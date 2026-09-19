// Dimension annotations (technical drawing style): line, end ticks, arrowheads and a label pill.
type P = { x: number; y: number }

export function drawDimension(x: CanvasRenderingContext2D, a: P, b: P, label: string, color: string, unit: number) {
  // unit: size of one "UI pixel" in canvas pixels, so annotations stay legible at any resolution
  const dx = b.x - a.x, dy = b.y - a.y
  const len = Math.hypot(dx, dy)
  if (len < 1) return
  const ux = dx / len, uy = dy / len
  const nx = -uy, ny = ux
  const lw = 1.6 * unit, tick = 9 * unit, head = 10 * unit
  x.save()
  x.strokeStyle = color
  x.fillStyle = color
  x.lineWidth = lw
  x.lineCap = 'round'
  x.beginPath()
  x.moveTo(a.x, a.y); x.lineTo(b.x, b.y)
  for (const p of [a, b]) { x.moveTo(p.x + nx * tick, p.y + ny * tick); x.lineTo(p.x - nx * tick, p.y - ny * tick) }
  x.stroke()
  const arrow = (p: P, dir: number) => {
    x.beginPath()
    x.moveTo(p.x, p.y)
    x.lineTo(p.x + (ux * dir) * head + nx * head * 0.4, p.y + (uy * dir) * head + ny * head * 0.4)
    x.lineTo(p.x + (ux * dir) * head - nx * head * 0.4, p.y + (uy * dir) * head - ny * head * 0.4)
    x.closePath()
    x.fill()
  }
  if (len > head * 3) { arrow(a, 1); arrow(b, -1) }
  // label, kept upright
  let ang = Math.atan2(dy, dx)
  if (ang > Math.PI / 2) ang -= Math.PI
  if (ang < -Math.PI / 2) ang += Math.PI
  const fs = 13 * unit
  x.font = `600 ${fs}px system-ui, -apple-system, 'Segoe UI', sans-serif`
  const tw = x.measureText(label).width
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2
  x.translate(mx, my)
  x.rotate(ang)
  const pw = tw + 12 * unit, ph = fs + 8 * unit
  x.fillStyle = '#ffffff'
  x.beginPath()
  x.roundRect(-pw / 2, -ph / 2, pw, ph, ph / 2)
  x.fill()
  x.lineWidth = lw * 0.8
  x.stroke()
  x.fillStyle = color
  x.textAlign = 'center'
  x.textBaseline = 'middle'
  x.fillText(label, 0, 1 * unit)
  x.restore()
}

export function formatLength(px: number, pxPerCm: number, unit: 'cm' | 'in') {
  const cm = px / pxPerCm
  const v = unit === 'cm' ? cm : cm / 2.54
  return `${v.toFixed(1).replace('.', ',')} ${unit === 'cm' ? 'cm' : 'in'}`
}
