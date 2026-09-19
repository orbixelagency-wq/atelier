// QuickShape: turn a hand-drawn stroke into a clean line, arc, ellipse, rectangle or polygon.
type P = { x: number; y: number }

function rdp(pts: P[], eps: number): P[] {
  if (pts.length < 3) return pts
  const a = pts[0], b = pts[pts.length - 1]
  let idx = -1, dmax = 0
  const L = Math.hypot(b.x - a.x, b.y - a.y) || 1
  for (let i = 1; i < pts.length - 1; i++) {
    const d = Math.abs((b.y - a.y) * pts[i].x - (b.x - a.x) * pts[i].y + b.x * a.y - b.y * a.x) / L
    if (d > dmax) { dmax = d; idx = i }
  }
  if (dmax > eps) {
    const l = rdp(pts.slice(0, idx + 1), eps)
    const r = rdp(pts.slice(idx), eps)
    return [...l.slice(0, -1), ...r]
  }
  return [a, b]
}

function densify(poly: P[], step = 2): P[] {
  const out: P[] = []
  for (let i = 0; i < poly.length - 1; i++) {
    const a = poly[i], b = poly[i + 1]
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / step))
    for (let k = 0; k < n; k++) out.push({ x: a.x + ((b.x - a.x) * k) / n, y: a.y + ((b.y - a.y) * k) / n })
  }
  out.push(poly[poly.length - 1])
  return out
}

export interface ShapeResult { kind: 'line' | 'ellipse' | 'rect' | 'polygon' | 'arc'; path: P[] }

export function detectShape(pts: P[]): ShapeResult | null {
  if (pts.length < 4) return null
  let len = 0
  for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y)
  if (len < 20) return null
  const a = pts[0], b = pts[pts.length - 1]
  const chord = Math.hypot(b.x - a.x, b.y - a.y)
  // Line: path length ≈ chord.
  if (chord / len > 0.93) return { kind: 'line', path: densify([a, b]) }
  const closed = chord < len * 0.18
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const p of pts) { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y) }
  const w = maxX - minX, h = maxY - minY
  if (!closed) {
    // Open curve → circular arc through start, middle and end.
    const m = pts[Math.floor(pts.length / 2)]
    const d = 2 * (a.x * (m.y - b.y) + m.x * (b.y - a.y) + b.x * (a.y - m.y))
    if (Math.abs(d) < 1e-6) return { kind: 'line', path: densify([a, b]) }
    const ux = ((a.x ** 2 + a.y ** 2) * (m.y - b.y) + (m.x ** 2 + m.y ** 2) * (b.y - a.y) + (b.x ** 2 + b.y ** 2) * (a.y - m.y)) / d
    const uy = ((a.x ** 2 + a.y ** 2) * (b.x - m.x) + (m.x ** 2 + m.y ** 2) * (a.x - b.x) + (b.x ** 2 + b.y ** 2) * (m.x - a.x)) / d
    const r = Math.hypot(a.x - ux, a.y - uy)
    let a0 = Math.atan2(a.y - uy, a.x - ux), a1 = Math.atan2(b.y - uy, b.x - ux)
    const am = Math.atan2(m.y - uy, m.x - ux)
    // choose direction that passes through the middle
    const norm = (t: number) => ((t % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)
    const ccw = norm(am - a0) < norm(a1 - a0)
    if (!ccw) { const t = a0; a0 = a1; a1 = t }
    let sweep = norm(a1 - a0)
    const n = Math.max(12, Math.ceil((r * sweep) / 3))
    const path: P[] = []
    for (let i = 0; i <= n; i++) { const t = a0 + (sweep * i) / n; path.push({ x: ux + Math.cos(t) * r, y: uy + Math.sin(t) * r }) }
    if (!ccw) path.reverse()
    sweep = 0
    return { kind: 'arc', path }
  }
  const simp = rdp([...pts, pts[0]], Math.max(w, h) * 0.09)
  const corners = simp.length - 1
  if (corners === 4) {
    const rect = [simp[0], simp[1], simp[2], simp[3], simp[0]]
    // Snap to axis-aligned rectangle when edges are near horizontal/vertical.
    const angs = [0, 1, 2, 3].map((i) => Math.atan2(rect[i + 1].y - rect[i].y, rect[i + 1].x - rect[i].x))
    const aligned = angs.every((t) => Math.min(Math.abs(Math.sin(t)), Math.abs(Math.cos(t))) < 0.22)
    if (aligned) return { kind: 'rect', path: densify([{ x: minX, y: minY }, { x: maxX, y: minY }, { x: maxX, y: maxY }, { x: minX, y: maxY }, { x: minX, y: minY }]) }
    return { kind: 'polygon', path: densify(rect) }
  }
  if (corners === 3 || corners === 5 || corners === 6) return { kind: 'polygon', path: densify([...simp.slice(0, -1), simp[0]]) }
  // Ellipse: fit via principal axes.
  let cx = 0, cy = 0
  for (const p of pts) { cx += p.x; cy += p.y }
  cx /= pts.length; cy /= pts.length
  let sxx = 0, syy = 0, sxy = 0
  for (const p of pts) { sxx += (p.x - cx) ** 2; syy += (p.y - cy) ** 2; sxy += (p.x - cx) * (p.y - cy) }
  const ang = 0.5 * Math.atan2(2 * sxy, sxx - syy)
  let rx = 0, ry = 0
  for (const p of pts) {
    const dx = p.x - cx, dy = p.y - cy
    const u = dx * Math.cos(ang) + dy * Math.sin(ang), v = -dx * Math.sin(ang) + dy * Math.cos(ang)
    rx = Math.max(rx, Math.abs(u)); ry = Math.max(ry, Math.abs(v))
  }
  rx *= 0.96; ry *= 0.96
  if (Math.abs(rx - ry) / Math.max(rx, ry) < 0.12) rx = ry = (rx + ry) / 2
  const n = Math.max(24, Math.ceil(((rx + ry) * Math.PI) / 3))
  const path: P[] = []
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * Math.PI * 2
    const u = Math.cos(t) * rx, v = Math.sin(t) * ry
    path.push({ x: cx + u * Math.cos(ang) - v * Math.sin(ang), y: cy + u * Math.sin(ang) + v * Math.cos(ang) })
  }
  return { kind: 'ellipse', path }
}

export const SHAPE_NAMES: Record<ShapeResult['kind'], string> = {
  line: 'Línea', ellipse: 'Elipse', rect: 'Rectángulo', polygon: 'Polígono', arc: 'Arco',
}
