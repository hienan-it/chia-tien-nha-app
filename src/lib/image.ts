function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Không đọc được ảnh'))
    }
    img.src = url
  })
}

/** Thu nhỏ ảnh QR thành data URL < ~190KB để lưu thẳng vào Postgres */
export async function compressImage(file: File): Promise<string> {
  const img = await loadImage(file)
  const tries: [number, string, number?][] = [
    [640, 'image/png'],
    [640, 'image/jpeg', 0.88],
    [520, 'image/jpeg', 0.8],
    [420, 'image/jpeg', 0.75]
  ]
  for (const [max, type, q] of tries) {
    const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight))
    const w = Math.round(img.naturalWidth * s)
    const h = Math.round(img.naturalHeight * s)
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    const ctx = c.getContext('2d')
    if (!ctx) break
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, w, h)
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, 0, 0, w, h)
    const data = c.toDataURL(type, q)
    if (data.length < 190000) return data
  }
  throw new Error('Ảnh quá lớn')
}

export const safeImage = (s: string) => (s && s.startsWith('data:image/') ? s : '')
