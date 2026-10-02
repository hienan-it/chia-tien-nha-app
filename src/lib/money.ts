import type { Debt, Payment, Txn } from './types'

export const CATS = [
  { id: 'rent', name: 'Tiền nhà', color: 'var(--c-rent)' },
  { id: 'bill', name: 'Điện nước, mạng', color: 'var(--c-bill)' },
  { id: 'food', name: 'Ăn uống', color: 'var(--c-food)' },
  { id: 'shop', name: 'Đồ dùng', color: 'var(--c-shop)' },
  { id: 'other', name: 'Khác', color: 'var(--c-other)' }
] as const

export type CatId = (typeof CATS)[number]['id']

export function catOf(id: string) {
  return CATS.find((c) => c.id === id) ?? CATS[4]
}

export const fmt = (n: number) => Math.round(n).toLocaleString('vi-VN') + 'đ'

export function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** "150k" → 150000, "2.5tr" → 2500000, "1.200.000" → 1200000 */
export function parseAmount(input: string): number {
  let s = String(input).trim().toLowerCase().replace(/\s/g, '')
  let mult = 1
  if (/(k|ng|nghìn|nghin)$/.test(s)) {
    mult = 1000
    s = s.replace(/(k|ng|nghìn|nghin)$/, '')
  } else if (/(tr|m|triệu|trieu)$/.test(s)) {
    mult = 1e6
    s = s.replace(/(tr|m|triệu|trieu)$/, '')
  }
  s = mult > 1 ? s.replace(',', '.') : s.replace(/[.,]/g, '')
  const n = parseFloat(s)
  return Number.isFinite(n) ? Math.round(n * mult) : NaN
}

export const formatInput = (n: number) => (n ? n.toLocaleString('vi-VN') : '')

/** Nợ tính theo từng cặp người, đã bù trừ hai chiều */
export function computeDebts(ids: string[], txns: Txn[], payments: Payment[]): Debt[] {
  const d: Record<string, Record<string, number>> = {}
  ids.forEach((a) => {
    d[a] = {}
    ids.forEach((b) => (d[a][b] = 0))
  })
  const has = (x: string) => x in d

  for (const t of txns) {
    const split = (t.split || []).filter(has)
    if (!split.length || !has(t.payer)) continue
    const share = Number(t.amount) / split.length
    split.forEach((m) => {
      if (m !== t.payer) d[m][t.payer] += share
    })
  }
  for (const p of payments) {
    if (has(p.from_member) && has(p.to_member)) d[p.from_member][p.to_member] -= Number(p.amount)
  }

  const out: Debt[] = []
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = ids[i]
      const b = ids[j]
      const v = Math.round(d[a][b] - d[b][a])
      if (v >= 500) out.push({ from: a, to: b, amount: v })
      else if (v <= -500) out.push({ from: b, to: a, amount: -v })
    }
  }
  return out
}

export function netOf(id: string, debts: Debt[]): number {
  let n = 0
  for (const x of debts) {
    if (x.to === id) n += x.amount
    if (x.from === id) n -= x.amount
  }
  return n
}
