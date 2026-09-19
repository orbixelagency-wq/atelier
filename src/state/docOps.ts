import type { BlendMode, Doc, Layer } from '../engine/types'
import { childrenOf, compositeDoc } from '../engine/compositor'
import { clamp, cloneCanvas, contentBounds, ctx2d, makeCanvas, uid, type Canvas } from '../engine/util'
import { commit, editPixels, setSelection } from './history'
import { get, set, toast } from './store'

export function newLayer(w: number, h: number, name: string, over: Partial<Layer> = {}): Layer {
  return {
    id: uid('layer'), name, kind: 'raster', canvas: makeCanvas(w, h), visible: true, opacity: 1, blend: 'source-over',
    alphaLock: false, clip: false, locked: false, reference: false, mask: null, editMask: false, parentId: null, ...over,
  }
}

export function createDoc(w: number, h: number, name = 'Sin título', dpi = 132, bg = '#ffffff'): Doc {
  const l = newLayer(w, h, 'Capa 1')
  return {
    id: uid('art'), name, width: w, height: h, dpi, background: bg, bgVisible: true, layers: [l], activeId: l.id,
    created: Date.now(), timeSpent: 0, strokes: 0,
  }
}

export function active(): Layer | null {
  const d = get().doc
  return d ? d.layers.find((l) => l.id === d.activeId) || null : null
}

export function layerName(d: Doc) {
  let n = d.layers.filter((l) => l.kind !== 'group').length + 1
  while (d.layers.some((l) => l.name === `Capa ${n}`)) n++
  return `Capa ${n}`
}

const MAX_LAYERS = 200

function insertAbove(d: Doc, ref: Layer | null, layer: Layer): Layer[] {
  const layers = [...d.layers]
  if (!ref) { layers.push(layer); return layers }
  if (ref.kind === 'group' && !ref.collapsed) {
    layer.parentId = ref.id
    layers.push(layer)
    return layers
  }
  layer.parentId = ref.parentId
  layers.splice(layers.indexOf(ref) + 1, 0, layer)
  return layers
}

export function addLayer(canvas?: Canvas, name?: string, over: Partial<Layer> = {}): Layer | null {
  const d = get().doc
  if (!d) return null
  if (d.layers.length >= MAX_LAYERS) { toast('Has alcanzado el máximo de capas para este lienzo'); return null }
  const l = newLayer(d.width, d.height, name || layerName(d), over)
  if (canvas) ctx2d(l.canvas).drawImage(canvas, 0, 0)
  commit('Nueva capa', (d) => ({ ...d, layers: insertAbove(d, active(), l), activeId: l.id }))
  return l
}

export function updateLayer(id: string, patch: Partial<Layer>, label = 'Propiedades de capa') {
  commit(label, (d) => ({ ...d, layers: d.layers.map((l) => (l.id === id ? { ...l, ...patch } : l)) }))
}

/** Change a property live (slider drag) without adding history; call commitLayer at the end. */
export function setLayerLive(id: string, patch: Partial<Layer>) {
  const d = get().doc
  if (!d) return
  set({ doc: { ...d, layers: d.layers.map((l) => (l.id === id ? { ...l, ...patch } : l)) }, layersVersion: get().layersVersion + 1 })
}

export function selectLayer(id: string) {
  const d = get().doc
  if (!d || d.activeId === id) return
  set({ doc: { ...d, activeId: id }, layersVersion: get().layersVersion + 1 })
}

function descendants(d: Doc, id: string): Layer[] {
  const out: Layer[] = []
  const walk = (pid: string) => { for (const l of d.layers) if (l.parentId === pid) { out.push(l); if (l.kind === 'group') walk(l.id) } }
  walk(id)
  return out
}

export function deleteLayer(id: string) {
  const d = get().doc
  if (!d) return
  const target = d.layers.find((l) => l.id === id)
  if (!target) return
  const drop = new Set([id, ...descendants(d, id).map((l) => l.id)])
  const rest = d.layers.filter((l) => !drop.has(l.id))
  if (!rest.length) {
    const l = newLayer(d.width, d.height, 'Capa 1')
    commit('Eliminar capa', (d) => ({ ...d, layers: [l], activeId: l.id }))
    return
  }
  const idx = d.layers.indexOf(target)
  const below = [...d.layers.slice(0, idx)].reverse().find((l) => !drop.has(l.id))
  commit('Eliminar capa', (d) => ({ ...d, layers: rest, activeId: (below || rest[rest.length - 1]).id }))
}

export function duplicateLayer(id: string) {
  const d = get().doc
  if (!d) return
  const src = d.layers.find((l) => l.id === id)
  if (!src) return
  const copy: Layer = { ...src, id: uid('layer'), name: src.name + ' copia', canvas: cloneCanvas(src.canvas), mask: src.mask ? cloneCanvas(src.mask) : null, text: src.text ? { ...src.text } : undefined }
  const extra: Layer[] = []
  if (src.kind === 'group') {
    const map = new Map<string, string>([[src.id, copy.id]])
    for (const c of descendants(d, src.id)) {
      const nid = uid('layer')
      map.set(c.id, nid)
      extra.push({ ...c, id: nid, parentId: map.get(c.parentId!)!, canvas: cloneCanvas(c.canvas), mask: c.mask ? cloneCanvas(c.mask) : null })
    }
  }
  commit('Duplicar capa', (d) => {
    const layers = [...d.layers]
    const desc = descendants(d, src.id)
    const at = layers.indexOf(desc.length ? desc[desc.length - 1] : src) + 1
    layers.splice(at, 0, ...extra, copy)
    return { ...d, layers, activeId: copy.id }
  })
}

/** Move layer `id` directly above/below `targetId` among its siblings, or into a group (on top). */
export function moveLayer(id: string, targetId: string, place: 'above' | 'below' | 'into') {
  const d = get().doc
  if (!d || id === targetId) return
  const L = d.layers.find((l) => l.id === id)
  const T = d.layers.find((l) => l.id === targetId)
  if (!L || !T) return
  if (descendants(d, id).some((x) => x.id === targetId)) return
  const rest = d.layers.filter((l) => l.id !== id)
  const ti = rest.indexOf(T)
  let moved: Layer
  if (place === 'into') {
    moved = { ...L, parentId: T.id, clip: false }
    rest.push(moved)
  } else {
    moved = { ...L, parentId: T.parentId }
    rest.splice(place === 'above' ? ti + 1 : ti, 0, moved)
  }
  commit('Mover capa', (d) => ({ ...d, layers: rest }))
}

export function setBlend(id: string, blend: BlendMode) {
  updateLayer(id, { blend }, 'Modo de fusión')
}

export function renameLayer(id: string, name: string) {
  updateLayer(id, { name: name.trim() || 'Capa' }, 'Renombrar capa')
}

export function toggleLayer(id: string, key: 'visible' | 'alphaLock' | 'clip' | 'locked' | 'reference') {
  const L = get().doc?.layers.find((l) => l.id === id)
  if (!L) return
  const labels = { visible: 'Visibilidad', alphaLock: 'Bloqueo alfa', clip: 'Máscara de recorte', locked: 'Bloquear capa', reference: 'Referencia' }
  if (key === 'reference' && !L.reference) {
    // only one reference layer at a time
    commit(labels[key], (d) => ({ ...d, layers: d.layers.map((l) => ({ ...l, reference: l.id === id })) }))
    return
  }
  updateLayer(id, { [key]: !L[key] } as Partial<Layer>, labels[key])
}

export function addMask(id: string) {
  const d = get().doc
  const L = d?.layers.find((l) => l.id === id)
  if (!d || !L || L.mask) return
  const m = makeCanvas(d.width, d.height)
  const x = ctx2d(m)
  x.fillStyle = '#fff'
  x.fillRect(0, 0, d.width, d.height)
  updateLayer(id, { mask: m, editMask: true }, 'Máscara de capa')
}

export function applyMask(id: string) {
  const L = get().doc?.layers.find((l) => l.id === id)
  if (!L || !L.mask) return
  const c = cloneCanvas(L.canvas)
  const x = ctx2d(c)
  x.globalCompositeOperation = 'destination-in'
  x.drawImage(L.mask, 0, 0)
  updateLayer(id, { canvas: c, mask: null, editMask: false }, 'Aplicar máscara')
}

export function removeMask(id: string) {
  updateLayer(id, { mask: null, editMask: false }, 'Eliminar máscara')
}

/** Flatten a layer (with mask, and a group with its children) into a new canvas. */
function bake(d: Doc, L: Layer): Canvas {
  if (L.kind === 'group') {
    const sub: Doc = { ...d, bgVisible: false, layers: [{ ...L, parentId: null, opacity: 1, blend: 'source-over' }, ...descendants(d, L.id)] }
    const c = makeCanvas(d.width, d.height)
    compositeDoc(sub, c, { includeBg: false })
    return c
  }
  if (!L.mask) return L.canvas
  const c = cloneCanvas(L.canvas)
  const x = ctx2d(c)
  x.globalCompositeOperation = 'destination-in'
  x.drawImage(L.mask, 0, 0)
  return c
}

export function mergeDown(id: string) {
  const d = get().doc
  if (!d) return
  const L = d.layers.find((l) => l.id === id)
  if (!L) return
  const siblings = childrenOf(d, L.parentId)
  const i = siblings.indexOf(L)
  const B = siblings[i - 1]
  if (!B) { toast('No hay ninguna capa debajo para combinar'); return }
  if (B.kind === 'group' || L.kind === 'group') { toast('Aplana el grupo antes de combinar'); return }
  const c = cloneCanvas(bake(d, B))
  const x = ctx2d(c)
  const top = bake(d, L)
  if (L.clip) {
    const t = cloneCanvas(top)
    const tx = ctx2d(t)
    tx.globalCompositeOperation = 'destination-in'
    tx.drawImage(c, 0, 0)
    x.globalAlpha = L.opacity
    x.globalCompositeOperation = L.blend === 'source-over' ? 'source-atop' : L.blend
    x.drawImage(t, 0, 0)
  } else {
    x.globalAlpha = L.opacity
    x.globalCompositeOperation = L.blend
    x.drawImage(top, 0, 0)
  }
  commit('Combinar abajo', (d) => ({
    ...d,
    layers: d.layers.filter((l) => l.id !== L.id).map((l) => (l.id === B.id ? { ...l, canvas: c, mask: null, kind: 'raster', text: undefined } : l)),
    activeId: B.id,
  }))
}

export function flattenGroup(id: string) {
  const d = get().doc
  const G = d?.layers.find((l) => l.id === id)
  if (!d || !G || G.kind !== 'group') return
  const c = bake(d, G)
  const drop = new Set(descendants(d, id).map((l) => l.id))
  commit('Aplanar grupo', (d) => ({
    ...d,
    layers: d.layers.filter((l) => !drop.has(l.id)).map((l) => (l.id === id ? { ...l, kind: 'raster', canvas: c, collapsed: false } : l)),
  }))
}

export function flattenAll() {
  const d = get().doc
  if (!d) return
  const c = makeCanvas(d.width, d.height)
  compositeDoc(d, c, { includeBg: false })
  const l = newLayer(d.width, d.height, 'Capa 1')
  l.canvas = c
  commit('Aplanar', (d) => ({ ...d, layers: [l], activeId: l.id }))
}

export function groupLayer(id: string) {
  const d = get().doc
  const L = d?.layers.find((l) => l.id === id)
  if (!d || !L) return
  const g = newLayer(1, 1, 'Grupo', { kind: 'group', parentId: L.parentId })
  commit('Nuevo grupo', (d) => {
    const layers = d.layers.map((l) => (l.id === id ? { ...l, parentId: g.id } : l))
    const i = layers.findIndex((l) => l.id === id)
    const desc = descendants({ ...d, layers }, id)
    const at = (desc.length ? layers.indexOf(desc[desc.length - 1]) : i) + 1
    layers.splice(at, 0, g)
    return { ...d, layers, activeId: g.id }
  })
}

export function ungroup(id: string) {
  const d = get().doc
  const G = d?.layers.find((l) => l.id === id)
  if (!d || !G || G.kind !== 'group') return
  commit('Desagrupar', (d) => ({
    ...d,
    layers: d.layers.filter((l) => l.id !== id).map((l) => (l.parentId === id ? { ...l, parentId: G.parentId } : l)),
    activeId: d.layers.find((l) => l.parentId === id)?.id || d.layers[0].id,
  }))
}

// ---- pixel operations on the active layer ----
function editable(): Layer | null {
  const L = active()
  if (!L) return null
  if (L.locked) { toast('La capa está bloqueada'); return null }
  if (L.kind === 'group') { toast('Selecciona una capa, no un grupo'); return null }
  return L
}

export function fillLayer(color?: string) {
  const L = editable()
  if (!L) return
  const s = get()
  const c = color || hsvHex(s.color.primary)
  const target = L.mask && L.editMask ? 'mask' : 'content'
  editPixels('Rellenar capa', L, (cv) => {
    const x = ctx2d(cv)
    x.save()
    const sel = s.selection
    if (sel) {
      const t = makeCanvas(cv.width, cv.height)
      const tx = ctx2d(t)
      tx.fillStyle = c
      tx.fillRect(0, 0, cv.width, cv.height)
      tx.globalCompositeOperation = 'destination-in'
      tx.drawImage(sel, 0, 0)
      x.globalCompositeOperation = L.alphaLock ? 'source-atop' : 'source-over'
      x.drawImage(t, 0, 0)
    } else {
      x.globalCompositeOperation = L.alphaLock ? 'source-atop' : 'source-over'
      x.fillStyle = c
      x.fillRect(0, 0, cv.width, cv.height)
    }
    x.restore()
  }, target)
}

export function clearLayer() {
  const L = editable()
  if (!L) return
  const sel = get().selection
  const target = L.mask && L.editMask ? 'mask' : 'content'
  editPixels(sel ? 'Borrar selección' : 'Borrar capa', L, (cv) => {
    const x = ctx2d(cv)
    if (sel) {
      x.globalCompositeOperation = 'destination-out'
      x.drawImage(sel, 0, 0)
      x.globalCompositeOperation = 'source-over'
    } else x.clearRect(0, 0, cv.width, cv.height)
  }, target)
}

export function invertLayer() {
  const L = editable()
  if (!L) return
  const target = L.mask && L.editMask ? 'mask' : 'content'
  editPixels('Invertir', L, (cv) => {
    const x = ctx2d(cv, true)
    const img = x.getImageData(0, 0, cv.width, cv.height)
    const d = img.data
    if (target === 'mask') for (let i = 3; i < d.length; i += 4) d[i] = 255 - d[i]
    else for (let i = 0; i < d.length; i += 4) { d[i] = 255 - d[i]; d[i + 1] = 255 - d[i + 1]; d[i + 2] = 255 - d[i + 2] }
    x.putImageData(img, 0, 0)
  }, target)
}

export function selectLayerContents(id?: string) {
  const d = get().doc
  const L = id ? d?.layers.find((l) => l.id === id) : active()
  if (!d || !L) return
  const m = makeCanvas(d.width, d.height)
  const x = ctx2d(m)
  x.drawImage(L.canvas, 0, 0)
  setSelection('Seleccionar contenido', m)
  set({ tool: 'select' })
}

// ---- clipboard ----
let clipboard: Canvas | null = null

export function copy(cut = false) {
  const d = get().doc
  const L = editable()
  if (!d || !L) return
  const c = makeCanvas(d.width, d.height)
  const x = ctx2d(c)
  x.drawImage(L.canvas, 0, 0)
  const sel = get().selection
  if (sel) {
    x.globalCompositeOperation = 'destination-in'
    x.drawImage(sel, 0, 0)
  }
  clipboard = c
  if (cut) clearLayer()
  toast(cut ? 'Cortado' : 'Copiado')
}

export function copyMerged() {
  const d = get().doc
  if (!d) return
  const c = makeCanvas(d.width, d.height)
  compositeDoc(d, c, { includeBg: false })
  const sel = get().selection
  if (sel) {
    const x = ctx2d(c)
    x.globalCompositeOperation = 'destination-in'
    x.drawImage(sel, 0, 0)
  }
  clipboard = c
  toast('Copiado todo')
}

export function paste() {
  if (!clipboard) { toast('El portapapeles está vacío'); return }
  addLayer(clipboard, 'Pegado')
}

export function hasClipboard() {
  return !!clipboard
}

// ---- canvas-level ----
export function setBackground(color: string) {
  commit('Color de fondo', (d) => ({ ...d, background: color }))
}

export function toggleBackground() {
  commit('Fondo', (d) => ({ ...d, bgVisible: !d.bgVisible }))
}

function mapCanvases(d: Doc, fn: (c: Canvas) => Canvas): Layer[] {
  return d.layers.map((l) => ({ ...l, canvas: l.kind === 'group' ? l.canvas : fn(l.canvas), mask: l.mask ? fn(l.mask) : null }))
}

export function flipCanvas(horizontal: boolean) {
  commit(horizontal ? 'Voltear lienzo horizontalmente' : 'Voltear lienzo verticalmente', (d) => ({
    ...d,
    layers: mapCanvases(d, (c) => {
      const n = makeCanvas(c.width, c.height)
      const x = ctx2d(n)
      if (horizontal) { x.translate(c.width, 0); x.scale(-1, 1) } else { x.translate(0, c.height); x.scale(1, -1) }
      x.drawImage(c, 0, 0)
      return n
    }),
  }))
}

export function rotateCanvas(clockwise: boolean) {
  commit('Rotar lienzo', (d) => ({
    ...d,
    width: d.height,
    height: d.width,
    layers: mapCanvases(d, (c) => {
      const n = makeCanvas(c.height, c.width)
      const x = ctx2d(n)
      if (clockwise) { x.translate(c.height, 0); x.rotate(Math.PI / 2) } else { x.translate(0, c.width); x.rotate(-Math.PI / 2) }
      x.drawImage(c, 0, 0)
      return n
    }),
  }))
  set({ selection: null })
}

/** Crop (x,y,w,h in doc px) and optionally resample content to (outW,outH). */
export function cropResize(rx: number, ry: number, rw: number, rh: number, outW: number, outH: number, resample: boolean) {
  rw = Math.max(1, Math.round(rw)); rh = Math.max(1, Math.round(rh))
  outW = Math.max(1, Math.round(clamp(outW, 1, 16384))); outH = Math.max(1, Math.round(clamp(outH, 1, 16384)))
  commit('Recortar y redimensionar', (d) => ({
    ...d,
    width: resample ? outW : rw,
    height: resample ? outH : rh,
    layers: mapCanvases(d, (c) => {
      const n = makeCanvas(resample ? outW : rw, resample ? outH : rh)
      const x = ctx2d(n)
      x.imageSmoothingQuality = 'high'
      if (resample) x.drawImage(c, rx, ry, rw, rh, 0, 0, outW, outH)
      else x.drawImage(c, -Math.round(rx), -Math.round(ry))
      return n
    }),
  }))
  set({ selection: null, selVersion: get().selVersion + 1 })
}

export function trimToContent() {
  const d = get().doc
  if (!d) return
  const c = makeCanvas(d.width, d.height)
  compositeDoc(d, c, { includeBg: false })
  const b = contentBounds(c)
  if (!b) { toast('El lienzo está vacío'); return }
  cropResize(b.x, b.y, b.w, b.h, b.w, b.h, false)
}

export function hsvHex(c: { h: number; s: number; v: number }) {
  // local import avoided to keep this file light
  const h = ((c.h % 360) + 360) % 360, s = c.s, v = c.v
  const k = (n: number) => (n + h / 60) % 6
  const f = (n: number) => v - v * s * Math.max(0, Math.min(k(n), 4 - k(n), 1))
  return '#' + [f(5), f(3), f(1)].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('')
}
