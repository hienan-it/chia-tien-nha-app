<script setup lang="ts">
import { computed } from 'vue'
import { debts, membersById, myId, nm, state } from '../store'
import { fmt, netOf, todayStr } from '../lib/money'
import { initial } from '../lib/util'
import type { Txn } from '../lib/types'
import TxnItem from './TxnItem.vue'

defineEmits<{ debt: [from: string, to: string]; txn: [txn: Txn]; addAccount: [] }>()

const net = computed(() => netOf(myId.value, debts.value))
const cls = computed(() => (Math.abs(net.value) < 500 ? 'zero' : net.value > 0 ? 'pos' : 'neg'))
const iOwe = computed(() => debts.value.filter((d) => d.from === myId.value))
const owesMe = computed(() => debts.value.filter((d) => d.to === myId.value))
const mine = computed(() =>
  state.txns.filter((t) => t.payer === myId.value || t.split.includes(myId.value)).slice(0, 8)
)
const monthShare = computed(() => {
  const m = todayStr().slice(0, 7)
  return state.txns
    .filter((t) => t.date.slice(0, 7) === m && t.split.includes(myId.value))
    .reduce((s, t) => s + t.amount / t.split.length, 0)
})
const noAccount = computed(() => {
  const me = membersById.value[myId.value]
  return !!me && !me.acc && !me.qr_data
})
</script>

<template>
  <div class="card hero">
    <div class="lbl">{{ cls === 'zero' ? 'Bạn đang' : cls === 'pos' ? 'Tổng cộng bạn được nhận lại' : 'Tổng cộng bạn đang nợ' }}</div>
    <div class="num" :class="cls">{{ cls === 'zero' ? 'Sòng phẳng' : fmt(Math.abs(net)) }}</div>
    <div class="sub">Phần của bạn tháng này: {{ fmt(monthShare) }}</div>
  </div>

  <button v-if="noAccount" class="card note" style="width: 100%; text-align: left; border: none; margin-top: 0" @click="$emit('addAccount')">
    Bạn chưa thêm số tài khoản hay mã QR. Chạm để thêm, mọi người sẽ chuyển tiền cho bạn dễ hơn.
  </button>

  <div class="card">
    <h2>Bạn nợ</h2>
    <button v-for="d in iOwe" :key="d.to" class="debt" @click="$emit('debt', d.from, d.to)">
      <span class="avatar">{{ initial(nm(d.to)) }}</span>
      <span class="who"><b>{{ nm(d.to) }}</b><small>Chạm để xem STK, QR và trả</small></span>
      <span class="amt neg">{{ fmt(d.amount) }}</span>
    </button>
    <p v-if="!iOwe.length" class="none">Bạn không nợ ai.</p>
  </div>

  <div class="card">
    <h2>Nợ bạn</h2>
    <button v-for="d in owesMe" :key="d.from" class="debt" @click="$emit('debt', d.from, d.to)">
      <span class="avatar">{{ initial(nm(d.from)) }}</span>
      <span class="who"><b>{{ nm(d.from) }}</b><small>Chạm khi đã nhận tiền</small></span>
      <span class="amt pos">{{ fmt(d.amount) }}</span>
    </button>
    <p v-if="!owesMe.length" class="none">Không ai nợ bạn.</p>
  </div>

  <div class="card">
    <h2>Khoản gần đây của bạn</h2>
    <TxnItem v-for="t in mine" :key="t.id" :txn="t" mine @open="$emit('txn', t)" />
    <p v-if="!mine.length" class="none">Chưa có khoản chi nào liên quan đến bạn.</p>
  </div>
</template>
