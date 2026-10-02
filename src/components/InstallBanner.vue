<script setup lang="ts">
import { computed, ref } from 'vue'
import { installState, promptInstall } from '../lib/install'

const KEY = 'ctn-install-dismissed'
const dismissed = ref(false)
try {
  dismissed.value = !!localStorage.getItem(KEY)
} catch {
  /* ignore */
}

const hidden = computed(() => dismissed.value || installState.installed || !(installState.canPrompt || installState.ios))

function dismiss() {
  dismissed.value = true
  try {
    localStorage.setItem(KEY, '1')
  } catch {
    /* ignore */
  }
}
</script>

<template>
  <div v-if="!hidden" class="install">
    <span v-if="installState.canPrompt">Cài app lên màn hình chính để mở nhanh hơn.</span>
    <span v-else>Cài app: bấm nút Chia sẻ trong Safari, chọn "Thêm vào MH chính".</span>
    <button v-if="installState.canPrompt" class="go" @click="promptInstall">Cài</button>
    <button class="x" aria-label="Ẩn" @click="dismiss">✕</button>
  </div>
</template>
