// Liquify: a backward displacement field sampled bilinearly. Output(p) = Source(p + D(p)).
import { clamp, ctx2d, makeCanvas, mulberry32, type Canvas } from './util'

export type LiquifyMode = 'push' | 'twirlR' | 'twirlL' | 'pinch' | 'expand' | 'crystals' | 'edge' | 'reconstruct'

export class Liquify {
  w: number
  h: number
  src: ImageData
  out: Canvas
  private outImg: ImageData
  private step: number
  private gw: number
  private gh: number
  dx: Float32Array
  dy: Float32Array
  private rand = mulberry32(3)
  private dirty: { x0: number; y0: number; x1: number; y1: number } | null = null

  constructor(source: Canvas) {
    this.w = source.width
    this.h = source.height
    this.src = ctx2d(source, true).getImageData(0, 0, this.w, this.h)
    this.step = this.w * this.h > 6e6 ? 4 : 2
    this.gw = Math.ceil(this.w / this.step) + 1
    this.gh = Math.ceil(this.h / this.step) + 1
    this.dx = new Float32Array(this.gw * this.gh)
    this.dy = new Float32Array(this.gw * this.gh)
    this.out = makeCanvas(this.w, this.h)
    ctx2d(this.out).putImageData(this.src, 0, 0)
    this.outImg = new ImageData(new Uint8ClampedArray(this.src.data), this.w, this.h)
  }

  apply(mode: LiquifyMode, x: number, y: number, px: number, py: number, radius: number, pressure: number, distortion: number) {
    const s = this.step
    const r2 = radius * radius
    const gx0 = Math.max(0, Math.floor((x - radius) / s)), gx1 = Math.min(this.gw - 1, Math.ceil((x + radius) / s))
    const gy0 = Math.max(0, Math.floor((y - radius) / s)), gy1 = Math.min(this.gh - 1, Math.ceil((y + radius) / s))
    const mx = x - px, my = y - py
    const k = pressure * 0.5
    for (let gy = gy0; gy <= gy1; gy++) for (let gx = gx0; gx <= gx1; gx++) {
      const X = gx * s, Y = gy * s
      const vx = X - x, vy = Y - y
      const d2 = vx * vx + vy * vy
      if (d2 > r2) continue
      const f = Math.pow(1 - d2 / r2, 2) * k
      const i = gy * this.gw + gx
      switch (mode) {
        case 'push':
          this.dx[i] -= mx * f * 1.6
          this.dy[i] -= my * f * 1.6
          break
        case 'twirlR':
        case 'twirlL': {
          const a = (mode === 'twirlR' ? 1 : -1) * f * 0.25
          const c = Math.cos(a), sn = Math.sin(a)
          this.dx[i] += vx - (vx * c - vy * sn)
          this.dy[i] += vy - (vx * sn + vy * c)
          break
        }
        case 'pinch':
          this.dx[i] += vx * f * 0.12
          this.dy[i] += vy * f * 0.12
          break
        case 'expand':
          this.dx[i] -= vx * f * 0.12
          this.dy[i] -= vy * f * 0.12
          break
        case 'crystals':
          this.dx[i] += (this.rand() - 0.5) * radius * f * 0.3
          this.dy[i] += (this.rand() - 0.5) * radius * f * 0.3
          break
        case 'edge': {
          const len = Math.sqrt(d2) || 1
          this.dx[i] += (vx / len) * f * radius * 0.06
          this.dy[i] += (vy / len) * f * radius * 0.06
          break
        }
        case 'reconstruct':
          this.dx[i] *= 1 - clamp(f * 1.5)
          this.dy[i] *= 1 - clamp(f * 1.5)
          break
      }
      if (distortion > 0 && mode !== 'reconstruct') {
        this.dx[i] += (this.rand() - 0.5) * distortion * f * 6
        this.dy[i] += (this.rand() - 0.5) * distortion * f * 6
      }
    }
    const d = this.dirty || { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity }
    d.x0 = Math.min(d.x0, x - radius); d.y0 = Math.min(d.y0, y - radius)
    d.x1 = Math.max(d.x1, x + radius); d.y1 = Math.max(d.y1, y + radius)
    this.dirty = d
  }

  reset() {
    this.dx.fill(0)
    this.dy.fill(0)
    this.dirty = { x0: 0, y0: 0, x1: this.w, y1: this.h }
    this.render()
  }

  /** Re-sample the dirty region into the output canvas. */
  render() {
    if (!this.dirty) return
    const x0 = Math.max(0, Math.floor(this.dirty.x0)), y0 = Math.max(0, Math.floor(this.dirty.y0))
    const x1 = Math.min(this.w, Math.ceil(this.dirty.x1)), y1 = Math.min(this.h, Math.ceil(this.dirty.y1))
    this.dirty = null
    if (x1 <= x0 || y1 <= y0) return
    const s = this.step, W = this.w, H = this.h, gw = this.gw
    const src = this.src.data, out = this.outImg.data
    for (let y = y0; y < y1; y++) {
      const fy = y / s, gy = Math.floor(fy), ty = fy - gy
      for (let x = x0; x < x1; x++) {
        const fx = x / s, gx = Math.floor(fx), tx = fx - gx
        const i00 = gy * gw + gx, i10 = i00 + 1, i01 = i00 + gw, i11 = i01 + 1
        const ddx = (this.dx[i00] * (1 - tx) + this.dx[i10] * tx) * (1 - ty) + (this.dx[i01] * (1 - tx) + this.dx[i11] * tx) * ty
        const ddy = (this.dy[i00] * (1 - tx) + this.dy[i10] * tx) * (1 - ty) + (this.dy[i01] * (1 - tx) + this.dy[i11] * tx) * ty
        let sx = x + ddx, sy = y + ddy
        sx = sx < 0 ? 0 : sx > W - 1.001 ? W - 1.001 : sx
        sy = sy < 0 ? 0 : sy > H - 1.001 ? H - 1.001 : sy
        const ix = sx | 0, iy = sy | 0, ax = sx - ix, ay = sy - iy
        const p00 = (iy * W + ix) * 4, p10 = p00 + 4, p01 = p00 + W * 4, p11 = p01 + 4
        const o = (y * W + x) * 4
        for (let c = 0; c < 4; c++) {
          out[o + c] = (src[p00 + c] * (1 - ax) + src[p10 + c] * ax) * (1 - ay) + (src[p01 + c] * (1 - ax) + src[p11 + c] * ax) * ay
        }
      }
    }
    ctx2d(this.out).putImageData(this.outImg, 0, 0, x0, y0, x1 - x0, y1 - y0)
  }
}
