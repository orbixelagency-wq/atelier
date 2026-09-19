import { Plus, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { compositeDoc } from '../../engine/compositor'
import { dominantColors, recolor, type ColorPair } from '../../engine/pattern'
import { buildPdf } from '../../engine/pdf'
import type { Doc, Layer } from '../../engine/types'
import { canvasToBlob, ctx2d, downloadBlob, hexToRgb, makeCanvas, rgbToHex, uid, type Canvas } from '../../engine/util'
import { createDoc } from '../../state/docOps'
import { editor } from '../../state/editor'
import { editPixels } from '../../state/history'
import { openDoc, saveCurrent } from '../../state/session'
import { get, set, toast, useStore, type Colorway } from '../../state/store'
import { Dialog, HSlider } from '../common'

const toRgb = (h: string): [number, number, number] => { const c = hexToRgb(h); return [c.r, c.g, c.b] }
const toHex = (c: number[]) => rgbToHex({ r: c[0], g: c[1], b: c[2] })

function cmyk(hex: string) {
  const { r, g, b } = hexToRgb(hex)
  const R = r / 255, G = g / 255, B = b / 255
  const k = 1 - Math.max(R, G, B)
  if (k >= 1) return 'C0 M0 Y0 K100'
  const f = (v: number) => Math.round(((1 - v - k) / (1 - k)) * 100)
  return `C${f(R)} M${f(G)} Y${f(B)} K${Math.round(k * 100)}`
}

function rasterLayers(d: Doc): Layer[] {
  return d.layers.filter((l) => l.kind !== 'group')
}

function defaultSource(d: Doc): string {
  const base = [...d.layers].reverse().find((l) => l.name === 'Color base')
  const act = d.layers.find((l) => l.id === d.activeId)
  return base?.id || (act && act.kind !== 'group' ? act.id : rasterLayers(d)[0]?.id)
}

function pairsFor(cw: Colorway): ColorPair[] {
  return cw.pairs.map((p) => ({ from: toRgb(p.from), to: toRgb(p.to) }))
}

// ---------------------------------------------------------------- colorways
export function ColorwayDialog() {
  const doc = useStore((s) => s.doc)!
  const saved = useStore((s) => s.colorways)
  const [layerId, setLayerId] = useState(() => defaultSource(doc))
  const layer = doc.layers.find((l) => l.id === layerId)
  const [from, setFrom] = useState<string[]>([])
  const [to, setTo] = useState<string[]>([])
  const [name, setName] = useState('')
  const [tol, setTol] = useState(0.2)
  const timer = useRef(0)

  useEffect(() => {
    if (!layer) return
    const cs = dominantColors(layer.canvas, 6).map(toHex)
    setFrom(cs)
    setTo(cs)
  }, [layerId])

  const pairs = (): ColorPair[] => from.map((f, i) => ({ from: toRgb(f), to: toRgb(to[i] || f) }))

  useEffect(() => {
    if (!layer || !from.length) return
    clearTimeout(timer.current)
    timer.current = window.setTimeout(() => editor.setFilterPreview(layer.id, recolor(layer.canvas, pairs(), tol)), 60)
  }, [to, tol, from])

  const close = () => { editor.setFilterPreview('', null); set({ fashionDialog: null }) }

  const load = (cw: Colorway) => {
    setName(cw.name)
    setTo(from.map((f) => {
      const fr = toRgb(f)
      let best = f, bd = Infinity
      for (const p of cw.pairs) {
        const c = toRgb(p.from)
        const dd = (c[0] - fr[0]) ** 2 + (c[1] - fr[1]) ** 2 + (c[2] - fr[2]) ** 2
        if (dd < bd) { bd = dd; best = p.to }
      }
      return best
    }))
  }

  const saveCw = () => {
    const cw: Colorway = { id: uid('cw'), name: name.trim() || `Colorway ${saved.length + 1}`, pairs: from.map((f, i) => ({ from: f, to: to[i] || f })) }
    set({ colorways: [...get().colorways, cw] })
    toast(`«${cw.name}» guardado`)
    setName('')
  }

  const applyToLayer = () => {
    if (!layer) return
    const out = recolor(layer.canvas, pairs(), tol)
    editor.setFilterPreview('', null)
    editPixels('Colorway', layer, (cv) => { const x = ctx2d(cv); x.clearRect(0, 0, cv.width, cv.height); x.drawImage(out, 0, 0) })
    set({ fashionDialog: null })
  }

  const board = async () => {
    if (!layer) return
    const list: { name: string; pairs: ColorPair[] | null; swatches: string[] }[] = [
      { name: 'Original', pairs: null, swatches: from },
      ...saved.map((cw) => ({ name: cw.name, pairs: pairsFor(cw), swatches: cw.pairs.map((p) => p.to) })),
    ]
    if (list.length < 2) { toast('Guarda al menos un colorway para crear el tablero'); return }
    editor.setFilterPreview('', null)
    const cols = Math.min(3, list.length)
    const rows = Math.ceil(list.length / cols)
    const cellW = 1400, img = Math.round(cellW * (doc.height / doc.width)), cellH = img + 260
    const W = cols * cellW + 240, H = rows * cellH + 360
    const out = createDoc(W, H, `Colorways · ${doc.name}`, doc.dpi, '#ffffff')
    const c = out.layers[0].canvas
    const x = ctx2d(c)
    x.fillStyle = '#1d1c1a'
    x.font = '700 72px system-ui, -apple-system, Segoe UI, sans-serif'
    x.fillText(doc.name, 120, 170)
    x.font = '400 36px system-ui, -apple-system, Segoe UI, sans-serif'
    x.fillStyle = '#6b6a66'
    x.fillText(`${list.length} variantes de color`, 120, 230)
    const full = makeCanvas(doc.width, doc.height)
    list.forEach((cw, i) => {
      const cx = 120 + (i % cols) * cellW, cy = 300 + Math.floor(i / cols) * cellH
      const override = cw.pairs ? { id: layer.id, canvas: recolor(layer.canvas, cw.pairs, tol) } : null
      compositeDoc(doc, full, { includeBg: true, layerOverride: override })
      x.drawImage(full, cx, cy, cellW - 80, img * ((cellW - 80) / cellW))
      x.fillStyle = '#1d1c1a'
      x.font = '600 40px system-ui, -apple-system, Segoe UI, sans-serif'
      x.fillText(cw.name, cx, cy + img + 70)
      cw.swatches.slice(0, 8).forEach((hex, k) => {
        x.fillStyle = hex
        x.fillRect(cx + k * 150, cy + img + 100, 120, 60)
        x.strokeStyle = 'rgba(0,0,0,0.15)'
        x.strokeRect(cx + k * 150, cy + img + 100, 120, 60)
        x.fillStyle = '#6b6a66'
        x.font = '400 22px system-ui, -apple-system, Segoe UI, sans-serif'
        x.fillText(hex.toUpperCase(), cx + k * 150, cy + img + 190)
      })
    })
    out.layers[0].name = 'Tablero'
    await saveCurrent()
    set({ fashionDialog: null })
    openDoc(out)
    toast('Tablero de colorways creado como obra nueva')
  }

  return (
    <Dialog onClose={close}>
      <h2>Colorways</h2>
      <label className="row" style={{ justifyContent: 'space-between' }}>
        <span className="label">Capa a recolorear</span>
        <select className="field" style={{ width: 'auto', maxWidth: 220 }} value={layerId} onChange={(e) => setLayerId(e.target.value)}>
          {rasterLayers(doc).slice().reverse().map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </label>
      {!from.length && <p style={{ margin: 0, color: 'var(--ink-2)' }}>Esa capa no tiene color. Usa «Color base» de una plantilla o una capa pintada.</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {from.map((f, i) => (
          <div key={i} className="row">
            <span className="swatch" style={{ width: 34, height: 34, background: f, flex: 'none' }} />
            <span className="label num" style={{ width: 70 }}>{f.toUpperCase()}</span>
            <span style={{ color: 'var(--ink-3)' }}>→</span>
            <input type="color" value={to[i] || f} onChange={(e) => { const t = [...to]; t[i] = e.target.value; setTo(t) }} aria-label={`Nuevo color para ${f}`} style={{ width: 44, height: 34, border: 0, background: 'none' }} />
            <span className="label num">{(to[i] || f).toUpperCase()}</span>
          </div>
        ))}
      </div>
      <HSlider name="Tolerancia" value={tol} min={0.05} max={0.5} onChange={setTol} />
      <div className="row">
        <input className="field" placeholder="Nombre (p. ej. Negro / Crudo)" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn" onClick={saveCw} disabled={!from.length}><Plus size={15} /> Guardar</button>
      </div>
      {!!saved.length && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span className="label">Colorways guardados · toca para cargar</span>
          {saved.map((cw) => (
            <div key={cw.id} className="row" style={{ justifyContent: 'space-between' }}>
              <button className="menu-item" style={{ minHeight: 34 }} onClick={() => load(cw)}>
                <span style={{ display: 'flex', gap: 3 }}>{cw.pairs.slice(0, 6).map((p, k) => <span key={k} style={{ width: 16, height: 16, borderRadius: 4, background: p.to, boxShadow: 'inset 0 0 0 1px rgba(128,128,128,.3)' }} />)}</span>
                {cw.name}
              </button>
              <button className="icon-btn" aria-label="Eliminar colorway" onClick={() => set({ colorways: saved.filter((x) => x.id !== cw.id) })}><Trash2 size={15} /></button>
            </div>
          ))}
        </div>
      )}
      <div className="row" style={{ justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <button className="btn ghost" onClick={close}>Cerrar</button>
        <button className="btn" onClick={board}>Tablero de colorways</button>
        <button className="btn primary" onClick={applyToLayer} disabled={!from.length}>Aplicar a la capa</button>
      </div>
    </Dialog>
  )
}

// ---------------------------------------------------------------- tech pack
interface TechPack {
  brand: string; model: string; ref: string; season: string; designer: string
  fabric: string; composition: string; weight: string; trims: string; notes: string
  sizes: string; rows: { pom: string; tol: string; values: string[] }[]
}
const TP_KEY = 'atelier:techpack'
const defaultTP = (): TechPack => ({
  brand: '', model: '', ref: '', season: '', designer: '', fabric: '', composition: '', weight: '', trims: '', notes: '',
  sizes: 'XS,S,M,L,XL',
  rows: [
    { pom: 'Largo total (HPS)', tol: '±1', values: [] },
    { pom: 'Ancho de pecho (1/2)', tol: '±1', values: [] },
    { pom: 'Ancho de bajo (1/2)', tol: '±1', values: [] },
    { pom: 'Largo de manga', tol: '±0,5', values: [] },
    { pom: 'Ancho de hombros', tol: '±0,5', values: [] },
    { pom: 'Ancho de cuello', tol: '±0,5', values: [] },
  ],
})

const A4 = { w: 3508, h: 2480 }
const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif'

function wrap(x: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = []
  for (const para of text.split('\n')) {
    let line = ''
    for (const w of para.split(' ')) {
      const t = line ? line + ' ' + w : w
      if (x.measureText(t).width > maxW && line) { out.push(line); line = w } else line = t
    }
    out.push(line)
  }
  return out
}

function header(x: CanvasRenderingContext2D, tp: TechPack, page: number, total: number) {
  x.fillStyle = '#ffffff'
  x.fillRect(0, 0, A4.w, A4.h)
  x.fillStyle = '#1d1c1a'
  x.font = `800 84px ${FONT}`
  x.fillText(tp.brand || 'Marca', 150, 220)
  x.font = `600 44px ${FONT}`
  x.textAlign = 'right'
  x.fillText('FICHA TÉCNICA', A4.w - 150, 190)
  x.font = `400 32px ${FONT}`
  x.fillStyle = '#6b6a66'
  x.fillText(`Página ${page} de ${total} · ${new Date().toLocaleDateString('es-ES')}`, A4.w - 150, 240)
  x.textAlign = 'left'
  x.strokeStyle = '#1d1c1a'
  x.lineWidth = 4
  x.beginPath(); x.moveTo(150, 290); x.lineTo(A4.w - 150, 290); x.stroke()
  const meta: [string, string][] = [['Modelo', tp.model], ['Referencia', tp.ref], ['Temporada', tp.season], ['Diseño', tp.designer]]
  meta.forEach(([k, v], i) => {
    const cx = 150 + i * ((A4.w - 300) / 4)
    x.fillStyle = '#6b6a66'
    x.font = `600 28px ${FONT}`
    x.fillText(k.toUpperCase(), cx, 350)
    x.fillStyle = '#1d1c1a'
    x.font = `500 40px ${FONT}`
    x.fillText(v || '—', cx, 400)
  })
}

function renderPages(doc: Doc, tp: TechPack, colors: { name: string; hexes: string[] }[]): Canvas[] {
  const p1 = makeCanvas(A4.w, A4.h)
  const x = ctx2d(p1)
  header(x, tp, 1, 2)
  // flat drawing
  const flat = makeCanvas(doc.width, doc.height)
  compositeDoc(doc, flat, { includeBg: true })
  const boxW = 2050, boxH = 1880
  const k = Math.min(boxW / doc.width, boxH / doc.height)
  x.imageSmoothingQuality = 'high'
  x.drawImage(flat, 150 + (boxW - doc.width * k) / 2, 470 + (boxH - doc.height * k) / 2, doc.width * k, doc.height * k)
  x.strokeStyle = '#d9d7d2'
  x.lineWidth = 3
  x.strokeRect(150, 470, boxW, boxH)
  // right column
  let y = 500
  const cx = 2300, colW = A4.w - 150 - cx
  const section = (title: string) => {
    x.fillStyle = '#1d1c1a'
    x.font = `700 36px ${FONT}`
    x.fillText(title.toUpperCase(), cx, y)
    y += 20
    x.strokeStyle = '#1d1c1a'
    x.lineWidth = 2
    x.beginPath(); x.moveTo(cx, y); x.lineTo(cx + colW, y); x.stroke()
    y += 50
  }
  section('Colores')
  for (const cw of colors.slice(0, 4)) {
    x.fillStyle = '#1d1c1a'
    x.font = `600 30px ${FONT}`
    x.fillText(cw.name, cx, y)
    y += 20
    cw.hexes.slice(0, 5).forEach((h, i) => {
      const sx = cx + i * 205
      x.fillStyle = h
      x.fillRect(sx, y, 180, 80)
      x.strokeStyle = 'rgba(0,0,0,0.15)'
      x.strokeRect(sx, y, 180, 80)
      x.fillStyle = '#1d1c1a'
      x.font = `500 24px ${FONT}`
      x.fillText(h.toUpperCase(), sx, y + 112)
      x.fillStyle = '#6b6a66'
      x.font = `400 19px ${FONT}`
      x.fillText(cmyk(h), sx, y + 140)
    })
    y += 190
  }
  section('Tejido')
  const facts: [string, string][] = [['Tejido', tp.fabric], ['Composición', tp.composition], ['Gramaje', tp.weight], ['Tallas', tp.sizes], ['Fornituras', tp.trims]]
  for (const [k2, v] of facts) {
    x.fillStyle = '#6b6a66'
    x.font = `600 26px ${FONT}`
    x.fillText(k2, cx, y)
    x.fillStyle = '#1d1c1a'
    x.font = `400 32px ${FONT}`
    const lines = wrap(x, v || '—', colW - 280)
    lines.forEach((l, i) => x.fillText(l, cx + 280, y + i * 42))
    y += Math.max(1, lines.length) * 42 + 22
  }
  x.fillStyle = '#6b6a66'
  x.font = `400 22px ${FONT}`
  x.fillText('CMYK aproximado a partir de sRGB; confirmar con carta de color del proveedor.', cx, A4.h - 130)

  // page 2: measurements + notes
  const p2 = makeCanvas(A4.w, A4.h)
  const y2 = ctx2d(p2)
  header(y2, tp, 2, 2)
  const sizes = tp.sizes.split(',').map((s) => s.trim()).filter(Boolean)
  const tx = 150, ty = 520, colPom = 1100, colTol = 260
  const colSz = Math.min(300, (A4.w - 300 - colPom - colTol) / Math.max(1, sizes.length))
  y2.fillStyle = '#1d1c1a'
  y2.font = `700 36px ${FONT}`
  y2.fillText('TABLA DE MEDIDAS (cm)', tx, ty - 40)
  const rowH = 86
  y2.fillStyle = '#1d1c1a'
  y2.fillRect(tx, ty, colPom + colTol + colSz * sizes.length, rowH)
  y2.fillStyle = '#ffffff'
  y2.font = `700 30px ${FONT}`
  y2.fillText('Punto de medida', tx + 24, ty + 54)
  y2.fillText('Tol.', tx + colPom + 24, ty + 54)
  sizes.forEach((s, i) => y2.fillText(s, tx + colPom + colTol + i * colSz + 24, ty + 54))
  tp.rows.forEach((r, ri) => {
    const ry = ty + rowH * (ri + 1)
    y2.fillStyle = ri % 2 ? '#ffffff' : '#f4f3ef'
    y2.fillRect(tx, ry, colPom + colTol + colSz * sizes.length, rowH)
    y2.fillStyle = '#1d1c1a'
    y2.font = `500 30px ${FONT}`
    y2.fillText(r.pom, tx + 24, ry + 54)
    y2.fillText(r.tol, tx + colPom + 24, ry + 54)
    sizes.forEach((_, i) => y2.fillText(r.values[i] || '', tx + colPom + colTol + i * colSz + 24, ry + 54))
  })
  const noteY = ty + rowH * (tp.rows.length + 1) + 120
  y2.fillStyle = '#1d1c1a'
  y2.font = `700 36px ${FONT}`
  y2.fillText('NOTAS DE CONFECCIÓN', tx, noteY)
  y2.font = `400 32px ${FONT}`
  wrap(y2, tp.notes || '—', A4.w - 300).slice(0, 18).forEach((l, i) => y2.fillText(l, tx, noteY + 70 + i * 46))
  return [p1, p2]
}

export function TechPackDialog() {
  const doc = useStore((s) => s.doc)!
  const saved = useStore((s) => s.colorways)
  const [tp, setTp] = useState<TechPack>(() => {
    try { const v = localStorage.getItem(TP_KEY); return v ? { ...defaultTP(), ...JSON.parse(v) } : defaultTP() } catch { return defaultTP() }
  })
  const [busy, setBusy] = useState(false)
  useEffect(() => { try { localStorage.setItem(TP_KEY, JSON.stringify(tp)) } catch { /* ignore */ } }, [tp])
  const sizes = tp.sizes.split(',').map((s) => s.trim()).filter(Boolean)
  const colors = useMemo(() => {
    if (saved.length) return saved.map((c) => ({ name: c.name, hexes: c.pairs.map((p) => p.to) }))
    const flat = makeCanvas(doc.width, doc.height)
    compositeDoc(doc, flat, { includeBg: false })
    return [{ name: 'Colores del diseño', hexes: dominantColors(flat, 5).map(toHex) }]
  }, [saved, doc])
  const up = (p: Partial<TechPack>) => setTp({ ...tp, ...p })
  const field = (k: keyof TechPack, label: string, ph = '') => (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span className="label">{label}</span>
      <input className="field" value={tp[k] as string} placeholder={ph} onChange={(e) => up({ [k]: e.target.value } as Partial<TechPack>)} />
    </label>
  )
  const name = (tp.ref || tp.model || doc.name || 'ficha').replace(/[\\/:*?"<>|]+/g, '')
  const exportPdf = async () => {
    setBusy(true)
    try {
      const pages = renderPages(doc, tp, colors)
      const blob = await buildPdf(pages.map((c) => ({ canvas: c, widthPt: 842, heightPt: 595 })), `Ficha técnica ${tp.model}`)
      downloadBlob(blob, `ficha-tecnica-${name}.pdf`)
    } finally { setBusy(false) }
  }
  const exportPng = async () => {
    setBusy(true)
    try {
      const pages = renderPages(doc, tp, colors)
      for (let i = 0; i < pages.length; i++) downloadBlob(await canvasToBlob(pages[i]), `ficha-tecnica-${name}-${i + 1}.png`)
    } finally { setBusy(false) }
  }
  return (
    <div className="dialog-wrap" onPointerDown={(e) => { if (e.target === e.currentTarget) set({ fashionDialog: null }) }}>
      <div className="dialog" style={{ width: 'min(820px, 100%)' }}>
        <h2>Ficha técnica</h2>
        <p style={{ margin: 0, color: 'var(--ink-2)' }}>Se genera un PDF A4 apaisado de 2 páginas: el plano de este lienzo con colores, tejido y fornituras, y la tabla de medidas con notas de confección.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
          {field('brand', 'Marca')}{field('model', 'Modelo', 'Camiseta oversize')}{field('ref', 'Referencia', 'OFS-01')}
          {field('season', 'Temporada', 'PV27')}{field('designer', 'Diseño')}{field('fabric', 'Tejido', 'Punto jersey')}
          {field('composition', 'Composición', '100% algodón orgánico')}{field('weight', 'Gramaje', '240 g/m²')}{field('sizes', 'Tallas (separadas por comas)')}
        </div>
        {field('trims', 'Fornituras', 'Etiqueta tejida cuello, cinta espalda…')}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: 4 }} className="label">Punto de medida</th>
                <th style={{ padding: 4 }} className="label">Tol.</th>
                {sizes.map((s) => <th key={s} style={{ padding: 4 }} className="label">{s}</th>)}
                <th />
              </tr>
            </thead>
            <tbody>
              {tp.rows.map((r, ri) => (
                <tr key={ri}>
                  <td style={{ padding: 3 }}><input className="field" value={r.pom} onChange={(e) => { const rows = [...tp.rows]; rows[ri] = { ...r, pom: e.target.value }; up({ rows }) }} /></td>
                  <td style={{ padding: 3, width: 70 }}><input className="field num" value={r.tol} onChange={(e) => { const rows = [...tp.rows]; rows[ri] = { ...r, tol: e.target.value }; up({ rows }) }} /></td>
                  {sizes.map((_, si) => (
                    <td key={si} style={{ padding: 3, width: 70 }}>
                      <input className="field num" inputMode="decimal" value={r.values[si] || ''} onChange={(e) => { const rows = [...tp.rows]; const values = [...r.values]; values[si] = e.target.value; rows[ri] = { ...r, values }; up({ rows }) }} />
                    </td>
                  ))}
                  <td><button className="icon-btn" aria-label="Quitar fila" onClick={() => up({ rows: tp.rows.filter((_, k) => k !== ri) })}><Trash2 size={14} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button className="btn" style={{ alignSelf: 'flex-start' }} onClick={() => up({ rows: [...tp.rows, { pom: '', tol: '±0,5', values: [] }] })}><Plus size={15} /> Añadir medida</button>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span className="label">Notas de confección</span>
          <textarea className="field" style={{ height: 90, padding: 8 }} value={tp.notes} onChange={(e) => up({ notes: e.target.value })} placeholder="Costuras, acabados, lavado, etiquetado…" />
        </label>
        <p className="label" style={{ margin: 0, fontWeight: 500 }}>
          Colores: {saved.length ? `${saved.length} colorways guardados` : 'se toman los colores dominantes del lienzo (guarda colorways para incluirlos)'}.
        </p>
        <div className="row" style={{ justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button className="btn ghost" onClick={() => set({ fashionDialog: null })}>Cerrar</button>
          <button className="btn" disabled={busy} onClick={exportPng}>Exportar PNG</button>
          <button className="btn primary" disabled={busy} onClick={exportPdf}>{busy ? 'Generando…' : 'Exportar PDF'}</button>
        </div>
      </div>
    </div>
  )
}
