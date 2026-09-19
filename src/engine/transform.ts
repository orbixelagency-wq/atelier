// Mesh-based transform: a source image mapped through a grid of control points.
// Freeform/uniform keep an affine quad; distort maps corners by homography; warp moves a 4×4 grid.
import { type Canvas } from './util'

export type P = { x: number; y: number }

/** 3x3 homography mapping unit square → quad (a,b,c,d clockwise from top-left). */
export function squareToQuad(q: P[]): number[] {
  const [p0, p1, p2, p3] = q
  const dx1 = p1.x - p2.x, dx2 = p3.x - p2.x, dx3 = p0.x - p1.x + p2.x - p3.x
  const dy1 = p1.y - p2.y, dy2 = p3.y - p2.y, dy3 = p0.y - p1.y + p2.y - p3.y
  let g = 0, h = 0
  if (Math.abs(dx3) > 1e-9 || Math.abs(dy3) > 1e-9) {
    const den = dx1 * dy2 - dx2 * dy1
    g = (dx3 * dy2 - dx2 * dy3) / den
    h = (dx1 * dy3 - dx3 * dy1) / den
  }
  const a = p1.x - p0.x + g * p1.x, b = p3.x - p0.x + h * p3.x, c = p0.x
  const d = p1.y - p0.y + g * p1.y, e = p3.y - p0.y + h * p3.y, f = p0.y
  return [a, b, c, d, e, f, g, h]
}

export function applyH(H: number[], u: number, v: number): P {
  const [a, b, c, d, e, f, g, h] = H
  const w = g * u + h * v + 1
  return { x: (a * u + b * v + c) / w, y: (d * u + e * v + f) / w }
}

/** Cubic Bezier patch evaluation over a 4×4 control grid (row-major). */
export function bezierPatch(ctrl: P[], u: number, v: number): P {
  const B = (t: number) => [(1 - t) ** 3, 3 * t * (1 - t) ** 2, 3 * t * t * (1 - t), t ** 3]
  const bu = B(u), bv = B(v)
  let x = 0, y = 0
  for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
    const w = bu[i] * bv[j]
    x += ctrl[j * 4 + i].x * w
    y += ctrl[j * 4 + i].y * w
  }
  return { x, y }
}

export function gridFromQuad(q: P[]): P[] {
  const H = squareToQuad(q)
  const g: P[] = []
  for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) g.push(applyH(H, i / 3, j / 3))
  return g
}

/** Draw one textured triangle (affine) from source coords s* to destination d*. */
function tri(ctx: CanvasRenderingContext2D, img: Canvas, s0: P, s1: P, s2: P, d0: P, d1: P, d2: P) {
  // expand destination triangle slightly to hide seams
  const cx = (d0.x + d1.x + d2.x) / 3, cy = (d0.y + d1.y + d2.y) / 3
  const grow = (p: P): P => {
    const dx = p.x - cx, dy = p.y - cy
    const l = Math.hypot(dx, dy) || 1
    return { x: p.x + (dx / l) * 0.6, y: p.y + (dy / l) * 0.6 }
  }
  const e0 = grow(d0), e1 = grow(d1), e2 = grow(d2)
  const den = s0.x * (s2.y - s1.y) - s1.x * s2.y + s2.x * s1.y + (s1.x - s2.x) * s0.y
  if (Math.abs(den) < 1e-9) return
  const m11 = -(s0.y * (d2.x - d1.x) - s1.y * d2.x + s2.y * d1.x + (s1.y - s2.y) * d0.x) / den
  const m12 = (s1.y * d2.y + s0.y * (d1.y - d2.y) - s2.y * d1.y + (s2.y - s1.y) * d0.y) / den
  const m21 = (s0.x * (d2.x - d1.x) - s1.x * d2.x + s2.x * d1.x + (s1.x - s2.x) * d0.x) / den
  const m22 = -(s1.x * d2.y + s0.x * (d1.y - d2.y) - s2.x * d1.y + (s2.x - s1.x) * d0.y) / den
  const dx = (s0.x * (s2.y * d1.x - s1.y * d2.x) + s0.y * (s1.x * d2.x - s2.x * d1.x) + (s2.x * s1.y - s1.x * s2.y) * d0.x) / den
  const dy = (s0.x * (s2.y * d1.y - s1.y * d2.y) + s0.y * (s1.x * d2.y - s2.x * d1.y) + (s2.x * s1.y - s1.x * s2.y) * d0.y) / den
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(e0.x, e0.y)
  ctx.lineTo(e1.x, e1.y)
  ctx.lineTo(e2.x, e2.y)
  ctx.closePath()
  ctx.clip()
  ctx.transform(m11, m12, m21, m22, dx, dy)
  ctx.drawImage(img, 0, 0)
  ctx.restore()
}

/** Render `img` (sub-rect sx,sy,sw,sh) through a mapping function (u,v)∈[0,1]² → destination. */
export function drawMesh(ctx: CanvasRenderingContext2D, img: Canvas, sx: number, sy: number, sw: number, sh: number, map: (u: number, v: number) => P, n = 16) {
  const pts: P[] = []
  for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) pts.push(map(i / n, j / n))
  const src = (i: number, j: number): P => ({ x: sx + (i / n) * sw, y: sy + (j / n) * sh })
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const a = pts[j * (n + 1) + i], b = pts[j * (n + 1) + i + 1], c = pts[(j + 1) * (n + 1) + i + 1], d = pts[(j + 1) * (n + 1) + i]
    const sa = src(i, j), sb = src(i + 1, j), sc = src(i + 1, j + 1), sd = src(i, j + 1)
    tri(ctx, img, sa, sb, sc, a, b, c)
    tri(ctx, img, sa, sc, sd, a, c, d)
  }
}

export function isAffineQuad(q: P[]) {
  // parallelogram check
  return Math.abs(q[0].x + q[2].x - q[1].x - q[3].x) < 0.5 && Math.abs(q[0].y + q[2].y - q[1].y - q[3].y) < 0.5
}
