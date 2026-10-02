import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

// đọc trước khi client Supabase xử lý và xóa token trên URL
export const isRecoveryLink = /type=recovery/.test(window.location.hash)

export const configured = Boolean(url && key)

export const supabase = createClient(url || 'http://localhost', key || 'missing', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
})
