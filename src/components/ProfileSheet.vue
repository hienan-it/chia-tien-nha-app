<script setup lang="ts">
import { computed, ref } from 'vue'
import { logout, membersById, myId, saveProfile, state } from '../store'
import { compressImage, safeImage } from '../lib/image'
import { copyText, errMsg, toast } from '../lib/util'
import { installState, promptInstall } from '../lib/install'

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

async function doLogout() {
  if (!confirm('Đăng xuất tài khoản khỏi máy này?')) return
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
    <p class="hint" style="margin-top: -8px">Tên, STK và QR riêng cho nhóm {{ state.me?.group_name }}.</p>
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

  <template v-if="!installState.installed && (installState.canPrompt || installState.ios)">
    <hr class="section-sep" />
    <h3>Cài app</h3>
    <button v-if="installState.canPrompt" type="button" class="btn secondary" style="margin-top: 0" @click="promptInstall">Cài app lên màn hình chính</button>
    <p v-else class="hint">Trong Safari, bấm nút <b>Chia sẻ</b> rồi chọn <b>Thêm vào MH chính</b>.</p>
  </template>

  <hr class="section-sep" />
  <p class="hint">Tài khoản: {{ state.user?.email }}</p>
  <div><button class="link" style="color: var(--neg)" @click="doLogout">Đăng xuất</button></div>
</template>
