import { computed, reactive } from 'vue'
import type { RealtimeChannel, User } from '@supabase/supabase-js'
import { supabase, configured, isRecoveryLink } from './lib/supabase'
import { computeDebts } from './lib/money'
import { errMsg } from './lib/util'
import type { Account, GroupPreview, JoinStatus, Me, Member, Payment, Txn } from './lib/types'

export const state = reactive({
  ready: false,
  initError: '',
  user: null as Account | null,
  // vừa bấm link đặt lại mật khẩu trong email
  recovery: isRecoveryLink,
  groups: [] as Me[],
  // nhóm đang xem
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

/* ---------- nhóm đang xem (nhớ trên máy) ---------- */
const ACTIVE_KEY = 'active-group'
function savedGroup() {
  try {
    return localStorage.getItem(ACTIVE_KEY)
  } catch {
    return null
  }
}
function saveGroup(gid: string) {
  try {
    localStorage.setItem(ACTIVE_KEY, gid)
  } catch {}
}

/* ---------- load ---------- */
export async function loadAll() {
  if (!state.me) return
  const gid = state.me.group_id
  const [m, t, p] = await Promise.all([
    supabase.from('members').select('*').eq('group_id', gid).order('joined_at'),
    supabase.from('txns').select('*').eq('group_id', gid).order('date', { ascending: false }).order('created_at', { ascending: false }),
    supabase.from('payments').select('*').eq('group_id', gid).order('date', { ascending: false }).order('created_at', { ascending: false })
  ])
  if (m.error) throw m.error
  if (t.error) throw t.error
  if (p.error) throw p.error
  // đã đổi sang nhóm khác trong lúc chờ
  if (state.me?.group_id !== gid) return
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

function clearGroup() {
  state.me = null
  state.members = []
  state.txns = []
  state.payments = []
}

export async function loadGroups() {
  const { data, error } = await supabase.rpc('my_groups')
  if (error) throw error
  state.groups = (data as Me[] | null) ?? []
}

export async function selectGroup(gid: string) {
  const g = state.groups.find((x) => x.group_id === gid)
  if (!g) return
  await unsubscribe()
  clearGroup()
  state.me = g
  saveGroup(gid)
  await loadAll()
  subscribe()
}

/* ---------- boot ---------- */
function setUser(u: User | null) {
  state.user = u ? { id: u.id, email: u.email ?? '', name: (u.user_metadata?.name as string | undefined) ?? '' } : null
}

async function afterLogin(u: User) {
  setUser(u)
  await loadGroups()
  const first = state.groups.find((g) => g.group_id === savedGroup()) ?? state.groups[0]
  if (first) await selectGroup(first.group_id)
}

export async function init() {
  try {
    if (!configured) throw new Error('Chưa cấu hình VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY trong file .env')
    supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') state.recovery = true
    })
    const { data } = await supabase.auth.getSession()
    const u = data.session?.user
    // phiên ẩn danh của bản cũ: bỏ, bắt đăng nhập bằng tài khoản
    if (u?.is_anonymous) await supabase.auth.signOut()
    else if (u) await afterLogin(u)
  } catch (e) {
    state.initError = errMsg(e)
  } finally {
    state.ready = true
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && state.me) loadAll().catch(() => {})
  })
}

/* ---------- tài khoản ---------- */
export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  await afterLogin(data.user)
}

/** false = cần xác nhận email trước khi đăng nhập */
export async function signUp(email: string, password: string, name: string): Promise<boolean> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name }, emailRedirectTo: window.location.origin + window.location.search }
  })
  if (error) throw error
  if (!data.session || !data.user) return false
  await afterLogin(data.user)
  return true
}

export async function sendPasswordReset(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin })
  if (error) throw error
}

export async function setNewPassword(password: string) {
  const { data, error } = await supabase.auth.updateUser({ password })
  if (error) throw error
  state.recovery = false
  await afterLogin(data.user)
}

export async function logout() {
  await unsubscribe()
  const { error } = await supabase.auth.signOut()
  if (error) throw error
  clearGroup()
  state.groups = []
  state.user = null
}

/* ---------- nhóm ---------- */
export async function createGroup(groupName: string, name: string) {
  const { data, error } = await supabase.rpc('create_group', { p_group_name: groupName, p_name: name })
  if (error) throw error
  await loadGroups()
  await selectGroup(data as string)
}

export async function previewGroup(code: string): Promise<GroupPreview | null> {
  const { data, error } = await supabase.rpc('group_preview', { p_code: code })
  if (error) throw error
  return (data as GroupPreview | null) ?? null
}

export async function joinGroup(code: string, name: string, pin?: string): Promise<JoinStatus> {
  const { data, error } = await supabase.rpc('join_group', { p_code: code, p_name: name, p_pin: pin ?? null })
  if (error) throw error
  const r = data as JoinStatus
  if (r.status === 'ok') {
    await loadGroups()
    await selectGroup(r.group_id)
  }
  return r
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
