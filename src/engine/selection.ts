// Selections are alpha masks (white, alpha = selected amount) the size of the document.
import { floodMask, maskToCanvas } from './fill'
import { blurCanvas } from './filters'
import { cloneCanvas, ctx2d, makeCanvas, type Canvas } from './util'

export type Pt = { x: number; y: number }

export function shapeMask(w: number, h: number, draw: (x: CanvasRenderingContext2D) => void): Canvas {
  const c = makeCanvas(w, h)
  const x = ctx2d(c)
  x.fillStyle = '#fff'
  x.beginPath()
  draw(x)
  x.fill()
  return c
}

export const rectMask = (w: number, h: number, a: Pt, b: Pt) =>
  shapeMask(w, h, (x) => x.rect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y)))

export const ellipseMask = (w: number, h: number, a: Pt, b: Pt) =>
  shapeMask(w, h, (x) => x.ellipse((a.x + b.x) / 2, (a.y + b.y) / 2, Math.abs(b.x - a.x) / 2, Math.abs(b.y - a.y) / 2, 0, 0, Math.PI * 2))

export const polyMask = (w: number, h: number, pts: Pt[]) =>
  shapeMask(w, h, (x) => { pts.forEach((p, i) => (i ? x.lineTo(p.x, p.y) : x.moveTo(p.x, p.y))); x.closePath() })

export function autoMask(src: Canvas, p: Pt, threshold: number): Canvas | null {
  const m = floodMask(src, p.x, p.y, threshold)
  if (!m) return null
  return maskToCanvas(m, src.width, src.height)
}

/** Combine a new shape with the existing selection. */
export function combine(prev: Canvas | null, next: Canvas, op: 'replace' | 'add' | 'subtract'): Canvas {
  if (!prev || op === 'replace') return next
  const c = cloneCanvas(prev)
  const x = ctx2d(c)
  x.globalCompositeOperation = op === 'add' ? 'source-over' : 'destination-out'
  x.drawImage(next, 0, 0)
  return c
}

export function invertMask(m: Canvas): Canvas {
  const c = makeCanvas(m.width, m.height)
  const x = ctx2d(c)
  x.fillStyle = '#fff'
  x.fillRect(0, 0, c.width, c.height)
  x.globalCompositeOperation = 'destination-out'
  x.drawImage(m, 0, 0)
  return c
}

export function featherMask(m: Canvas, radius: number): Canvas {
  if (radius <= 0) return m
  return blurCanvas(m, radius)
}

export function isEmpty(m: Canvas): boolean {
  const s = 64
  const t = makeCanvas(s, s)
  const x = ctx2d(t, true)
  x.drawImage(m, 0, 0, s, s)
  const d = x.getImageData(0, 0, s, s).data
  for (let i = 3; i < d.length; i += 4) if (d[i] > 0) return false
  return true
}

/** Diagonal stripes over the unselected area — the marching overlay. */
let stripe: Canvas | null = null
export function selectionOverlay(sel: Canvas, out: Canvas, phase: number, scale = 1) {
  if (!stripe) {
    stripe = makeCanvas(16, 16)
    const g = ctx2d(stripe)
    g.strokeStyle = 'rgba(20,20,22,0.32)'
    g.lineWidth = 5
    for (let i = -16; i <= 32; i += 8) { g.beginPath(); g.moveTo(i, 16); g.lineTo(i + 16, 0); g.stroke() }
  }
  if (out.width !== sel.width || out.height !== sel.height) { out.width = sel.width; out.height = sel.height }
  const x = ctx2d(out)
  x.setTransform(1, 0, 0, 1, 0, 0)
  x.globalCompositeOperation = 'source-over'
  x.clearRect(0, 0, out.width, out.height)
  const pat = x.createPattern(stripe, 'repeat')!
  pat.setTransform(new DOMMatrix().scale(scale, scale).translate(phase % 16, 0))
  x.fillStyle = pat
  x.fillRect(0, 0, out.width, out.height)
  x.globalCompositeOperation = 'destination-out'
  x.drawImage(sel, 0, 0)
  x.globalCompositeOperation = 'source-over'
}
