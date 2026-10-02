<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { addTxn, deleteTxn, memberIds, myId, nm, updateTxn } from '../store'
import { CATS, catOf, fmt, formatInput, parseAmount, todayStr } from '../lib/money'
import { errMsg, toast } from '../lib/util'
import type { Txn } from '../lib/types'

const props = defineProps<{ txn: Txn | null }>()
const emit = defineEmits<{ close: [] }>()

const ids = memberIds.value
const t = props.txn
const amountText = ref(t ? formatInput(t.amount) : '')
const title = ref(t?.title ?? '')
const cat = ref<string>(t?.cat ?? 'food')
const payer = ref(t && ids.includes(t.payer) ? t.payer : myId.value)
const split = ref(new Set((t?.split ?? ids).filter((id) => ids.includes(id))))
const date = ref(t?.date ?? todayStr())
const err = ref('')
const busy = ref(false)
const amountEl = ref<HTMLInputElement | null>(null)

const amount = computed(() => parseAmount(amountText.value))
const valid = computed(() => Number.isFinite(amount.value) && amount.value > 0)

function toggle(id: string) {
  const s = new Set(split.value)
  if (s.has(id)) s.delete(id)
  else s.add(id)
  split.value = s
}

onMounted(() => {
  if (!t) setTimeout(() => amountEl.value?.focus(), 250)
})

async function save() {
  err.value = ''
  if (!valid.value) return (err.value = 'Nhập số tiền lớn hơn 0.')
  if (!split.value.size) return (err.value = 'Chọn ít nhất một người để chia.')
  const data = {
    title: title.value.trim() || catOf(cat.value).name,
    amount: amount.value,
    payer: payer.value,
    split: ids.filter((id) => split.value.has(id)),
    cat: cat.value,
    date: date.value || todayStr()
  }
  busy.value = true
  try {
    if (t) await updateTxn(t.id, data)
    else await addTxn(data)
    toast(t ? 'Đã lưu' : 'Đã thêm')
    emit('close')
  } catch (e) {
    err.value = errMsg(e)
  } finally {
    busy.value = false
  }
}

async function remove() {
  if (!t || !confirm(`Xóa "${t.title}"?`)) return
  busy.value = true
  try {
    await deleteTxn(t.id)
    toast('Đã xóa')
    emit('close')
  } catch (e) {
    err.value = errMsg(e)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <form @submit.prevent="save">
    <h3>{{ t ? 'Sửa khoản chi' : 'Thêm khoản chi' }}</h3>
    <label class="f" for="fAmt">Số tiền</label>
    <input id="fAmt" ref="amountEl" v-model="amountText" class="in big" inputmode="decimal" placeholder="0" autocomplete="off" />
    <div class="hint">{{ valid ? '= ' + fmt(amount) : 'Gõ nhanh: 150k, 3tr, 2.5tr' }}</div>

    <label class="f" for="fTitle">Nội dung</label>
    <input id="fTitle" v-model="title" class="in" maxlength="80" placeholder="VD: Đi chợ, tiền điện tháng 9" />

    <label class="f">Loại</label>
    <div class="chips">
      <button v-for="c in CATS" :key="c.id" type="button" class="chip" :aria-pressed="cat === c.id" @click="cat = c.id">{{ c.name }}</button>
    </div>

    <label class="f">Ai trả</label>
    <div class="chips">
      <button v-for="id in ids" :key="id" type="button" class="chip" :aria-pressed="payer === id" @click="payer = id">
        {{ nm(id) }}{{ id === myId ? ' (bạn)' : '' }}
      </button>
    </div>

    <label class="f">Chia cho</label>
    <div class="chips">
      <button v-for="id in ids" :key="id" type="button" class="chip" :aria-pressed="split.has(id)" @click="toggle(id)">{{ nm(id) }}</button>
    </div>
    <div class="hint">{{ valid && split.size ? `Mỗi người ${fmt(amount / split.size)}` : '' }}</div>

    <label class="f" for="fDate">Ngày</label>
    <input id="fDate" v-model="date" class="in" type="date" />

    <div class="err">{{ err }}</div>
    <div class="row">
      <button v-if="t" type="button" class="danger" :disabled="busy" @click="remove">Xóa</button>
      <button type="button" @click="emit('close')">Hủy</button>
      <button type="submit" class="primary" :disabled="busy">{{ t ? 'Lưu' : 'Thêm' }}</button>
    </div>
  </form>
</template>
