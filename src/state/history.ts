// Linear undo history. Pixel edits store only the changed rectangle; structural edits store
// snapshots of the (immutable) layer list, whose canvases are never mutated after being replaced.
import type { Doc, DocSnapshot, Layer } from '../engine/types'
import { ctx2d, makeCanvas, type Canvas, type Rect } from '../engine/util'
import { get, set } from './store'

type Entry =
  | { kind: 'pixels'; label: string; layerId: string; target: 'content' | 'mask'; rect: Rect; before: ImageData; after: ImageData }
  | { kind: 'state'; label: string; before: DocSnapshot; after: DocSnapshot }
  | { kind: 'selection'; label: string; before: Canvas | null; after: Canvas | null }

const past: Entry[] = []
const future: Entry[] = []
const LIMIT = 80
let bytes = 0
const BYTE_LIMIT = 900 * 1024 * 1024

function size(e: Entry) {
  return e.kind === 'pixels' ? e.before.data.length * 2 : 0
}

function sync() {
  set({ canUndo: past.length > 0, canRedo: future.length > 0 })
}

function push(e: Entry) {
  past.push(e)
  bytes += size(e)
  while (past.length > LIMIT || (bytes > BYTE_LIMIT && past.length > 1)) bytes -= size(past.shift()!)
  for (const f of future) bytes -= size(f)
  future.length = 0
  sync()
}

export function clearHistory() {
  past.length = 0
  future.length = 0
  bytes = 0
  sync()
}

export function snapshot(d: Doc): DocSnapshot {
  return { layers: d.layers, activeId: d.activeId, width: d.width, height: d.height, background: d.background, bgVisible: d.bgVisible }
}

function applySnapshot(s: DocSnapshot) {
  const d = get().doc
  if (!d) return
  set({ doc: { ...d, ...s }, layersVersion: get().layersVersion + 1, docVersion: get().docVersion + 1 })
}

/** Structural change: mutate returns the new doc. Layers must be replaced, not mutated. */
export function commit(label: string, mutate: (d: Doc) => Doc) {
  const d = get().doc
  if (!d) return
  const before = snapshot(d)
  const nd = mutate(d)
  if (nd === d) return
  push({ kind: 'state', label, before, after: snapshot(nd) })
  set({ doc: nd, layersVersion: get().layersVersion + 1, docVersion: get().docVersion + 1 })
}

/** Record a change that was applied live, given the snapshot from before it started. */
export function commitFrom(label: string, before: DocSnapshot) {
  const d = get().doc
  if (!d) return
  push({ kind: 'state', label, before, after: snapshot(d) })
  set({ layersVersion: get().layersVersion + 1, docVersion: get().docVersion + 1 })
}

/** Replace the doc without history (e.g. while live-editing text). */
export function replaceDoc(nd: Doc) {
  set({ doc: nd, layersVersion: get().layersVersion + 1, docVersion: get().docVersion + 1 })
}

// ---- pixel edits ----
let beforeCanvas: Canvas | null = null
let pending: { layerId: string; target: 'content' | 'mask' } | null = null

export function targetCanvas(layer: Layer, target: 'content' | 'mask'): Canvas {
  return target === 'mask' && layer.mask ? layer.mask : layer.canvas
}

export function beginPixels(layer: Layer, target: 'content' | 'mask' = 'content') {
  const src = targetCanvas(layer, target)
  if (!beforeCanvas || beforeCanvas.width !== src.width || beforeCanvas.height !== src.height) beforeCanvas = makeCanvas(src.width, src.height)
  const x = ctx2d(beforeCanvas)
  x.clearRect(0, 0, src.width, src.height)
  x.drawImage(src, 0, 0)
  pending = { layerId: layer.id, target }
}

export function beforePixels(): Canvas | null {
  return beforeCanvas
}

export function endPixels(label: string, rect: Rect | null) {
  const d = get().doc
  if (!d || !pending || !beforeCanvas) return
  const layer = d.layers.find((l) => l.id === pending!.layerId)
  if (!layer) { pending = null; return }
  const cv = targetCanvas(layer, pending.target)
  const r = rect || { x: 0, y: 0, w: cv.width, h: cv.height }
  if (r.w > 0 && r.h > 0) {
    const before = ctx2d(beforeCanvas, true).getImageData(r.x, r.y, r.w, r.h)
    const after = ctx2d(cv, true).getImageData(r.x, r.y, r.w, r.h)
    push({ kind: 'pixels', label, layerId: layer.id, target: pending.target, rect: r, before, after })
  }
  pending = null
  set({ docVersion: get().docVersion + 1, doc: { ...d, strokes: d.strokes + 1 } })
}

export function cancelPixels() {
  const d = get().doc
  if (!d || !pending || !beforeCanvas) return
  const layer = d.layers.find((l) => l.id === pending!.layerId)
  if (layer) {
    const cv = targetCanvas(layer, pending.target)
    const x = ctx2d(cv)
    x.clearRect(0, 0, cv.width, cv.height)
    x.drawImage(beforeCanvas, 0, 0)
  }
  pending = null
}

/** One-shot whole-layer pixel change (filters, fills, clear). */
export function editPixels(label: string, layer: Layer, fn: (c: Canvas) => void, target: 'content' | 'mask' = 'content') {
  beginPixels(layer, target)
  fn(targetCanvas(layer, target))
  endPixels(label, null)
}

// ---- selection ----
export function setSelection(label: string, next: Canvas | null) {
  const prev = get().selection
  push({ kind: 'selection', label, before: prev, after: next })
  set({ selection: next, selVersion: get().selVersion + 1 })
}

function applyEntry(e: Entry, dir: 'undo' | 'redo') {
  if (e.kind === 'state') applySnapshot(dir === 'undo' ? e.before : e.after)
  else if (e.kind === 'selection') set({ selection: dir === 'undo' ? e.before : e.after, selVersion: get().selVersion + 1 })
  else {
    const d = get().doc
    const layer = d?.layers.find((l) => l.id === e.layerId)
    if (!layer) return
    const cv = targetCanvas(layer, e.target)
    ctx2d(cv).putImageData(dir === 'undo' ? e.before : e.after, e.rect.x, e.rect.y)
    set({ docVersion: get().docVersion + 1 })
  }
}

export function undo(): string | null {
  const e = past.pop()
  if (!e) return null
  applyEntry(e, 'undo')
  future.push(e)
  sync()
  return e.label
}

export function redo(): string | null {
  const e = future.pop()
  if (!e) return null
  applyEntry(e, 'redo')
  past.push(e)
  sync()
  return e.label
}
