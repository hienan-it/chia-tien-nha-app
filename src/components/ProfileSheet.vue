<script setup lang="ts">
import { computed, ref } from 'vue'
import { changePin, logout, membersById, myId, saveProfile, state } from '../store'
import { compressImage, safeImage } from '../lib/image'
import { copyText, errMsg, isPin, toast } from '../lib/util'

const emit = defineEmits<{ close: [] }>()
const me = membersById.value[myId.value]

const name = ref(me?.name ?? '')
const bank = ref(me?.bank ?? '')
const acc = ref(me?.acc ?? '')
const holder = ref(me?.holder ?? '')
const qr = ref(safeImage(me?.qr_data ?? ''))
const err = ref('')
const busy = ref(false)

const inviteCode = state.me?.invite_code ?? ''
const inviteLink = computed(() => `${window.location.origin}/?code=${inviteCode}`)
const canShare = typeof navigator.share === 'function'

async function onFile(ev: Event) {
  const f = (ev.target as HTMLInputElement).files?.[0]
  if (!f) return
  err.value = ''
  try {
    qr.value = await compressImage(f)
  } catch (e) {
    err.value = (e as Error).message + '. Thử cắt sát phần mã QR rồi chọn lại.'
  }
}

async function save() {
  err.value = ''
  const n = name.value.trim()
  if (!n) return (err.value = 'Tên không được để trống.')
  if (state.members.some((m) => m.id !== myId.value && m.name.toLowerCase() === n.toLowerCase()))
    return (err.value = 'Tên này đã có người dùng.')
  busy.value = true
  try {
    await saveProfile({
      name: n,
      bank: bank.value.trim(),
      acc: acc.value.replace(/\s/g, ''),
      holder: holder.value.trim().toUpperCase(),
      qr_data: qr.value
    })
    toast('Đã lưu thông tin')
    emit('close')
  } catch (e) {
    err.value = errMsg(e)
  } finally {
    busy.value = false
  }
}

async function share() {
  try {
    await navigator.share({
      title: 'Tham gia nhóm ' + (state.me?.group_name ?? ''),
      text: `Vào nhóm "${state.me?.group_name}" trên Chia tiền nhà. Mã nhóm: ${inviteCode}`,
      url: inviteLink.value
    })
  } catch {
    /* người dùng hủy */
  }
}

/* đổi PIN */
const showPin = ref(false)
const oldPin = ref('')
const newPin = ref('')
const pinErr = ref('')
const digits = (v: string) => v.replace(/\D/g, '').slice(0, 4)
async function doChangePin() {
  pinErr.value = ''
  if (!isPin(oldPin.value) || !isPin(newPin.value)) return (pinErr.value = 'PIN phải gồm đúng 4 chữ số.')
  busy.value = true
  try {
    const ok = await changePin(oldPin.value, newPin.value)
    if (!ok) {
      pinErr.value = 'PIN hiện tại không đúng.'
      return
    }
    toast('Đã đổi PIN')
    showPin.value = false
    oldPin.value = newPin.value = ''
  } catch (e) {
    pinErr.value = errMsg(e)
  } finally {
    busy.value = false
  }
}

async function doLogout() {
  if (!confirm('Đăng xuất khỏi máy này? Lần sau bạn cần nhập lại mã nhóm, tên và PIN.')) return
  try {
    emit('close')
    await logout()
  } catch (e) {
    toast(errMsg(e))
  }
}
</script>

<template>
  <form @submit.prevent="save">
    <h3>Thông tin của bạn</h3>
    <label class="f" for="mName">Tên hiển thị</label>
    <input id="mName" v-model="name" class="in" maxlength="30" />
    <label class="f" for="mBank">Ngân hàng</label>
    <input id="mBank" v-model="bank" class="in" maxlength="60" placeholder="VD: Vietcombank, MB, Techcombank" />
    <label class="f" for="mAcc">Số tài khoản</label>
    <input id="mAcc" v-model="acc" class="in" inputmode="numeric" maxlength="30" placeholder="VD: 0123456789" />
    <label class="f" for="mHolder">Tên chủ tài khoản</label>
    <input id="mHolder" v-model="holder" class="in" maxlength="60" placeholder="VD: NGUYEN VAN A" />
    <label class="f">Ảnh mã QR</label>
    <div class="qrprev">
      <img v-if="qr" :src="qr" alt="Mã QR của bạn" />
      <span class="filebtn ghost">{{ qr ? 'Đổi ảnh' : 'Chọn ảnh QR' }}<input type="file" accept="image/*" @change="onFile" /></span>
      <button v-if="qr" type="button" class="ghost" @click="qr = ''">Xóa ảnh</button>
    </div>
    <div class="note">Mọi người trong nhóm xem được số tài khoản và mã QR này. Chỉ bạn sửa được.</div>
    <div class="err">{{ err }}</div>
    <div class="row">
      <button type="button" @click="emit('close')">Hủy</button>
      <button type="submit" class="primary" :disabled="busy">Lưu</button>
    </div>
  </form>

  <hr class="section-sep" />
  <h3>Mời bạn cùng nhà</h3>
  <div class="paybox">
    <div class="hint" style="margin: 0">Mã nhóm</div>
    <div class="code">{{ inviteCode }}</div>
  </div>
  <div class="row" style="margin-top: 10px">
    <button type="button" @click="copyText(inviteLink, 'link mời')">Chép link mời</button>
    <button v-if="canShare" type="button" class="primary" @click="share">Gửi link</button>
  </div>

  <hr class="section-sep" />
  <button v-if="!showPin" class="link" @click="showPin = true">Đổi PIN</button>
  <form v-else @submit.prevent="doChangePin">
    <label class="f" for="oPin">PIN hiện tại</label>
    <input id="oPin" v-model="oldPin" class="in pin" type="password" inputmode="numeric" maxlength="4" autocomplete="current-password" @input="oldPin = digits(oldPin)" />
    <label class="f" for="nPin">PIN mới</label>
    <input id="nPin" v-model="newPin" class="in pin" type="password" inputmode="numeric" maxlength="4" autocomplete="new-password" @input="newPin = digits(newPin)" />
    <div class="err">{{ pinErr }}</div>
    <div class="row">
      <button type="button" @click="showPin = false">Hủy</button>
      <button type="submit" class="primary" :disabled="busy">Đổi PIN</button>
    </div>
  </form>
  <div><button class="link" style="color: var(--neg)" @click="doLogout">Đăng xuất khỏi máy này</button></div>
</template>
