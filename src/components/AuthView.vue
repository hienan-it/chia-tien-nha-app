<script setup lang="ts">
import { ref } from 'vue'
import { sendPasswordReset, setNewPassword, signIn, signUp, state } from '../store'
import { errMsg } from '../lib/util'
import InstallBanner from './InstallBanner.vue'

type Mode = 'login' | 'register' | 'forgot'
const mode = ref<Mode>(new URLSearchParams(window.location.search).get('code') ? 'register' : 'login')
const busy = ref(false)
const err = ref('')
const info = ref('')

const name = ref('')
const email = ref('')
const password = ref('')

function go(m: Mode) {
  err.value = ''
  info.value = ''
  mode.value = m
}

async function run(fn: () => Promise<void>) {
  err.value = ''
  info.value = ''
  busy.value = true
  try {
    await fn()
  } catch (e) {
    err.value = errMsg(e)
  } finally {
    busy.value = false
  }
}

const cleanEmail = () => email.value.trim().toLowerCase()

function doLogin() {
  if (!cleanEmail() || !password.value) return (err.value = 'Nhập email và mật khẩu.')
  run(() => signIn(cleanEmail(), password.value))
}

function doRegister() {
  if (!name.value.trim()) return (err.value = 'Nhập tên của bạn.')
  if (!cleanEmail()) return (err.value = 'Nhập email.')
  if (password.value.length < 6) return (err.value = 'Mật khẩu cần ít nhất 6 ký tự.')
  run(async () => {
    const ok = await signUp(cleanEmail(), password.value, name.value.trim())
    if (!ok) {
      info.value = `Đã gửi email xác nhận tới ${cleanEmail()}. Mở hộp thư, bấm link xác nhận rồi quay lại đăng nhập.`
      mode.value = 'login'
    }
  })
}

function doForgot() {
  if (!cleanEmail()) return (err.value = 'Nhập email của tài khoản.')
  run(async () => {
    await sendPasswordReset(cleanEmail())
    info.value = `Nếu ${cleanEmail()} có tài khoản, bạn sẽ nhận được email để đặt lại mật khẩu.`
  })
}

function doNewPassword() {
  if (password.value.length < 6) return (err.value = 'Mật khẩu cần ít nhất 6 ký tự.')
  run(() => setNewPassword(password.value))
}
</script>

<template>
  <div class="wrap">
    <InstallBanner />
    <div class="onboard">
      <div class="brand"><img src="/favicon.svg" alt="" />Chia tiền nhà</div>

      <form v-if="state.recovery" @submit.prevent="doNewPassword">
        <h2>Đặt mật khẩu mới</h2>
        <label class="f" for="aNewPw">Mật khẩu mới</label>
        <input id="aNewPw" v-model="password" class="in" type="password" autocomplete="new-password" minlength="6" />
        <div class="err">{{ err }}</div>
        <button class="btn" type="submit" :disabled="busy">{{ busy ? 'Đang lưu…' : 'Lưu và đăng nhập' }}</button>
      </form>

      <template v-else>
        <div v-if="mode !== 'forgot'" class="tabs" role="tablist" style="margin-bottom: 4px">
          <button role="tab" type="button" :aria-selected="mode === 'login'" @click="go('login')">Đăng nhập</button>
          <button role="tab" type="button" :aria-selected="mode === 'register'" @click="go('register')">Tạo tài khoản</button>
        </div>
        <div v-if="info" class="note">{{ info }}</div>

        <form v-if="mode === 'login'" @submit.prevent="doLogin">
          <label class="f" for="aEmail">Email</label>
          <input id="aEmail" v-model="email" class="in" type="email" autocomplete="email" inputmode="email" />
          <label class="f" for="aPw">Mật khẩu</label>
          <input id="aPw" v-model="password" class="in" type="password" autocomplete="current-password" />
          <div class="err">{{ err }}</div>
          <button class="btn" type="submit" :disabled="busy">{{ busy ? 'Đang đăng nhập…' : 'Đăng nhập' }}</button>
          <button class="link" type="button" @click="go('forgot')">Quên mật khẩu?</button>
        </form>

        <form v-else-if="mode === 'register'" @submit.prevent="doRegister">
          <label class="f" for="rName">Tên của bạn</label>
          <input id="rName" v-model="name" class="in" maxlength="30" placeholder="Tên hiển thị trong nhóm" autocomplete="nickname" />
          <label class="f" for="rEmail">Email</label>
          <input id="rEmail" v-model="email" class="in" type="email" autocomplete="email" inputmode="email" />
          <label class="f" for="rPw">Mật khẩu</label>
          <input id="rPw" v-model="password" class="in" type="password" autocomplete="new-password" minlength="6" />
          <p class="hint">Ít nhất 6 ký tự. Dùng email và mật khẩu này để đăng nhập trên mọi máy.</p>
          <div class="err">{{ err }}</div>
          <button class="btn" type="submit" :disabled="busy">{{ busy ? 'Đang tạo…' : 'Tạo tài khoản' }}</button>
        </form>

        <form v-else @submit.prevent="doForgot">
          <h2>Quên mật khẩu</h2>
          <p>Nhập email, chúng tôi sẽ gửi link để đặt mật khẩu mới.</p>
          <label class="f" for="fEmail">Email</label>
          <input id="fEmail" v-model="email" class="in" type="email" autocomplete="email" inputmode="email" />
          <div class="err">{{ err }}</div>
          <button class="btn" type="submit" :disabled="busy">{{ busy ? 'Đang gửi…' : 'Gửi link' }}</button>
          <button class="link" type="button" @click="go('login')">‹ Quay lại đăng nhập</button>
        </form>
      </template>
    </div>
  </div>
</template>
