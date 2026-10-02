<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { membersById, myId, state } from '../store'
import { initial } from '../lib/util'
import type { Payment, Txn } from '../lib/types'
import Sheet from './Sheet.vue'
import MinePanel from './MinePanel.vue'
import SharedPanel from './SharedPanel.vue'
import ExpenseSheet from './ExpenseSheet.vue'
import PaymentSheet from './PaymentSheet.vue'
import ProfileSheet from './ProfileSheet.vue'
import MemberSheet from './MemberSheet.vue'
import PaymentRecordSheet from './PaymentRecordSheet.vue'
import InstallBanner from './InstallBanner.vue'

type SheetState =
  | { type: 'expense'; txn: Txn | null }
  | { type: 'pay'; from: string; to: string }
  | { type: 'profile' }
  | { type: 'member'; id: string }
  | { type: 'record'; payment: Payment }

const open = ref(false)
const content = ref<SheetState | null>(null)
const sheetKey = ref(0)
function show(s: SheetState) {
  content.value = s
  sheetKey.value++
  open.value = true
}
const close = () => (open.value = false)

const me = computed(() => membersById.value[myId.value])

/* tabs + vuốt */
const tab = ref(0)
const pager = ref<HTMLElement | null>(null)
function setTab(i: number) {
  tab.value = i
  pager.value?.scrollTo({ left: i * pager.value.clientWidth, behavior: 'smooth' })
}
let scrollTimer: number | undefined
function onScroll() {
  clearTimeout(scrollTimer)
  scrollTimer = window.setTimeout(() => {
    const p = pager.value
    if (p) tab.value = Math.round(p.scrollLeft / p.clientWidth)
  }, 80)
}
function onResize() {
  const p = pager.value
  if (p) p.scrollLeft = tab.value * p.clientWidth
}
onMounted(() => {
  window.addEventListener('resize', onResize)
  nextTick(onResize)
})
onBeforeUnmount(() => window.removeEventListener('resize', onResize))

const openMember = (id: string) => (id === myId.value ? show({ type: 'profile' }) : show({ type: 'member', id }))
</script>

<template>
  <div class="wrap">
    <header class="top">
      <h1>{{ state.me?.group_name }}</h1>
      <button class="me-chip" aria-label="Thông tin của tôi" @click="show({ type: 'profile' })">
        <span class="avatar">{{ initial(me?.name) }}</span>{{ me?.name }}
      </button>
    </header>
    <InstallBanner />

    <div class="tabs" role="tablist">
      <button role="tab" :aria-selected="tab === 0" @click="setTab(0)">Của tôi</button>
      <button role="tab" :aria-selected="tab === 1" @click="setTab(1)">Chung</button>
    </div>

    <div ref="pager" class="pager" @scroll.passive="onScroll">
      <section class="panel" aria-label="Của tôi">
        <MinePanel
          @debt="(from, to) => show({ type: 'pay', from, to })"
          @txn="(txn) => show({ type: 'expense', txn })"
          @add-account="show({ type: 'profile' })"
        />
      </section>
      <section class="panel" aria-label="Chung">
        <SharedPanel
          @debt="(from, to) => show({ type: 'pay', from, to })"
          @txn="(txn) => show({ type: 'expense', txn })"
          @member="openMember"
          @record="(payment) => show({ type: 'record', payment })"
        />
      </section>
    </div>
  </div>

  <div class="fab"><button @click="show({ type: 'expense', txn: null })">+ Thêm khoản chi</button></div>

  <Sheet :open="open" @close="close">
    <template v-if="content">
      <ExpenseSheet v-if="content.type === 'expense'" :key="sheetKey" :txn="content.txn" @close="close" />
      <PaymentSheet v-else-if="content.type === 'pay'" :key="sheetKey" :from="content.from" :to="content.to" @close="close" />
      <ProfileSheet v-else-if="content.type === 'profile'" :key="sheetKey" @close="close" />
      <MemberSheet v-else-if="content.type === 'member'" :key="sheetKey" :id="content.id" @close="close" />
      <PaymentRecordSheet v-else-if="content.type === 'record'" :key="sheetKey" :payment="content.payment" @close="close" />
    </template>
  </Sheet>
</template>
