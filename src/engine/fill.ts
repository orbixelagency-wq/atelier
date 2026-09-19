import { ctx2d, hexToRgb, makeCanvas, type Canvas } from './util'

/**
 * Scanline flood fill over `src` from (sx,sy). Returns a mask (Uint8 0/255) of the region whose
 * color is within `threshold` (0-1) of the seed color. Alpha participates in the distance.
 */
export function floodMask(src: Canvas, sx: number, sy: number, threshold: number): Uint8Array | null {
  const w = src.width, h = src.height
  sx = Math.floor(sx); sy = Math.floor(sy)
  if (sx < 0 || sy < 0 || sx >= w || sy >= h) return null
  const data = ctx2d(src, true).getImageData(0, 0, w, h).data
  const i0 = (sy * w + sx) * 4
  const r0 = data[i0], g0 = data[i0 + 1], b0 = data[i0 + 2], a0 = data[i0 + 3]
  const tol = threshold * threshold * 4 * 255 * 255
  const out = new Uint8Array(w * h)
  const match = (p: number) => {
    const k = p * 4
    const a = data[k + 3]
    // Treat fully transparent pixels as equal regardless of their RGB.
    if (a0 < 8 && a < 8) return true
    const dr = data[k] - r0, dg = data[k + 1] - g0, db = data[k + 2] - b0, da = a - a0
    return dr * dr + dg * dg + db * db + da * da * 1.5 <= tol
  }
  const stack: number[] = [sx, sy]
  while (stack.length) {
    const y = stack.pop()!, x0 = stack.pop()!
    let x = x0
    let p = y * w + x
    while (x >= 0 && !out[p] && match(p)) { x--; p-- }
    x++; p++
    let up = false, down = false
    while (x < w && !out[p] && match(p)) {
      out[p] = 255
      if (y > 0) {
        const q = p - w
        if (!out[q] && match(q)) { if (!up) { stack.push(x, y - 1); up = true } } else up = false
      }
      if (y < h - 1) {
        const q = p + w
        if (!out[q] && match(q)) { if (!down) { stack.push(x, y + 1); down = true } } else down = false
      }
      x++; p++
    }
  }
  return out
}

/** Grow a binary mask by n pixels so fills tuck under antialiased line edges. */
export function dilate(mask: Uint8Array, w: number, h: number, n: number): Uint8Array {
  let cur = mask
  for (let it = 0; it < n; it++) {
    const next = new Uint8Array(cur)
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const p = y * w + x
      if (cur[p]) continue
      if ((x > 0 && cur[p - 1]) || (x < w - 1 && cur[p + 1]) || (y > 0 && cur[p - w]) || (y < h - 1 && cur[p + w])) next[p] = 255
    }
    cur = next
  }
  return cur
}

export function maskToCanvas(mask: Uint8Array, w: number, h: number, color = '#ffffff'): Canvas {
  const c = makeCanvas(w, h)
  const x = ctx2d(c)
  const img = x.createImageData(w, h)
  const { r, g, b } = hexToRgb(color)
  for (let p = 0, k = 0; p < mask.length; p++, k += 4) {
    if (!mask[p]) continue
    img.data[k] = r; img.data[k + 1] = g; img.data[k + 2] = b; img.data[k + 3] = mask[p]
  }
  x.putImageData(img, 0, 0)
  return c
}
