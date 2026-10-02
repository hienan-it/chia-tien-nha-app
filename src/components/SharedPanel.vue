<script setup lang="ts">
import { computed, ref } from 'vue'
import { debts, myId, nm, state } from '../store'
import { CATS, fmt, netOf, todayStr } from '../lib/money'
import { initial } from '../lib/util'
import type { Payment, Txn } from '../lib/types'
import TxnItem from './TxnItem.vue'

defineEmits<{ debt: [from: string, to: string]; txn: [txn: Txn]; member: [id: string]; record: [p: Payment] }>()

const month = ref(todayStr().slice(0, 7))
const monthLabel = computed(() => {
  const [y, m] = month.value.split('-')
  return `Tháng ${+m}/${y}`
})
function shift(delta: number) {
  const [y, m] = month.value.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  month.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const people = computed(() =>
  state.members.map((m) => {
    const v = netOf(m.id, debts.value)
    const paid = state.txns.filter((t) => t.payer === m.id).reduce((s, t) => s + t.amount, 0)
    const cls = Math.abs(v) < 500 ? 'zero' : v > 0 ? 'pos' : 'neg'
    return { m, v, paid, cls }
  })
)

const ex = computed(() => state.txns.filter((t) => t.date.slice(0, 7) === month.value))
const pays = computed(() => state.payments.filter((p) => p.date.slice(0, 7) === month.value))
const total = computed(() => ex.value.reduce((s, t) => s + t.amount, 0))
const byCat = computed(() => {
  const r: Record<string, number> = {}
  ex.value.forEach((t) => (r[t.cat] = (r[t.cat] || 0) + t.amount))
  return CATS.filter((c) => r[c.id]).map((c) => ({ ...c, sum: r[c.id] }))
})

type Row = { kind: 't'; t: Txn; date: string; at: string } | { kind: 'p'; p: Payment; date: string; at: string }
const days = computed(() => {
  const rows: Row[] = [
    ...ex.value.map((t) => ({ kind: 't' as const, t, date: t.date, at: t.created_at })),
    ...pays.value.map((p) => ({ kind: 'p' as const, p, date: p.date, at: p.created_at }))
  ].sort((a, b) => b.date.localeCompare(a.date) || b.at.localeCompare(a.at))
  const groups: { date: string; rows: Row[] }[] = []
  for (const r of rows) {
    const last = groups[groups.length - 1]
    if (last && last.date === r.date) last.rows.push(r)
    else groups.push({ date: r.date, rows: [r] })
  }
  return groups
})
const dm = (d: string) => {
  const [, m, day] = d.split('-')
  return `${+day}/${+m}`
}
</script>

<template>
  <div class="card">
    <h2>Mọi người</h2>
    <button v-for="p in people" :key="p.m.id" class="person" @click="$emit('member', p.m.id)">
      <span class="avatar">{{ initial(p.m.name) }}</span>
      <span>
        <div class="pname">{{ p.m.name }}{{ p.m.id === myId ? ' (bạn)' : '' }}</div>
        <div class="psub">Đã chi {{ fmt(p.paid) }}</div>
        <div v-if="p.m.acc" class="psub bank">{{ p.m.bank || 'Ngân hàng' }} · {{ p.m.acc }}</div>
        <div v-else-if="p.m.qr_data" class="psub bank">Có mã QR</div>
        <div v-else class="psub">Chưa thêm tài khoản</div>
      </span>
      <span class="bal" :class="p.cls">
        {{ p.cls === 'zero' ? 'Hòa' : (p.v > 0 ? '+' : '−') + fmt(Math.abs(p.v)) }}
        <small>{{ p.cls === 'zero' ? 'không nợ ai' : p.v > 0 ? 'được nhận lại' : 'đang nợ' }}</small>
      </span>
    </button>
  </div>

  <div class="card">
    <h2>Ai nợ ai</h2>
    <button v-for="d in debts" :key="d.from + d.to" class="debt" @click="$emit('debt', d.from, d.to)">
      <span class="who"><b>{{ nm(d.from) }}</b> nợ <b>{{ nm(d.to) }}</b></span>
      <span class="amt">{{ fmt(d.amount) }}</span>
    </button>
    <p v-if="!debts.length" class="none">Mọi người đã sòng phẳng.</p>
  </div>

  <div class="monthbar">
    <button aria-label="Tháng trước" @click="shift(-1)">‹</button>
    <span class="m">{{ monthLabel }}</span>
    <button aria-label="Tháng sau" @click="shift(1)">›</button>
  </div>
  <template v-if="total">
    <div class="total">Tổng chi {{ fmt(total) }} · trung bình {{ fmt(total / (state.members.length || 1)) }}/người</div>
    <div class="bars">
      <div v-for="c in byCat" :key="c.id" :style="{ width: (c.sum / total) * 100 + '%', background: c.color }"></div>
    </div>
    <div class="legend">
      <span v-for="c in byCat" :key="c.id" :style="{ '--c': c.color }">{{ c.name }} {{ fmt(c.sum) }}</span>
    </div>
  </template>

  <template v-for="g in days" :key="g.date">
    <div class="dayhead">{{ dm(g.date) }}</div>
    <template v-for="r in g.rows" :key="r.kind === 't' ? r.t.id : r.p.id">
      <TxnItem v-if="r.kind === 't'" :txn="r.t" @open="$emit('txn', r.t)" />
      <button v-else class="item settle" style="--c: transparent" @click="$emit('record', r.p)">
        <span class="stripe"></span>
        <span><div class="t">{{ nm(r.p.from_member) }} đã trả {{ nm(r.p.to_member) }}</div><div class="d">Thanh toán nợ</div></span>
        <span class="a">{{ fmt(r.p.amount) }}</span>
      </button>
    </template>
  </template>
  <div v-if="!days.length" class="empty">Chưa có khoản chi nào trong tháng này.</div>
</template>
