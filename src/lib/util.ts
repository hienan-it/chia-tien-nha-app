import { reactive } from 'vue'

export const toastState = reactive({ text: '', show: false })
let timer: number | undefined

export function toast(text: string) {
  toastState.text = text
  toastState.show = true
  clearTimeout(timer)
  timer = window.setTimeout(() => (toastState.show = false), 2600)
}

export async function copyText(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast('Đã chép ' + label)
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    let ok = false
    try {
      ok = document.execCommand('copy')
    } catch {
      /* ignore */
    }
    ta.remove()
    toast(ok ? 'Đã chép ' + label : 'Không chép được, hãy chép tay: ' + text)
  }
}

export const initial = (s?: string) => (s ?? '?').trim().charAt(0).toUpperCase() || '?'

export const isPin = (p: string) => /^\d{4}$/.test(p)

const MESSAGES: Record<string, string> = {
  invalid_pin: 'PIN phải gồm đúng 4 chữ số.',
  invalid_name: 'Tên không hợp lệ.',
  not_authenticated: 'Phiên đăng nhập hết hạn, hãy đăng nhập lại.',
  'Invalid login credentials': 'Sai email hoặc mật khẩu.',
  'User already registered': 'Email này đã có tài khoản. Hãy đăng nhập.',
  'Email not confirmed': 'Email chưa được xác nhận. Mở hộp thư và bấm link xác nhận.',
  'Password should be at least': 'Mật khẩu cần ít nhất 6 ký tự.',
  'Unable to validate email address': 'Email không hợp lệ.',
  'rate limit': 'Thao tác quá nhiều lần, thử lại sau ít phút.',
  'should be different from the old password': 'Mật khẩu mới phải khác mật khẩu cũ.',
  not_admin: 'Chỉ người tạo nhóm làm được việc này.',
  invalid_member: 'Có thành viên không thuộc nhóm.',
  members_group_name_uniq: 'Tên này đã có người dùng trong nhóm.',
  'row-level security': 'Bạn không có quyền làm việc này.'
}

export function errMsg(e: unknown): string {
  const msg = (e as { message?: string })?.message ?? String(e)
  for (const k in MESSAGES) if (msg.includes(k)) return MESSAGES[k]
  if (/Failed to fetch|NetworkError|Load failed/i.test(msg)) return 'Không có mạng. Thử lại khi có kết nối.'
  return 'Có lỗi: ' + msg
}

export function dayMonth(date: string) {
  const [, m, d] = (date || '--').split('-')
  return `${+d}/${+m}`
}
