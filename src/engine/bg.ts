// Background removal for artwork that is going to be printed on a garment.
import { blurCanvas } from './filters'
import { cloneCanvas, contentBounds, ctx2d, hexToRgb, makeCanvas, type Canvas } from './util'

export interface BgOptions {
  mode: 'auto' | 'color'
  color: string // used by 'color'
  tolerance: number // 0-1
  softness: number // edge feather in px
  shrink: number // px of matte erosion, kills white fringes
  trim: boolean // crop to the remaining artwork
}

const dist2 = (a: number[], r: number, g: number, b: number) => (a[0] - r) ** 2 + (a[1] - g) ** 2 + (a[2] - b) ** 2

/** Average colour of the image border — what a flat studio background looks like. */
function borderColor(d: Uint8ClampedArray, w: number, h: number): [number, number, number] {
  let r = 0, g = 0, b = 0, n = 0
  const sample = (x: number, y: number) => { const i = (y * w + x) * 4; if (d[i + 3] > 8) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++ } }
  for (let x = 0; x < w; x++) { sample(x, 0); sample(x, h - 1) }
  for (let y = 0; y < h; y++) { sample(0, y); sample(w - 1, y) }
  return n ? [r / n, g / n, b / n] : [255, 255, 255]
}

/**
 * Returns a copy of `src` with the background knocked out.
 * 'auto' floods inwards from the edges, so only background connected to the border goes
 * (a white shape inside the design survives). 'color' removes that colour everywhere.
 */
export function removeBackground(src: Canvas, o: BgOptions): Canvas {
  const w = src.width, h = src.height
  const out = cloneCanvas(src)
  const x = ctx2d(out, true)
  const img = x.getImageData(0, 0, w, h)
  const d = img.data
  const tol = (o.tolerance * 441) ** 2
  const target: [number, number, number] = o.mode === 'color'
    ? (() => { const c = hexToRgb(o.color); return [c.r, c.g, c.b] })()
    : borderColor(d, w, h)

  const alpha = new Uint8Array(w * h) // 255 = keep
  alpha.fill(255)
  if (o.mode === 'color') {
    for (let p = 0, i = 0; p < alpha.length; p++, i += 4) {
      if (dist2(target, d[i], d[i + 1], d[i + 2]) <= tol) alpha[p] = 0
    }
  } else {
    // scanline flood from every border pixel
    const stack: number[] = []
    const visited = new Uint8Array(w * h)
    const match = (p: number) => {
      const i = p * 4
      return d[i + 3] < 8 || dist2(target, d[i], d[i + 1], d[i + 2]) <= tol
    }
    const push = (px: number, py: number) => {
      const p = py * w + px
      if (!visited[p] && match(p)) { visited[p] = 1; alpha[p] = 0; stack.push(p) }
    }
    for (let i = 0; i < w; i++) { push(i, 0); push(i, h - 1) }
    for (let j = 0; j < h; j++) { push(0, j); push(w - 1, j) }
    while (stack.length) {
      const p = stack.pop()!
      const px = p % w, py = (p / w) | 0
      if (px > 0) push(px - 1, py)
      if (px < w - 1) push(px + 1, py)
      if (py > 0) push(px, py - 1)
      if (py < h - 1) push(px, py + 1)
    }
  }

  // erode the kept area to bite off the halo the background leaves on the edge
  let keep = alpha
  for (let s = 0; s < Math.round(o.shrink); s++) {
    const next = new Uint8Array(keep)
    for (let y = 0; y < h; y++) for (let i = 0; i < w; i++) {
      const p = y * w + i
      if (!keep[p]) continue
      if ((i > 0 && !keep[p - 1]) || (i < w - 1 && !keep[p + 1]) || (y > 0 && !keep[p - w]) || (y < h - 1 && !keep[p + w])) next[p] = 0
    }
    keep = next
  }
  for (let p = 0, i = 3; p < keep.length; p++, i += 4) if (!keep[p]) d[i] = 0
  x.putImageData(img, 0, 0)

  let result = out
  if (o.softness > 0.1) {
    // feather only the alpha channel
    const mask = makeCanvas(w, h)
    const mx = ctx2d(mask)
    mx.drawImage(out, 0, 0)
    const soft = blurCanvas(mask, o.softness)
    const r2 = cloneCanvas(src)
    const rx = ctx2d(r2)
    rx.globalCompositeOperation = 'destination-in'
    rx.drawImage(soft, 0, 0)
    result = r2
  }
  if (o.trim) {
    const b = contentBounds(result)
    if (b && (b.w < w || b.h < h)) {
      const t = makeCanvas(b.w, b.h)
      ctx2d(t).drawImage(result, b.x, b.y, b.w, b.h, 0, 0, b.w, b.h)
      result = t
    }
  }
  return result
}

/** Quick check used by the UI: does the image look like it has a flat background to remove? */
export function looksLikeFlatBackground(src: Canvas): boolean {
  const s = makeCanvas(60, 60)
  const x = ctx2d(s, true)
  x.drawImage(src, 0, 0, 60, 60)
  const d = x.getImageData(0, 0, 60, 60).data
  const c = borderColor(d, 60, 60)
  let same = 0, total = 0
  const check = (x2: number, y2: number) => {
    const i = (y2 * 60 + x2) * 4
    total++
    if (d[i + 3] > 8 && dist2(c, d[i], d[i + 1], d[i + 2]) < 900) same++
  }
  for (let i = 0; i < 60; i++) { check(i, 0); check(i, 59); check(0, i); check(59, i) }
  return same / total > 0.8
}
