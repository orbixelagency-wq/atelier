import type { Guides } from '../state/store'
import type { SymmetryFn } from './brushEngine'

type P = { x: number; y: number }

export function guideCenter(g: Guides, w: number, h: number): P {
  return g.center || { x: w / 2, y: h / 2 }
}

export function symmetryFn(g: Guides, w: number, h: number): SymmetryFn | null {
  if (!g.enabled || g.type !== 'symmetry' || !g.assisted) return null
  const c = guideCenter(g, w, h)
  switch (g.symmetry) {
    case 'vertical':
      return (x, y) => [[x, y, 0, false], [2 * c.x - x, y, 0, true]]
    case 'horizontal':
      return (x, y) => [[x, y, 0, false], [x, 2 * c.y - y, Math.PI, true]]
    case 'quadrant':
      return (x, y) => [
        [x, y, 0, false], [2 * c.x - x, y, 0, true],
        [x, 2 * c.y - y, Math.PI, true], [2 * c.x - x, 2 * c.y - y, Math.PI, false],
      ]
    case 'radial': {
      const n = Math.max(2, g.radial)
      return (x, y) => {
        const out: [number, number, number, boolean][] = []
        const dx = x - c.x, dy = y - c.y
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2
          const cs = Math.cos(a), sn = Math.sin(a)
          out.push([c.x + dx * cs - dy * sn, c.y + dx * sn + dy * cs, a, false])
          if (!g.rotational) {
            const ang = Math.atan2(dy, dx), r = Math.hypot(dx, dy)
            const ma = a - ang
            out.push([c.x + Math.cos(ma) * r, c.y + Math.sin(ma) * r, a, true])
          }
        }
        return out
      }
    }
  }
}

/**
 * Assisted drawing: returns a function that constrains a point given the stroke start.
 * The direction is locked after the pen moves a few pixels.
 */
export function assistFn(g: Guides, w: number, h: number): ((p: P, start: P) => P) | null {
  if (!g.enabled || !g.assisted || g.type === 'symmetry') return null
  let dir: { x: number; y: number } | null = null
  let lockedVp: P | null = null
  const dirs: number[] =
    g.type === 'grid' ? [0, 90] :
    g.type === 'iso' ? [30, 90, 150] : []
  return (p, s) => {
    const dx = p.x - s.x, dy = p.y - s.y
    const d = Math.hypot(dx, dy)
    if (!dir && !lockedVp) {
      if (d < 6) return s
      if (g.type === 'perspective') {
        // choose between vanishing points and pure horizontal/vertical
        const a = Math.atan2(dy, dx)
        let best = Infinity
        const cand: { vp: P | null; dir: P | null }[] = [
          ...g.vps.map((vp) => ({ vp, dir: null })),
          { vp: null, dir: { x: 1, y: 0 } }, { vp: null, dir: { x: 0, y: 1 } },
        ]
        for (const c of cand) {
          const ca = c.vp ? Math.atan2(c.vp.y - s.y, c.vp.x - s.x) : Math.atan2(c.dir!.y, c.dir!.x)
          let diff = (((a - ca) % Math.PI) + Math.PI) % Math.PI
          diff = Math.min(diff, Math.PI - diff)
          if (diff < best) { best = diff; lockedVp = c.vp; dir = c.dir }
        }
        if (lockedVp) dir = null
      } else {
        const a = (Math.atan2(dy, dx) * 180) / Math.PI
        let best = Infinity, bestA = 0
        for (const base of dirs) for (const t of [base, base + 180, base - 180]) {
          const diff = Math.abs(a - t)
          if (diff < best) { best = diff; bestA = t }
        }
        dir = { x: Math.cos((bestA * Math.PI) / 180), y: Math.sin((bestA * Math.PI) / 180) }
      }
    }
    let ux: number, uy: number
    if (lockedVp) {
      const vx = lockedVp.x - s.x, vy = lockedVp.y - s.y
      const l = Math.hypot(vx, vy) || 1
      ux = vx / l; uy = vy / l
    } else if (dir) { ux = dir.x; uy = dir.y } else return p
    const t = dx * ux + dy * uy
    return { x: s.x + ux * t, y: s.y + uy * t }
  }
}

/** Draw guide lines in document space onto an overlay context already transformed to doc coords. */
export function drawGuides(x: CanvasRenderingContext2D, g: Guides, w: number, h: number, zoom: number, editing: boolean) {
  if (!g.enabled) return
  x.save()
  x.strokeStyle = g.color
  x.globalAlpha = g.opacity
  x.lineWidth = g.thickness / zoom
  x.beginPath()
  if (g.type === 'grid') {
    for (let i = g.gridSize; i < w; i += g.gridSize) { x.moveTo(i, 0); x.lineTo(i, h) }
    for (let j = g.gridSize; j < h; j += g.gridSize) { x.moveTo(0, j); x.lineTo(w, j) }
  } else if (g.type === 'iso') {
    const s = g.gridSize
    const t = Math.tan(Math.PI / 6)
    for (let i = -h / t; i < w + h / t; i += s / t / 2 * 2) {
      x.moveTo(i, 0); x.lineTo(i + h / t, h)
      x.moveTo(i, h); x.lineTo(i + h / t, 0)
    }
    for (let i = 0; i < w; i += s / t / 2 * 2) { x.moveTo(i, 0); x.lineTo(i, h) }
  } else if (g.type === 'perspective') {
    const R = Math.hypot(w, h) * 2
    for (const vp of g.vps) {
      const n = 36
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2
        x.moveTo(vp.x, vp.y)
        x.lineTo(vp.x + Math.cos(a) * R, vp.y + Math.sin(a) * R)
      }
    }
    if (g.vps.length >= 2) { x.moveTo(-R, g.vps[0].y); x.lineTo(R, g.vps[0].y) }
  } else if (g.type === 'symmetry') {
    const c = guideCenter(g, w, h)
    const R = Math.hypot(w, h)
    if (g.symmetry === 'vertical' || g.symmetry === 'quadrant') { x.moveTo(c.x, 0); x.lineTo(c.x, h) }
    if (g.symmetry === 'horizontal' || g.symmetry === 'quadrant') { x.moveTo(0, c.y); x.lineTo(w, c.y) }
    if (g.symmetry === 'radial') {
      const n = Math.max(2, g.radial)
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2
        x.moveTo(c.x, c.y)
        x.lineTo(c.x + Math.cos(a) * R, c.y + Math.sin(a) * R)
      }
    }
  }
  x.stroke()
  x.globalAlpha = 1
  if (editing || g.type === 'perspective') {
    const pts = g.type === 'perspective' ? g.vps : g.type === 'symmetry' ? [guideCenter(g, w, h)] : []
    for (const p of pts) {
      x.beginPath()
      x.fillStyle = '#fff'
      x.strokeStyle = g.color
      x.lineWidth = 2 / zoom
      x.arc(p.x, p.y, 9 / zoom, 0, Math.PI * 2)
      x.fill()
      x.stroke()
    }
  }
  x.restore()
}
