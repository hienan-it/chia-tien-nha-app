export interface Me {
  member_id: string
  group_id: string
  group_name: string
  invite_code: string
  is_admin: boolean
}

export interface Member {
  id: string
  group_id: string
  name: string
  is_admin: boolean
  bank: string
  acc: string
  holder: string
  qr_data: string
  joined_at: string
}

export interface Txn {
  id: string
  group_id: string
  title: string
  amount: number
  payer: string
  split: string[]
  cat: string
  date: string
  created_by: string | null
  created_at: string
}

export interface Payment {
  id: string
  group_id: string
  from_member: string
  to_member: string
  amount: number
  date: string
  created_by: string | null
  created_at: string
}

export interface Debt {
  from: string
  to: string
  amount: number
}

export interface GroupPreview {
  name: string
  members: string[]
}

export type EnterStatus =
  | { status: 'ok' }
  | { status: 'group_not_found' }
  | { status: 'new_name' }
  | { status: 'wrong_pin'; remaining: number }
  | { status: 'locked'; minutes: number }
