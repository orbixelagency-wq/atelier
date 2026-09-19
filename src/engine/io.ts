// Document (de)serialization, PSD, GIF and flat image export.
import { readPsd, writePsd, type Layer as PsdLayer, type Psd } from 'ag-psd'
import { GIFEncoder, applyPalette, quantize } from 'gifenc'
import type { BlendMode, Doc, Layer } from './types'
import { compositeDoc, frameLayers } from './compositor'
import { blobToCanvas, canvasToBlob, ctx2d, makeCanvas, uid, type Canvas } from './util'

// ---------- native container ----------
// [magic "ATLR"][u32 headerLen][header JSON][blob bytes...]
interface LayerHeader extends Omit<Layer, 'canvas' | 'mask'> { canvas: [number, number]; mask: [number, number] | null }

export async function serializeDoc(doc: Doc): Promise<Blob> {
  const parts: Blob[] = []
  let offset = 0
  const put = async (c: Canvas): Promise<[number, number]> => {
    const b = await canvasToBlob(c)
    parts.push(b)
    const r: [number, number] = [offset, b.size]
    offset += b.size
    return r
  }
  const layers: LayerHeader[] = []
  for (const l of doc.layers) {
    const canvas = l.kind === 'group' ? ([0, 0] as [number, number]) : await put(l.canvas)
    const mask = l.mask ? await put(l.mask) : null
    layers.push({ ...l, canvas, mask })
  }
  const header = JSON.stringify({ v: 1, doc: { ...doc, layers } })
  const hb = new TextEncoder().encode(header)
  const pre = new Uint8Array(8)
  pre.set([65, 84, 76, 82])
  new DataView(pre.buffer).setUint32(4, hb.length)
  return new Blob([pre, hb, ...parts], { type: 'application/x-atelier' })
}

export async function deserializeDoc(blob: Blob): Promise<Doc> {
  const buf = await blob.arrayBuffer()
  const u8 = new Uint8Array(buf)
  if (String.fromCharCode(u8[0], u8[1], u8[2], u8[3]) !== 'ATLR') throw new Error('El archivo no es un documento de Atelier')
  const hl = new DataView(buf).getUint32(4)
  const header = JSON.parse(new TextDecoder().decode(u8.subarray(8, 8 + hl)))
  const base = 8 + hl
  const d = header.doc
  const load = async ([o, n]: [number, number]): Promise<Canvas> => {
    const c = await blobToCanvas(new Blob([u8.subarray(base + o, base + o + n)], { type: 'image/png' }))
    if (c.width !== d.width || c.height !== d.height) {
      const f = makeCanvas(d.width, d.height)
      ctx2d(f).drawImage(c, 0, 0)
      return f
    }
    return c
  }
  const layers: Layer[] = []
  for (const l of d.layers as LayerHeader[]) {
    layers.push({
      ...l,
      canvas: l.kind === 'group' ? makeCanvas(1, 1) : await load(l.canvas),
      mask: l.mask ? await load(l.mask) : null,
    })
  }
  return { ...d, layers }
}

// ---------- PSD ----------
const toPsdBlend: Record<BlendMode, string> = {
  'source-over': 'normal', multiply: 'multiply', darken: 'darken', 'color-burn': 'color burn', lighten: 'lighten', screen: 'screen',
  'color-dodge': 'color dodge', overlay: 'overlay', 'soft-light': 'soft light', 'hard-light': 'hard light', difference: 'difference',
  exclusion: 'exclusion', hue: 'hue', saturation: 'saturation', color: 'color', luminosity: 'luminosity', lighter: 'linear dodge',
}
const fromPsdBlend = (m?: string): BlendMode => {
  for (const [k, v] of Object.entries(toPsdBlend)) if (v === m) return k as BlendMode
  if (m === 'linear burn') return 'color-burn'
  return 'source-over'
}

function maskToPsd(mask: Canvas): Canvas {
  // PSD masks are grayscale: white shows, black hides.
  const c = makeCanvas(mask.width, mask.height)
  const x = ctx2d(c, true)
  x.fillStyle = '#000'
  x.fillRect(0, 0, c.width, c.height)
  x.drawImage(mask, 0, 0)
  return c
}

export function exportPsd(doc: Doc): Blob {
  const build = (parentId: string | null): PsdLayer[] =>
    doc.layers.filter((l) => l.parentId === parentId).map((l): PsdLayer => {
      const base: PsdLayer = { name: l.name, hidden: !l.visible, opacity: l.opacity, blendMode: toPsdBlend[l.blend] as any, clipping: l.clip }
      if (l.kind === 'group') return { ...base, children: build(l.id), opened: !l.collapsed }
      const out: PsdLayer = { ...base, canvas: l.canvas, top: 0, left: 0 }
      if (l.mask) out.mask = { canvas: maskToPsd(l.mask), top: 0, left: 0, defaultColor: 0 }
      return out
    })
  const children = build(null)
  if (doc.bgVisible) {
    const bg = makeCanvas(doc.width, doc.height)
    const x = ctx2d(bg)
    x.fillStyle = doc.background
    x.fillRect(0, 0, doc.width, doc.height)
    children.unshift({ name: 'Fondo', canvas: bg, top: 0, left: 0 })
  }
  const flat = makeCanvas(doc.width, doc.height)
  compositeDoc(doc, flat)
  const psd: Psd = { width: doc.width, height: doc.height, children, canvas: flat }
  const buf = writePsd(psd, { generateThumbnail: true })
  return new Blob([buf], { type: 'image/vnd.adobe.photoshop' })
}

export async function importPsd(file: Blob, name: string): Promise<Doc> {
  const psd = readPsd(await file.arrayBuffer(), { skipThumbnail: true })
  const W = psd.width, H = psd.height
  const layers: Layer[] = []
  const place = (src: HTMLCanvasElement | undefined, left = 0, top = 0) => {
    const c = makeCanvas(W, H)
    if (src) ctx2d(c).drawImage(src, left, top)
    return c
  }
  const walk = (list: PsdLayer[] | undefined, parentId: string | null) => {
    for (const p of list || []) {
      const id = uid('layer')
      const common = {
        id, name: p.name || 'Capa', visible: !p.hidden, opacity: p.opacity ?? 1, blend: fromPsdBlend(p.blendMode),
        alphaLock: false, clip: !!p.clipping, locked: false, reference: false, editMask: false, parentId,
      }
      if (p.children) {
        layers.push({ ...common, kind: 'group', canvas: makeCanvas(1, 1), mask: null, collapsed: !p.opened })
        walk(p.children, id)
      } else {
        let mask: Canvas | null = null
        if (p.mask?.canvas) {
          const m = makeCanvas(W, H)
          const mx = ctx2d(m, true)
          mx.fillStyle = p.mask.defaultColor ? '#fff' : '#000'
          mx.fillRect(0, 0, W, H)
          mx.drawImage(p.mask.canvas, p.mask.left || 0, p.mask.top || 0)
          const d = mx.getImageData(0, 0, W, H)
          for (let i = 0; i < d.data.length; i += 4) { d.data[i + 3] = d.data[i]; d.data[i] = d.data[i + 1] = d.data[i + 2] = 255 }
          mx.putImageData(d, 0, 0)
          mask = m
        }
        layers.push({ ...common, kind: 'raster', canvas: place(p.canvas, p.left, p.top), mask })
      }
    }
  }
  walk(psd.children, null)
  if (!layers.length) layers.push({
    id: uid('layer'), name: 'Capa 1', kind: 'raster', canvas: place(psd.canvas), visible: true, opacity: 1, blend: 'source-over',
    alphaLock: false, clip: false, locked: false, reference: false, mask: null, editMask: false, parentId: null,
  })
  return {
    id: uid('art'), name, width: W, height: H, dpi: 300, background: '#ffffff', bgVisible: false, layers,
    activeId: layers[layers.length - 1].id, created: Date.now(), timeSpent: 0, strokes: 0,
  }
}

// ---------- flat images ----------
export async function exportImage(doc: Doc, type: 'image/png' | 'image/jpeg' | 'image/webp', quality = 0.92): Promise<Blob> {
  const c = makeCanvas(doc.width, doc.height)
  compositeDoc(doc, c, { includeBg: type === 'image/jpeg' ? true : doc.bgVisible })
  if (type === 'image/jpeg' && !doc.bgVisible) {
    const f = makeCanvas(doc.width, doc.height)
    const x = ctx2d(f)
    x.fillStyle = '#fff'
    x.fillRect(0, 0, f.width, f.height)
    x.drawImage(c, 0, 0)
    return canvasToBlob(f, type, quality)
  }
  return canvasToBlob(c, type, quality)
}

export async function exportLayersPng(doc: Doc): Promise<{ name: string; blob: Blob }[]> {
  const out: { name: string; blob: Blob }[] = []
  let i = 1
  for (const l of doc.layers) {
    if (l.kind === 'group') continue
    out.push({ name: `${String(i++).padStart(2, '0')}-${l.name.replace(/[^\w\-áéíóúñ ]+/gi, '')}.png`, blob: await canvasToBlob(l.canvas) })
  }
  return out
}

// ---------- animation ----------
export function animFrames(doc: Doc, opts: { bgFrame: boolean; fgFrame: boolean }, maxSide = 1080): Canvas[] {
  const frames = frameLayers(doc)
  const s = Math.min(1, maxSide / Math.max(doc.width, doc.height))
  const out: Canvas[] = []
  const full = makeCanvas(doc.width, doc.height)
  for (let i = 0; i < frames.length; i++) {
    if (opts.bgFrame && i === 0 && frames.length > 1) continue
    if (opts.fgFrame && i === frames.length - 1 && frames.length > 1) continue
    compositeDoc(doc, full, { anim: { frame: i, onionBefore: 0, onionAfter: 0, onionOpacity: 0, bgFrame: opts.bgFrame, fgFrame: opts.fgFrame, playing: true } })
    const c = makeCanvas(doc.width * s, doc.height * s)
    const x = ctx2d(c)
    x.imageSmoothingQuality = 'high'
    x.drawImage(full, 0, 0, c.width, c.height)
    const hold = 1 + (frames[i].hold || 0)
    for (let h = 0; h < hold; h++) out.push(c)
  }
  return out
}

export function sequenceFor(n: number, mode: 'loop' | 'pingpong' | 'once'): number[] {
  const seq = Array.from({ length: n }, (_, i) => i)
  if (mode === 'pingpong' && n > 2) for (let i = n - 2; i > 0; i--) seq.push(i)
  return seq
}

export function exportGif(frames: Canvas[], fps: number, mode: 'loop' | 'pingpong' | 'once'): Blob {
  const gif = GIFEncoder()
  const delay = Math.round(1000 / fps)
  for (const idx of sequenceFor(frames.length, mode)) {
    const f = frames[idx]
    const { data, width, height } = ctx2d(f, true).getImageData(0, 0, f.width, f.height)
    const palette = quantize(data, 256, { format: 'rgba4444', oneBitAlpha: true })
    const index = applyPalette(data, palette, 'rgba4444')
    gif.writeFrame(index, width, height, { palette, delay, transparent: true, repeat: mode === 'once' ? -1 : 0 })
  }
  gif.finish()
  return new Blob([gif.bytes() as unknown as BlobPart], { type: "image/gif" })
}

/** Record frames to WebM with MediaRecorder (timelapse and animation). */
export function exportVideo(frames: Canvas[], fps: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    if (!frames.length) { reject(new Error('No hay fotogramas')); return }
    const w = frames[0].width - (frames[0].width % 2), h = frames[0].height - (frames[0].height % 2)
    const c = makeCanvas(w, h)
    const x = ctx2d(c)
    const stream = (c as any).captureStream(fps) as MediaStream
    const types = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4']
    const mime = types.find((t) => (window as any).MediaRecorder?.isTypeSupported?.(t))
    if (!mime) { reject(new Error('Este navegador no puede grabar vídeo')); return }
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8_000_000 })
    const chunks: Blob[] = []
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data)
    rec.onstop = () => resolve(new Blob(chunks, { type: mime.split(';')[0] }))
    rec.start()
    let i = 0
    const tick = () => {
      if (i >= frames.length) { setTimeout(() => rec.stop(), 1000 / fps); return }
      x.fillStyle = '#fff'
      x.fillRect(0, 0, w, h)
      x.drawImage(frames[i++], 0, 0, w, h)
      setTimeout(tick, 1000 / fps)
    }
    tick()
  })
}

export async function imageFileToCanvas(file: Blob): Promise<Canvas> {
  return blobToCanvas(file)
}
