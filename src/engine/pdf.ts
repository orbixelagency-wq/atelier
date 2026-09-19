// Minimal writers for PDF (one JPEG image per page) and baseline TIFF (uncompressed RGBA).
import { canvasToBlob, ctx2d, type Canvas } from './util'

export interface PdfPage { canvas: Canvas; widthPt: number; heightPt: number }

/** Builds a PDF where each page is a full-bleed JPEG. Sizes are in points (1/72 in). */
export async function buildPdf(pages: PdfPage[], title = 'Atelier'): Promise<Blob> {
  const enc = new TextEncoder()
  const parts: (Uint8Array | Blob)[] = []
  const offsets: number[] = []
  let pos = 0
  const push = (p: Uint8Array | Blob, size: number) => { parts.push(p); pos += size }
  const text = (s: string) => { const b = enc.encode(s); push(b, b.length) }

  text('%PDF-1.4\n%âãÏÓ\n')
  // object numbering: 1 catalog, 2 pages, 3 info, then per page: page, content, image
  const n = pages.length
  const pageObj = (i: number) => 4 + i * 3
  const obj = (id: number) => { offsets[id] = pos }

  obj(1)
  text('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n')
  obj(2)
  text(`2 0 obj\n<< /Type /Pages /Count ${n} /Kids [${pages.map((_, i) => `${pageObj(i)} 0 R`).join(' ')}] >>\nendobj\n`)
  obj(3)
  const safe = title.replace(/[()\\]/g, '')
  text(`3 0 obj\n<< /Title (${safe}) /Producer (Atelier) >>\nendobj\n`)

  for (let i = 0; i < n; i++) {
    const p = pages[i]
    const jpeg = await canvasToBlob(p.canvas, 'image/jpeg', 0.92)
    const W = p.widthPt.toFixed(2), H = p.heightPt.toFixed(2)
    const id = pageObj(i)
    obj(id)
    text(`${id} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /Im0 ${id + 2} 0 R >> >> /Contents ${id + 1} 0 R >>\nendobj\n`)
    const content = `q ${W} 0 0 ${H} 0 0 cm /Im0 Do Q`
    obj(id + 1)
    text(`${id + 1} 0 obj\n<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\n`)
    obj(id + 2)
    text(`${id + 2} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${p.canvas.width} /Height ${p.canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.size} >>\nstream\n`)
    push(jpeg, jpeg.size)
    text('\nendstream\nendobj\n')
  }
  const total = 4 + n * 3
  const xref = pos
  let x = `xref\n0 ${total}\n0000000000 65535 f \n`
  for (let i = 1; i < total; i++) x += String(offsets[i] ?? 0).padStart(10, '0') + ' 00000 n \n'
  x += `trailer\n<< /Size ${total} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  text(x)
  return new Blob(parts as BlobPart[], { type: 'application/pdf' })
}

/** Uncompressed RGBA TIFF with resolution tags. */
export function buildTiff(c: Canvas, dpi = 300): Blob {
  const w = c.width, h = c.height
  const px = ctx2d(c, true).getImageData(0, 0, w, h).data
  const tags: [number, number, number, number | number[]][] = [] // tag, type, count, value(s)
  const SHORT = 3, LONG = 4, RATIONAL = 5
  const headerSize = 8
  const nTags = 14
  const ifdSize = 2 + nTags * 12 + 4
  let extra = headerSize + ifdSize
  const bpsOff = extra; extra += 8
  const xresOff = extra; extra += 8
  const yresOff = extra; extra += 8
  const dataOff = extra
  tags.push([256, LONG, 1, w], [257, LONG, 1, h], [258, SHORT, 4, bpsOff], [259, SHORT, 1, 1], [262, SHORT, 1, 2],
    [273, LONG, 1, dataOff], [277, SHORT, 1, 4], [278, LONG, 1, h], [279, LONG, 1, w * h * 4],
    [282, RATIONAL, 1, xresOff], [283, RATIONAL, 1, yresOff], [284, SHORT, 1, 1], [296, SHORT, 1, 2], [338, SHORT, 1, 2])
  const head = new ArrayBuffer(dataOff)
  const v = new DataView(head)
  v.setUint8(0, 0x49); v.setUint8(1, 0x49); v.setUint16(2, 42, true); v.setUint32(4, 8, true)
  v.setUint16(8, nTags, true)
  tags.forEach(([tag, type, count, val], i) => {
    const o = 10 + i * 12
    v.setUint16(o, tag, true); v.setUint16(o + 2, type, true); v.setUint32(o + 4, count, true)
    if (type === SHORT && count === 1) v.setUint16(o + 8, val as number, true)
    else v.setUint32(o + 8, val as number, true)
  })
  v.setUint32(10 + nTags * 12, 0, true)
  for (let i = 0; i < 4; i++) v.setUint16(bpsOff + i * 2, 8, true)
  v.setUint32(xresOff, dpi, true); v.setUint32(xresOff + 4, 1, true)
  v.setUint32(yresOff, dpi, true); v.setUint32(yresOff + 4, 1, true)
  return new Blob([head, px as unknown as BlobPart], { type: 'image/tiff' })
}
