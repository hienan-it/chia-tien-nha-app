import { computed, reactive } from 'vue'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase, configured } from './lib/supabase'
import { computeDebts } from './lib/money'
import { errMsg } from './lib/util'
import type { EnterStatus, GroupPreview, Me, Member, Payment, Txn } from './lib/types'

export const state = reactive({
  ready: false,
  initError: '',
  me: null as Me | null,
  members: [] as Member[],
  txns: [] as Txn[],
  payments: [] as Payment[]
})

/* ---------- derived ---------- */
export const memberIds = computed(() => state.members.map((m) => m.id))
export const membersById = computed(() => Object.fromEntries(state.members.map((m) => [m.id, m])) as Record<string, Member>)
export const debts = computed(() => computeDebts(memberIds.value, state.txns, state.payments))
export const myId = computed(() => state.me?.member_id ?? '')
export const nm = (id: string) => membersById.value[id]?.name ?? 'Thành viên cũ'

/* ---------- boot ---------- */
async function ensureSession() {
  const { data } = await supabase.auth.getSession()
  if (data.session) return
  const { error } = await supabase.auth.signInAnonymously()
  if (error) throw error
}

async function loadMe() {
  const { data, error } = await supabase.rpc('me')
  if (error) throw error
  state.me = (data as Me | null) ?? null
}

export async function loadAll() {
  if (!state.me) return
  const [m, t, p] = await Promise.all([
    supabase.from('members').select('*').order('joined_at'),
    supabase.from('txns').select('*').order('date', { ascending: false }).order('created_at', { ascending: false }),
    supabase.from('payments').select('*').order('date', { ascending: false }).order('created_at', { ascending: false })
  ])
  if (m.error) throw m.error
  if (t.error) throw t.error
  if (p.error) throw p.error
  state.members = m.data as Member[]
  state.txns = (t.data as Txn[]).map((x) => ({ ...x, amount: Number(x.amount) }))
  state.payments = (p.data as Payment[]).map((x) => ({ ...x, amount: Number(x.amount) }))
}

let channel: RealtimeChannel | null = null
let refreshTimer: number | undefined

function subscribe() {
  if (channel || !state.me) return
  const gid = state.me.group_id
  const refresh = () => {
    clearTimeout(refreshTimer)
    refreshTimer = window.setTimeout(() => loadAll().catch(() => {}), 250)
  }
  let ch = supabase.channel('group-' + gid)
  for (const table of ['txns', 'payments', 'members']) {
    ch = ch
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table, filter: `group_id=eq.${gid}` }, refresh)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table, filter: `group_id=eq.${gid}` }, refresh)
      // DELETE không lọc được theo cột nên nghe tất cả rồi tải lại
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table }, refresh)
  }
  channel = ch.subscribe()
}

async function unsubscribe() {
  if (channel) await supabase.removeChannel(channel)
  channel = null
}

async function afterEnter() {
  await loadMe()
  await loadAll()
  subscribe()
}

export async function init() {
  try {
    if (!configured) throw new Error('Chưa cấu hình VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY trong file .env')
    await ensureSession()
    await loadMe()
    if (state.me) {
      await loadAll()
      subscribe()
    }
  } catch (e) {
    state.initError = errMsg(e)
  } finally {
    state.ready = true
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && state.me) loadAll().catch(() => {})
  })
}

/* ---------- onboarding ---------- */
export async function createGroup(groupName: string, name: string, pin: string) {
  const { error } = await supabase.rpc('create_group', { p_group_name: groupName, p_name: name, p_pin: pin })
  if (error) throw error
  await afterEnter()
}

export async function previewGroup(code: string): Promise<GroupPreview | null> {
  const { data, error } = await supabase.rpc('group_preview', { p_code: code })
  if (error) throw error
  return (data as GroupPreview | null) ?? null
}

export async function enterGroup(code: string, name: string, pin: string, create: boolean): Promise<EnterStatus> {
  const { data, error } = await supabase.rpc('enter_group', { p_code: code, p_name: name, p_pin: pin, p_create: create })
  if (error) throw error
  const r = data as EnterStatus
  if (r.status === 'ok') await afterEnter()
  return r
}

export async function logout() {
  const { error } = await supabase.rpc('leave_group')
  if (error) throw error
  await unsubscribe()
  state.me = null
  state.members = []
  state.txns = []
  state.payments = []
}

export async function changePin(oldPin: string, newPin: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('change_my_pin', { p_old: oldPin, p_new: newPin })
  if (error) throw error
  return (data as { status: string }).status === 'ok'
}

export async function resetPin(memberId: string, newPin: string) {
  const { error } = await supabase.rpc('reset_member_pin', { p_member_id: memberId, p_new_pin: newPin })
  if (error) throw error
}

/* ---------- data ---------- */
export async function saveProfile(patch: Pick<Member, 'name' | 'bank' | 'acc' | 'holder' | 'qr_data'>) {
  const { error } = await supabase.from('members').update(patch).eq('id', myId.value)
  if (error) throw error
  await loadAll()
}

type TxnInput = Pick<Txn, 'title' | 'amount' | 'payer' | 'split' | 'cat' | 'date'>

export async function addTxn(t: TxnInput) {
  const { error } = await supabase.from('txns').insert({ ...t, group_id: state.me!.group_id, created_by: myId.value })
  if (error) throw error
  await loadAll()
}

export async function updateTxn(id: string, t: TxnInput) {
  const { error } = await supabase.from('txns').update(t).eq('id', id)
  if (error) throw error
  await loadAll()
}

export async function deleteTxn(id: string) {
  const { error } = await supabase.from('txns').delete().eq('id', id)
  if (error) throw error
  await loadAll()
}

export async function addPayment(from: string, to: string, amount: number, date: string) {
  const { error } = await supabase.from('payments').insert({
    group_id: state.me!.group_id,
    from_member: from,
    to_member: to,
    amount,
    date,
    created_by: myId.value
  })
  if (error) throw error
  await loadAll()
}

export async function deletePayment(id: string) {
  const { error } = await supabase.from('payments').delete().eq('id', id)
  if (error) throw error
  await loadAll()
}
