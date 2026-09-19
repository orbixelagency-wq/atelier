// Procedural brush tips (white on transparent) and grain textures (grayscale → alpha).
import type { Brush, GrainSource, TipSource } from './types'
import { ctx2d, makeCanvas, mulberry32, type Canvas } from './util'

const TIP = 128
const tipCache = new Map<string, Canvas>()
const imageTips = new Map<string, Canvas>()

function radial(x: CanvasRenderingContext2D, r: number, hardness: number, cx = TIP / 2, cy = TIP / 2) {
  const g = x.createRadialGradient(cx, cy, 0, cx, cy, r)
  const h = Math.min(0.999, Math.max(0, hardness))
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(h, 'rgba(255,255,255,1)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  x.fillStyle = g
  x.beginPath()
  x.arc(cx, cy, r, 0, Math.PI * 2)
  x.fill()
}

function speckle(x: CanvasRenderingContext2D, n: number, radius: number, dot: number, rand: () => number, falloff = true) {
  x.fillStyle = '#fff'
  for (let i = 0; i < n; i++) {
    const a = rand() * Math.PI * 2
    const d = (falloff ? Math.sqrt(rand()) : rand()) * radius
    const s = dot * (0.4 + rand() * 0.8)
    x.globalAlpha = 0.35 + rand() * 0.65
    x.beginPath()
    x.arc(TIP / 2 + Math.cos(a) * d, TIP / 2 + Math.sin(a) * d, s, 0, Math.PI * 2)
    x.fill()
  }
  x.globalAlpha = 1
}

/** Knock random holes into the tip to create a dry, grainy edge. */
function erode(c: Canvas, amount: number, rand: () => number, edgeOnly = true) {
  const x = ctx2d(c, true)
  const img = x.getImageData(0, 0, TIP, TIP)
  const d = img.data
  for (let y = 0; y < TIP; y++) for (let i = 0; i < TIP; i++) {
    const k = (y * TIP + i) * 4
    const dx = i - TIP / 2, dy = y - TIP / 2
    const r = Math.sqrt(dx * dx + dy * dy) / (TIP / 2)
    const w = edgeOnly ? Math.pow(r, 2) : 1
    if (rand() < amount * w) d[k + 3] = d[k + 3] * rand() * 0.4
  }
  x.putImageData(img, 0, 0)
}

function star(x: CanvasRenderingContext2D, points: number, outer: number, inner: number) {
  x.beginPath()
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 ? inner : outer
    const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2
    const px = TIP / 2 + Math.cos(a) * r, py = TIP / 2 + Math.sin(a) * r
    i ? x.lineTo(px, py) : x.moveTo(px, py)
  }
  x.closePath()
  x.fill()
}

function buildTip(source: TipSource, hardness: number): Canvas {
  const c = makeCanvas(TIP, TIP)
  const x = ctx2d(c)
  const R = TIP / 2 - 1
  const rand = mulberry32(source.length * 977 + Math.round(hardness * 100))
  x.fillStyle = '#fff'
  switch (source) {
    case 'round':
      radial(x, R, 0.55 + hardness * 0.44)
      break
    case 'soft':
      radial(x, R, hardness * 0.5)
      break
    case 'square':
      x.fillRect(8, 8, TIP - 16, TIP - 16)
      break
    case 'flat':
      x.fillRect(4, TIP / 2 - 10, TIP - 8, 20)
      break
    case 'pencil':
      radial(x, R, 0.6 + hardness * 0.3)
      erode(c, 0.55, rand, false)
      break
    case 'charcoal': {
      x.beginPath()
      for (let i = 0; i < 40; i++) {
        const a = (i / 40) * Math.PI * 2
        const r = R * (0.7 + rand() * 0.3)
        const px = TIP / 2 + Math.cos(a) * r, py = TIP / 2 + Math.sin(a) * r
        i ? x.lineTo(px, py) : x.moveTo(px, py)
      }
      x.closePath()
      x.fill()
      erode(c, 0.75, rand, false)
      break
    }
    case 'chalk':
      radial(x, R, 0.85)
      erode(c, 0.9, rand, true)
      erode(c, 0.25, rand, false)
      break
    case 'spray':
      speckle(x, 420, R, 1.1, rand)
      break
    case 'splatter':
      speckle(x, 40, R * 0.95, 5, rand, false)
      speckle(x, 90, R, 1.8, rand, false)
      break
    case 'dots':
      speckle(x, 14, R * 0.8, 7, rand, false)
      break
    case 'bristle': {
      for (let i = 0; i < 26; i++) {
        const px = 10 + rand() * (TIP - 20)
        const py = TIP / 2 + (rand() - 0.5) * 30
        const s = 2 + rand() * 5
        x.globalAlpha = 0.5 + rand() * 0.5
        x.beginPath()
        x.ellipse(px, py, s, s * 1.6, 0, 0, Math.PI * 2)
        x.fill()
      }
      x.globalAlpha = 1
      break
    }
    case 'leaf':
      x.beginPath()
      x.moveTo(TIP / 2, 6)
      x.quadraticCurveTo(TIP - 18, TIP / 2, TIP / 2, TIP - 6)
      x.quadraticCurveTo(18, TIP / 2, TIP / 2, 6)
      x.fill()
      x.globalCompositeOperation = 'destination-out'
      x.lineWidth = 2
      x.strokeStyle = '#fff'
      x.beginPath()
      x.moveTo(TIP / 2, 12)
      x.lineTo(TIP / 2, TIP - 12)
      x.stroke()
      break
    case 'star':
      star(x, 5, R, R * 0.42)
      break
    case 'sparkle':
      star(x, 4, R, R * 0.12)
      radial(x, R * 0.35, 0.2)
      break
    case 'cloud':
      for (let i = 0; i < 9; i++) {
        const a = rand() * Math.PI * 2, d = rand() * R * 0.45
        radial(x, R * (0.3 + rand() * 0.25), 0.3, TIP / 2 + Math.cos(a) * d, TIP / 2 + Math.sin(a) * d)
      }
      break
    case 'grass':
      x.strokeStyle = '#fff'
      x.lineCap = 'round'
      for (let i = 0; i < 14; i++) {
        const bx = 20 + rand() * (TIP - 40)
        x.lineWidth = 1.5 + rand() * 2.5
        x.beginPath()
        x.moveTo(bx, TIP - 6)
        x.quadraticCurveTo(bx + (rand() - 0.5) * 30, TIP / 2, bx + (rand() - 0.5) * 50, 8 + rand() * 40)
        x.stroke()
      }
      break
    case 'hatch':
      x.strokeStyle = '#fff'
      x.lineWidth = 3
      for (let i = -TIP; i < TIP * 2; i += 12) {
        x.beginPath()
        x.moveTo(i, 0)
        x.lineTo(i + TIP, TIP)
        x.stroke()
      }
      x.globalCompositeOperation = 'destination-in'
      radial(x, R, 0.8)
      break
    case 'noise': {
      const img = x.createImageData(TIP, TIP)
      for (let i = 0; i < img.data.length; i += 4) {
        img.data[i] = img.data[i + 1] = img.data[i + 2] = 255
        img.data[i + 3] = rand() * 255
      }
      x.putImageData(img, 0, 0)
      x.globalCompositeOperation = 'destination-in'
      radial(x, R, 0.6)
      break
    }
    case 'drop':
      radial(x, R, 0.9)
      x.globalCompositeOperation = 'destination-out'
      radial(x, R * 0.8, 0.2)
      x.globalCompositeOperation = 'source-over'
      x.globalAlpha = 0.35
      radial(x, R * 0.8, 0.6)
      break
    case 'ring':
      x.lineWidth = 10
      x.strokeStyle = '#fff'
      x.beginPath()
      x.arc(TIP / 2, TIP / 2, R - 6, 0, Math.PI * 2)
      x.stroke()
      break
    // Textile tips are drawn along +x, the stroke direction (brushes use follow: 1).
    case 'stitch':
      x.beginPath()
      x.roundRect(TIP * 0.14, TIP / 2 - 7, TIP * 0.52, 14, 7)
      x.fill()
      break
    case 'dstitch':
      x.beginPath()
      x.roundRect(TIP * 0.14, TIP * 0.28 - 5, TIP * 0.5, 10, 5)
      x.roundRect(TIP * 0.14, TIP * 0.72 - 5, TIP * 0.5, 10, 5)
      x.fill()
      break
    case 'zigzag':
      x.strokeStyle = '#fff'
      x.lineWidth = 9
      x.lineCap = 'round'
      x.beginPath()
      x.moveTo(8, TIP - 12)
      x.lineTo(TIP / 2, 12)
      x.lineTo(TIP - 8, TIP - 12)
      x.stroke()
      break
    case 'zipper':
      x.fillRect(TIP * 0.08, TIP * 0.14, TIP * 0.34, TIP * 0.3)
      x.fillRect(TIP * 0.58, TIP * 0.56, TIP * 0.34, TIP * 0.3)
      x.globalAlpha = 0.55
      x.fillRect(0, TIP / 2 - 3, TIP, 6)
      break
    case 'rope':
      x.beginPath()
      x.ellipse(TIP / 2, TIP / 2, TIP * 0.42, TIP * 0.16, -Math.PI / 4, 0, Math.PI * 2)
      x.fill()
      x.globalCompositeOperation = 'destination-out'
      x.lineWidth = 3
      x.strokeStyle = '#fff'
      x.beginPath()
      x.moveTo(TIP * 0.3, TIP * 0.7)
      x.lineTo(TIP * 0.7, TIP * 0.3)
      x.stroke()
      break
    case 'overlock':
      x.strokeStyle = '#fff'
      x.lineWidth = 6
      x.beginPath()
      x.moveTo(10, TIP - 14)
      x.bezierCurveTo(TIP * 0.2, 6, TIP * 0.8, 6, TIP - 10, TIP - 14)
      x.moveTo(0, TIP - 14)
      x.lineTo(TIP, TIP - 14)
      x.stroke()
      break
    case 'satin':
      x.strokeStyle = '#fff'
      x.lineWidth = 7
      x.beginPath()
      x.moveTo(TIP * 0.35, 6)
      x.lineTo(TIP * 0.65, TIP - 6)
      x.stroke()
      break
    case 'rivet':
      x.lineWidth = 14
      x.strokeStyle = '#fff'
      x.beginPath()
      x.arc(TIP / 2, TIP / 2, R * 0.72, 0, Math.PI * 2)
      x.stroke()
      radial(x, R * 0.3, 0.8)
      break
    default:
      radial(x, R, hardness)
  }
  x.globalCompositeOperation = 'source-over'
  x.globalAlpha = 1
  return c
}

export function registerImageTip(dataUrl: string): Promise<void> {
  if (imageTips.has(dataUrl)) return Promise.resolve()
  return new Promise((res) => {
    const img = new Image()
    img.onload = () => {
      const c = makeCanvas(TIP, TIP)
      const x = ctx2d(c, true)
      const s = Math.min(TIP / img.width, TIP / img.height)
      x.drawImage(img, (TIP - img.width * s) / 2, (TIP - img.height * s) / 2, img.width * s, img.height * s)
      // Tips are defined by luminance: white paints, black is empty. If the source has transparency use it.
      const d = x.getImageData(0, 0, TIP, TIP)
      let hasAlpha = false
      for (let i = 3; i < d.data.length; i += 4) if (d.data[i] < 250) { hasAlpha = true; break }
      for (let i = 0; i < d.data.length; i += 4) {
        const l = (d.data[i] + d.data[i + 1] + d.data[i + 2]) / 3
        d.data[i + 3] = hasAlpha ? d.data[i + 3] : l
        d.data[i] = d.data[i + 1] = d.data[i + 2] = 255
      }
      x.putImageData(d, 0, 0)
      imageTips.set(dataUrl, c)
      res()
    }
    img.onerror = () => res()
    img.src = dataUrl
  })
}

export function getTip(b: Brush): Canvas {
  if (b.shape.source === 'image' && b.shape.image) {
    const t = imageTips.get(b.shape.image)
    if (t) return t
    registerImageTip(b.shape.image)
  }
  const key = `${b.shape.source}:${Math.round(b.shape.hardness * 20)}`
  let t = tipCache.get(key)
  if (!t) {
    t = buildTip(b.shape.source === 'image' ? 'round' : b.shape.source, b.shape.hardness)
    tipCache.set(key, t)
  }
  return t
}

// Tinted stamp cache: tip × color.
const stampCache = new Map<string, Canvas>()
export function getStamp(tip: Canvas, tipKey: string, color: string): Canvas {
  const key = tipKey + color
  let s = stampCache.get(key)
  if (s) return s
  if (stampCache.size > 300) stampCache.clear()
  s = makeCanvas(tip.width, tip.height)
  const x = ctx2d(s)
  x.fillStyle = color
  x.fillRect(0, 0, s.width, s.height)
  x.globalCompositeOperation = 'destination-in'
  x.drawImage(tip, 0, 0)
  stampCache.set(key, s)
  return s
}

export const tipKey = (b: Brush) => b.shape.source === 'image' ? 'img' + (b.shape.image?.length || 0) + (b.shape.image?.slice(-24) || '') : `${b.shape.source}:${Math.round(b.shape.hardness * 20)}`

// ---------------- Grain ----------------
const GRAIN = 256
const grainCache = new Map<string, Canvas>()

function valueNoise(size: number, cells: number, rand: () => number) {
  const g = new Float32Array((cells + 1) * (cells + 1)).map(() => rand())
  const out = new Float32Array(size * size)
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const fx = (x / size) * cells, fy = (y / size) * cells
    const ix = Math.floor(fx), iy = Math.floor(fy)
    const tx = fx - ix, ty = fy - iy
    const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty)
    const i0 = ix % cells, i1 = (ix + 1) % cells, j0 = iy % cells, j1 = (iy + 1) % cells
    const a = g[j0 * (cells + 1) + i0], b = g[j0 * (cells + 1) + i1]
    const c = g[j1 * (cells + 1) + i0], d = g[j1 * (cells + 1) + i1]
    out[y * size + x] = (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy
  }
  return out
}

function buildGrain(src: GrainSource): Canvas {
  const c = makeCanvas(GRAIN, GRAIN)
  const x = ctx2d(c)
  const img = x.createImageData(GRAIN, GRAIN)
  const rand = mulberry32(src.length * 31337)
  const N = GRAIN * GRAIN
  const v = new Float32Array(N)
  const add = (o: Float32Array, w: number) => { for (let i = 0; i < N; i++) v[i] += o[i] * w }
  switch (src) {
    case 'paper':
      add(valueNoise(GRAIN, 64, rand), 0.45); add(valueNoise(GRAIN, 32, rand), 0.3); add(valueNoise(GRAIN, 128, rand), 0.25)
      break
    case 'noise':
      for (let i = 0; i < N; i++) v[i] = rand()
      break
    case 'canvas': {
      // woven linen: soft warp/weft threads offset every other row, plus fibre noise
      const n = valueNoise(GRAIN, 128, rand)
      for (let y = 0; y < GRAIN; y++) for (let i = 0; i < GRAIN; i++) {
        const k = y * GRAIN + i
        const row = Math.floor(y / 4) % 2
        const wob = n[k] * 3
        const u = Math.sin(((i + row * 2 + wob) / 4) * Math.PI) ** 2
        const w = Math.sin(((y + wob) / 4) * Math.PI) ** 2
        v[k] = 0.3 + 0.25 * (row ? u : w) + 0.45 * n[k]
      }
      break
    }
    case 'charcoal': {
      const n = valueNoise(GRAIN, 128, rand)
      for (let y = 0; y < GRAIN; y++) for (let i = 0; i < GRAIN; i++) {
        const streak = Math.sin((i + y * 0.35) * 0.9 + n[y * GRAIN + i] * 6) * 0.5 + 0.5
        v[y * GRAIN + i] = Math.pow(streak * 0.5 + n[y * GRAIN + i] * 0.5, 1.6)
      }
      break
    }
    case 'watercolor':
      add(valueNoise(GRAIN, 8, rand), 0.5); add(valueNoise(GRAIN, 16, rand), 0.3); add(valueNoise(GRAIN, 64, rand), 0.2)
      break
    case 'halftone':
      for (let y = 0; y < GRAIN; y++) for (let i = 0; i < GRAIN; i++) {
        const cx = (i % 8) - 4, cy = (y % 8) - 4
        v[y * GRAIN + i] = Math.max(0, 1 - Math.sqrt(cx * cx + cy * cy) / 4)
      }
      break
    case 'wood': {
      const n = valueNoise(GRAIN, 16, rand)
      for (let y = 0; y < GRAIN; y++) for (let i = 0; i < GRAIN; i++) {
        const k = y * GRAIN + i
        v[k] = Math.pow(Math.sin(y * 0.55 + n[k] * 26 + Math.sin(i * 0.05) * 4) * 0.5 + 0.5, 0.7) * 0.6 + n[k] * 0.4
      }
      break
    }
    case 'twill': {
      // denim: 2/1 diagonal twill with slubby yarn noise
      const n = valueNoise(GRAIN, 64, rand)
      for (let y = 0; y < GRAIN; y++) for (let i = 0; i < GRAIN; i++) {
        const k = y * GRAIN + i
        const d = Math.sin(((i + y * 2) / 4) * Math.PI)
        v[k] = 0.5 + 0.35 * d + 0.3 * (n[k] - 0.5) + (rand() - 0.5) * 0.15
      }
      break
    }
    case 'knit': {
      // jersey: columns of small V loops
      const n = valueNoise(GRAIN, 128, rand)
      for (let y = 0; y < GRAIN; y++) for (let i = 0; i < GRAIN; i++) {
        const cx = (i % 8) - 3.5, cy = y % 8
        const leg = Math.abs(Math.abs(cx) - cy * 0.45)
        v[y * GRAIN + i] = Math.max(0, 1 - leg / 1.6) * 0.8 + n[y * GRAIN + i] * 0.2
      }
      break
    }
    case 'rib':
      for (let y = 0; y < GRAIN; y++) for (let i = 0; i < GRAIN; i++) v[y * GRAIN + i] = Math.sin((i / 4) * Math.PI) ** 2 * 0.85 + rand() * 0.15
      break
    case 'corduroy': {
      const n = valueNoise(GRAIN, 64, rand)
      for (let y = 0; y < GRAIN; y++) for (let i = 0; i < GRAIN; i++) v[y * GRAIN + i] = Math.pow(Math.sin((i / 8) * Math.PI) ** 2, 0.6) * 0.75 + n[y * GRAIN + i] * 0.25
      break
    }
    case 'leather': {
      const a = valueNoise(GRAIN, 32, rand), b2 = valueNoise(GRAIN, 64, rand)
      for (let i = 0; i < N; i++) v[i] = Math.min(1, Math.abs(a[i] - 0.5) * 6) * 0.7 + Math.min(1, Math.abs(b2[i] - 0.5) * 5) * 0.3
      break
    }
    case 'fleece':
      add(valueNoise(GRAIN, 128, rand), 0.5); add(valueNoise(GRAIN, 64, rand), 0.3)
      for (let i = 0; i < N; i++) v[i] += rand() * 0.2
      break
    case 'mesh':
      for (let y = 0; y < GRAIN; y++) for (let i = 0; i < GRAIN; i++) {
        const cx = ((i + (Math.floor(y / 8) % 2) * 4) % 8) - 4, cy = (y % 8) - 4
        v[y * GRAIN + i] = Math.min(1, Math.sqrt(cx * cx + cy * cy) / 2.6)
      }
      break
    case 'concrete':
      add(valueNoise(GRAIN, 128, rand), 0.5)
      for (let i = 0; i < N; i++) v[i] += rand() * 0.5
      break
    default:
      v.fill(1)
  }
  let mn = Infinity, mx = -Infinity
  for (let i = 0; i < N; i++) { if (v[i] < mn) mn = v[i]; if (v[i] > mx) mx = v[i] }
  const r = mx - mn || 1
  for (let i = 0; i < N; i++) {
    const g = ((v[i] - mn) / r) * 255
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = g
    img.data[i * 4 + 3] = 255
  }
  x.putImageData(img, 0, 0)
  return c
}

export function getGrain(src: GrainSource): Canvas {
  let g = grainCache.get(src)
  if (!g) { g = buildGrain(src); grainCache.set(src, g) }
  return g
}

/** Grain as an alpha mask with the given depth: alpha = 1 - depth·(1 - lum). */
const grainAlphaCache = new Map<string, Canvas>()
export function getGrainAlpha(src: GrainSource, depth: number): Canvas {
  const key = src + Math.round(depth * 20)
  let c = grainAlphaCache.get(key)
  if (c) return c
  const g = getGrain(src)
  c = makeCanvas(GRAIN, GRAIN)
  const x = ctx2d(c)
  const d = ctx2d(g, true).getImageData(0, 0, GRAIN, GRAIN)
  for (let i = 0; i < d.data.length; i += 4) {
    const l = d.data[i] / 255
    d.data[i + 3] = (1 - depth * (1 - l)) * 255
    d.data[i] = d.data[i + 1] = d.data[i + 2] = 255
  }
  x.putImageData(d, 0, 0)
  grainAlphaCache.set(key, c)
  return c
}

export const GRAIN_SOURCES: [GrainSource, string][] = [
  ['none', 'Ninguno'], ['paper', 'Papel'], ['canvas', 'Lienzo'], ['noise', 'Ruido'], ['charcoal', 'Carbón'],
  ['watercolor', 'Acuarela'], ['halftone', 'Semitono'], ['wood', 'Madera'], ['concrete', 'Hormigón'],
  ['twill', 'Denim'], ['knit', 'Punto'], ['rib', 'Canalé'], ['corduroy', 'Pana'], ['leather', 'Piel'], ['fleece', 'Polar'], ['mesh', 'Malla'],
]

export const TIP_SOURCES: [TipSource, string][] = [
  ['round', 'Redonda'], ['soft', 'Difusa'], ['square', 'Cuadrada'], ['flat', 'Plana'], ['pencil', 'Lápiz'],
  ['charcoal', 'Carbón'], ['chalk', 'Tiza'], ['spray', 'Spray'], ['splatter', 'Salpicadura'], ['bristle', 'Cerdas'],
  ['dots', 'Puntos'], ['hatch', 'Tramado'], ['noise', 'Ruido'], ['drop', 'Gota'], ['ring', 'Anillo'],
  ['leaf', 'Hoja'], ['star', 'Estrella'], ['sparkle', 'Destello'], ['cloud', 'Nube'], ['grass', 'Hierba'],
  ['stitch', 'Puntada'], ['dstitch', 'Puntada doble'], ['zigzag', 'Zigzag'], ['zipper', 'Cremallera'], ['rope', 'Cordón'],
  ['overlock', 'Overlock'], ['satin', 'Satinado'], ['rivet', 'Remache'], ['image', 'Imagen'],
]
