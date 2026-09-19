// Shared canvas, math and color helpers.

export type Canvas = HTMLCanvasElement
export type Ctx = CanvasRenderingContext2D

export function makeCanvas(w: number, h: number): Canvas {
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(w))
  c.height = Math.max(1, Math.round(h))
  return c
}

/** 2D context in a known default state: contexts keep composite mode, alpha and transform between uses. */
export function ctx2d(c: Canvas, readFrequently = false): Ctx {
  const x = c.getContext('2d', readFrequently ? { willReadFrequently: true } : undefined) as Ctx
  x.globalCompositeOperation = 'source-over'
  x.globalAlpha = 1
  x.setTransform(1, 0, 0, 1, 0, 0)
  if (x.filter && x.filter !== 'none') x.filter = 'none'
  return x
}

export function cloneCanvas(src: Canvas): Canvas {
  const c = makeCanvas(src.width, src.height)
  ctx2d(c).drawImage(src, 0, 0)
  return c
}

export function clearCanvas(c: Canvas) {
  const x = ctx2d(c)
  x.setTransform(1, 0, 0, 1, 0, 0)
  x.globalAlpha = 1
  x.globalCompositeOperation = 'source-over'
  x.clearRect(0, 0, c.width, c.height)
}

export const clamp = (v: number, a = 0, b = 1) => (v < a ? a : v > b ? b : v)
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
export const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(bx - ax, by - ay)

let idCounter = 0
export const uid = (p = 'id') => `${p}_${Date.now().toString(36)}_${(idCounter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`

/** Deterministic PRNG so a stroke can be re-rendered identically. */
export function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ---------- Rect helpers ----------
export interface Rect { x: number; y: number; w: number; h: number }
export const emptyRect = (): Rect => ({ x: Infinity, y: Infinity, w: -Infinity, h: -Infinity })

export class BBox {
  x0 = Infinity; y0 = Infinity; x1 = -Infinity; y1 = -Infinity
  add(x: number, y: number, r = 0) {
    if (x - r < this.x0) this.x0 = x - r
    if (y - r < this.y0) this.y0 = y - r
    if (x + r > this.x1) this.x1 = x + r
    if (y + r > this.y1) this.y1 = y + r
  }
  get empty() { return this.x1 < this.x0 }
  clampTo(w: number, h: number): Rect | null {
    if (this.empty) return null
    const x = Math.max(0, Math.floor(this.x0) - 2)
    const y = Math.max(0, Math.floor(this.y0) - 2)
    const x1 = Math.min(w, Math.ceil(this.x1) + 2)
    const y1 = Math.min(h, Math.ceil(this.y1) + 2)
    if (x1 <= x || y1 <= y) return null
    return { x, y, w: x1 - x, h: y1 - y }
  }
}

// ---------- Color ----------
export interface HSV { h: number; s: number; v: number } // h 0-360, s/v 0-1
export interface RGB { r: number; g: number; b: number } // 0-255

export function hsvToRgb({ h, s, v }: HSV): RGB {
  h = ((h % 360) + 360) % 360
  const c = v * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = v - c
  let r = 0, g = 0, b = 0
  if (h < 60) [r, g, b] = [c, x, 0]
  else if (h < 120) [r, g, b] = [x, c, 0]
  else if (h < 180) [r, g, b] = [0, c, x]
  else if (h < 240) [r, g, b] = [0, x, c]
  else if (h < 300) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]
  return { r: Math.round((r + m) * 255), g: Math.round((g + m) * 255), b: Math.round((b + m) * 255) }
}

export function rgbToHsv({ r, g, b }: RGB): HSV {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const d = max - min
  let h = 0
  if (d) {
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  return { h, s: max ? d / max : 0, v: max }
}

export function rgbToHex({ r, g, b }: RGB) {
  return '#' + [r, g, b].map((n) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0')).join('')
}

export function hexToRgb(hex: string): RGB {
  let h = hex.replace('#', '').trim()
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  const n = parseInt(h.slice(0, 6), 16) || 0
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

export const hsvToHex = (c: HSV) => rgbToHex(hsvToRgb(c))
export const hexToHsv = (h: string) => rgbToHsv(hexToRgb(h))

export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let h = 0, s = 0
  const l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0)
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h /= 6
  }
  return [h, s, l]
}

function hue2rgb(p: number, q: number, t: number) {
  if (t < 0) t += 1
  if (t > 1) t -= 1
  if (t < 1 / 6) return p + (q - p) * 6 * t
  if (t < 1 / 2) return q
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
  return p
}

export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) return [l * 255, l * 255, l * 255]
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  return [hue2rgb(p, q, h + 1 / 3) * 255, hue2rgb(p, q, h) * 255, hue2rgb(p, q, h - 1 / 3) * 255]
}

export const luminance = (r: number, g: number, b: number) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255

// ---------- Blobs / files ----------
export function canvasToBlob(c: Canvas, type = 'image/png', quality?: number): Promise<Blob> {
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('No se pudo codificar la imagen'))), type, quality))
}

export async function blobToCanvas(blob: Blob): Promise<Canvas> {
  const bmp = await createImageBitmap(blob)
  const c = makeCanvas(bmp.width, bmp.height)
  ctx2d(c).drawImage(bmp, 0, 0)
  bmp.close?.()
  return c
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

export function pickFile(accept: string, multiple = false): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.multiple = multiple
    input.onchange = () => resolve(Array.from(input.files || []))
    input.click()
  })
}

/** Scales a canvas down so its longest side is at most `max`. */
export function thumbnail(src: Canvas, max: number, bg?: string): Canvas {
  const s = Math.min(1, max / Math.max(src.width, src.height))
  const c = makeCanvas(src.width * s, src.height * s)
  const x = ctx2d(c)
  if (bg) { x.fillStyle = bg; x.fillRect(0, 0, c.width, c.height) }
  x.imageSmoothingQuality = 'high'
  x.drawImage(src, 0, 0, c.width, c.height)
  return c
}

let checker: CanvasPattern | null = null
export function checkerPattern(x: Ctx): CanvasPattern {
  if (checker) return checker
  const c = makeCanvas(16, 16)
  const g = ctx2d(c)
  g.fillStyle = '#ffffff'
  g.fillRect(0, 0, 16, 16)
  g.fillStyle = '#d9d9d9'
  g.fillRect(0, 0, 8, 8)
  g.fillRect(8, 8, 8, 8)
  checker = x.createPattern(c, 'repeat')!
  return checker
}

/** Bounding box of non-transparent pixels. */
export function contentBounds(c: Canvas): Rect | null {
  const d = ctx2d(c, true).getImageData(0, 0, c.width, c.height).data
  let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1
  for (let y = 0; y < c.height; y++) {
    const row = y * c.width * 4
    for (let x = 0; x < c.width; x++) {
      if (d[row + x * 4 + 3] > 2) {
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
    }
  }
  if (x1 < 0) return null
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 }
}
