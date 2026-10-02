<script setup lang="ts">
import { ref } from 'vue'
import { deletePayment, myId, nm, state } from '../store'
import { fmt } from '../lib/money'
import { errMsg, toast } from '../lib/util'
import type { Payment } from '../lib/types'

const props = defineProps<{ payment: Payment }>()
const emit = defineEmits<{ close: [] }>()
const p = props.payment
const canDelete = [p.from_member, p.to_member, p.created_by].includes(myId.value) || !!state.me?.is_admin
const [y, m, d] = p.date.split('-')
const err = ref('')
const busy = ref(false)

async function remove() {
  if (!confirm('Xóa lần thanh toán này? Khoản nợ sẽ quay lại như trước.')) return
  busy.value = true
  try {
    await deletePayment(p.id)
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
  <h3>{{ nm(p.from_member) }} đã trả {{ nm(p.to_member) }}</h3>
  <div class="paybox">
    <div class="big">{{ fmt(p.amount) }}</div>
    <div class="hint">Ngày {{ +d }}/{{ +m }}/{{ y }}<template v-if="p.created_by"> · ghi bởi {{ nm(p.created_by) }}</template></div>
  </div>
  <div class="err">{{ err }}</div>
  <div class="row">
    <button v-if="canDelete" class="danger" :disabled="busy" @click="remove">Xóa</button>
    <button @click="emit('close')">Đóng</button>
  </div>
</template>
