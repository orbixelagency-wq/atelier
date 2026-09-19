// Repeat patterns for prints: build a seamless super-tile for the repeat type and fill with it.
import { cloneCanvas, ctx2d, luminance, makeCanvas, type Canvas } from './util'

export type RepeatType = 'grid' | 'halfdrop' | 'brick' | 'mirror'
export const REPEATS: [RepeatType, string][] = [['grid', 'Cuadrícula'], ['halfdrop', 'Media gota'], ['brick', 'Ladrillo'], ['mirror', 'Espejo']]

export interface PatternOpts { scale: number; rotation: number; repeat: RepeatType; offsetX: number; offsetY: number; gap: number }

export function superTile(tile: Canvas, repeat: RepeatType, gap = 0): Canvas {
  const w = tile.width + gap, h = tile.height + gap
  if (repeat === 'grid') {
    if (!gap) return tile
    const c = makeCanvas(w, h)
    ctx2d(c).drawImage(tile, 0, 0)
    return c
  }
  if (repeat === 'halfdrop') {
    const c = makeCanvas(w * 2, h)
    const x = ctx2d(c)
    x.drawImage(tile, 0, 0)
    x.drawImage(tile, w, h / 2)
    x.drawImage(tile, w, -h / 2)
    return c
  }
  if (repeat === 'brick') {
    const c = makeCanvas(w, h * 2)
    const x = ctx2d(c)
    x.drawImage(tile, 0, 0)
    x.drawImage(tile, w / 2, h)
    x.drawImage(tile, -w / 2, h)
    return c
  }
  const c = makeCanvas(w * 2, h * 2)
  const x = ctx2d(c)
  const put = (sx: number, sy: number, dx: number, dy: number) => {
    x.save(); x.translate(dx + (sx < 0 ? w : 0), dy + (sy < 0 ? h : 0)); x.scale(sx, sy); x.drawImage(tile, 0, 0); x.restore()
  }
  put(1, 1, 0, 0); put(-1, 1, w, 0); put(1, -1, 0, h); put(-1, -1, w, h)
  return c
}

/** A canvas of size w×h filled with the repeated tile. */
export function patternFill(tile: Canvas, w: number, h: number, o: PatternOpts): Canvas {
  const out = makeCanvas(w, h)
  const x = ctx2d(out)
  const st = superTile(tile, o.repeat, o.gap)
  const pat = x.createPattern(st, 'repeat')!
  pat.setTransform(new DOMMatrix().translate(w / 2 + o.offsetX, h / 2 + o.offsetY).rotate(o.rotation).scale(o.scale, o.scale))
  x.fillStyle = pat
  x.fillRect(0, 0, w, h)
  return out
}

/** Wrap-shift by half a tile: shows the seams so they can be painted out. */
export function offsetHalf(src: Canvas, fx = 0.5, fy = 0.5): Canvas {
  const w = src.width, h = src.height
  const dx = Math.round(w * fx), dy = Math.round(h * fy)
  const c = makeCanvas(w, h)
  const x = ctx2d(c)
  for (const ox of [dx - w, dx]) for (const oy of [dy - h, dy]) x.drawImage(src, ox, oy)
  return c
}

// ---------- colorways ----------
export interface ColorPair { from: [number, number, number]; to: [number, number, number] }

/** Replace each source colour by its target, keeping the shading difference (folds, texture). */
export function recolor(src: Canvas, pairs: ColorPair[], tolerance = 0.22, keepShading = true): Canvas {
  const c = cloneCanvas(src)
  const x = ctx2d(c, true)
  const img = x.getImageData(0, 0, c.width, c.height)
  const d = img.data
  const tol = (tolerance * 441) ** 2
  const cache = new Map<number, number>()
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue
    const r = d[i], g = d[i + 1], b = d[i + 2]
    const key = (r << 16) | (g << 8) | b
    let best = cache.get(key)
    if (best === undefined) {
      best = -1
      let bd = tol
      for (let k = 0; k < pairs.length; k++) {
        const f = pairs[k].from
        const dd = (r - f[0]) ** 2 + (g - f[1]) ** 2 + (b - f[2]) ** 2
        if (dd <= bd) { bd = dd; best = k }
      }
      cache.set(key, best)
    }
    if (best < 0) continue
    const { from, to } = pairs[best]
    if (keepShading) {
      // carry the luminance offset so folds and texture survive the recolour
      const dl = (luminance(r, g, b) - luminance(from[0], from[1], from[2])) * 255
      d[i] = Math.max(0, Math.min(255, to[0] + dl))
      d[i + 1] = Math.max(0, Math.min(255, to[1] + dl))
      d[i + 2] = Math.max(0, Math.min(255, to[2] + dl))
    } else { d[i] = to[0]; d[i + 1] = to[1]; d[i + 2] = to[2] }
  }
  x.putImageData(img, 0, 0)
  return c
}

/** Dominant colours of a canvas (k-means on a downsample), most common first. */
export function dominantColors(src: Canvas, k = 6): [number, number, number][] {
  const s = Math.min(1, 140 / Math.max(src.width, src.height))
  const t = makeCanvas(src.width * s, src.height * s)
  const x = ctx2d(t, true)
  x.imageSmoothingEnabled = false
  x.drawImage(src, 0, 0, t.width, t.height)
  const d = x.getImageData(0, 0, t.width, t.height).data
  const px: number[][] = []
  for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200) px.push([d[i], d[i + 1], d[i + 2]])
  if (!px.length) return []
  const cent: number[][] = [px[0]]
  while (cent.length < Math.min(k, px.length)) {
    let best = px[0], bd = -1
    for (let i = 0; i < px.length; i += 3) {
      let mn = Infinity
      for (const c of cent) mn = Math.min(mn, (px[i][0] - c[0]) ** 2 + (px[i][1] - c[1]) ** 2 + (px[i][2] - c[2]) ** 2)
      if (mn > bd) { bd = mn; best = px[i] }
    }
    if (bd < 300) break
    cent.push([...best])
  }
  let counts = cent.map(() => 0)
  for (let it = 0; it < 8; it++) {
    const sum = cent.map(() => [0, 0, 0, 0])
    for (const p of px) {
      let bi = 0, bd = Infinity
      for (let j = 0; j < cent.length; j++) {
        const dd = (p[0] - cent[j][0]) ** 2 + (p[1] - cent[j][1]) ** 2 + (p[2] - cent[j][2]) ** 2
        if (dd < bd) { bd = dd; bi = j }
      }
      sum[bi][0] += p[0]; sum[bi][1] += p[1]; sum[bi][2] += p[2]; sum[bi][3]++
    }
    sum.forEach((s2, j) => { if (s2[3]) cent[j] = [s2[0] / s2[3], s2[1] / s2[3], s2[2] / s2[3]] })
    counts = sum.map((s2) => s2[3])
  }
  return cent.map((c, i) => ({ c, n: counts[i] })).filter((e) => e.n > px.length * 0.01).sort((a, b) => b.n - a.n)
    .map((e) => [Math.round(e.c[0]), Math.round(e.c[1]), Math.round(e.c[2])] as [number, number, number])
}

// ---------- fabric displacement (mockups) ----------
/** Bend a flat design over a photographed garment: offsets follow the photo's luminance slope. */
export function displace(src: Canvas, map: Canvas, strength: number, softness = 2): Canvas {
  const w = src.width, h = src.height
  const mc = makeCanvas(w, h)
  const mx = ctx2d(mc, true)
  mx.filter = `blur(${softness}px)`
  mx.drawImage(map, 0, 0)
  mx.filter = 'none'
  const m = mx.getImageData(0, 0, w, h).data
  const L = new Float32Array(w * h)
  for (let i = 0, p = 0; p < L.length; i += 4, p++) L[p] = (m[i] * 0.2126 + m[i + 1] * 0.7152 + m[i + 2] * 0.0722) / 255
  const s = ctx2d(src, true).getImageData(0, 0, w, h).data
  const out = new ImageData(w, h)
  const o = out.data
  for (let y = 0; y < h; y++) for (let xx = 0; xx < w; xx++) {
    const p = y * w + xx
    const gx = L[Math.min(w - 1, xx + 1) + y * w] - L[Math.max(0, xx - 1) + y * w]
    const gy = L[xx + Math.min(h - 1, y + 1) * w] - L[xx + Math.max(0, y - 1) * w]
    const sx = Math.min(w - 1, Math.max(0, Math.round(xx + gx * strength * 10)))
    const sy = Math.min(h - 1, Math.max(0, Math.round(y + gy * strength * 10)))
    const q = (sy * w + sx) * 4, k = p * 4
    o[k] = s[q]; o[k + 1] = s[q + 1]; o[k + 2] = s[q + 2]; o[k + 3] = s[q + 3]
  }
  const c = makeCanvas(w, h)
  ctx2d(c).putImageData(out, 0, 0)
  return c
}

/** Grey shading layer from a photo, normalised so the fabric's mid-tone becomes white under multiply. */
export function shadingFrom(map: Canvas, contrast = 1.4): Canvas {
  const c = cloneCanvas(map)
  const x = ctx2d(c, true)
  const img = x.getImageData(0, 0, c.width, c.height)
  const d = img.data
  let sum = 0, n = 0
  for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 10) { sum += luminance(d[i], d[i + 1], d[i + 2]); n++ }
  const mean = n ? sum / n : 0.5
  for (let i = 0; i < d.length; i += 4) {
    const l = luminance(d[i], d[i + 1], d[i + 2])
    const v = Math.max(0, Math.min(1, 1 + (l - mean) * contrast))
    d[i] = d[i + 1] = d[i + 2] = Math.min(255, v * 255)
  }
  x.putImageData(img, 0, 0)
  return c
}
