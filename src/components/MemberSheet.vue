<script setup lang="ts">
import { ref } from 'vue'
import { membersById, nm, resetPin, state } from '../store'
import { errMsg, isPin, toast } from '../lib/util'
import BankCard from './BankCard.vue'

const props = defineProps<{ id: string }>()
const emit = defineEmits<{ close: [] }>()
// chỉ thành viên cũ chưa gắn tài khoản mới cần PIN
const canReset = !!state.me?.is_admin && !membersById.value[props.id]?.user_id
const showReset = ref(false)
const pin = ref('')
const err = ref('')
const busy = ref(false)

async function doReset() {
  err.value = ''
  if (!isPin(pin.value)) return (err.value = 'PIN phải gồm đúng 4 chữ số.')
  busy.value = true
  try {
    await resetPin(props.id, pin.value)
    toast(`Đã đặt lại PIN cho ${nm(props.id)}`)
    emit('close')
  } catch (e) {
    err.value = errMsg(e)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <h3>{{ nm(id) }}</h3>
  <BankCard :member-id="id" />
  <template v-if="canReset">
    <button v-if="!showReset" class="link" @click="showReset = true">Đặt lại PIN cho {{ nm(id) }}</button>
    <p v-if="!showReset" class="hint">{{ nm(id) }} chưa gắn tài khoản. Họ cần PIN này để nhận lại tên khi vào nhóm bằng tài khoản.</p>
    <form v-else @submit.prevent="doReset">
      <label class="f" for="rPin">PIN mới (báo lại cho {{ nm(id) }})</label>
      <input id="rPin" v-model="pin" class="in pin" type="text" inputmode="numeric" maxlength="4" autocomplete="off" @input="pin = pin.replace(/\D/g, '').slice(0, 4)" />
      <div class="err">{{ err }}</div>
      <div class="row">
        <button type="button" @click="showReset = false">Hủy</button>
        <button type="submit" class="primary" :disabled="busy">Đặt lại PIN</button>
      </div>
    </form>
  </template>
  <div v-if="!showReset" class="row"><button @click="emit('close')">Đóng</button></div>
</template>
