import { compositeDoc } from '../engine/compositor'
import { deserializeDoc, exportPsd, importPsd, serializeDoc } from '../engine/io'
import { deleteArt, getArt, listArt, putArt, type ArtMeta } from '../engine/storage'
import type { Doc } from '../engine/types'
import { blobToCanvas, canvasToBlob, ctx2d, makeCanvas, thumbnail, uid } from '../engine/util'
import { addLayer, createDoc, newLayer } from './docOps'
import { editor } from './editor'
import { clearHistory } from './history'
import { get, set, toast, useStore } from './store'

export const MAX_SIDE = 8192

export function openDoc(doc: Doc) {
  editor.resetTimelapse()
  editor.cancelTransform()
  editor.cancelLiquify()
  editor.lastDrop = null
  clearHistory()
  set({
    doc, screen: 'editor', selection: null, selVersion: get().selVersion + 1, panel: null, adjust: null, cloneSource: null,
    anim: { ...get().anim, enabled: false, frame: 0, playing: false }, tool: get().lastBrushTool, uiHidden: false, textEdit: null,
    cropping: false, docVersion: get().docVersion + 1, layersVersion: get().layersVersion + 1,
  })
  requestAnimationFrame(() => editor.fit())
}

export function newCanvas(w: number, h: number, dpi: number, name?: string, bg = '#ffffff') {
  w = Math.round(Math.min(MAX_SIDE, Math.max(16, w)))
  h = Math.round(Math.min(MAX_SIDE, Math.max(16, h)))
  openDoc(createDoc(w, h, name || 'Sin título', dpi, bg))
}

function fitSize(w: number, h: number) {
  const k = Math.min(1, MAX_SIDE / Math.max(w, h))
  return { w: Math.round(w * k), h: Math.round(h * k), k }
}

export async function importFileAsNew(file: File) {
  const name = file.name.replace(/\.[^.]+$/, '') || 'Importado'
  const lower = file.name.toLowerCase()
  try {
    if (lower.endsWith('.atelier')) {
      const d = await deserializeDoc(file)
      openDoc({ ...d, id: uid('art') })
      return
    }
    if (lower.endsWith('.psd')) {
      openDoc(await importPsd(file, name))
      return
    }
    const img = await blobToCanvas(file)
    const { w, h, k } = fitSize(img.width, img.height)
    const d = createDoc(w, h, name, 300, '#ffffff')
    d.bgVisible = false
    const l = d.layers[0]
    l.name = 'Foto'
    const x = ctx2d(l.canvas)
    x.imageSmoothingQuality = 'high'
    x.drawImage(img, 0, 0, img.width * k, img.height * k)
    openDoc(d)
  } catch (e) {
    toast((e as Error).message || 'No se pudo abrir el archivo')
  }
}

/** Insert an image file into the open canvas as a new layer, then enter transform. */
export async function insertImage(file: File) {
  const d = get().doc
  if (!d) return
  try {
    const img = await blobToCanvas(file)
    const k = Math.min(1, (d.width * 0.9) / img.width, (d.height * 0.9) / img.height)
    const c = makeCanvas(d.width, d.height)
    const x = ctx2d(c)
    x.imageSmoothingQuality = 'high'
    const w = img.width * k, h = img.height * k
    x.drawImage(img, (d.width - w) / 2, (d.height - h) / 2, w, h)
    addLayer(c, file.name.replace(/\.[^.]+$/, '').slice(0, 40) || 'Imagen')
    set({ selection: null, tool: 'transform' })
    editor.beginTransform()
  } catch {
    toast('No se pudo leer la imagen')
  }
}

// ---------- saving ----------
let saving = false
let dirty = false
let saveTimer = 0

export async function saveCurrent(): Promise<void> {
  const d = get().doc
  if (!d) return
  if (saving) { dirty = true; return }
  saving = true
  dirty = false
  try {
    const flat = makeCanvas(d.width, d.height)
    compositeDoc(d, flat, { includeBg: true })
    const th = thumbnail(flat, 520, d.bgVisible ? undefined : '#ffffff')
    const [thumb, data] = await Promise.all([canvasToBlob(th, 'image/jpeg', 0.86), serializeDoc(d)])
    const meta: ArtMeta = { id: d.id, name: d.name, width: d.width, height: d.height, updated: Date.now(), created: d.created, thumb }
    await putArt(meta, data)
  } catch (e) {
    console.error(e)
    toast('No se pudo guardar. Revisa el espacio disponible del navegador.')
  } finally {
    saving = false
    if (dirty) scheduleSave()
  }
}

function scheduleSave() {
  clearTimeout(saveTimer)
  saveTimer = window.setTimeout(() => { if (get().screen === 'editor') saveCurrent() }, 1500)
}

useStore.subscribe((s, p) => {
  if (s.screen === 'editor' && s.doc && p.doc && s.doc.id === p.doc.id && (s.docVersion !== p.docVersion || s.layersVersion !== p.layersVersion)) scheduleSave()
})

// time spent on the artwork
setInterval(() => {
  const s = get()
  if (s.screen === 'editor' && s.doc && document.visibilityState === 'visible' && editor.activeTime()) {
    set({ doc: { ...s.doc, timeSpent: s.doc.timeSpent + 5 } })
  }
}, 5000)

window.addEventListener('beforeunload', () => { if (get().screen === 'editor') saveCurrent() })

export async function closeToGallery() {
  const s = get()
  if (editor.transform) editor.commitTransform()
  if (editor.liquify) editor.commitLiquify()
  if (s.doc) await saveCurrent()
  editor.stop()
  set({ screen: 'gallery', doc: null, panel: null, adjust: null, selection: null })
  clearHistory()
}

export async function openArt(id: string) {
  const blob = await getArt(id)
  if (!blob) { toast('No se encontró la obra'); return }
  try {
    const d = await deserializeDoc(blob)
    openDoc(d)
  } catch (e) {
    toast((e as Error).message || 'No se pudo abrir la obra')
  }
}

export async function duplicateArt(id: string) {
  const blob = await getArt(id)
  const metas = await listArt()
  const m = metas.find((a) => a.id === id)
  if (!blob || !m) return
  const d = await deserializeDoc(blob)
  const nd: Doc = { ...d, id: uid('art'), name: d.name + ' copia', created: Date.now() }
  await putArt({ ...m, id: nd.id, name: nd.name, updated: Date.now(), created: nd.created }, await serializeDoc(nd))
}

export async function removeArt(id: string) {
  await deleteArt(id)
}

export async function exportArtPsd(id: string) {
  const blob = await getArt(id)
  if (!blob) return null
  const d = await deserializeDoc(blob)
  return { name: d.name, blob: exportPsd(d) }
}

export function blankLayer() {
  const d = get().doc
  return d ? newLayer(d.width, d.height, 'Capa') : null
}

export async function renameCurrent(name: string) {
  const d = get().doc
  if (!d) return
  set({ doc: { ...d, name: name.trim() || 'Sin título' }, layersVersion: get().layersVersion + 1 })
}
