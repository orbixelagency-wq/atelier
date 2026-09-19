// Image adjustments. Each filter takes a source canvas and returns a new canvas.
import { clamp, cloneCanvas, ctx2d, hexToRgb, hslToRgb, lerp, luminance, makeCanvas, mulberry32, rgbToHsl, type Canvas } from './util'

let filterSupport: boolean | null = null
export function canvasFilterSupported(): boolean {
  if (filterSupport !== null) return filterSupport
  try {
    const c = makeCanvas(4, 4)
    const x = ctx2d(c, true)
    x.filter = 'blur(1px)'
    filterSupport = x.filter === 'blur(1px)'
    if (filterSupport) {
      x.fillStyle = '#fff'
      x.fillRect(1, 1, 2, 2)
      const t = makeCanvas(4, 4)
      const tx = ctx2d(t, true)
      tx.filter = 'blur(2px)'
      tx.drawImage(c, 0, 0)
      filterSupport = tx.getImageData(0, 0, 1, 1).data[3] > 0
    }
  } catch { filterSupport = false }
  return filterSupport
}

function imgData(c: Canvas) { return ctx2d(c, true).getImageData(0, 0, c.width, c.height) }
function fromData(d: ImageData): Canvas {
  const c = makeCanvas(d.width, d.height)
  ctx2d(c).putImageData(d, 0, 0)
  return c
}

/** Per-pixel map with RGB in 0-255. */
function mapPixels(src: Canvas, fn: (r: number, g: number, b: number, out: number[]) => void): Canvas {
  const d = imgData(src)
  const p = d.data
  const out = [0, 0, 0]
  for (let i = 0; i < p.length; i += 4) {
    if (!p[i + 3]) continue
    fn(p[i], p[i + 1], p[i + 2], out)
    p[i] = out[0]; p[i + 1] = out[1]; p[i + 2] = out[2]
  }
  return fromData(d)
}

// ---------- Blur ----------
function boxesForGauss(sigma: number, n: number) {
  const wIdeal = Math.sqrt((12 * sigma * sigma) / n + 1)
  let wl = Math.floor(wIdeal)
  if (wl % 2 === 0) wl--
  const wu = wl + 2
  const mIdeal = (12 * sigma * sigma - n * wl * wl - 4 * n * wl - 3 * n) / (-4 * wl - 4)
  const m = Math.round(mIdeal)
  const sizes: number[] = []
  for (let i = 0; i < n; i++) sizes.push(i < m ? wl : wu)
  return sizes
}

function boxBlurH(src: Float32Array, dst: Float32Array, w: number, h: number, r: number) {
  const iarr = 1 / (r + r + 1)
  for (let c = 0; c < 4; c++) for (let i = 0; i < h; i++) {
    let ti = i * w, li = ti, ri = ti + r
    const fv = src[ti * 4 + c], lv = src[(ti + w - 1) * 4 + c]
    let val = (r + 1) * fv
    for (let j = 0; j < r; j++) val += src[(ti + Math.min(j, w - 1)) * 4 + c]
    for (let j = 0; j <= r; j++) { val += (ri < i * w + w ? src[ri * 4 + c] : lv) - fv; dst[ti * 4 + c] = val * iarr; ri++; ti++ }
    for (let j = r + 1; j < w - r; j++) { val += src[ri * 4 + c] - src[li * 4 + c]; dst[ti * 4 + c] = val * iarr; ri++; li++; ti++ }
    for (let j = Math.max(r + 1, w - r); j < w; j++) { val += lv - src[li * 4 + c]; dst[ti * 4 + c] = val * iarr; li++; ti++ }
  }
}

function boxBlurV(src: Float32Array, dst: Float32Array, w: number, h: number, r: number) {
  const iarr = 1 / (r + r + 1)
  for (let c = 0; c < 4; c++) for (let i = 0; i < w; i++) {
    let ti = i, li = ti, ri = ti + r * w
    const fv = src[ti * 4 + c], lv = src[(ti + w * (h - 1)) * 4 + c]
    let val = (r + 1) * fv
    for (let j = 0; j < r; j++) val += src[(ti + Math.min(j, h - 1) * w) * 4 + c]
    for (let j = 0; j <= r; j++) { val += (ri < w * h ? src[ri * 4 + c] : lv) - fv; dst[ti * 4 + c] = val * iarr; ri += w; ti += w }
    for (let j = r + 1; j < h - r; j++) { val += src[ri * 4 + c] - src[li * 4 + c]; dst[ti * 4 + c] = val * iarr; li += w; ri += w; ti += w }
    for (let j = Math.max(r + 1, h - r); j < h; j++) { val += lv - src[li * 4 + c]; dst[ti * 4 + c] = val * iarr; li += w; ti += w }
  }
}

function jsBlur(src: Canvas, sigma: number): Canvas {
  const d = imgData(src)
  const { width: w, height: h } = d
  const n = w * h * 4
  let a = new Float32Array(n), b = new Float32Array(n)
  const p = d.data
  for (let i = 0; i < n; i += 4) {
    const al = p[i + 3] / 255
    a[i] = p[i] * al; a[i + 1] = p[i + 1] * al; a[i + 2] = p[i + 2] * al; a[i + 3] = p[i + 3]
  }
  for (const box of boxesForGauss(sigma, 3)) {
    const r = Math.max(0, Math.floor((box - 1) / 2))
    if (!r) continue
    boxBlurH(a, b, w, h, Math.min(r, w - 1)); boxBlurV(b, a, w, h, Math.min(r, h - 1))
  }
  for (let i = 0; i < n; i += 4) {
    const al = a[i + 3]
    const k = al > 0 ? 255 / al : 0
    p[i] = a[i] * k; p[i + 1] = a[i + 1] * k; p[i + 2] = a[i + 2] * k; p[i + 3] = al
  }
  a = b = null as any
  return fromData(d)
}

export function blurCanvas(src: Canvas, radius: number): Canvas {
  if (radius <= 0.1) return cloneCanvas(src)
  if (canvasFilterSupported()) {
    const c = makeCanvas(src.width, src.height)
    const x = ctx2d(c)
    // pad with edge pixels to avoid darkened borders
    x.filter = `blur(${radius}px)`
    x.drawImage(src, 0, 0)
    x.filter = 'none'
    return c
  }
  return jsBlur(src, radius)
}

export function gaussian(src: Canvas, p: { radius: number }) {
  return blurCanvas(src, p.radius)
}

export function motionBlur(src: Canvas, p: { distance: number; angle: number }) {
  const c = makeCanvas(src.width, src.height)
  const x = ctx2d(c)
  const n = Math.max(2, Math.min(64, Math.round(p.distance / 2)))
  const a = (p.angle * Math.PI) / 180
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1) - 0.5
    x.globalAlpha = 1 / (i + 1)
    x.drawImage(src, Math.cos(a) * p.distance * t, Math.sin(a) * p.distance * t)
  }
  return c
}

export function perspectiveBlur(src: Canvas, p: { amount: number; cx: number; cy: number; directional: boolean; angle: number }) {
  const c = makeCanvas(src.width, src.height)
  const x = ctx2d(c)
  const n = Math.max(2, Math.min(48, Math.round(p.amount * 40)))
  const cx = p.cx * src.width, cy = p.cy * src.height
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1)
    const s = 1 + t * p.amount * 0.25
    x.globalAlpha = 1 / (i + 1)
    x.setTransform(1, 0, 0, 1, 0, 0)
    if (p.directional) {
      const a = (p.angle * Math.PI) / 180
      x.translate(cx, cy)
      x.rotate(a)
      x.scale(s, 1)
      x.rotate(-a)
      x.translate(-cx, -cy)
    } else {
      x.translate(cx, cy)
      x.scale(s, s)
      x.translate(-cx, -cy)
    }
    x.drawImage(src, 0, 0)
  }
  return c
}

export function sharpen(src: Canvas, p: { amount: number }) {
  const blur = imgData(blurCanvas(src, 1.4))
  const d = imgData(src)
  const a = p.amount * 2
  for (let i = 0; i < d.data.length; i += 4) {
    for (let k = 0; k < 3; k++) d.data[i + k] = clamp(d.data[i + k] + (d.data[i + k] - blur.data[i + k]) * a, 0, 255)
  }
  return fromData(d)
}

export function noise(src: Canvas, p: { amount: number; mono: boolean; seed?: number }) {
  const d = imgData(src)
  const rand = mulberry32(p.seed ?? 11)
  const a = p.amount * 160
  for (let i = 0; i < d.data.length; i += 4) {
    if (!d.data[i + 3]) continue
    if (p.mono) {
      const n = (rand() - 0.5) * a
      d.data[i] = clamp(d.data[i] + n, 0, 255); d.data[i + 1] = clamp(d.data[i + 1] + n, 0, 255); d.data[i + 2] = clamp(d.data[i + 2] + n, 0, 255)
    } else for (let k = 0; k < 3; k++) d.data[i + k] = clamp(d.data[i + k] + (rand() - 0.5) * a, 0, 255)
  }
  return fromData(d)
}

// ---------- Color ----------
export function hsb(src: Canvas, p: { hue: number; sat: number; bright: number }) {
  // hue -180..180, sat -1..1, bright -1..1
  const hs = p.hue / 360
  return mapPixels(src, (r, g, b, o) => {
    let [h, s, l] = rgbToHsl(r, g, b)
    h = (h + hs + 1) % 1
    s = clamp(p.sat >= 0 ? s + (1 - s) * p.sat * s * 2 + s * p.sat : s * (1 + p.sat))
    l = clamp(p.bright >= 0 ? l + (1 - l) * p.bright : l * (1 + p.bright))
    const [nr, ng, nb] = hslToRgb(h, s, l)
    o[0] = nr; o[1] = ng; o[2] = nb
  })
}

export type Tri = [number, number, number] // cyan-red, magenta-green, yellow-blue in -1..1
export function colorBalance(src: Canvas, p: { shadows: Tri; mid: Tri; high: Tri }) {
  return mapPixels(src, (r, g, b, o) => {
    const l = luminance(r, g, b)
    const ws = clamp(1 - l * 2.5), wh = clamp((l - 0.6) * 2.5), wm = clamp(1 - Math.abs(l - 0.5) * 2.2)
    const dr = (p.shadows[0] * ws + p.mid[0] * wm + p.high[0] * wh) * 80
    const dg = (p.shadows[1] * ws + p.mid[1] * wm + p.high[1] * wh) * 80
    const db = (p.shadows[2] * ws + p.mid[2] * wm + p.high[2] * wh) * 80
    o[0] = clamp(r + dr, 0, 255); o[1] = clamp(g + dg, 0, 255); o[2] = clamp(b + db, 0, 255)
  })
}

export type CurvePts = { x: number; y: number }[]
/** Monotone cubic interpolation → 256 LUT. */
export function curveLUT(pts: CurvePts): Uint8Array {
  const P = [...pts].sort((a, b) => a.x - b.x)
  const lut = new Uint8Array(256)
  const n = P.length
  if (n < 2) { for (let i = 0; i < 256; i++) lut[i] = i; return lut }
  const dx: number[] = [], m: number[] = []
  const s: number[] = []
  for (let i = 0; i < n - 1; i++) { dx.push(P[i + 1].x - P[i].x || 1e-6); s.push((P[i + 1].y - P[i].y) / dx[i]) }
  m.push(s[0])
  for (let i = 1; i < n - 1; i++) m.push(s[i - 1] * s[i] <= 0 ? 0 : (s[i - 1] + s[i]) / 2)
  m.push(s[n - 2])
  for (let i = 0; i < n - 1; i++) {
    if (s[i] === 0) { m[i] = m[i + 1] = 0; continue }
    const a = m[i] / s[i], b = m[i + 1] / s[i], h = a * a + b * b
    if (h > 9) { const t = 3 / Math.sqrt(h); m[i] = t * a * s[i]; m[i + 1] = t * b * s[i] }
  }
  for (let v = 0; v < 256; v++) {
    const x = v / 255
    let y: number
    if (x <= P[0].x) y = P[0].y
    else if (x >= P[n - 1].x) y = P[n - 1].y
    else {
      let i = 0
      while (i < n - 2 && x > P[i + 1].x) i++
      const h = dx[i], t = (x - P[i].x) / h
      const t2 = t * t, t3 = t2 * t
      y = (2 * t3 - 3 * t2 + 1) * P[i].y + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * P[i + 1].y + (t3 - t2) * h * m[i + 1]
    }
    lut[v] = clamp(Math.round(y * 255), 0, 255)
  }
  return lut
}

export function curves(src: Canvas, p: { master: CurvePts; r: CurvePts; g: CurvePts; b: CurvePts }) {
  const M = curveLUT(p.master), R = curveLUT(p.r), G = curveLUT(p.g), B = curveLUT(p.b)
  return mapPixels(src, (r, g, b, o) => { o[0] = M[R[r]]; o[1] = M[G[g]]; o[2] = M[B[b]] })
}

export interface GradStop { pos: number; color: string }
export function gradientLUT(stops: GradStop[]): Uint8Array {
  const S = [...stops].sort((a, b) => a.pos - b.pos).map((s) => ({ pos: s.pos, c: hexToRgb(s.color) }))
  const lut = new Uint8Array(256 * 3)
  for (let i = 0; i < 256; i++) {
    const t = i / 255
    let a = S[0], b = S[S.length - 1]
    for (let k = 0; k < S.length - 1; k++) if (t >= S[k].pos && t <= S[k + 1].pos) { a = S[k]; b = S[k + 1]; break }
    const u = b.pos === a.pos ? 0 : clamp((t - a.pos) / (b.pos - a.pos))
    lut[i * 3] = lerp(a.c.r, b.c.r, u); lut[i * 3 + 1] = lerp(a.c.g, b.c.g, u); lut[i * 3 + 2] = lerp(a.c.b, b.c.b, u)
  }
  return lut
}

export function gradientMap(src: Canvas, p: { stops: GradStop[]; strength: number }) {
  const L = gradientLUT(p.stops)
  return mapPixels(src, (r, g, b, o) => {
    const i = Math.round(luminance(r, g, b) * 255) * 3
    o[0] = lerp(r, L[i], p.strength); o[1] = lerp(g, L[i + 1], p.strength); o[2] = lerp(b, L[i + 2], p.strength)
  })
}

export const GRADIENT_PRESETS: { name: string; stops: GradStop[] }[] = [
  { name: 'Noir', stops: [{ pos: 0, color: '#0b0b0f' }, { pos: 1, color: '#f4f1ea' }] },
  { name: 'Atardecer', stops: [{ pos: 0, color: '#1a0b2e' }, { pos: 0.45, color: '#c2365a' }, { pos: 0.8, color: '#f59a4a' }, { pos: 1, color: '#fff2c4' }] },
  { name: 'Sepia', stops: [{ pos: 0, color: '#1e140c' }, { pos: 0.5, color: '#8a6440' }, { pos: 1, color: '#f6e8cf' }] },
  { name: 'Océano', stops: [{ pos: 0, color: '#021526' }, { pos: 0.5, color: '#1f6f8b' }, { pos: 1, color: '#d3f4ef' }] },
  { name: 'Neón', stops: [{ pos: 0, color: '#12002b' }, { pos: 0.5, color: '#ff2e88' }, { pos: 1, color: '#2ef2ff' }] },
  { name: 'Cianotipo', stops: [{ pos: 0, color: '#0a1f4d' }, { pos: 1, color: '#e8f0ff' }] },
  { name: 'Duotono lima', stops: [{ pos: 0, color: '#1b1b3a' }, { pos: 1, color: '#d4f74a' }] },
]

// ---------- Effects ----------
export function bloom(src: Canvas, p: { threshold: number; size: number; burn: number }) {
  const d = imgData(src)
  const bright = new ImageData(d.width, d.height)
  for (let i = 0; i < d.data.length; i += 4) {
    const l = luminance(d.data[i], d.data[i + 1], d.data[i + 2])
    const k = clamp((l - p.threshold) / Math.max(0.01, 1 - p.threshold))
    bright.data[i] = d.data[i]; bright.data[i + 1] = d.data[i + 1]; bright.data[i + 2] = d.data[i + 2]
    bright.data[i + 3] = d.data[i + 3] * k
  }
  const glow = blurCanvas(fromData(bright), p.size)
  const c = cloneCanvas(src)
  const x = ctx2d(c)
  x.globalCompositeOperation = 'screen'
  x.globalAlpha = clamp(0.4 + p.burn)
  x.drawImage(glow, 0, 0)
  if (p.burn > 0.5) { x.globalAlpha = p.burn - 0.5; x.drawImage(glow, 0, 0) }
  x.globalCompositeOperation = 'destination-in'
  x.globalAlpha = 1
  x.drawImage(src, 0, 0)
  return c
}

export function glitch(src: Canvas, p: { amount: number; block: number; mode: 'artifact' | 'wave' | 'signal' | 'diverge'; seed: number }) {
  const w = src.width, h = src.height
  const c = makeCanvas(w, h)
  const x = ctx2d(c)
  const rand = mulberry32(p.seed)
  x.drawImage(src, 0, 0)
  if (p.mode === 'diverge') {
    const s = makeCanvas(w, h)
    const sx = ctx2d(s)
    const off = p.amount * 40
    for (const [col, dx] of [['#ff0000', -off], ['#00ff00', 0], ['#0000ff', off]] as [string, number][]) {
      const t = makeCanvas(w, h)
      const tx = ctx2d(t)
      tx.drawImage(src, dx, 0)
      tx.globalCompositeOperation = 'multiply'
      tx.fillStyle = col
      tx.fillRect(0, 0, w, h)
      tx.globalCompositeOperation = 'destination-in'
      tx.drawImage(src, dx, 0)
      sx.globalCompositeOperation = 'lighter'
      sx.drawImage(t, 0, 0)
    }
    return s
  }
  const bh = Math.max(2, Math.round(p.block * 60))
  for (let y = 0; y < h; y += bh) {
    if (p.mode === 'wave') {
      const dx = Math.sin(y * 0.02 + p.seed) * p.amount * 60
      x.clearRect(0, y, w, bh)
      x.drawImage(src, 0, y, w, bh, dx, y, w, bh)
      continue
    }
    if (rand() > p.amount) continue
    const dx = (rand() - 0.5) * p.amount * 160
    x.clearRect(0, y, w, bh)
    x.drawImage(src, 0, y, w, bh, dx, y, w, bh)
    if (p.mode === 'signal') {
      x.globalCompositeOperation = 'lighter'
      x.globalAlpha = 0.35
      x.fillStyle = rand() < 0.5 ? '#ff0040' : '#00e5ff'
      x.fillRect(0, y, w, bh)
      x.globalAlpha = 1
      x.globalCompositeOperation = 'source-over'
    }
  }
  x.globalCompositeOperation = 'destination-in'
  x.fillStyle = '#000'
  return c
}

export function halftone(src: Canvas, p: { size: number; mode: 'full' | 'screen' | 'news' }) {
  const w = src.width, h = src.height
  const d = imgData(src)
  const c = makeCanvas(w, h)
  const x = ctx2d(c)
  const cell = Math.max(3, Math.round(p.size))
  if (p.mode === 'news') { x.fillStyle = '#f3efe4'; x.fillRect(0, 0, w, h) }
  const drawDots = (angle: number, color: string, pick: (r: number, g: number, b: number) => number, comp: GlobalCompositeOperation) => {
    x.globalCompositeOperation = comp
    x.fillStyle = color
    const cos = Math.cos(angle), sin = Math.sin(angle)
    const R = Math.hypot(w, h)
    for (let v = -R; v < R; v += cell) for (let u = -R; u < R; u += cell) {
      const px = w / 2 + u * cos - v * sin, py = h / 2 + u * sin + v * cos
      if (px < -cell || py < -cell || px > w + cell || py > h + cell) continue
      const ix = clamp(Math.round(px), 0, w - 1), iy = clamp(Math.round(py), 0, h - 1)
      const k = (iy * w + ix) * 4
      if (d.data[k + 3] < 10) continue
      const amt = pick(d.data[k], d.data[k + 1], d.data[k + 2])
      const r = Math.sqrt(amt) * cell * 0.72
      if (r < 0.3) continue
      x.beginPath()
      x.arc(px, py, r, 0, Math.PI * 2)
      x.fill()
    }
  }
  if (p.mode === 'full') {
    x.fillStyle = '#fff'
    x.fillRect(0, 0, w, h)
    drawDots(0.26, '#00aeef', (r) => 1 - r / 255, 'multiply')
    drawDots(1.31, '#ec008c', (_, g) => 1 - g / 255, 'multiply')
    drawDots(0, '#fff200', (_, __, b) => 1 - b / 255, 'multiply')
    drawDots(0.79, '#231f20', (r, g, b) => clamp(1 - Math.max(r, g, b) / 255 - 0.2), 'multiply')
  } else {
    if (p.mode === 'screen') { x.fillStyle = '#fff'; x.fillRect(0, 0, w, h) }
    drawDots(0.79, '#111', (r, g, b) => 1 - luminance(r, g, b), 'source-over')
  }
  x.globalCompositeOperation = 'destination-in'
  x.drawImage(src, 0, 0)
  return c
}

export function chromatic(src: Canvas, p: { amount: number; cx: number; cy: number; falloff: number }) {
  const w = src.width, h = src.height
  const s = ctx2d(src, true).getImageData(0, 0, w, h).data
  const out = new ImageData(w, h)
  const o = out.data
  const cx = p.cx * w, cy = p.cy * h
  const maxR = Math.hypot(Math.max(cx, w - cx), Math.max(cy, h - cy))
  const amt = p.amount * 0.03
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = x - cx, dy = y - cy
    const r = Math.hypot(dx, dy) / maxR
    const k = amt * Math.pow(r, 1 + p.falloff * 2)
    const i = (y * w + x) * 4
    const rx = clamp(Math.round(x + dx * k), 0, w - 1), ry = clamp(Math.round(y + dy * k), 0, h - 1)
    const bx = clamp(Math.round(x - dx * k), 0, w - 1), by = clamp(Math.round(y - dy * k), 0, h - 1)
    const ri = (ry * w + rx) * 4, bi = (by * w + bx) * 4
    o[i] = s[ri]; o[i + 1] = s[i + 1]; o[i + 2] = s[bi + 2]
    o[i + 3] = Math.max(s[ri + 3], s[i + 3], s[bi + 3])
  }
  return fromData(out)
}

export function invert(src: Canvas) {
  return mapPixels(src, (r, g, b, o) => { o[0] = 255 - r; o[1] = 255 - g; o[2] = 255 - b })
}

export function threshold(src: Canvas, p: { level: number }) {
  return mapPixels(src, (r, g, b, o) => { const v = luminance(r, g, b) >= p.level ? 255 : 0; o[0] = o[1] = o[2] = v })
}

export function posterize(src: Canvas, p: { levels: number }) {
  const n = Math.max(2, Math.round(p.levels)) - 1
  return mapPixels(src, (r, g, b, o) => {
    o[0] = Math.round((r / 255) * n) / n * 255
    o[1] = Math.round((g / 255) * n) / n * 255
    o[2] = Math.round((b / 255) * n) / n * 255
  })
}

export function levels(src: Canvas, p: { black: number; white: number; gamma: number }) {
  const lut = new Uint8Array(256)
  for (let i = 0; i < 256; i++) {
    const v = clamp((i / 255 - p.black) / Math.max(0.01, p.white - p.black))
    lut[i] = Math.round(Math.pow(v, 1 / p.gamma) * 255)
  }
  return mapPixels(src, (r, g, b, o) => { o[0] = lut[r]; o[1] = lut[g]; o[2] = lut[b] })
}

/** Restrict a filtered result to the selection (keeping the original outside it). */
export function withinSelection(original: Canvas, filtered: Canvas, sel: Canvas | null): Canvas {
  if (!sel) return filtered
  const out = cloneCanvas(original)
  const x = ctx2d(out)
  x.globalCompositeOperation = 'destination-out'
  x.drawImage(sel, 0, 0)
  const f = cloneCanvas(filtered)
  const fx = ctx2d(f)
  fx.globalCompositeOperation = 'destination-in'
  fx.drawImage(sel, 0, 0)
  x.globalCompositeOperation = 'source-over'
  x.drawImage(f, 0, 0)
  return out
}
