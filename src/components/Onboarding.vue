<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { createGroup, joinGroup, logout, previewGroup, state } from '../store'
import { errMsg, isPin, toast } from '../lib/util'
import type { GroupPreview } from '../lib/types'
import InstallBanner from './InstallBanner.vue'

type Mode = 'home' | 'create' | 'code' | 'enter'
// embedded: nằm trong sheet (thêm nhóm khi đã có nhóm), không phải màn hình riêng
const props = defineProps<{ embedded?: boolean; start?: Mode }>()
const emit = defineEmits<{ done: [] }>()

const mode = ref<Mode>(props.start ?? 'home')
const busy = ref(false)
const err = ref('')

const accountName = state.user?.name ?? ''

// tạo nhóm
const gName = ref('')
const cName = ref(accountName)

// vào nhóm
const code = ref('')
const preview = ref<GroupPreview | null>(null)
const eName = ref(accountName)
const ePin = ref('')

const claimable = computed(() => (preview.value?.members ?? []).filter((m) => m.claimable).map((m) => m.name))
const match = computed(() => {
  const n = eName.value.trim().toLowerCase()
  return n ? preview.value?.members.find((m) => m.name.toLowerCase() === n) : undefined
})

function go(m: Mode) {
  err.value = ''
  mode.value = m
}

onMounted(() => {
  const c = new URLSearchParams(window.location.search).get('code')
  if (c && mode.value !== 'create') {
    code.value = c.toUpperCase()
    lookup()
  }
})

const digits = (v: string) => v.replace(/\D/g, '').slice(0, 4)
const clearInvite = () => window.history.replaceState(null, '', window.location.pathname)

async function doCreate() {
  err.value = ''
  if (!cName.value.trim()) return (err.value = 'Nhập tên của bạn trong nhóm.')
  busy.value = true
  try {
    await createGroup(gName.value.trim(), cName.value.trim())
    toast('Đã tạo nhóm')
    emit('done')
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

async function doJoin() {
  err.value = ''
  const joined = preview.value?.joined
  const n = eName.value.trim()
  if (!joined && !n) return (err.value = 'Nhập tên của bạn trong nhóm.')
  if (!joined && match.value && !match.value.claimable) return (err.value = 'Tên này đã có người dùng, hãy chọn tên khác.')
  const claiming = !joined && !!match.value?.claimable
  if (claiming && !isPin(ePin.value)) return (err.value = 'Nhập PIN 4 số bạn đã đặt trước đây.')
  busy.value = true
  try {
    const r = await joinGroup(code.value, n, claiming ? ePin.value : undefined)
    switch (r.status) {
      case 'ok':
        clearInvite()
        toast('Đã vào nhóm')
        emit('done')
        break
      case 'need_pin':
        err.value = 'Nhập PIN 4 số bạn đã đặt trước đây.'
        break
      case 'name_taken':
        err.value = 'Tên này đã có người dùng, hãy chọn tên khác.'
        break
      case 'wrong_pin':
        err.value = r.remaining > 0 ? `Sai PIN. Còn ${r.remaining} lần thử.` : 'Sai PIN.'
        ePin.value = ''
        break
      case 'locked':
        err.value = `Nhập sai quá nhiều lần. Thử lại sau ${r.minutes} phút, hoặc nhờ chủ nhóm đặt lại PIN.`
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

async function doLogout() {
  try {
    await logout()
  } catch (e) {
    toast(errMsg(e))
  }
}
</script>

<template>
  <div :class="{ wrap: !embedded }">
    <InstallBanner v-if="!embedded" />
    <div :class="{ onboard: !embedded }">
      <div v-if="!embedded" class="brand"><img src="/favicon.svg" alt="" />Chia tiền nhà</div>

      <template v-if="mode === 'home'">
        <h2>Chào {{ accountName || 'bạn' }}</h2>
        <p>Bạn chưa ở trong nhóm nào. Tham gia nhóm của người cùng nhà, hoặc tạo nhóm mới rồi mời họ vào.</p>
        <button class="btn" @click="go('code')">Tham gia bằng mã nhóm</button>
        <button class="btn secondary" @click="go('create')">Tạo nhóm mới</button>
      </template>

      <form v-else-if="mode === 'create'" @submit.prevent="doCreate">
        <h2>Tạo nhóm</h2>
        <p>Bạn sẽ là chủ nhóm. Sau khi tạo, gửi mã hoặc link mời cho bạn cùng nhà.</p>
        <label class="f" for="gName">Tên nhóm</label>
        <input id="gName" v-model="gName" class="in" maxlength="40" placeholder="VD: Nhà 12B" />
        <label class="f" for="cName">Tên của bạn trong nhóm</label>
        <input id="cName" v-model="cName" class="in" maxlength="30" placeholder="Tên hiển thị trong nhóm" autocomplete="nickname" />
        <div class="err">{{ err }}</div>
        <button class="btn" type="submit" :disabled="busy">{{ busy ? 'Đang tạo…' : 'Tạo nhóm' }}</button>
        <button v-if="!embedded" class="link" type="button" @click="go('home')">‹ Quay lại</button>
      </form>

      <form v-else-if="mode === 'code'" @submit.prevent="lookup">
        <h2>Tham gia nhóm</h2>
        <p>Mã gồm 6 ký tự, chủ nhóm sẽ gửi cho bạn.</p>
        <label class="f" for="code">Mã nhóm</label>
        <input id="code" v-model="code" class="in code" maxlength="6" autocapitalize="characters" autocomplete="off" placeholder="K7P2QX" @input="code = code.toUpperCase().replace(/[^A-Z0-9]/g, '')" />
        <div class="err">{{ err }}</div>
        <button class="btn" type="submit" :disabled="busy">{{ busy ? 'Đang tìm…' : 'Tiếp tục' }}</button>
        <button v-if="!embedded" class="link" type="button" @click="go('home')">‹ Quay lại</button>
      </form>

      <form v-else-if="mode === 'enter' && preview" @submit.prevent="doJoin">
        <h2>{{ preview.name }}</h2>
        <template v-if="preview.joined">
          <p>Bạn đã ở trong nhóm này.</p>
          <div class="err">{{ err }}</div>
          <button class="btn" type="submit" :disabled="busy">Mở nhóm</button>
        </template>
        <template v-else>
          <template v-if="claimable.length">
            <p>Bạn đã vào nhóm này từ trước khi có tài khoản? Chạm vào tên mình:</p>
            <div class="chips" style="margin: 8px 0 4px">
              <button v-for="n in claimable" :key="n" type="button" class="chip" :aria-pressed="eName.trim().toLowerCase() === n.toLowerCase()" @click="eName = n">{{ n }}</button>
            </div>
          </template>
          <label class="f" for="eName">Tên của bạn trong nhóm</label>
          <input id="eName" v-model="eName" class="in" maxlength="30" placeholder="Tên hiển thị trong nhóm" autocomplete="nickname" />
          <template v-if="match?.claimable">
            <label class="f" for="ePin">PIN cũ của {{ match.name }}</label>
            <input id="ePin" v-model="ePin" class="in pin" type="password" inputmode="numeric" maxlength="4" autocomplete="current-password" @input="ePin = digits(ePin)" />
            <p class="hint">Nhập đúng PIN để gắn tên này (cùng các khoản chi cũ) vào tài khoản của bạn. Quên PIN thì nhờ chủ nhóm đặt lại.</p>
          </template>
          <p v-else-if="match" class="hint" style="color: var(--neg)">Tên này đã có người dùng.</p>
          <p v-else class="hint">Bạn sẽ vào nhóm như thành viên mới.</p>
          <div class="err">{{ err }}</div>
          <button class="btn" type="submit" :disabled="busy">{{ busy ? 'Đang vào…' : 'Vào nhóm' }}</button>
        </template>
        <button class="link" type="button" @click="go('code')">‹ Đổi mã nhóm</button>
      </form>

      <p v-if="!embedded" class="hint" style="margin-top: 18px">
        Đang đăng nhập: {{ state.user?.email }} ·
        <button class="link" style="margin: 0; padding: 0" @click="doLogout">Đăng xuất</button>
      </p>
    </div>
  </div>
</template>
