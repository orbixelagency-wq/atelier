// Editor controller: owns the view canvas, the render loop, pointer/gesture handling and every
// on-canvas tool. React components call into it; it reads/writes the zustand store.
import { Stroke, type StrokeMode } from '../engine/brushEngine'
import { compositeDoc, referenceComposite, type FloatLayer, type LiveStroke } from '../engine/compositor'
import { dilate, floodMask, maskToCanvas } from '../engine/fill'
import { assistFn, drawGuides, guideCenter, symmetryFn } from '../engine/guides'
import { Liquify } from '../engine/liquify'
import { detectShape, SHAPE_NAMES } from '../engine/quickshape'
import { autoMask, combine, ellipseMask, polyMask, rectMask, selectionOverlay } from '../engine/selection'
import { applyH, bezierPatch, drawMesh, gridFromQuad, squareToQuad, type P } from '../engine/transform'
import type { BrushTool, Layer } from '../engine/types'
import {
  BBox, checkerPattern, clamp, cloneCanvas, contentBounds, ctx2d, hexToHsv, hsvToHex, makeCanvas, rgbToHex, type Canvas,
} from '../engine/util'
import { active, hsvHex } from './docOps'
import { beginPixels, beforePixels, cancelPixels, commit, endPixels, redo, setSelection, targetCanvas, undo } from './history'
import { get, set, toast, type View } from './store'

type Ptr = { id: number; x: number; y: number; sx: number; sy: number; type: string; t: number }

const DPR = () => Math.min(2, window.devicePixelRatio || 1)

// ---------------- pressure curve ----------------
function bezierCurve(c: [number, number, number, number]) {
  const [x1, y1, x2, y2] = c
  const lut = new Float32Array(101)
  const B = (t: number, a: number, b: number) => 3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3
  let j = 0
  for (let i = 0; i <= 1000; i++) {
    const t = i / 1000
    const x = B(t, x1, x2)
    while (j <= 100 && j / 100 <= x) { lut[j] = B(t, y1, y2); j++ }
  }
  for (; j <= 100; j++) lut[j] = 1
  return (p: number) => lut[Math.round(clamp(p) * 100)]
}

// ---------------- transform state ----------------
interface TransformState {
  layerId: string
  float: Canvas
  rest: Canvas | null
  src: { x: number; y: number; w: number; h: number }
  quad: P[] // tl, tr, br, bl
  grid: P[] // 16 warp controls
  selection: Canvas | null
  flipped: boolean
}

class Editor {
  host: HTMLElement | null = null
  view: HTMLCanvasElement | null = null
  vctx: CanvasRenderingContext2D | null = null
  composite = makeCanvas(1, 1)
  overlay = makeCanvas(1, 1)
  needsComposite = true
  needsDraw = true
  private raf = 0
  private vw = 0
  private vh = 0

  // input
  private pointers = new Map<number, Ptr>()
  private gesture: { d0: number; a0: number; cx: number; cy: number; view: View; moved: boolean; t: number; count: number; maxCount: number } | null = null
  private touchTimer = 0
  private pendingTouch: PointerEvent | null = null
  private spaceDown = false
  private altDown = false
  private panning: { x: number; y: number; view: View } | null = null
  private lastPenTime = 0
  cursor: { x: number; y: number; visible: boolean } = { x: 0, y: 0, visible: false }

  // tools
  live: LiveStroke | null = null
  private strokeStart: P | null = null
  private assist: ((p: P, s: P) => P) | null = null
  private holdTimer = 0
  private holdAnchor: P | null = null
  private shapeLocked = false
  eyedropperOnce = false
  loupe: { x: number; y: number; color: string; prev: string } | null = null
  private eyeHold = 0
  selDraft: { mode: string; a: P; b: P; pts: P[]; base: number; th: number } | null = null
  lasso: P[] = []
  transform: TransformState | null = null
  private tDrag: { kind: string; idx: number; start: P; quad: P[]; grid: P[] } | null = null
  liquify: Liquify | null = null
  private liqPrev: P | null = null
  private liqLayer: string | null = null
  filterPreview: { layerId: string; canvas: Canvas } | null = null
  private cloneOffset: P | null = null
  private cloneDrag = false
  crop: { x: number; y: number; w: number; h: number } | null = null
  private cropDrag: { kind: string; start: P; rect: { x: number; y: number; w: number; h: number } } | null = null
  private guideDrag: number | null = null
  private textDrag: { start: P; x: number; y: number } | null = null
  private selPhase = 0
  private selOverlayVersion = -1
  onTextMove: ((x: number, y: number) => void) | null = null

  // timelapse
  timelapse: ImageBitmap[] = []
  private lastActive = Date.now()
  private animTimer = 0

  // ============ lifecycle ============
  attach(host: HTMLElement, canvas: HTMLCanvasElement) {
    this.host = host
    this.view = canvas
    this.vctx = canvas.getContext('2d')!
    this.resize()
    this.fit()
    const loop = () => {
      this.raf = requestAnimationFrame(loop)
      this.frame()
    }
    this.raf = requestAnimationFrame(loop)
  }

  detach() {
    cancelAnimationFrame(this.raf)
    this.host = null
    this.view = null
  }

  resize() {
    if (!this.host || !this.view) return
    const r = this.host.getBoundingClientRect()
    this.vw = r.width
    this.vh = r.height
    const d = DPR()
    this.view.width = Math.round(r.width * d)
    this.view.height = Math.round(r.height * d)
    this.view.style.width = r.width + 'px'
    this.view.style.height = r.height + 'px'
    this.needsDraw = true
  }

  invalidate(composite = true) {
    if (composite) this.needsComposite = true
    this.needsDraw = true
  }

  // ============ view math ============
  matrix(v = get().view): DOMMatrix {
    return new DOMMatrix().translate(v.tx, v.ty).rotate((v.rot * 180) / Math.PI).scale(v.zoom * (v.flip ? -1 : 1), v.zoom)
  }

  toDoc(sx: number, sy: number): P {
    const p = this.matrix().inverse().transformPoint(new DOMPoint(sx, sy))
    return { x: p.x, y: p.y }
  }

  toScreen(x: number, y: number): P {
    const p = this.matrix().transformPoint(new DOMPoint(x, y))
    return { x: p.x, y: p.y }
  }

  fit() {
    const d = get().doc
    if (!d || !this.vw) return
    const pad = 80
    const zoom = Math.min((this.vw - pad) / d.width, (this.vh - pad - 40) / d.height)
    set({ view: { zoom, rot: 0, flip: false, tx: (this.vw - d.width * zoom) / 2, ty: (this.vh - d.height * zoom) / 2 + 20 } })
    this.invalidate(false)
  }

  zoomAt(sx: number, sy: number, factor: number) {
    const v = get().view
    const zoom = clamp(v.zoom * factor, 0.02, 64)
    const k = zoom / v.zoom
    set({ view: { ...v, zoom, tx: sx - (sx - v.tx) * k, ty: sy - (sy - v.ty) * k } })
    this.invalidate(false)
  }

  setZoom(zoom: number) {
    this.zoomAt(this.vw / 2, this.vh / 2, zoom / get().view.zoom)
  }

  rotateView(delta: number) {
    const v = get().view
    const c = { x: this.vw / 2, y: this.vh / 2 }
    const m = new DOMMatrix().translate(c.x, c.y).rotate((delta * 180) / Math.PI).translate(-c.x, -c.y)
    const p = m.transformPoint(new DOMPoint(v.tx, v.ty))
    set({ view: { ...v, rot: v.rot + delta, tx: p.x, ty: p.y } })
    this.invalidate(false)
  }

  flipView() {
    const v = get().view
    const d = get().doc
    if (!d) return
    // keep the canvas centre in place
    const c = this.toScreen(d.width / 2, d.height / 2)
    const nv = { ...v, flip: !v.flip }
    set({ view: nv })
    const c2 = this.toScreen(d.width / 2, d.height / 2)
    set({ view: { ...nv, tx: nv.tx + (c.x - c2.x), ty: nv.ty + (c.y - c2.y) } })
    this.invalidate(false)
  }

  // ============ rendering ============
  private frame() {
    const s = get()
    const d = s.doc
    if (!d || !this.vctx || !this.view) return
    if (s.selection) {
      this.selPhase += 0.35
      this.needsDraw = true
    }
    if (!this.needsDraw && !this.needsComposite) return
    if (this.needsComposite) {
      compositeDoc(d, this.composite, {
        live: this.live,
        float: this.floatLayer(),
        anim: s.anim.enabled ? { frame: s.anim.frame, onionBefore: s.anim.onion, onionAfter: s.anim.onion, onionOpacity: s.anim.onionOpacity, bgFrame: s.anim.bgFrame, fgFrame: s.anim.fgFrame, playing: s.anim.playing } : null,
        layerOverride: this.liquify && this.liqLayer ? { id: this.liqLayer, canvas: this.liquify.out } : this.filterPreview ? { id: this.filterPreview.layerId, canvas: this.filterPreview.canvas } : null,
      })
      this.needsComposite = false
    }
    this.needsDraw = false
    this.draw()
  }

  private floatLayer(): FloatLayer | null {
    const t = this.transform
    if (!t) return null
    const smooth = get().transformSmooth
    return {
      layerId: t.layerId,
      hideSource: true,
      draw: (x) => {
        if (t.rest) x.drawImage(t.rest, 0, 0)
        x.imageSmoothingEnabled = smooth
        this.drawFloat(x, t)
      },
    }
  }

  private drawFloat(x: CanvasRenderingContext2D, t: TransformState, img: Canvas = t.float) {
    const mode = get().transformMode
    const { src, quad } = t
    if (mode === 'warp') {
      drawMesh(x, img, src.x, src.y, src.w, src.h, (u, v) => bezierPatch(t.grid, u, v), 20)
    } else if (mode === 'distort' && !this.isParallelogram(quad)) {
      const H = squareToQuad(quad)
      drawMesh(x, img, src.x, src.y, src.w, src.h, (u, v) => applyH(H, u, v), 16)
    } else {
      // affine: map src rect to parallelogram tl,tr,bl
      const [tl, tr, , bl] = quad
      const a = (tr.x - tl.x) / src.w, b = (tr.y - tl.y) / src.w
      const c = (bl.x - tl.x) / src.h, dd = (bl.y - tl.y) / src.h
      x.save()
      x.transform(a, b, c, dd, tl.x - a * src.x - c * src.y, tl.y - b * src.x - dd * src.y)
      x.drawImage(img, src.x, src.y, src.w, src.h, src.x, src.y, src.w, src.h)
      x.restore()
    }
  }

  private isParallelogram(q: P[]) {
    return Math.abs(q[0].x + q[2].x - q[1].x - q[3].x) < 0.5 && Math.abs(q[0].y + q[2].y - q[1].y - q[3].y) < 0.5
  }

  private draw() {
    const s = get()
    const d = s.doc!
    const x = this.vctx!
    const dpr = DPR()
    x.setTransform(1, 0, 0, 1, 0, 0)
    x.clearRect(0, 0, this.view!.width, this.view!.height)
    x.setTransform(dpr, 0, 0, dpr, 0, 0)
    const m = this.matrix()
    // canvas shadow + checker
    x.save()
    x.setTransform(m.a * dpr, m.b * dpr, m.c * dpr, m.d * dpr, m.e * dpr, m.f * dpr)
    x.shadowColor = 'rgba(0,0,0,0.45)'
    x.shadowBlur = 28
    x.shadowOffsetY = 10
    x.fillStyle = s.prefs.light ? '#fff' : '#2a2a2a'
    x.fillRect(0, 0, d.width, d.height)
    x.shadowColor = 'transparent'
    if (!d.bgVisible || s.anim.enabled) {
      x.fillStyle = checkerPattern(x)
      x.fillRect(0, 0, d.width, d.height)
    }
    x.imageSmoothingEnabled = s.view.zoom < 2
    x.imageSmoothingQuality = 'high'
    x.drawImage(this.composite, 0, 0)
    x.imageSmoothingEnabled = true
    // selection overlay
    if (s.selection && !this.transform) {
      const key = Math.floor(this.selPhase) * 100000 + s.selVersion + s.view.zoom
      if (this.selOverlayVersion !== key) {
        selectionOverlay(s.selection, this.overlay, Math.floor(this.selPhase), 1 / s.view.zoom)
        this.selOverlayVersion = key
      }
      x.drawImage(this.overlay, 0, 0)
    }
    // guides
    drawGuides(x, s.guides, d.width, d.height, s.view.zoom, s.tool === 'guide')
    // selection drafts
    const lw = 1.5 / s.view.zoom
    if (this.selDraft && (this.selDraft.mode === 'rect' || this.selDraft.mode === 'ellipse')) {
      const { a, b } = this.selDraft
      x.lineWidth = lw
      x.setLineDash([6 / s.view.zoom, 4 / s.view.zoom])
      x.strokeStyle = '#fff'
      x.beginPath()
      if (this.selDraft.mode === 'rect') x.rect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y))
      else x.ellipse((a.x + b.x) / 2, (a.y + b.y) / 2, Math.abs(b.x - a.x) / 2, Math.abs(b.y - a.y) / 2, 0, 0, Math.PI * 2)
      x.stroke()
      x.strokeStyle = '#111'
      x.lineDashOffset = 5 / s.view.zoom
      x.stroke()
      x.setLineDash([])
    }
    if (this.lasso.length) {
      x.lineWidth = lw
      x.strokeStyle = '#fff'
      x.setLineDash([6 / s.view.zoom, 4 / s.view.zoom])
      x.beginPath()
      this.lasso.forEach((p, i) => (i ? x.lineTo(p.x, p.y) : x.moveTo(p.x, p.y)))
      x.stroke()
      x.setLineDash([])
      const p0 = this.lasso[0]
      x.fillStyle = '#fff'
      x.strokeStyle = '#111'
      x.beginPath()
      x.arc(p0.x, p0.y, 6 / s.view.zoom, 0, Math.PI * 2)
      x.fill()
      x.stroke()
    }
    // crop
    if (this.crop) {
      const c = this.crop
      x.fillStyle = 'rgba(0,0,0,0.55)'
      x.beginPath()
      x.rect(-d.width * 4, -d.height * 4, d.width * 9, d.height * 9)
      x.rect(c.x + c.w, c.y, -c.w, c.h)
      x.fill('evenodd')
      x.strokeStyle = '#fff'
      x.lineWidth = 2 / s.view.zoom
      x.strokeRect(c.x, c.y, c.w, c.h)
      x.lineWidth = 1 / s.view.zoom
      x.globalAlpha = 0.5
      for (let i = 1; i < 3; i++) {
        x.beginPath()
        x.moveTo(c.x + (c.w * i) / 3, c.y); x.lineTo(c.x + (c.w * i) / 3, c.y + c.h)
        x.moveTo(c.x, c.y + (c.h * i) / 3); x.lineTo(c.x + c.w, c.y + (c.h * i) / 3)
        x.stroke()
      }
      x.globalAlpha = 1
    }
    x.restore()

    // ---- screen-space overlays ----
    x.setTransform(dpr, 0, 0, dpr, 0, 0)
    if (this.transform) this.drawTransformHandles(x)
    if (this.crop) {
      for (const h of this.cropHandles()) this.handle(x, h.x, h.y, 7)
    }
    if (s.adjust === 'clone' && s.cloneSource) {
      const off = this.cloneOffset
      const cs = this.live && off ? this.toScreen(this.cursor.x + off.x, this.cursor.y + off.y) : this.toScreen(s.cloneSource.x, s.cloneSource.y)
      x.strokeStyle = '#fff'
      x.lineWidth = 2
      x.beginPath()
      x.arc(cs.x, cs.y, 22, 0, Math.PI * 2)
      x.stroke()
      x.strokeStyle = '#111'
      x.lineWidth = 1
      x.beginPath()
      x.arc(cs.x, cs.y, 24, 0, Math.PI * 2)
      x.moveTo(cs.x - 6, cs.y); x.lineTo(cs.x + 6, cs.y)
      x.moveTo(cs.x, cs.y - 6); x.lineTo(cs.x, cs.y + 6)
      x.stroke()
    }
    // brush cursor
    if (this.cursor.visible && s.prefs.brushCursor && !this.loupe) {
      const r = this.cursorRadius()
      if (r) {
        const p = this.toScreen(this.cursor.x, this.cursor.y)
        x.lineWidth = 1
        x.strokeStyle = 'rgba(255,255,255,0.9)'
        x.beginPath()
        x.arc(p.x, p.y, Math.max(2, r), 0, Math.PI * 2)
        x.stroke()
        x.strokeStyle = 'rgba(0,0,0,0.6)'
        x.beginPath()
        x.arc(p.x, p.y, Math.max(2, r) + 1, 0, Math.PI * 2)
        x.stroke()
      }
    }
    if (this.loupe) {
      const p = this.toScreen(this.loupe.x, this.loupe.y)
      const R = 46
      x.lineWidth = 16
      x.strokeStyle = this.loupe.prev
      x.beginPath()
      x.arc(p.x, p.y - 70, R, 0, Math.PI)
      x.stroke()
      x.strokeStyle = this.loupe.color
      x.beginPath()
      x.arc(p.x, p.y - 70, R, Math.PI, Math.PI * 2)
      x.stroke()
      x.lineWidth = 1.5
      x.strokeStyle = 'rgba(255,255,255,0.8)'
      x.beginPath()
      x.arc(p.x, p.y - 70, R + 8, 0, Math.PI * 2)
      x.arc(p.x, p.y - 70, R - 8, 0, Math.PI * 2, true)
      x.stroke()
      x.beginPath()
      x.moveTo(p.x - 5, p.y - 70); x.lineTo(p.x + 5, p.y - 70)
      x.moveTo(p.x, p.y - 75); x.lineTo(p.x, p.y - 65)
      x.stroke()
    }
  }

  private cursorRadius(): number {
    const s = get()
    const bt = this.brushTool()
    if (!bt) {
      if (s.adjust === 'liquify') return (s.liquify.size * 300 * s.view.zoom) / 2
      return 0
    }
    const b = this.brushFor(bt)
    return (this.sizePx(bt, b.props.maxSize) * s.view.zoom) / 2
  }

  private handle(x: CanvasRenderingContext2D, px: number, py: number, r = 6, fill = '#fff') {
    x.beginPath()
    x.arc(px, py, r, 0, Math.PI * 2)
    x.fillStyle = fill
    x.fill()
    x.lineWidth = 1.5
    x.strokeStyle = 'rgba(0,0,0,0.55)'
    x.stroke()
  }

  // ============ helpers ============
  brushTool(): BrushTool | null {
    const s = get()
    if (s.adjust === 'clone') return 'paint'
    if (s.adjust) return null
    return s.tool === 'paint' || s.tool === 'smudge' || s.tool === 'erase' ? s.tool : null
  }

  brushFor(t: BrushTool) {
    const s = get()
    return s.brushes.find((b) => b.id === s.toolBrush[t]) || s.brushes[0]
  }

  sizePx(t: BrushTool, maxSize: number) {
    const s = get()
    const rel = s.toolSize[t]
    let px = Math.max(1, rel * rel * maxSize * 4 + rel * 2)
    if (s.prefs.dynamicScaling) px /= s.view.zoom
    return px
  }

  private layerForPaint(): { layer: Layer; target: 'content' | 'mask' } | null {
    const L = active()
    if (!L) return null
    if (L.locked) { toast('La capa está bloqueada'); return null }
    if (L.kind === 'group') { toast('Selecciona una capa dentro del grupo'); return null }
    if (!L.visible) { toast('La capa está oculta'); return null }
    if (L.kind === 'text') {
      commit('Rasterizar texto', (d) => ({ ...d, layers: d.layers.map((l) => (l.id === L.id ? { ...l, kind: 'raster', text: undefined } : l)) }))
      toast('Texto rasterizado para poder pintar')
      return { layer: active()!, target: 'content' }
    }
    return { layer: L, target: L.mask && L.editMask ? 'mask' : 'content' }
  }

  // ============ input ============
  pointerDown(e: PointerEvent) {
    const s = get()
    if (!s.doc) return
    this.lastActive = Date.now()
    const r = this.host!.getBoundingClientRect()
    const sx = e.clientX - r.left, sy = e.clientY - r.top
    this.pointers.set(e.pointerId, { id: e.pointerId, x: sx, y: sy, sx, sy, type: e.pointerType, t: performance.now() })
    if (e.pointerType === 'pen') this.lastPenTime = Date.now()

    if (e.pointerType === 'touch') {
      const touches = [...this.pointers.values()].filter((p) => p.type === 'touch')
      if (touches.length >= 2) {
        // cancel any single-finger action and start a gesture
        clearTimeout(this.touchTimer)
        this.pendingTouch = null
        if (this.live) { this.abortStroke() }
        this.selDraft = null
        this.startGesture()
        return
      }
      const penRecent = Date.now() - this.lastPenTime < 60_000
      if (!s.prefs.touchPaint && penRecent && this.brushTool()) {
        this.startGesture()
        return
      }
      // delay slightly so a second finger can turn this into a gesture
      this.pendingTouch = e
      this.touchTimer = window.setTimeout(() => {
        if (this.pendingTouch) { const ev = this.pendingTouch; this.pendingTouch = null; this.toolDown(ev, sx, sy) }
      }, 70)
      if (s.prefs.holdEyedropper && this.brushTool()) {
        clearTimeout(this.eyeHold)
        this.eyeHold = window.setTimeout(() => {
          const p = this.pointers.get(e.pointerId)
          if (p && Math.hypot(p.x - p.sx, p.y - p.sy) < 6 && this.pointers.size === 1) {
            if (this.live) this.abortStroke()
            this.startEyedropper(p.x, p.y)
          }
        }, 520)
      }
      return
    }
    if (e.button === 1 || e.button === 2 || this.spaceDown) {
      this.panning = { x: sx, y: sy, view: { ...s.view } }
      return
    }
    if (this.altDown || this.eyedropperOnce || s.tool === 'eyedropper') {
      this.startEyedropper(sx, sy)
      return
    }
    this.toolDown(e, sx, sy)
  }

  pointerMove(e: PointerEvent) {
    const s = get()
    if (!s.doc || !this.host) return
    const r = this.host.getBoundingClientRect()
    const sx = e.clientX - r.left, sy = e.clientY - r.top
    const dp = this.toDoc(sx, sy)
    this.cursor = { x: dp.x, y: dp.y, visible: e.pointerType !== 'touch' || !!this.live }
    const p = this.pointers.get(e.pointerId)
    if (p) { p.x = sx; p.y = sy }
    this.needsDraw = true
    if (this.gesture) { this.updateGesture(); return }
    if (this.pendingTouch && p && Math.hypot(sx - p.sx, sy - p.sy) > 8) {
      clearTimeout(this.touchTimer)
      const ev = this.pendingTouch
      this.pendingTouch = null
      this.toolDown(ev, p.sx, p.sy)
    }
    if (this.panning) {
      const v = this.panning.view
      set({ view: { ...v, tx: v.tx + sx - this.panning.x, ty: v.ty + sy - this.panning.y } })
      return
    }
    if (this.loupe) { this.updateEyedropper(sx, sy); return }
    if (!p) return
    this.toolMove(e, sx, sy)
  }

  pointerUp(e: PointerEvent) {
    const s = get()
    const p = this.pointers.get(e.pointerId)
    this.pointers.delete(e.pointerId)
    clearTimeout(this.eyeHold)
    if (!s.doc) return
    if (this.gesture) {
      this.gesture.count = this.pointers.size
      if (this.pointers.size === 0) this.endGesture()
      else this.startGesture(true)
      return
    }
    if (this.pendingTouch) {
      // quick tap with one finger
      clearTimeout(this.touchTimer)
      const ev = this.pendingTouch
      this.pendingTouch = null
      if (p) { this.toolDown(ev, p.sx, p.sy); this.toolUp(e) }
      return
    }
    if (this.panning) { this.panning = null; return }
    if (this.loupe) { this.endEyedropper(); return }
    this.toolUp(e)
    if (e.pointerType === 'touch') this.cursor.visible = false
  }

  pointerLeave() {
    this.cursor.visible = false
    this.needsDraw = true
  }

  wheel(e: WheelEvent) {
    e.preventDefault()
    const r = this.host!.getBoundingClientRect()
    const sx = e.clientX - r.left, sy = e.clientY - r.top
    const v = get().view
    if (e.ctrlKey || e.metaKey) this.zoomAt(sx, sy, Math.exp(-e.deltaY * 0.01))
    else if (e.altKey) this.rotateView(e.deltaY * 0.004)
    else if (e.deltaMode === 1 || (Math.abs(e.deltaY) >= 50 && e.deltaX === 0 && !e.shiftKey)) this.zoomAt(sx, sy, e.deltaY < 0 ? 1.15 : 1 / 1.15)
    else set({ view: { ...v, tx: v.tx - (e.shiftKey ? e.deltaY : e.deltaX), ty: v.ty - (e.shiftKey ? 0 : e.deltaY) } })
    this.needsDraw = true
  }

  // ----- gestures -----
  private startGesture(resume = false) {
    const pts = [...this.pointers.values()]
    if (!pts.length) return
    const cx = pts.reduce((a, p) => a + p.x, 0) / pts.length
    const cy = pts.reduce((a, p) => a + p.y, 0) / pts.length
    const d0 = pts.length > 1 ? Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y) : 1
    const a0 = pts.length > 1 ? Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x) : 0
    const prev = this.gesture
    this.gesture = {
      d0, a0, cx, cy, view: { ...get().view },
      moved: resume && prev ? prev.moved : false,
      t: resume && prev ? prev.t : performance.now(),
      count: pts.length,
      maxCount: Math.max(pts.length, resume && prev ? prev.maxCount : 0),
    }
  }

  private updateGesture() {
    const g = this.gesture!
    const pts = [...this.pointers.values()]
    if (pts.length < 2) {
      if (pts.length === 1 && g.count === 1) {
        const v = g.view
        const p = pts[0]
        if (Math.hypot(p.x - g.cx, p.y - g.cy) > 10) g.moved = true
        set({ view: { ...v, tx: v.tx + p.x - g.cx, ty: v.ty + p.y - g.cy } })
      }
      return
    }
    const cx = (pts[0].x + pts[1].x) / 2, cy = (pts[0].y + pts[1].y) / 2
    const d = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y)
    const a = Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x)
    const scale = d / g.d0
    let rot = a - g.a0
    if (Math.abs(scale - 1) > 0.04 || Math.abs(rot) > 0.06 || Math.hypot(cx - g.cx, cy - g.cy) > 10) g.moved = true
    if (!g.moved) return
    const v = g.view
    const zoom = clamp(v.zoom * scale, 0.02, 64)
    const k = zoom / v.zoom
    if (Math.abs(rot) < 0.05) rot = 0
    const m = new DOMMatrix()
      .translate(cx, cy)
      .rotate((rot * 180) / Math.PI)
      .scale(k, k)
      .translate(-g.cx, -g.cy)
    const t = m.transformPoint(new DOMPoint(v.tx, v.ty))
    set({ view: { ...v, zoom, rot: v.rot + rot, tx: t.x, ty: t.y } })
    this.needsDraw = true
  }

  private endGesture() {
    const g = this.gesture!
    this.gesture = null
    const dt = performance.now() - g.t
    const s = get()
    if (!g.moved && dt < 320) {
      if (g.maxCount === 2 && s.prefs.tapUndo) this.undo()
      else if (g.maxCount === 3 && s.prefs.tapUndo) this.redo()
      else if (g.maxCount >= 4) set({ uiHidden: !s.uiHidden })
      return
    }
    // quick pinch: snap to fit when zoomed out past fit quickly
    if (dt < 260 && s.view.zoom < g.view.zoom * 0.7) this.fit()
  }

  key(e: KeyboardEvent, down: boolean) {
    if (e.code === 'Space') { this.spaceDown = down; if (this.host) this.host.style.cursor = down ? 'grab' : ''; }
    if (e.key === 'Alt') { this.altDown = down; e.preventDefault() }
  }

  // ----- eyedropper -----
  private sampleAt(p: P): string | null {
    const d = get().doc!
    const x = Math.floor(p.x), y = Math.floor(p.y)
    if (x < 0 || y < 0 || x >= d.width || y >= d.height) return null
    const t = makeCanvas(1, 1)
    const tx = ctx2d(t, true)
    if (d.bgVisible) { tx.fillStyle = d.background; tx.fillRect(0, 0, 1, 1) } else { tx.fillStyle = '#fff'; tx.fillRect(0, 0, 1, 1) }
    tx.drawImage(this.composite, x, y, 1, 1, 0, 0, 1, 1)
    const px = tx.getImageData(0, 0, 1, 1).data
    return rgbToHex({ r: px[0], g: px[1], b: px[2] })
  }

  startEyedropper(sx: number, sy: number) {
    const p = this.toDoc(sx, sy)
    const prev = hsvToHex(get().color.primary)
    const c = this.sampleAt(p) || prev
    this.loupe = { x: p.x, y: p.y, color: c, prev }
    this.needsDraw = true
  }

  private updateEyedropper(sx: number, sy: number) {
    const p = this.toDoc(sx, sy)
    const c = this.sampleAt(p)
    if (c && this.loupe) this.loupe = { ...this.loupe, x: p.x, y: p.y, color: c }
  }

  private endEyedropper() {
    if (this.loupe) {
      const s = get()
      set({ color: { ...s.color, primary: hexToHsv(this.loupe.color) } })
    }
    this.loupe = null
    this.eyedropperOnce = false
    if (get().tool === 'eyedropper') set({ tool: get().lastBrushTool })
    this.needsDraw = true
  }

  // ============ tool dispatch ============
  private toolDown(e: PointerEvent, sx: number, sy: number) {
    const s = get()
    const p = this.toDoc(sx, sy)
    if (this.crop) return this.cropDown(p, sx, sy)
    if (s.tool === 'guide') return this.guideDown(p, sx, sy)
    if (this.transform) return this.transformDown(p, sx, sy)
    if (s.adjust === 'liquify') return this.liquifyDown(p)
    if (s.adjust === 'clone') {
      if (s.cloneSource) {
        const cs = this.toScreen(s.cloneSource.x, s.cloneSource.y)
        if (Math.hypot(cs.x - sx, cs.y - sy) < 28) { this.cloneDrag = true; return }
      }
      return this.strokeDown(e, p, 'clone')
    }
    if (s.adjust) return
    if (s.tool === 'select') return this.selectDown(p)
    if (s.tool === 'text') return this.textDown(p)
    const bt = this.brushTool()
    if (bt) this.strokeDown(e, p, bt === 'paint' ? 'paint' : bt === 'erase' ? 'erase' : 'smudge')
  }

  private toolMove(e: PointerEvent, sx: number, sy: number) {
    const s = get()
    const p = this.toDoc(sx, sy)
    if (this.cropDrag) return this.cropMove(p)
    if (this.guideDrag !== null) return this.guideMove(p)
    if (this.tDrag) return this.transformMove(p)
    if (this.liqPrev) return this.liquifyMove(p)
    if (this.cloneDrag) { set({ cloneSource: p }); this.cloneOffset = null; return }
    if (this.selDraft) return this.selectMove(p)
    if (this.textDrag) return this.textMove(p)
    if (this.live) this.strokeMove(e)
    void s
  }

  private toolUp(e: PointerEvent) {
    if (this.cropDrag) { this.cropDrag = null; return }
    if (this.guideDrag !== null) { this.guideDrag = null; return }
    if (this.tDrag) { this.tDrag = null; this.invalidate(); return }
    if (this.liqPrev) { this.liqPrev = null; return }
    if (this.cloneDrag) { this.cloneDrag = false; return }
    if (this.selDraft) return this.selectUp()
    if (this.textDrag) { this.textDrag = null; return }
    if (this.live) this.strokeUp(e)
  }

  // ============ painting ============
  private strokeDown(e: PointerEvent, p: P, mode: StrokeMode) {
    const s = get()
    const d = s.doc!
    const target = this.layerForPaint()
    if (!target) return
    const bt: BrushTool = mode === 'clone' ? 'paint' : (mode as BrushTool)
    const brush = this.brushFor(bt)
    let smode: StrokeMode = mode
    const L = target.layer
    let maskValue = 1
    if (target.target === 'mask') {
      smode = 'mask'
      maskValue = mode === 'erase' ? 0 : s.color.primary.v * (1 - s.color.primary.s * 0.5)
      if (mode === 'smudge') smode = 'smudge'
    }
    const layerCanvas = targetCanvas(L, target.target)
    beginPixels(L, target.target)
    if (mode === 'clone') {
      if (!s.cloneSource) set({ cloneSource: { x: p.x - 80, y: p.y - 80 } })
      const src = get().cloneSource!
      if (!this.cloneOffset) this.cloneOffset = { x: src.x - p.x, y: src.y - p.y }
    }
    const stroke = new Stroke(d.width, d.height, {
      brush,
      size: this.sizePx(bt, brush.props.maxSize),
      opacity: s.toolOpacity[bt] * brush.props.maxOpacity,
      color: hsvToHex(s.color.primary),
      mode: smode,
      layer: layerCanvas,
      source: mode === 'clone' ? cloneCanvas(this.composite) : undefined,
      cloneOffset: this.cloneOffset || undefined,
      alphaLock: L.alphaLock && target.target === 'content',
      selection: s.selection,
      symmetry: symmetryFn(s.guides, d.width, d.height),
      pressureCurve: bezierCurve(s.prefs.pressureCurve),
      maskValue,
      viewRotation: s.view.rot,
    })
    this.live = { layerId: L.id, target: target.target, stroke }
    this.strokeStart = p
    this.assist = assistFn(s.guides, d.width, d.height)
    this.shapeLocked = false
    this.addEventPoint(e, [e])
    this.armQuickShape(p)
    this.invalidate()
  }

  private pressureOf(ev: PointerEvent): number {
    if (ev.pointerType === 'pen') return ev.pressure || 0.01
    if (ev.pointerType === 'touch') return ev.pressure && ev.pressure !== 0.5 ? ev.pressure : 0.75
    return get().prefs.mousePressure === 'full' ? 1 : 0.7
  }

  private addEventPoint(_e: PointerEvent, events: PointerEvent[]) {
    if (!this.live || !this.host) return
    const r = this.host.getBoundingClientRect()
    for (const ev of events) {
      let p = this.toDoc(ev.clientX - r.left, ev.clientY - r.top)
      if (this.assist && this.strokeStart) p = this.assist(p, this.strokeStart)
      this.live.stroke.addPoint({ x: p.x, y: p.y, p: this.pressureOf(ev), tiltX: ev.tiltX || 0, tiltY: ev.tiltY || 0, t: ev.timeStamp })
    }
    this.live.stroke.render()
    this.needsComposite = true
    this.needsDraw = true
  }

  private armQuickShape(p: P) {
    clearTimeout(this.holdTimer)
    const s = get()
    if (!s.prefs.quickShape || this.live?.stroke.o.mode === 'smudge') return
    this.holdAnchor = p
    this.holdTimer = window.setTimeout(() => this.quickShape(), s.prefs.quickShapeDelay)
  }

  private quickShape() {
    if (!this.live || this.shapeLocked) return
    const st = this.live.stroke
    if (st.path.length < 6) return
    const shape = detectShape(st.raw.map((r) => ({ x: r.x, y: r.y })))
    if (!shape) return
    this.shapeLocked = true
    st.rerender(shape.path)
    this.invalidate()
    toast(`${SHAPE_NAMES[shape.kind]} creada`)
  }

  private strokeMove(e: PointerEvent) {
    if (!this.live || this.shapeLocked) return
    const evs = (e as any).getCoalescedEvents?.() as PointerEvent[] | undefined
    this.addEventPoint(e, evs && evs.length ? evs : [e])
    const r = this.host!.getBoundingClientRect()
    const p = this.toDoc(e.clientX - r.left, e.clientY - r.top)
    if (this.holdAnchor && Math.hypot(p.x - this.holdAnchor.x, p.y - this.holdAnchor.y) * get().view.zoom > 3) this.armQuickShape(p)
  }

  private strokeUp(_e: PointerEvent) {
    clearTimeout(this.holdTimer)
    const live = this.live!
    const st = live.stroke
    if (!this.shapeLocked) st.end()
    const d = get().doc!
    const L = d.layers.find((l) => l.id === live.layerId)
    if (L) {
      const cv = targetCanvas(L, live.target)
      st.applyTo(cv)
      const labels: Record<string, string> = { paint: 'Pintar', erase: 'Borrar', smudge: 'Difuminar', clone: 'Clonar', mask: 'Máscara' }
      endPixels(labels[st.o.mode] || 'Trazo', st.bbox.clampTo(d.width, d.height))
    } else cancelPixels()
    this.live = null
    this.strokeStart = null
    this.shapeLocked = false
    if (st.o.mode === 'paint') this.pushColorHistory(st.o.color)
    this.invalidate()
    this.captureTimelapse()
  }

  private abortStroke() {
    clearTimeout(this.holdTimer)
    cancelPixels()
    this.live = null
    this.invalidate()
  }

  pushColorHistory(hex: string) {
    const s = get()
    if (s.colorHistory[0] === hex) return
    set({ colorHistory: [hex, ...s.colorHistory.filter((c) => c !== hex)].slice(0, 10) })
  }

  // ============ ColorDrop ============
  lastDrop: { x: number; y: number; color: string; layerId: string } | null = null
  colorDropAt(sx: number, sy: number, color?: string, redoThreshold = false) {
    const s = get()
    const d = s.doc
    if (!d || !this.host) return
    const r = this.host.getBoundingClientRect()
    const p = redoThreshold && this.lastDrop ? this.lastDrop : this.toDoc(sx - r.left, sy - r.top)
    if (p.x < 0 || p.y < 0 || p.x >= d.width || p.y >= d.height) return
    const target = this.layerForPaint()
    if (!target) return
    const L = target.layer
    const hex = color || (redoThreshold && this.lastDrop ? this.lastDrop.color : hsvHex(s.color.primary))
    if (redoThreshold) undo()
    const ref = referenceComposite(d)
    const src = ref || targetCanvas(L, target.target)
    let mask = floodMask(src, p.x, p.y, s.colorDropThreshold)
    if (!mask) return
    mask = dilate(mask, d.width, d.height, 1)
    const fill = maskToCanvas(mask, d.width, d.height, target.target === 'mask' ? '#ffffff' : hex)
    if (s.selection) {
      const fx = ctx2d(fill)
      fx.globalCompositeOperation = 'destination-in'
      fx.drawImage(s.selection, 0, 0)
    }
    beginPixels(L, target.target)
    const x = ctx2d(targetCanvas(L, target.target))
    x.save()
    x.globalCompositeOperation = L.alphaLock ? 'source-atop' : 'source-over'
    x.drawImage(fill, 0, 0)
    x.restore()
    endPixels('ColorDrop', null)
    this.lastDrop = { x: p.x, y: p.y, color: hex, layerId: L.id }
    this.pushColorHistory(hex)
    this.invalidate()
    this.captureTimelapse()
  }

  // ============ selection ============
  private autoStart: Canvas | null = null
  private autoTimer = 0

  private selectDown(p: P) {
    const s = get()
    const mode = s.selectMode
    if (mode === 'free') {
      if (this.lasso.length > 2) {
        const p0 = this.toScreen(this.lasso[0].x, this.lasso[0].y)
        const ps = this.toScreen(p.x, p.y)
        if (Math.hypot(p0.x - ps.x, p0.y - ps.y) < 18) { this.finishLasso(); return }
      }
      this.lasso.push(p)
      this.selDraft = { mode, a: p, b: p, pts: [p], base: 0, th: 0 }
      this.needsDraw = true
      return
    }
    if (mode === 'auto') {
      this.autoStart = s.selection
      this.selDraft = { mode, a: p, b: p, pts: [], base: this.toScreen(p.x, p.y).x, th: s.autoThreshold }
      this.runAuto(p, s.autoThreshold)
      return
    }
    this.selDraft = { mode, a: p, b: p, pts: [], base: 0, th: 0 }
  }

  private runAuto(p: P, th: number) {
    const s = get()
    const m = autoMask(this.composite, p, th)
    if (!m) return
    set({ selection: combine(this.autoStart, m, s.selectOp), selVersion: s.selVersion + 1 })
    this.needsDraw = true
  }

  private selectMove(p: P) {
    const dft = this.selDraft!
    if (dft.mode === 'auto') {
      const th = clamp(dft.th + (this.toScreen(p.x, p.y).x - dft.base) / 400, 0.01, 1)
      set({ autoThreshold: th })
      clearTimeout(this.autoTimer)
      this.autoTimer = window.setTimeout(() => this.runAuto(dft.a, th), 40)
      return
    }
    if (dft.mode === 'free') {
      const last = this.lasso[this.lasso.length - 1]
      if (Math.hypot(p.x - last.x, p.y - last.y) * get().view.zoom > 3) this.lasso.push(p)
      this.needsDraw = true
      return
    }
    dft.b = p
    this.needsDraw = true
  }

  private selectUp() {
    const s = get()
    const d = s.doc!
    const dft = this.selDraft!
    this.selDraft = null
    if (dft.mode === 'auto') {
      clearTimeout(this.autoTimer)
      this.runAuto(dft.a, s.autoThreshold)
      const result = get().selection
      set({ selection: this.autoStart })
      setSelection('Selección automática', result)
      this.autoStart = null
      return
    }
    if (dft.mode === 'free') return
    if (Math.hypot(dft.b.x - dft.a.x, dft.b.y - dft.a.y) < 2) {
      if (s.selection && s.selectOp === 'replace') setSelection('Deseleccionar', null)
      return
    }
    const m = dft.mode === 'rect' ? rectMask(d.width, d.height, dft.a, dft.b) : ellipseMask(d.width, d.height, dft.a, dft.b)
    setSelection('Selección', combine(s.selection, m, s.selectOp))
  }

  finishLasso() {
    const s = get()
    const d = s.doc
    if (!d || this.lasso.length < 3) { this.lasso = []; this.needsDraw = true; return }
    const m = polyMask(d.width, d.height, this.lasso)
    this.lasso = []
    this.selDraft = null
    setSelection('Selección a mano alzada', combine(s.selection, m, s.selectOp))
  }

  cancelLasso() {
    this.lasso = []
    this.selDraft = null
    this.needsDraw = true
  }

  resetSelectionTool() {
    this.cancelLasso()
  }

  // ============ transform ============
  beginTransform(): boolean {
    const s = get()
    const d = s.doc
    const L = active()
    if (!d || !L) return false
    if (L.locked) { toast('La capa está bloqueada'); return false }
    if (L.kind === 'group') { toast('Transformar grupos no está disponible; aplana el grupo primero'); return false }
    const sel = s.selection
    const float = makeCanvas(d.width, d.height)
    const fx = ctx2d(float)
    fx.drawImage(L.canvas, 0, 0)
    let rest: Canvas | null = null
    if (sel) {
      fx.globalCompositeOperation = 'destination-in'
      fx.drawImage(sel, 0, 0)
      rest = cloneCanvas(L.canvas)
      const rx = ctx2d(rest)
      rx.globalCompositeOperation = 'destination-out'
      rx.drawImage(sel, 0, 0)
    }
    const b = contentBounds(float)
    if (!b) { toast(sel ? 'La selección está vacía en esta capa' : 'La capa está vacía'); return false }
    const quad = [{ x: b.x, y: b.y }, { x: b.x + b.w, y: b.y }, { x: b.x + b.w, y: b.y + b.h }, { x: b.x, y: b.y + b.h }]
    this.transform = { layerId: L.id, float, rest, src: b, quad, grid: gridFromQuad(quad), selection: sel, flipped: false }
    this.invalidate()
    return true
  }

  private tHandles(): { kind: string; idx: number; p: P }[] {
    const t = this.transform!
    const mode = get().transformMode
    const S = (p: P) => this.toScreen(p.x, p.y)
    const q = t.quad.map(S)
    const out: { kind: string; idx: number; p: P }[] = []
    if (mode === 'warp') {
      t.grid.forEach((g, i) => out.push({ kind: 'grid', idx: i, p: S(g) }))
      return out
    }
    q.forEach((p, i) => out.push({ kind: 'corner', idx: i, p }))
    for (let i = 0; i < 4; i++) {
      const a = q[i], b = q[(i + 1) % 4]
      out.push({ kind: 'edge', idx: i, p: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } })
    }
    if (mode !== 'distort') {
      const top = { x: (q[0].x + q[1].x) / 2, y: (q[0].y + q[1].y) / 2 }
      const c = { x: (q[0].x + q[2].x) / 2, y: (q[0].y + q[2].y) / 2 }
      const dx = top.x - c.x, dy = top.y - c.y
      const l = Math.hypot(dx, dy) || 1
      out.push({ kind: 'rotate', idx: 0, p: { x: top.x + (dx / l) * 32, y: top.y + (dy / l) * 32 } })
    }
    return out
  }

  private drawTransformHandles(x: CanvasRenderingContext2D) {
    const t = this.transform!
    const mode = get().transformMode
    const S = (p: P) => this.toScreen(p.x, p.y)
    const outline = () => {
      x.lineWidth = 3
      x.strokeStyle = 'rgba(0,0,0,0.45)'
      x.stroke()
      x.lineWidth = 1.25
      x.strokeStyle = 'rgba(255,255,255,0.95)'
      x.stroke()
    }
    if (mode === 'warp') {
      x.beginPath()
      for (let j = 0; j <= 8; j++) for (let i = 0; i <= 24; i++) {
        const p = S(bezierPatch(t.grid, i / 24, j / 8))
        i ? x.lineTo(p.x, p.y) : x.moveTo(p.x, p.y)
      }
      for (let i = 0; i <= 8; i++) for (let j = 0; j <= 24; j++) {
        const p = S(bezierPatch(t.grid, i / 8, j / 24))
        j ? x.lineTo(p.x, p.y) : x.moveTo(p.x, p.y)
      }
      outline()
    } else {
      const q = t.quad.map(S)
      x.beginPath()
      q.forEach((p, i) => (i ? x.lineTo(p.x, p.y) : x.moveTo(p.x, p.y)))
      x.closePath()
      outline()
    }
    x.lineWidth = 1
    x.strokeStyle = 'rgba(255,255,255,0.9)'
    for (const h of this.tHandles()) {
      if (h.kind === 'rotate') {
        const q = t.quad.map(S)
        const top = { x: (q[0].x + q[1].x) / 2, y: (q[0].y + q[1].y) / 2 }
        x.beginPath(); x.moveTo(top.x, top.y); x.lineTo(h.p.x, h.p.y); x.stroke()
        this.handle(x, h.p.x, h.p.y, 7, '#e9d25a')
      } else this.handle(x, h.p.x, h.p.y, h.kind === 'edge' ? 5 : 7)
    }
  }

  private transformDown(p: P, sx: number, sy: number) {
    const t = this.transform!
    let hit: { kind: string; idx: number } = { kind: 'move', idx: 0 }
    for (const h of this.tHandles()) if (Math.hypot(h.p.x - sx, h.p.y - sy) < 16) { hit = h; break }
    this.tDrag = { ...hit, start: p, quad: t.quad.map((q) => ({ ...q })), grid: t.grid.map((q) => ({ ...q })) }
  }

  private transformMove(p: P) {
    const t = this.transform!
    const dr = this.tDrag!
    const s = get()
    const mode = s.transformMode
    let dx = p.x - dr.start.x, dy = p.y - dr.start.y
    const Q = dr.quad
    const center = { x: (Q[0].x + Q[2].x) / 2, y: (Q[0].y + Q[2].y) / 2 }
    const d = s.doc!
    if (dr.kind === 'move') {
      if (s.transformSnap) {
        // snap centre to canvas centre
        const nc = { x: center.x + dx, y: center.y + dy }
        const tol = 10 / s.view.zoom
        if (Math.abs(nc.x - d.width / 2) < tol) dx = d.width / 2 - center.x
        if (Math.abs(nc.y - d.height / 2) < tol) dy = d.height / 2 - center.y
      }
      t.quad = Q.map((q) => ({ x: q.x + dx, y: q.y + dy }))
      t.grid = dr.grid.map((q) => ({ x: q.x + dx, y: q.y + dy }))
    } else if (dr.kind === 'grid') {
      t.grid = dr.grid.map((q, i) => (i === dr.idx ? { x: q.x + dx, y: q.y + dy } : q))
    } else if (dr.kind === 'rotate') {
      const a0 = Math.atan2(dr.start.y - center.y, dr.start.x - center.x)
      let a = Math.atan2(p.y - center.y, p.x - center.x) - a0
      if (s.transformSnap) {
        const step = Math.PI / 12
        const snapped = Math.round(a / step) * step
        if (Math.abs(snapped - a) < 0.04) a = snapped
      }
      const cs = Math.cos(a), sn = Math.sin(a)
      const rot = (q: P) => ({ x: center.x + (q.x - center.x) * cs - (q.y - center.y) * sn, y: center.y + (q.x - center.x) * sn + (q.y - center.y) * cs })
      t.quad = Q.map(rot)
      t.grid = dr.grid.map(rot)
    } else if (mode === 'distort') {
      if (dr.kind === 'corner') t.quad = Q.map((q, i) => (i === dr.idx ? { x: q.x + dx, y: q.y + dy } : q))
      else t.quad = Q.map((q, i) => (i === dr.idx || i === (dr.idx + 1) % 4 ? { x: q.x + dx, y: q.y + dy } : q))
      t.grid = gridFromQuad(t.quad)
    } else {
      // freeform / uniform: scale in the quad's local frame, anchored at the opposite side
      const ux = { x: Q[1].x - Q[0].x, y: Q[1].y - Q[0].y }
      const vy = { x: Q[3].x - Q[0].x, y: Q[3].y - Q[0].y }
      const lu = Math.hypot(ux.x, ux.y) || 1, lv = Math.hypot(vy.x, vy.y) || 1
      const eu = { x: ux.x / lu, y: ux.y / lu }, ev = { x: vy.x / lv, y: vy.y / lv }
      const du = dx * eu.x + dy * eu.y, dv = dx * ev.x + dy * ev.y
      // which sides move: corner idx 0 tl,1 tr,2 br,3 bl ; edge idx 0 top,1 right,2 bottom,3 left
      let left = 0, right = 0, top = 0, bottom = 0
      if (dr.kind === 'corner') {
        if (dr.idx === 0) { left = du; top = dv }
        if (dr.idx === 1) { right = du; top = dv }
        if (dr.idx === 2) { right = du; bottom = dv }
        if (dr.idx === 3) { left = du; bottom = dv }
      } else {
        if (dr.idx === 0) top = dv
        if (dr.idx === 1) right = du
        if (dr.idx === 2) bottom = dv
        if (dr.idx === 3) left = du
      }
      let nw = lu - left + right, nh = lv - top + bottom
      const uniform = mode === 'uniform' || (dr.kind === 'corner' && this.shiftKey)
      if (uniform) {
        const k = dr.kind === 'edge' ? (dr.idx % 2 ? nw / lu : nh / lv) : Math.max(nw / lu, nh / lv)
        const nw2 = lu * k, nh2 = lv * k
        if (dr.kind === 'corner') {
          if (dr.idx === 0 || dr.idx === 3) left = lu - nw2; else right = nw2 - lu
          if (dr.idx === 0 || dr.idx === 1) top = lv - nh2; else bottom = nh2 - lv
        } else if (dr.idx % 2) {
          // horizontal edge drag: grow vertically around centre
          if (dr.idx === 1) right = nw2 - lu; else left = lu - nw2
          top = -(nh2 - lv) / 2; bottom = (nh2 - lv) / 2
        } else {
          if (dr.idx === 2) bottom = nh2 - lv; else top = lv - nh2
          left = -(nw2 - lu) / 2; right = (nw2 - lu) / 2
        }
        nw = nw2; nh = nh2
      }
      const o = { x: Q[0].x + eu.x * left + ev.x * top, y: Q[0].y + eu.y * left + ev.y * top }
      const W = lu - left + right, H = lv - top + bottom
      t.quad = [
        o,
        { x: o.x + eu.x * W, y: o.y + eu.y * W },
        { x: o.x + eu.x * W + ev.x * H, y: o.y + eu.y * W + ev.y * H },
        { x: o.x + ev.x * H, y: o.y + ev.y * H },
      ]
      t.grid = gridFromQuad(t.quad)
      void nw; void nh
    }
    this.invalidate()
  }
  shiftKey = false

  transformAction(action: 'flipH' | 'flipV' | 'rot45' | 'fit' | 'reset') {
    const t = this.transform
    const d = get().doc
    if (!t || !d) return
    const q = t.quad
    const c = { x: (q[0].x + q[2].x) / 2, y: (q[0].y + q[2].y) / 2 }
    if (action === 'flipH') {
      t.quad = [q[1], q[0], q[3], q[2]]
      t.grid = [3, 2, 1, 0, 7, 6, 5, 4, 11, 10, 9, 8, 15, 14, 13, 12].map((i) => t.grid[i])
    } else if (action === 'flipV') {
      t.quad = [q[3], q[2], q[1], q[0]]
      t.grid = [12, 13, 14, 15, 8, 9, 10, 11, 4, 5, 6, 7, 0, 1, 2, 3].map((i) => t.grid[i])
    } else if (action === 'rot45') {
      const a = Math.PI / 4, cs = Math.cos(a), sn = Math.sin(a)
      const rot = (p: P) => ({ x: c.x + (p.x - c.x) * cs - (p.y - c.y) * sn, y: c.y + (p.x - c.x) * sn + (p.y - c.y) * cs })
      t.quad = q.map(rot)
      t.grid = t.grid.map(rot)
    } else if (action === 'fit') {
      const k = Math.min(d.width / t.src.w, d.height / t.src.h)
      const w = t.src.w * k, h = t.src.h * k
      const x0 = (d.width - w) / 2, y0 = (d.height - h) / 2
      t.quad = [{ x: x0, y: y0 }, { x: x0 + w, y: y0 }, { x: x0 + w, y: y0 + h }, { x: x0, y: y0 + h }]
      t.grid = gridFromQuad(t.quad)
    } else {
      const b = t.src
      t.quad = [{ x: b.x, y: b.y }, { x: b.x + b.w, y: b.y }, { x: b.x + b.w, y: b.y + b.h }, { x: b.x, y: b.y + b.h }]
      t.grid = gridFromQuad(t.quad)
    }
    this.invalidate()
  }

  syncTransformMode() {
    const t = this.transform
    if (!t) return
    if (get().transformMode !== 'warp') {
      // leaving warp: keep the outer corners
      t.quad = [t.grid[0], t.grid[3], t.grid[15], t.grid[12]].map((p) => ({ ...p }))
    } else t.grid = gridFromQuad(t.quad)
    this.invalidate()
  }

  commitTransform() {
    const t = this.transform
    const d = get().doc
    if (!t || !d) return
    const L = d.layers.find((l) => l.id === t.layerId)
    this.transform = null
    if (!L) { this.invalidate(); return }
    beginPixels(L, 'content')
    const x = ctx2d(L.canvas)
    x.save()
    x.clearRect(0, 0, d.width, d.height)
    if (t.rest) x.drawImage(t.rest, 0, 0)
    x.imageSmoothingEnabled = get().transformSmooth
    this.drawFloat(x, t)
    x.restore()
    endPixels('Transformar', null)
    if (t.selection) {
      const m = makeCanvas(d.width, d.height)
      const mx = ctx2d(m)
      this.drawFloat(mx, t, t.selection)
      set({ selection: m, selVersion: get().selVersion + 1 })
    }
    this.invalidate()
    this.captureTimelapse()
  }

  cancelTransform() {
    this.transform = null
    this.invalidate()
  }

  // ============ liquify ============
  private liquifyDown(p: P) {
    const L = active()
    if (!L || L.kind === 'group' || L.locked) { toast('Selecciona una capa editable'); return }
    if (!this.liquify || this.liqLayer !== L.id) {
      this.liquify = new Liquify(L.canvas)
      this.liqLayer = L.id
    }
    this.liqPrev = p
    this.liquifyMove(p)
  }

  private liquifyMove(p: P) {
    const s = get()
    const lq = this.liquify
    if (!lq || !this.liqPrev) return
    const radius = (s.liquify.size * 300) / 2
    const dist = Math.hypot(p.x - this.liqPrev.x, p.y - this.liqPrev.y)
    const steps = Math.max(1, Math.ceil(dist / (radius * 0.25)))
    for (let i = 1; i <= steps; i++) {
      const q = { x: this.liqPrev.x + ((p.x - this.liqPrev.x) * i) / steps, y: this.liqPrev.y + ((p.y - this.liqPrev.y) * i) / steps }
      const prev = { x: this.liqPrev.x + ((p.x - this.liqPrev.x) * (i - 1)) / steps, y: this.liqPrev.y + ((p.y - this.liqPrev.y) * (i - 1)) / steps }
      lq.apply(s.liquifyMode, q.x, q.y, prev.x, prev.y, radius, s.liquify.pressure, s.liquify.distortion)
    }
    if (dist === 0 && s.liquifyMode !== 'push') lq.apply(s.liquifyMode, p.x, p.y, p.x, p.y, radius, s.liquify.pressure, s.liquify.distortion)
    lq.render()
    this.liqPrev = p
    this.invalidate()
  }

  liquifyReset() {
    this.liquify?.reset()
    this.invalidate()
  }

  commitLiquify() {
    const d = get().doc
    if (this.liquify && this.liqLayer && d) {
      const L = d.layers.find((l) => l.id === this.liqLayer)
      if (L) {
        const out = this.liquify.out
        beginPixels(L, 'content')
        const x = ctx2d(L.canvas)
        x.clearRect(0, 0, d.width, d.height)
        x.drawImage(out, 0, 0)
        endPixels('Licuar', null)
      }
    }
    this.liquify = null
    this.liqLayer = null
    this.invalidate()
  }

  cancelLiquify() {
    this.liquify = null
    this.liqLayer = null
    this.invalidate()
  }

  resetClone() {
    this.cloneOffset = null
  }

  // ============ filters preview ============
  setFilterPreview(layerId: string, canvas: Canvas | null) {
    this.filterPreview = canvas ? { layerId, canvas } : null
    this.invalidate()
  }

  // ============ text ============
  private textDown(p: P) {
    const L = active()
    if (!L || L.kind !== 'text' || !L.text) return
    this.textDrag = { start: p, x: L.text.x, y: L.text.y }
  }

  private textMove(p: P) {
    const t = this.textDrag!
    this.onTextMove?.(t.x + p.x - t.start.x, t.y + p.y - t.start.y)
  }

  // ============ crop ============
  startCrop() {
    const d = get().doc
    if (!d) return
    this.crop = { x: 0, y: 0, w: d.width, h: d.height }
    set({ cropping: true })
    this.invalidate(false)
  }

  endCrop() {
    this.crop = null
    set({ cropping: false })
    this.invalidate(false)
  }

  private cropHandles() {
    const c = this.crop!
    const pts = [
      { k: 'tl', x: c.x, y: c.y }, { k: 'tr', x: c.x + c.w, y: c.y }, { k: 'br', x: c.x + c.w, y: c.y + c.h }, { k: 'bl', x: c.x, y: c.y + c.h },
      { k: 't', x: c.x + c.w / 2, y: c.y }, { k: 'r', x: c.x + c.w, y: c.y + c.h / 2 }, { k: 'b', x: c.x + c.w / 2, y: c.y + c.h }, { k: 'l', x: c.x, y: c.y + c.h / 2 },
    ]
    return pts.map((p) => ({ k: p.k, ...this.toScreen(p.x, p.y) }))
  }

  private cropDown(p: P, sx: number, sy: number) {
    let kind = 'move'
    for (const h of this.cropHandles()) if (Math.hypot(h.x - sx, h.y - sy) < 18) { kind = h.k; break }
    this.cropDrag = { kind, start: p, rect: { ...this.crop! } }
  }

  private cropMove(p: P) {
    const { kind, start, rect } = this.cropDrag!
    const dx = p.x - start.x, dy = p.y - start.y
    let { x, y, w, h } = rect
    if (kind === 'move') { x += dx; y += dy }
    if (kind.includes('l')) { x += dx; w -= dx }
    if (kind.includes('r')) w += dx
    if (kind.includes('t')) { y += dy; h -= dy }
    if (kind.includes('b')) h += dy
    if (w < 1) { w = 1 }
    if (h < 1) { h = 1 }
    this.crop = { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) }
    this.onCropChange?.(this.crop)
    this.needsDraw = true
  }
  onCropChange: ((c: { x: number; y: number; w: number; h: number }) => void) | null = null

  setCrop(c: { x: number; y: number; w: number; h: number }) {
    this.crop = c
    this.needsDraw = true
  }

  // ============ guides editing ============
  private guideDown(p: P, sx: number, sy: number) {
    const s = get()
    const d = s.doc!
    const g = s.guides
    if (g.type === 'perspective') {
      const idx = g.vps.findIndex((v) => { const q = this.toScreen(v.x, v.y); return Math.hypot(q.x - sx, q.y - sy) < 18 })
      if (idx >= 0) { this.guideDrag = idx; return }
      if (g.vps.length >= 3) { toast('Máximo 3 puntos de fuga; arrastra uno existente'); return }
      set({ guides: { ...g, vps: [...g.vps, p] } })
      this.guideDrag = g.vps.length
      this.needsDraw = true
      return
    }
    if (g.type === 'symmetry') {
      const c = guideCenter(g, d.width, d.height)
      const q = this.toScreen(c.x, c.y)
      if (Math.hypot(q.x - sx, q.y - sy) < 24) this.guideDrag = 0
    }
  }

  private guideMove(p: P) {
    const s = get()
    const g = s.guides
    if (g.type === 'perspective') {
      const vps = g.vps.map((v, i) => (i === this.guideDrag ? p : v))
      set({ guides: { ...g, vps } })
    } else if (g.type === 'symmetry') set({ guides: { ...g, center: p } })
    this.needsDraw = true
  }

  // ============ undo/redo ============
  undo() {
    if (this.transform) { this.cancelTransform(); return }
    if (this.lasso.length) { this.lasso.pop(); this.needsDraw = true; return }
    const l = undo()
    if (l) toast(`Deshacer: ${l}`)
    this.invalidate()
  }

  redo() {
    const l = redo()
    if (l) toast(`Rehacer: ${l}`)
    this.invalidate()
  }

  // ============ timelapse ============
  captureTimelapse() {
    const s = get()
    if (!s.timelapse || !s.doc) return
    const c = this.composite
    const k = Math.min(1, 720 / Math.max(c.width, c.height))
    const full = makeCanvas(c.width * k, c.height * k)
    const fx = ctx2d(full)
    fx.fillStyle = s.doc.bgVisible ? s.doc.background : '#ffffff'
    fx.fillRect(0, 0, full.width, full.height)
    fx.drawImage(c, 0, 0, full.width, full.height)
    createImageBitmap(full).then((b) => {
      this.timelapse.push(b)
      if (this.timelapse.length > 4000) this.timelapse.splice(0, this.timelapse.length - 4000).forEach((x) => x.close())
    }).catch(() => {})
  }

  resetTimelapse() {
    this.timelapse.forEach((b) => b.close())
    this.timelapse = []
  }

  activeTime() {
    const now = Date.now()
    const active = now - this.lastActive < 60_000
    return active
  }

  // ============ animation playback ============
  play() {
    const s = get()
    if (!s.doc) return
    clearInterval(this.animTimer)
    let dir = 1
    let hold = 0
    set({ anim: { ...s.anim, playing: true } })
    this.animTimer = window.setInterval(() => {
      const st = get()
      const d = st.doc
      if (!d || !st.anim.playing) { clearInterval(this.animTimer); return }
      const frames = d.layers.filter((l) => l.parentId === null)
      const n = frames.length
      const lo = st.anim.bgFrame ? 1 : 0
      const hi = n - 1 - (st.anim.fgFrame ? 1 : 0)
      if (hi < lo) return
      const curL = frames[st.anim.frame]
      if (curL && (curL.hold || 0) > hold) { hold++; return }
      hold = 0
      let f = st.anim.frame + dir
      if (st.anim.mode === 'pingpong') {
        if (f > hi) { dir = -1; f = Math.max(lo, hi - 1) }
        if (f < lo) { dir = 1; f = Math.min(hi, lo + 1) }
      } else if (f > hi) {
        if (st.anim.mode === 'once') { set({ anim: { ...st.anim, playing: false } }); clearInterval(this.animTimer); return }
        f = lo
      }
      set({ anim: { ...st.anim, frame: f } })
      this.invalidate()
    }, 1000 / Math.max(1, s.anim.fps))
  }

  stop() {
    clearInterval(this.animTimer)
    const s = get()
    set({ anim: { ...s.anim, playing: false } })
    this.invalidate()
  }
}

export const editor = new Editor()

// Recomposite whenever the doc, selection or animation state changes.
import { useStore } from './store'
useStore.subscribe((s, p) => {
  if (s.doc !== p.doc || s.docVersion !== p.docVersion || s.anim !== p.anim) editor.invalidate()
  else if (s.view !== p.view || s.selVersion !== p.selVersion || s.guides !== p.guides || s.prefs !== p.prefs || s.transformMode !== p.transformMode) editor.invalidate(s.transformMode !== p.transformMode)
  if (s.transformMode !== p.transformMode) editor.syncTransformMode()
})

export const BBoxT = BBox
