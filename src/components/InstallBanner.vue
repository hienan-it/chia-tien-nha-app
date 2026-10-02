<script setup lang="ts">
import { onMounted, ref } from 'vue'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const KEY = 'ctn-install-dismissed'
const deferred = ref<BeforeInstallPromptEvent | null>(null)
const showIos = ref(false)
const hidden = ref(true)

const standalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true

onMounted(() => {
  if (standalone()) return
  try {
    if (localStorage.getItem(KEY)) return
  } catch {
    /* ignore */
  }
  const ua = navigator.userAgent
  const isIos = /iPhone|iPad|iPod/.test(ua) || (ua.includes('Mac') && 'ontouchend' in document)
  if (isIos) {
    showIos.value = true
    hidden.value = false
  }
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferred.value = e as BeforeInstallPromptEvent
    hidden.value = false
  })
  window.addEventListener('appinstalled', () => (hidden.value = true))
})

async function install() {
  if (!deferred.value) return
  await deferred.value.prompt()
  await deferred.value.userChoice
  deferred.value = null
  hidden.value = true
}
function dismiss() {
  hidden.value = true
  try {
    localStorage.setItem(KEY, '1')
  } catch {
    /* ignore */
  }
}
</script>

<template>
  <div v-if="!hidden" class="install">
    <span v-if="deferred">Cài app lên màn hình chính để mở nhanh hơn.</span>
    <span v-else-if="showIos">Cài app: bấm nút Chia sẻ trong Safari, chọn "Thêm vào MH chính".</span>
    <button v-if="deferred" class="go" @click="install">Cài</button>
    <button class="x" aria-label="Ẩn" @click="dismiss">✕</button>
  </div>
</template>
