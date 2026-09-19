// Stamp-based brush engine. Input points are smoothed (StreamLine/stabilization) into a path;
// dabs are laid along the path at a spacing derived from the brush size. Paint, erase and clone
// accumulate into a stroke buffer that is composited onto the layer with the brush opacity (glaze).
// Smudge operates directly on the layer by carrying a patch of pixels along the stroke.
import type { Brush, BlendMode } from './types'
import { getGrainAlpha, getStamp, getTip, tipKey } from './tips'
import { BBox, clamp, ctx2d, hexToRgb, hsvToHex, lerp, makeCanvas, mulberry32, rgbToHex, rgbToHsv, type Canvas } from './util'

export interface InputPoint { x: number; y: number; p: number; tiltX: number; tiltY: number; t: number }
interface PathPoint { x: number; y: number; p: number; tilt: number; tiltAngle: number; speed: number }

export type StrokeMode = 'paint' | 'erase' | 'smudge' | 'clone' | 'mask'

/** Maps one dab to its mirrored copies. Returns [x, y, angleOffset, mirror]. */
export type SymmetryFn = (x: number, y: number) => [number, number, number, boolean][]

export interface StrokeOptions {
  brush: Brush
  size: number // px at full pressure
  opacity: number // 0-1
  color: string
  mode: StrokeMode
  layer: Canvas // target layer (read for smudge/pull, written for smudge)
  source?: Canvas // clone source snapshot
  cloneOffset?: { x: number; y: number }
  alphaLock?: boolean
  selection?: Canvas | null
  symmetry?: SymmetryFn | null
  pressureCurve?: (p: number) => number
  seed?: number
  maskValue?: number // luminance 0-1 when painting on a layer mask
  viewRotation?: number
}

const bufferPool = new Map<string, Canvas>()
function pooled(w: number, h: number, key: string): Canvas {
  const k = key + w + 'x' + h
  let c = bufferPool.get(k)
  if (!c) { c = makeCanvas(w, h); bufferPool.set(k, c) }
  return c
}

export class Stroke {
  o: StrokeOptions
  w: number
  h: number
  buffer: Canvas
  bctx: CanvasRenderingContext2D
  private dual: Canvas | null = null
  private dctx: CanvasRenderingContext2D | null = null
  raw: InputPoint[] = []
  path: PathPoint[] = []
  bbox = new BBox()
  private smooth: { x: number; y: number } | null = null
  private dabDist = 0 // distance to next dab
  private travelled = 0
  private rendered = 0 // index in path up to which dabs were emitted
  private rand: () => number
  private strokeHue: number
  private carried = new Map<number, Canvas>()
  private sampleCv = makeCanvas(1, 1)
  private sampleCtx = ctx2d(this.sampleCv, true)
  private pickColor: string | null = null
  private dabIndex = 0
  totalLength = 0
  finished = false
  seed: number

  constructor(w: number, h: number, o: StrokeOptions) {
    this.o = o
    this.w = w
    this.h = h
    this.seed = o.seed ?? Math.floor(Math.random() * 1e9)
    this.rand = mulberry32(this.seed)
    this.strokeHue = (this.rand() - 0.5) * 2 * o.brush.color.strokeHue * 180
    this.buffer = pooled(w, h, 'stroke')
    this.bctx = ctx2d(this.buffer)
    this.bctx.setTransform(1, 0, 0, 1, 0, 0)
    this.bctx.clearRect(0, 0, w, h)
    if (o.brush.dual?.enabled && o.mode !== 'smudge') {
      this.dual = pooled(w, h, 'dual')
      this.dctx = ctx2d(this.dual)
      this.dctx.clearRect(0, 0, w, h)
    }
  }

  get usesBuffer() { return this.o.mode !== 'smudge' }

  addPoint(pt: InputPoint) {
    const b = this.o.brush
    this.raw.push(pt)
    // Stabilization: average the last N raw points.
    let x = pt.x, y = pt.y
    const n = Math.round(b.stroke.stabilization * 24)
    if (n > 1) {
      const from = Math.max(0, this.raw.length - n)
      let sx = 0, sy = 0, c = 0
      for (let i = from; i < this.raw.length; i++) { sx += this.raw[i].x; sy += this.raw[i].y; c++ }
      x = sx / c; y = sy / c
    }
    // StreamLine: lazy follow.
    if (!this.smooth) this.smooth = { x, y }
    else {
      const k = 1 - clamp(b.stroke.streamline) * 0.92
      this.smooth.x += (x - this.smooth.x) * k
      this.smooth.y += (y - this.smooth.y) * k
    }
    this.pushPath(this.smooth.x, this.smooth.y, pt)
  }

  private pushPath(x: number, y: number, pt: InputPoint) {
    const prev = this.path[this.path.length - 1]
    const tiltMag = Math.min(1, Math.hypot(pt.tiltX, pt.tiltY) / 90)
    const tiltAngle = Math.atan2(pt.tiltY, pt.tiltX)
    const curve = this.o.pressureCurve || ((p: number) => p)
    const p = clamp(curve(pt.p))
    let speed = 0
    if (prev) {
      const d = Math.hypot(x - prev.x, y - prev.y)
      if (d < 0.2 && this.path.length > 1) return
      const dt = Math.max(1, pt.t - (this.raw[this.raw.length - 2]?.t ?? pt.t - 16))
      speed = lerp(prev.speed, clamp(d / dt / 4), 0.3)
    }
    this.path.push({ x, y, p, tilt: tiltMag, tiltAngle, speed })
  }

  /** Emit dabs for any new path segments. */
  render() {
    const P = this.path
    if (!P.length) return
    if (this.rendered === 0) {
      this.dab(P[0], 0, 0)
      this.rendered = 1
    }
    for (let i = Math.max(1, this.rendered); i < P.length; i++) {
      const a = P[i - 1], c = P[i]
      const segLen = Math.hypot(c.x - a.x, c.y - a.y)
      if (segLen === 0) continue
      const dir = Math.atan2(c.y - a.y, c.x - a.x)
      let pos = this.dabDist
      while (pos <= segLen) {
        const t = pos / segLen
        const pt: PathPoint = {
          x: lerp(a.x, c.x, t), y: lerp(a.y, c.y, t), p: lerp(a.p, c.p, t),
          tilt: lerp(a.tilt, c.tilt, t), tiltAngle: c.tiltAngle, speed: lerp(a.speed, c.speed, t),
        }
        const d = this.travelled + pos
        this.dab(pt, dir, d)
        const size = this.sizeAt(pt, d)
        pos += Math.max(0.5, this.o.brush.stroke.spacing * size)
      }
      this.dabDist = pos - segLen
      this.travelled += segLen
    }
    this.rendered = P.length
  }

  /** Finish the stroke; re-render with the end taper now that the length is known. */
  end() {
    if (this.raw.length) {
      const last = this.raw[this.raw.length - 1]
      // StreamLine catch-up so the stroke reaches the pen-up point.
      if (this.smooth && this.o.brush.stroke.streamline > 0) {
        const steps = 6
        const sx = this.smooth.x, sy = this.smooth.y
        for (let i = 1; i <= steps; i++) this.pushPath(lerp(sx, last.x, i / steps), lerp(sy, last.y, i / steps), { ...last, p: last.p * (1 - (i / steps) * 0.5) })
      }
    }
    const b = this.o.brush
    this.totalLength = 0
    for (let i = 1; i < this.path.length; i++) this.totalLength += Math.hypot(this.path[i].x - this.path[i - 1].x, this.path[i].y - this.path[i - 1].y)
    this.finished = true
    if (b.taper.end > 0 && this.usesBuffer && this.path.length > 2) this.rerender()
    else this.render()
  }

  /** Replace the path (QuickShape) or redraw it from scratch. */
  rerender(newPath?: { x: number; y: number }[]) {
    if (newPath) {
      const p = this.path.length ? this.path[Math.floor(this.path.length / 2)].p : 1
      this.path = newPath.map((q) => ({ x: q.x, y: q.y, p, tilt: 0, tiltAngle: 0, speed: 0 }))
      this.totalLength = 0
      for (let i = 1; i < this.path.length; i++) this.totalLength += Math.hypot(this.path[i].x - this.path[i - 1].x, this.path[i].y - this.path[i - 1].y)
    }
    if (!this.usesBuffer) return
    this.bctx.setTransform(1, 0, 0, 1, 0, 0)
    this.bctx.clearRect(0, 0, this.w, this.h)
    if (this.dctx) { this.dctx.setTransform(1, 0, 0, 1, 0, 0); this.dctx.clearRect(0, 0, this.w, this.h) }
    this.rand = mulberry32(this.seed)
    this.rand()
    this.dabDist = 0
    this.travelled = 0
    this.rendered = 0
    this.dabIndex = 0
    this.pickColor = null
    this.render()
  }

  private sizeAt(pt: PathPoint, d: number) {
    const b = this.o.brush
    const minS = b.props.minSize
    let s = this.o.size
    const pr = lerp(1, lerp(minS, 1, pt.p), b.pencil.pressureSize)
    s *= pr
    s *= 1 + b.pencil.tiltSize * pt.tilt * 1.5
    s *= 1 + b.dynamics.speedSize * pt.speed
    s *= this.taperFactor(d, b.taper.size)
    return Math.max(0.5, s)
  }

  private taperFactor(d: number, amount: number) {
    const b = this.o.brush
    if (!amount) return 1
    const base = Math.max(this.o.size * 4, 60)
    let f = 1
    if (b.taper.start > 0) {
      const L = b.taper.start * base * 3
      if (d < L) f = Math.min(f, 0.08 + 0.92 * Math.sin((d / L) * Math.PI / 2))
    }
    if (this.finished && b.taper.end > 0 && this.totalLength > 0) {
      const L = Math.min(this.totalLength * 0.45, b.taper.end * base * 3)
      const r = this.totalLength - d
      if (r < L) f = Math.min(f, 0.08 + 0.92 * Math.sin((Math.max(0, r) / L) * Math.PI / 2))
    }
    return lerp(1, f, amount)
  }

  private dab(pt: PathPoint, dir: number, d: number) {
    const o = this.o, b = o.brush, R = this.rand
    let size = this.sizeAt(pt, d)
    if (b.dynamics.sizeJitter) size *= 1 - R() * b.dynamics.sizeJitter
    let alpha = b.render.flow
    alpha *= lerp(1, lerp(b.props.minOpacity, 1, pt.p), b.pencil.pressureOpacity)
    alpha *= lerp(1, pt.p, b.pencil.pressureFlow)
    alpha *= 1 - b.pencil.tiltOpacity * pt.tilt * 0.8
    alpha *= 1 - b.dynamics.speedOpacity * pt.speed
    alpha *= this.taperFactor(d, b.taper.opacity)
    if (b.stroke.falloff) alpha *= Math.max(0, 1 - (d / 2000) * b.stroke.falloff * 4)
    if (b.dynamics.opacityJitter) alpha *= 1 - R() * b.dynamics.opacityJitter
    if (b.render.mode === 'build') alpha *= o.opacity
    alpha = clamp(alpha)
    if (alpha <= 0.003) return

    let angle = (b.shape.angle * Math.PI) / 180
    if (b.props.screenOrient && o.viewRotation) angle -= o.viewRotation
    angle += b.shape.follow * dir
    if (b.pencil.tiltAngle && pt.tilt > 0.05) angle = pt.tiltAngle
    if (b.shape.rotJitter) angle += (R() - 0.5) * 2 * Math.PI * b.shape.rotJitter

    let x = pt.x, y = pt.y
    if (b.stroke.jitter) {
      const j = (R() - 0.5) * 2 * b.stroke.jitter * size * 2
      x += Math.cos(dir + Math.PI / 2) * j
      y += Math.sin(dir + Math.PI / 2) * j
    }

    const count = Math.max(1, Math.round(b.shape.count))
    this.dabIndex++
    for (let c = 0; c < count; c++) {
      let cx = x, cy = y
      if (b.shape.scatter) {
        const a = R() * Math.PI * 2, r = R() * b.shape.scatter * size
        cx += Math.cos(a) * r
        cy += Math.sin(a) * r
      }
      const flip = b.shape.flipRandom && R() < 0.5
      const color = this.dabColor(cx, cy, d)
      const copies = o.symmetry ? o.symmetry(cx, cy) : [[cx, cy, 0, false] as [number, number, number, boolean]]
      for (let k = 0; k < copies.length; k++) {
        const [sx, sy, ao, mirror] = copies[k]
        const ang = mirror ? -angle + ao : angle + ao
        this.bbox.add(sx, sy, size)
        if (o.mode === 'smudge') this.smudgeDab(k, sx, sy, size, ang, alpha * o.opacity, flip !== mirror)
        else if (o.mode === 'clone') this.cloneDab(sx, sy, size, ang, alpha)
        else this.stampDab(sx, sy, size, ang, alpha, color, flip !== mirror)
      }
    }
  }

  private dabColor(x: number, y: number, d: number): string {
    const o = this.o, b = o.brush
    if (o.mode === 'erase' || o.mode === 'mask') return '#ffffff'
    let hex = o.color
    const pull = b.wet.pull + (1 - b.wet.charge) * Math.min(1, d / 600)
    if (pull > 0 && o.mode === 'paint') {
      if (this.dabIndex % 3 === 1 || !this.pickColor) this.pickColor = this.sample(x, y)
      if (this.pickColor) {
        const [pr, pg, pb, pa] = this.pickColor.split(',').map(Number)
        const c = hexToRgb(hex)
        const k = clamp(pull) * (pa / 255)
        hex = rgbToHex({ r: lerp(c.r, pr, k), g: lerp(c.g, pg, k), b: lerp(c.b, pb, k) })
      }
    }
    const cj = b.color
    if (cj.hue || cj.sat || cj.bright || this.strokeHue) {
      const R = this.rand
      const hsv = rgbToHsv(hexToRgb(hex))
      hsv.h += this.strokeHue + (R() - 0.5) * 2 * cj.hue * 180
      hsv.s = clamp(hsv.s + (R() - 0.5) * 2 * cj.sat)
      hsv.v = clamp(hsv.v + (R() - 0.5) * 2 * cj.bright)
      // quantize so the stamp cache stays small
      hsv.h = Math.round(hsv.h / 3) * 3
      hsv.s = Math.round(hsv.s * 40) / 40
      hsv.v = Math.round(hsv.v * 40) / 40
      hex = hsvToHex(hsv)
    }
    return hex
  }

  private sample(x: number, y: number): string | null {
    const sx = Math.round(x), sy = Math.round(y)
    if (sx < 0 || sy < 0 || sx >= this.w || sy >= this.h) return null
    this.sampleCtx.clearRect(0, 0, 1, 1)
    this.sampleCtx.drawImage(this.o.layer, sx, sy, 1, 1, 0, 0, 1, 1)
    const d = this.sampleCtx.getImageData(0, 0, 1, 1).data
    if (d[3] < 8) return null
    return `${d[0]},${d[1]},${d[2]},${d[3]}`
  }

  private stampDab(x: number, y: number, size: number, angle: number, alpha: number, color: string, flip: boolean) {
    const b = this.o.brush
    const tip = getTip(b)
    const stamp = getStamp(tip, tipKey(b), color)
    const g = this.bctx
    const rw = size, rh = size * b.shape.roundness
    g.setTransform(1, 0, 0, 1, 0, 0)
    g.translate(x, y)
    if (angle) g.rotate(angle)
    if (flip) g.scale(-1, 1)
    const wet = b.render.wetEdges
    const glow = b.render.glow || 0
    if (glow > 0) {
      const halo = getStamp(getTip({ ...b, shape: { ...b.shape, source: 'soft', hardness: 0 } } as Brush), 'soft:0', color)
      g.globalAlpha = alpha * glow * 0.08
      g.drawImage(halo, -rw, -rh, rw * 2, rh * 2)
    }
    g.globalAlpha = alpha * (1 - wet * 0.55)
    g.drawImage(stamp, -rw / 2, -rh / 2, rw, rh)
    if (glow > 0) {
      const c = hexToRgb(color)
      const hot = rgbToHex({ r: lerp(c.r, 255, 0.75), g: lerp(c.g, 255, 0.75), b: lerp(c.b, 255, 0.75) })
      g.globalAlpha = alpha * glow
      g.drawImage(getStamp(tip, tipKey(b), hot), -rw * 0.2, -rh * 0.2, rw * 0.4, rh * 0.4)
    }
    if (wet > 0) {
      g.globalAlpha = alpha * wet * 0.35
      const ring = getStamp(getTip({ ...b, shape: { ...b.shape, source: 'drop', hardness: 0.9 } } as Brush), 'drop:18', color)
      g.drawImage(ring, -rw / 2, -rh / 2, rw, rh)
    }
    g.globalAlpha = 1
    g.setTransform(1, 0, 0, 1, 0, 0)
    if (this.dctx && b.dual) {
      // secondary tip: its coverage later masks the primary stroke
      const d = this.dctx, R = this.rand
      const ds = size * b.dual.scale
      const sc = b.dual.scatter * size
      const a = R() * Math.PI * 2, r = R() * sc
      d.setTransform(1, 0, 0, 1, 0, 0)
      d.translate(x + Math.cos(a) * r, y + Math.sin(a) * r)
      d.rotate(R() * Math.PI * 2)
      d.drawImage(getTip({ ...b, shape: { ...b.shape, source: b.dual.source, hardness: b.dual.hardness } } as Brush), -ds / 2, -ds / 2, ds, ds)
      d.setTransform(1, 0, 0, 1, 0, 0)
    }
  }

  private patch(size: number, key: string): Canvas {
    const S = Math.max(2, Math.ceil(size))
    const c = pooled(S, S, key)
    return c
  }

  private smudgeDab(k: number, x: number, y: number, size: number, angle: number, strength: number, flip: boolean) {
    const b = this.o.brush
    const S = Math.max(2, Math.ceil(size))
    const sx = Math.round(x - S / 2), sy = Math.round(y - S / 2)
    const layerCtx = ctx2d(this.o.layer)
    let carried = this.carried.get(k)
    if (!carried) {
      carried = makeCanvas(S, S)
      ctx2d(carried).drawImage(this.o.layer, sx, sy, S, S, 0, 0, S, S)
      this.carried.set(k, carried)
      return
    }
    if (carried.width !== S) {
      const fresh = makeCanvas(S, S)
      ctx2d(fresh).drawImage(carried, 0, 0, S, S)
      carried = fresh
      this.carried.set(k, carried)
    }
    // Masked carried paint → layer.
    const m = this.patch(S, 'smudgemask')
    const mx = ctx2d(m)
    mx.setTransform(1, 0, 0, 1, 0, 0)
    mx.globalCompositeOperation = 'source-over'
    mx.clearRect(0, 0, S, S)
    mx.globalAlpha = 1
    mx.drawImage(carried, 0, 0)
    mx.globalCompositeOperation = 'destination-in'
    mx.translate(S / 2, S / 2)
    if (angle) mx.rotate(angle)
    if (flip) mx.scale(-1, 1)
    mx.drawImage(getTip(b), -S / 2, (-S * b.shape.roundness) / 2, S, S * b.shape.roundness)
    mx.setTransform(1, 0, 0, 1, 0, 0)
    mx.globalCompositeOperation = 'source-over'

    // Pick up what is under the new position before painting over it.
    const cx = ctx2d(carried)
    cx.globalAlpha = clamp(1 - strength * 0.92)
    cx.globalCompositeOperation = 'source-over'
    cx.drawImage(this.o.layer, sx, sy, S, S, 0, 0, S, S)
    cx.globalAlpha = 1

    layerCtx.save()
    if (this.o.selection) {
      // restrict to selection
      mx.globalCompositeOperation = 'destination-in'
      mx.drawImage(this.o.selection, sx, sy, S, S, 0, 0, S, S)
      mx.globalCompositeOperation = 'source-over'
    }
    layerCtx.globalAlpha = clamp(strength)
    layerCtx.globalCompositeOperation = this.o.alphaLock ? 'source-atop' : 'source-over'
    layerCtx.drawImage(m, sx, sy)
    layerCtx.restore()
  }

  private cloneDab(x: number, y: number, size: number, angle: number, alpha: number) {
    const src = this.o.source
    const off = this.o.cloneOffset
    if (!src || !off) return
    const S = Math.max(2, Math.ceil(size))
    const m = this.patch(S, 'clonemask')
    const mx = ctx2d(m)
    mx.setTransform(1, 0, 0, 1, 0, 0)
    mx.globalCompositeOperation = 'source-over'
    mx.clearRect(0, 0, S, S)
    mx.drawImage(src, Math.round(x + off.x - S / 2), Math.round(y + off.y - S / 2), S, S, 0, 0, S, S)
    mx.globalCompositeOperation = 'destination-in'
    mx.translate(S / 2, S / 2)
    if (angle) mx.rotate(angle)
    mx.drawImage(getTip(this.o.brush), -S / 2, -S / 2, S, S)
    mx.setTransform(1, 0, 0, 1, 0, 0)
    mx.globalCompositeOperation = 'source-over'
    this.bctx.globalAlpha = alpha
    this.bctx.drawImage(m, Math.round(x - S / 2), Math.round(y - S / 2))
    this.bctx.globalAlpha = 1
  }

  /** Composite operation used to merge the buffer onto the layer. */
  get gco(): GlobalCompositeOperation {
    const o = this.o
    if (o.mode === 'erase') return 'destination-out'
    if (o.mode === 'mask') return (o.maskValue ?? 1) >= 0.5 ? 'source-over' : 'destination-out'
    if (o.alphaLock) return 'source-atop'
    const bl = o.brush.render.blend as BlendMode
    return bl === 'source-over' ? 'source-over' : bl
  }

  /** Buffer with grain and selection applied, ready to composite. */
  prepared(): Canvas {
    const b = this.o.brush
    const needGrain = b.grain.source !== 'none' && b.grain.depth > 0
    const needSel = !!this.o.selection
    const needDual = !!this.dual
    if (!needGrain && !needSel && !needDual) return this.buffer
    const t = pooled(this.w, this.h, 'prepared')
    const x = ctx2d(t)
    x.setTransform(1, 0, 0, 1, 0, 0)
    x.globalCompositeOperation = 'source-over'
    x.globalAlpha = 1
    x.clearRect(0, 0, this.w, this.h)
    x.drawImage(this.buffer, 0, 0)
    if (needGrain) {
      const pat = x.createPattern(getGrainAlpha(b.grain.source, b.grain.depth), 'repeat')!
      const s = b.grain.scale * (b.grain.zoomWithBrush ? this.o.size / 40 : 1)
      pat.setTransform(new DOMMatrix().scale(s, s))
      x.globalCompositeOperation = 'destination-in'
      x.fillStyle = pat
      x.fillRect(0, 0, this.w, this.h)
    }
    if (needDual) {
      x.globalCompositeOperation = 'destination-in'
      x.drawImage(this.dual!, 0, 0)
    }
    if (needSel) {
      x.globalCompositeOperation = 'destination-in'
      x.drawImage(this.o.selection!, 0, 0)
    }
    x.globalCompositeOperation = 'source-over'
    return t
  }

  /** Composite the stroke onto a canvas holding the layer's pixels. */
  applyTo(target: Canvas) {
    if (!this.usesBuffer) return
    const x = ctx2d(target)
    x.save()
    x.setTransform(1, 0, 0, 1, 0, 0)
    x.globalAlpha = this.o.brush.render.mode === 'build' || this.o.mode === 'mask' ? (this.o.mode === 'mask' ? this.o.opacity : 1) : this.o.opacity
    x.globalCompositeOperation = this.gco
    x.drawImage(this.prepared(), 0, 0)
    x.restore()
  }
}

/** Renders a preview stroke of a brush onto a canvas (library thumbnails, Brush Studio pad). */
export function previewStroke(b: Brush, w: number, h: number, color = '#f2f1ed', sizeScale = 1): Canvas {
  const layer = makeCanvas(w, h)
  const size = Math.min(h * 0.34, Math.max(6, b.props.maxSize * 0.8)) * sizeScale
  const st = new Stroke(w, h, { brush: b, size, opacity: 1, color, mode: 'paint', layer, seed: 7 })
  const pad = size * 0.55 + 4
  const N = 60
  for (let i = 0; i <= N; i++) {
    const t = i / N
    const x = pad + t * (w - pad * 2)
    const y = h / 2 - Math.sin(t * Math.PI * 2) * Math.max(h * 0.16, h / 2 - pad)
    const p = Math.sin(t * Math.PI) * 0.85 + 0.15
    st.addPoint({ x, y, p, tiltX: 0, tiltY: 0, t: i * 16 })
    st.render()
  }
  st.end()
  st.applyTo(layer)
  return layer
}
