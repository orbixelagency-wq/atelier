import type { Doc, Layer } from './types'
import type { Stroke } from './brushEngine'
import { ctx2d, makeCanvas, type Canvas } from './util'

export interface LiveStroke { layerId: string; target: 'content' | 'mask'; stroke: Stroke }
export interface FloatLayer { layerId: string; draw: (ctx: CanvasRenderingContext2D) => void; hideSource?: boolean }
export interface AnimView {
  frame: number // index into top-level frame list
  onionBefore: number
  onionAfter: number
  onionOpacity: number
  bgFrame: boolean
  fgFrame: boolean
  playing: boolean
}

export interface RenderOpts {
  live?: LiveStroke | null
  float?: FloatLayer | null
  anim?: AnimView | null
  includeBg?: boolean
  layerOverride?: { id: string; canvas: Canvas } | null // adjustment preview
}

const temps: Canvas[][] = []
function temp(depth: number, slot: number, w: number, h: number): Canvas {
  temps[depth] ||= []
  let c = temps[depth][slot]
  if (!c || c.width !== w || c.height !== h) {
    c = makeCanvas(w, h)
    temps[depth][slot] = c
  }
  const x = ctx2d(c)
  x.setTransform(1, 0, 0, 1, 0, 0)
  x.globalAlpha = 1
  x.globalCompositeOperation = 'source-over'
  x.clearRect(0, 0, w, h)
  return c
}

export function childrenOf(doc: Doc, parentId: string | null): Layer[] {
  return doc.layers.filter((l) => l.parentId === parentId)
}

export function frameLayers(doc: Doc): Layer[] {
  return childrenOf(doc, null)
}

/** Pixels of one layer with live stroke, float and mask applied. */
function layerPixels(doc: Doc, L: Layer, o: RenderOpts, depth: number): Canvas {
  const w = doc.width, h = doc.height
  let base: Canvas = L.canvas
  if (L.kind === 'group') {
    const g = temp(depth, 0, w, h)
    renderList(doc, ctx2d(g), childrenOf(doc, L.id), o, depth + 1)
    base = g
  } else if (o.layerOverride && o.layerOverride.id === L.id) {
    base = o.layerOverride.canvas
  }
  const live = o.live && o.live.layerId === L.id ? o.live : null
  const flt = o.float && o.float.layerId === L.id ? o.float : null
  if ((live && live.target === 'content') || flt) {
    const t = temp(depth, 1, w, h)
    const x = ctx2d(t)
    if (!(flt && flt.hideSource)) x.drawImage(base, 0, 0)
    if (live && live.target === 'content') live.stroke.applyTo(t)
    if (flt) { x.save(); flt.draw(x); x.restore() }
    base = t
  }
  if (L.mask) {
    let mask = L.mask
    if (live && live.target === 'mask') {
      const mt = temp(depth, 3, w, h)
      ctx2d(mt).drawImage(L.mask, 0, 0)
      live.stroke.applyTo(mt)
      mask = mt
    }
    const t = temp(depth, 2, w, h)
    const x = ctx2d(t)
    x.drawImage(base, 0, 0)
    x.globalCompositeOperation = 'destination-in'
    x.drawImage(mask, 0, 0)
    x.globalCompositeOperation = 'source-over'
    base = t
  }
  return base
}

function renderList(doc: Doc, ctx: CanvasRenderingContext2D, list: Layer[], o: RenderOpts, depth: number) {
  const w = doc.width, h = doc.height
  for (let i = 0; i < list.length; i++) {
    const L = list[i]
    if (L.clip && i > 0) continue // drawn with its base
    // collect clipping layers stacked directly above
    let j = i + 1
    const clips: Layer[] = []
    while (j < list.length && list[j].clip) { clips.push(list[j]); j++ }
    if (!L.visible) continue
    const content = layerPixels(doc, L, o, depth)
    ctx.globalAlpha = L.opacity
    ctx.globalCompositeOperation = L.blend
    ctx.drawImage(content, 0, 0)
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
    if (clips.length) {
      // Keep the base alpha around while the clipped layers are resolved.
      const baseAlpha = temp(depth, 4, w, h)
      ctx2d(baseAlpha).drawImage(content, 0, 0)
      for (const C of clips) {
        if (!C.visible) continue
        const cc = layerPixels(doc, C, o, depth + 1)
        const t = temp(depth, 5, w, h)
        const x = ctx2d(t)
        x.drawImage(cc, 0, 0)
        x.globalCompositeOperation = 'destination-in'
        x.drawImage(baseAlpha, 0, 0)
        x.globalCompositeOperation = 'source-over'
        ctx.globalAlpha = C.opacity
        ctx.globalCompositeOperation = C.blend
        ctx.drawImage(t, 0, 0)
        ctx.globalAlpha = 1
        ctx.globalCompositeOperation = 'source-over'
      }
    }
  }
}

function drawTinted(doc: Doc, ctx: CanvasRenderingContext2D, L: Layer, o: RenderOpts, alpha: number, tint: string | null) {
  const content = layerPixels(doc, L, o, 1)
  if (tint) {
    const t = temp(0, 6, doc.width, doc.height)
    const x = ctx2d(t)
    x.drawImage(content, 0, 0)
    x.globalCompositeOperation = 'source-atop'
    x.globalAlpha = 0.55
    x.fillStyle = tint
    x.fillRect(0, 0, doc.width, doc.height)
    x.globalAlpha = 1
    x.globalCompositeOperation = 'source-over'
    ctx.globalAlpha = alpha
    ctx.drawImage(t, 0, 0)
  } else {
    ctx.globalAlpha = alpha * L.opacity
    ctx.globalCompositeOperation = L.blend
    ctx.drawImage(content, 0, 0)
  }
  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = 'source-over'
}

export function compositeDoc(doc: Doc, out: Canvas, o: RenderOpts = {}) {
  if (out.width !== doc.width || out.height !== doc.height) { out.width = doc.width; out.height = doc.height }
  const ctx = ctx2d(out)
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = 'source-over'
  ctx.clearRect(0, 0, doc.width, doc.height)
  if (o.includeBg !== false && doc.bgVisible) {
    ctx.fillStyle = doc.background
    ctx.fillRect(0, 0, doc.width, doc.height)
  }
  if (o.anim) {
    const frames = frameLayers(doc)
    const a = o.anim
    const n = frames.length
    if (!n) return
    const cur = Math.min(a.frame, n - 1)
    if (a.bgFrame && cur !== 0 && frames[0].visible) drawTinted(doc, ctx, frames[0], o, 1, null)
    if (!a.playing) {
      for (let k = a.onionBefore; k >= 1; k--) {
        const idx = cur - k
        if (idx < (a.bgFrame ? 1 : 0)) continue
        drawTinted(doc, ctx, frames[idx], o, a.onionOpacity * (1 - (k - 1) / (a.onionBefore + 1)), '#e0443e')
      }
      for (let k = 1; k <= a.onionAfter; k++) {
        const idx = cur + k
        if (idx >= n - (a.fgFrame ? 1 : 0)) continue
        drawTinted(doc, ctx, frames[idx], o, a.onionOpacity * (1 - (k - 1) / (a.onionAfter + 1)), '#35b36b')
      }
    }
    if (frames[cur].visible || true) drawTinted(doc, ctx, frames[cur], o, 1, null)
    if (a.fgFrame && cur !== n - 1) drawTinted(doc, ctx, frames[n - 1], o, 1, null)
    return
  }
  renderList(doc, ctx, childrenOf(doc, null), o, 0)
}

/** Composite of every layer flagged as reference (for ColorDrop / auto-select). */
export function referenceComposite(doc: Doc): Canvas | null {
  const refs = doc.layers.filter((l) => l.reference && l.visible)
  if (!refs.length) return null
  const c = makeCanvas(doc.width, doc.height)
  const x = ctx2d(c)
  for (const r of refs) x.drawImage(r.canvas, 0, 0)
  return c
}

/** Flattened image of the visible layers, background included. */
export function flatten(doc: Doc, includeBg = true): Canvas {
  const c = makeCanvas(doc.width, doc.height)
  compositeDoc(doc, c, { includeBg })
  return c
}
