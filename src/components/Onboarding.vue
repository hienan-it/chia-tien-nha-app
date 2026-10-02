<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { createGroup, enterGroup, previewGroup } from '../store'
import { errMsg, isPin } from '../lib/util'
import type { GroupPreview } from '../lib/types'
import InstallBanner from './InstallBanner.vue'

type Mode = 'home' | 'create' | 'code' | 'enter'
const mode = ref<Mode>('home')
const busy = ref(false)
const err = ref('')

// tạo nhóm
const gName = ref('')
const cName = ref('')
const cPin = ref('')
const cPin2 = ref('')

// vào nhóm
const code = ref('')
const preview = ref<GroupPreview | null>(null)
const eName = ref('')
const ePin = ref('')
const confirmNew = ref(false)

const existing = computed(() => {
  const n = eName.value.trim().toLowerCase()
  return !!n && (preview.value?.members ?? []).some((x) => x.toLowerCase() === n)
})

function go(m: Mode) {
  err.value = ''
  confirmNew.value = false
  mode.value = m
}

onMounted(() => {
  const c = new URLSearchParams(window.location.search).get('code')
  if (c) {
    code.value = c.toUpperCase()
    lookup()
  }
})

const digits = (v: string) => v.replace(/\D/g, '').slice(0, 4)

async function doCreate() {
  err.value = ''
  if (!cName.value.trim()) return (err.value = 'Nhập tên của bạn.')
  if (!isPin(cPin.value)) return (err.value = 'PIN phải gồm đúng 4 chữ số.')
  if (cPin.value !== cPin2.value) return (err.value = 'Hai lần nhập PIN không khớp.')
  busy.value = true
  try {
    await createGroup(gName.value.trim(), cName.value.trim(), cPin.value)
  } catch (e) {
    err.value = errMsg(e)
  } finally {
    busy.value = false
  }
}

async function lookup() {
  err.value = ''
  const c = code.value.trim().toUpperCase()
  if (c.length !== 6) {
    mode.value = 'code'
    err.value = 'Mã nhóm gồm 6 ký tự.'
    return
  }
  busy.value = true
  try {
    const p = await previewGroup(c)
    if (!p) {
      mode.value = 'code'
      err.value = 'Không tìm thấy nhóm với mã này.'
      return
    }
    code.value = c
    preview.value = p
    go('enter')
  } catch (e) {
    mode.value = 'code'
    err.value = errMsg(e)
  } finally {
    busy.value = false
  }
}

async function doEnter(create = false) {
  err.value = ''
  const n = eName.value.trim()
  if (!n) return (err.value = 'Nhập tên của bạn.')
  if (!isPin(ePin.value)) return (err.value = 'PIN phải gồm đúng 4 chữ số.')
  if (!existing.value && !create) {
    confirmNew.value = true
    return
  }
  busy.value = true
  try {
    const r = await enterGroup(code.value, n, ePin.value, create)
    switch (r.status) {
      case 'ok':
        window.history.replaceState(null, '', window.location.pathname)
        break
      case 'wrong_pin':
        err.value = r.remaining > 0 ? `Sai PIN. Còn ${r.remaining} lần thử.` : 'Sai PIN.'
        ePin.value = ''
        break
      case 'locked':
        err.value = `Nhập sai quá nhiều lần. Thử lại sau ${r.minutes} phút, hoặc nhờ người tạo nhóm đặt lại PIN.`
        break
      case 'new_name':
        confirmNew.value = true
        break
      case 'group_not_found':
        go('code')
        err.value = 'Nhóm không còn tồn tại.'
        break
    }
  } catch (e) {
    err.value = errMsg(e)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="wrap">
    <InstallBanner />
    <div class="onboard">
      <div class="brand"><img src="/favicon.svg" alt="" />Chia tiền nhà</div>

      <template v-if="mode === 'home'">
        <h2>Chào bạn</h2>
        <p>Chia tiền nhà, ăn uống và đồ dùng chung, xem ngay ai nợ ai.</p>
        <button class="btn" @click="go('code')">Tôi có mã nhóm</button>
        <button class="btn secondary" @click="go('create')">Tạo nhóm mới</button>
      </template>

      <form v-else-if="mode === 'create'" @submit.prevent="doCreate">
        <h2>Tạo nhóm</h2>
        <p>Sau khi tạo, bạn gửi mã hoặc link mời cho bạn cùng nhà.</p>
        <label class="f" for="gName">Tên nhóm</label>
        <input id="gName" v-model="gName" class="in" maxlength="40" placeholder="VD: Nhà 12B" />
        <label class="f" for="cName">Tên của bạn</label>
        <input id="cName" v-model="cName" class="in" maxlength="30" placeholder="Tên hiển thị trong nhóm" autocomplete="nickname" />
        <label class="f" for="cPin">Đặt PIN 4 số</label>
        <input id="cPin" v-model="cPin" class="in pin" type="password" inputmode="numeric" maxlength="4" autocomplete="new-password" @input="cPin = digits(cPin)" />
        <label class="f" for="cPin2">Nhập lại PIN</label>
        <input id="cPin2" v-model="cPin2" class="in pin" type="password" inputmode="numeric" maxlength="4" autocomplete="new-password" @input="cPin2 = digits(cPin2)" />
        <p class="hint">Dùng tên và PIN này khi đăng nhập trên máy khác.</p>
        <div class="err">{{ err }}</div>
        <button class="btn" type="submit" :disabled="busy">{{ busy ? 'Đang tạo…' : 'Tạo nhóm' }}</button>
        <button class="link" type="button" @click="go('home')">‹ Quay lại</button>
      </form>

      <form v-else-if="mode === 'code'" @submit.prevent="lookup">
        <h2>Nhập mã nhóm</h2>
        <p>Mã gồm 6 ký tự, người tạo nhóm sẽ gửi cho bạn.</p>
        <label class="f" for="code">Mã nhóm</label>
        <input id="code" v-model="code" class="in code" maxlength="6" autocapitalize="characters" autocomplete="off" placeholder="K7P2QX" @input="code = code.toUpperCase().replace(/[^A-Z0-9]/g, '')" />
        <div class="err">{{ err }}</div>
        <button class="btn" type="submit" :disabled="busy">{{ busy ? 'Đang tìm…' : 'Tiếp tục' }}</button>
        <button class="link" type="button" @click="go('home')">‹ Quay lại</button>
      </form>

      <form v-else-if="mode === 'enter' && preview" @submit.prevent="doEnter(false)">
        <h2>{{ preview.name }}</h2>
        <template v-if="preview.members.length">
          <p>Chạm vào tên bạn nếu đã có trong nhóm:</p>
          <div class="chips" style="margin: 8px 0 4px">
            <button v-for="n in preview.members" :key="n" type="button" class="chip" :aria-pressed="eName.trim().toLowerCase() === n.toLowerCase()" @click="(eName = n), (confirmNew = false)">{{ n }}</button>
          </div>
        </template>
        <label class="f" for="eName">Tên của bạn</label>
        <input id="eName" v-model="eName" class="in" maxlength="30" placeholder="Tên hiển thị trong nhóm" autocomplete="nickname" @input="confirmNew = false" />
        <label class="f" for="ePin">{{ existing ? 'PIN của bạn' : 'Đặt PIN 4 số' }}</label>
        <input id="ePin" v-model="ePin" class="in pin" type="password" inputmode="numeric" maxlength="4" :autocomplete="existing ? 'current-password' : 'new-password'" @input="ePin = digits(ePin)" />
        <p class="hint">{{ existing ? 'Nhập PIN bạn đã đặt khi tham gia.' : 'Bạn là người mới: PIN này dùng để đăng nhập lại về sau.' }}</p>
        <div class="err">{{ err }}</div>

        <div v-if="confirmNew" class="note">
          Trong nhóm chưa có ai tên “{{ eName.trim() }}”. Tạo thành viên mới với tên này?
          <div class="row" style="margin-top: 10px">
            <button type="button" @click="confirmNew = false">Sửa tên</button>
            <button type="button" class="primary" :disabled="busy" @click="doEnter(true)">Tạo và vào nhóm</button>
          </div>
        </div>
        <button v-else class="btn" type="submit" :disabled="busy">{{ busy ? 'Đang vào…' : 'Vào nhóm' }}</button>
        <button class="link" type="button" @click="go('code')">‹ Đổi mã nhóm</button>
      </form>
    </div>
  </div>
</template>
