<script setup lang="ts">
import { computed, ref } from 'vue'
import { addPayment, debts, myId, nm } from '../store'
import { fmt, formatInput, parseAmount, todayStr } from '../lib/money'
import { copyText, errMsg, toast } from '../lib/util'
import BankCard from './BankCard.vue'

const props = defineProps<{ from: string; to: string }>()
const emit = defineEmits<{ close: [] }>()

// chốt số nợ lúc mở để tránh nhảy số khi người khác vừa cập nhật
const total = debts.value.find((d) => d.from === props.from && d.to === props.to)?.amount ?? 0
const iPay = props.from === myId.value
const iReceive = props.to === myId.value
const title = iPay ? `Trả ${nm(props.to)}` : iReceive ? `${nm(props.from)} trả bạn` : `${nm(props.from)} trả ${nm(props.to)}`
const action = iPay ? 'Ghi nhận đã trả' : iReceive ? 'Xác nhận đã nhận' : 'Ghi nhận thanh toán'

const amountText = ref(formatInput(total))
const amount = computed(() => parseAmount(amountText.value))
const err = ref('')
const busy = ref(false)

const quick = [
  { label: 'Trả hết', ratio: 1 },
  { label: 'Một nửa', ratio: 0.5 }
]
const quickValue = (r: number) => (r === 1 ? total : Math.min(total, Math.round((total * r) / 1000) * 1000 || Math.round(total * r)))
const pick = (r: number) => (amountText.value = formatInput(quickValue(r)))
const quickActive = (r: number) => amount.value === quickValue(r)
const hint = computed(() => {
  const a = amount.value
  if (!Number.isFinite(a) || a <= 0) return ''
  if (a < total) return `Trả một phần. Còn lại ${fmt(total - a)}`
  if (a === total) return 'Trả hết khoản nợ'
  return ''
})

async function submit() {
  err.value = ''
  const a = amount.value
  if (!Number.isFinite(a) || a <= 0) return (err.value = 'Nhập số tiền lớn hơn 0.')
  if (a > total) return (err.value = `Số tiền vượt quá khoản nợ (${fmt(total)}).`)
  busy.value = true
  try {
    await addPayment(props.from, props.to, a, todayStr())
    toast(a < total ? `Đã ghi nhận ${fmt(a)}, còn ${fmt(total - a)}` : 'Đã trả hết')
    emit('close')
  } catch (e) {
    err.value = errMsg(e)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <form @submit.prevent="submit">
    <h3>{{ title }}</h3>
    <template v-if="total > 0">
      <div class="owed"><span>Đang nợ</span><b>{{ fmt(total) }}</b></div>
      <BankCard v-if="!iReceive" :member-id="to" />

      <label class="f" for="pAmt">Số tiền trả lần này</label>
      <input id="pAmt" v-model="amountText" class="in big" inputmode="decimal" autocomplete="off" />
      <div class="chips" style="margin-top: 10px">
        <button v-for="q in quick" :key="q.ratio" type="button" class="chip" :aria-pressed="quickActive(q.ratio)" @click="pick(q.ratio)">{{ q.label }}</button>
        <button v-if="!iReceive" type="button" class="chip" @click="Number.isFinite(amount) && copyText(String(amount), 'số tiền')">Chép số tiền</button>
      </div>
      <div class="hint">{{ hint }}</div>
      <div class="err">{{ err }}</div>
      <div class="row">
        <button type="button" @click="emit('close')">Đóng</button>
        <button type="submit" class="primary" :disabled="busy">{{ action }}</button>
      </div>
    </template>
    <template v-else>
      <p class="none">Khoản nợ này đã được thanh toán.</p>
      <div class="row"><button type="button" @click="emit('close')">Đóng</button></div>
    </template>
  </form>
</template>
