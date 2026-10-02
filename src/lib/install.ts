import { reactive } from 'vue'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const ua = navigator.userAgent
const standalone =
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true

export const installState = reactive({
  // Android/Chrome: có thể bật hộp thoại cài
  canPrompt: false,
  // iPhone/iPad: chỉ hướng dẫn cài tay qua Safari
  ios: !standalone && (/iPhone|iPad|iPod/.test(ua) || (ua.includes('Mac') && 'ontouchend' in document)),
  installed: standalone
})

let deferred: BeforeInstallPromptEvent | null = null

// Sự kiện chỉ bắn 1 lần lúc tải trang, nên phải nghe ngay từ đầu chứ không đợi component mount
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  deferred = e as BeforeInstallPromptEvent
  installState.canPrompt = true
})
window.addEventListener('appinstalled', () => {
  deferred = null
  installState.canPrompt = false
  installState.installed = true
})

export async function promptInstall() {
  if (!deferred) return
  await deferred.prompt()
  await deferred.userChoice
  deferred = null
  installState.canPrompt = false
}
