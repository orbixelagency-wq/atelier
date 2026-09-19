import { AlignCenter, AlignLeft, AlignRight, Bold, Italic } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { Layer, TextMeta } from '../../engine/types'
import { ctx2d, hsvToHex, makeCanvas, type Canvas } from '../../engine/util'
import { addLayer, active } from '../../state/docOps'
import { editor } from '../../state/editor'
import { commitFrom, replaceDoc, snapshot } from '../../state/history'
import { get, set, useStore } from '../../state/store'
import { HSlider } from '../common'

export const FONTS: [string, string][] = [
  ['system-ui', 'Sistema'], ['Helvetica, Arial, sans-serif', 'Helvética'], ['Georgia, serif', 'Georgia'], ['"Times New Roman", serif', 'Times'],
  ['"Courier New", monospace', 'Courier'], ['Impact, sans-serif', 'Impact'],
  ['"Bebas Neue"', 'Bebas Neue'], ['Anton', 'Anton'], ['"Archivo Black"', 'Archivo Black'], ['Oswald', 'Oswald'],
  ['"Permanent Marker"', 'Permanent Marker'], ['Caveat', 'Caveat'], ['Pacifico', 'Pacifico'], ['"Rubik Mono One"', 'Rubik Mono One'],
  ['"DM Serif Display"', 'DM Serif Display'], ['"Space Mono"', 'Space Mono'], ['"Unbounded"', 'Unbounded'], ['"Syne"', 'Syne'],
]

let fontsLoaded = false
function loadWebFonts() {
  if (fontsLoaded) return
  fontsLoaded = true
  const fam = ['Bebas+Neue', 'Anton', 'Archivo+Black', 'Oswald:wght@400;700', 'Permanent+Marker', 'Caveat:wght@400;700', 'Pacifico', 'Rubik+Mono+One', 'DM+Serif+Display', 'Space+Mono:wght@400;700', 'Unbounded:wght@400;800', 'Syne:wght@400;800']
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = `https://fonts.googleapis.com/css2?${fam.map((f) => 'family=' + f).join('&')}&display=swap`
  document.head.appendChild(link)
}

export function renderText(t: TextMeta, w: number, h: number): Canvas {
  const c = makeCanvas(w, h)
  const x = ctx2d(c)
  x.font = `${t.italic ? 'italic ' : ''}${t.bold ? '700 ' : '400 '}${t.size}px ${t.font}`
  x.fillStyle = t.color
  x.textBaseline = 'top'
  x.textAlign = t.align
  ;(x as any).letterSpacing = `${t.tracking}px`
  const lines = t.text.split('\n')
  const lh = t.size * t.leading
  lines.forEach((line, i) => {
    if (t.outline) {
      x.lineWidth = Math.max(1, t.size / 24)
      x.strokeStyle = t.color
      x.strokeText(line, t.x, t.y + i * lh)
    } else x.fillText(line, t.x, t.y + i * lh)
  })
  return c
}

export function addTextLayer() {
  const d = get().doc
  if (!d) return
  loadWebFonts()
  const size = Math.round(Math.min(d.width, d.height) / 10)
  const meta: TextMeta = {
    text: 'Texto', font: 'system-ui', size, color: hsvToHex(get().color.primary), align: 'center', bold: true, italic: false,
    tracking: 0, leading: 1.15, x: d.width / 2, y: d.height / 2 - size / 2,
  }
  const l = addLayer(renderText(meta, d.width, d.height), 'Texto', { kind: 'text', text: meta })
  if (l) set({ textEdit: { layerId: l.id }, panel: 'text', tool: 'text' })
}

export function TextPanel() {
  const edit = useStore((s) => s.textEdit)
  const doc = useStore((s) => s.doc)!
  const layer = doc.layers.find((l) => l.id === edit?.layerId) as Layer | undefined
  const before = useRef(snapshot(doc))
  const [t, setT] = useState<TextMeta | null>(layer?.text ? { ...layer.text } : null)

  useEffect(() => { loadWebFonts() }, [])

  const apply = (nt: TextMeta) => {
    setT(nt)
    const d = get().doc!
    const id = edit!.layerId
    const canvas = renderText(nt, d.width, d.height)
    replaceDoc({ ...d, layers: d.layers.map((l) => (l.id === id ? { ...l, canvas, text: nt, name: nt.text.split('\n')[0].slice(0, 30) || 'Texto' } : l)) })
    // web fonts may finish loading after the first render
    document.fonts?.ready.then(() => {
      const d2 = get().doc
      const L = d2?.layers.find((l) => l.id === id)
      if (!d2 || !L || L.text !== nt) return
      replaceDoc({ ...d2, layers: d2.layers.map((l) => (l.id === id ? { ...l, canvas: renderText(nt, d2.width, d2.height) } : l)) })
    })
  }

  useEffect(() => {
    editor.onTextMove = (x, y) => { if (t) apply({ ...t, x, y }) }
    return () => { editor.onTextMove = null }
  })

  if (!layer || !t) return null
  const done = () => {
    commitFrom('Editar texto', before.current)
    set({ panel: null, textEdit: null, tool: get().lastBrushTool })
  }
  const up = (p: Partial<TextMeta>) => apply({ ...t, ...p })

  return (
    <div className="adjust-panel" onPointerDown={(e) => e.stopPropagation()} style={{ bottom: 14 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div className="pop-title" style={{ fontSize: 15 }}>Texto <span className="label" style={{ fontWeight: 500 }}>· arrastra en el lienzo para moverlo</span></div>
        <button className="btn primary" onClick={done}>Hecho</button>
      </div>
      <textarea className="field" style={{ height: 70, padding: 8, resize: 'vertical' }} value={t.text} onChange={(e) => up({ text: e.target.value })} autoFocus aria-label="Contenido del texto" />
      <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
        <select className="field" style={{ flex: '1 1 180px', width: 'auto', fontFamily: t.font }} value={t.font} onChange={(e) => up({ font: e.target.value })} aria-label="Fuente">
          {FONTS.map(([f, n]) => <option key={f} value={f} style={{ fontFamily: f }}>{n}</option>)}
        </select>
        <input type="color" value={t.color} onChange={(e) => up({ color: e.target.value })} aria-label="Color del texto" style={{ width: 40, height: 34, border: 0, background: 'none', padding: 0 }} />
        <div className="seg">
          <button className={t.bold ? 'on' : ''} onClick={() => up({ bold: !t.bold })} aria-label="Negrita"><Bold size={15} /></button>
          <button className={t.italic ? 'on' : ''} onClick={() => up({ italic: !t.italic })} aria-label="Cursiva"><Italic size={15} /></button>
          <button className={t.outline ? 'on' : ''} onClick={() => up({ outline: !t.outline })} aria-label="Contorno">Contorno</button>
        </div>
        <div className="seg">
          <button className={t.align === 'left' ? 'on' : ''} onClick={() => up({ align: 'left' })} aria-label="Alinear a la izquierda"><AlignLeft size={15} /></button>
          <button className={t.align === 'center' ? 'on' : ''} onClick={() => up({ align: 'center' })} aria-label="Centrar"><AlignCenter size={15} /></button>
          <button className={t.align === 'right' ? 'on' : ''} onClick={() => up({ align: 'right' })} aria-label="Alinear a la derecha"><AlignRight size={15} /></button>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 18px' }}>
        <HSlider name="Tamaño" value={t.size} min={6} max={Math.max(doc.width, doc.height) / 2} onChange={(v) => up({ size: Math.round(v) })} format={(v) => `${Math.round(v)} px`} />
        <HSlider name="Interletrado" value={t.tracking} min={-t.size / 5} max={t.size} onChange={(v) => up({ tracking: Math.round(v) })} format={(v) => `${Math.round(v)} px`} />
        <HSlider name="Interlineado" value={t.leading} min={0.7} max={2.5} onChange={(v) => up({ leading: v })} format={(v) => v.toFixed(2)} />
      </div>
    </div>
  )
}

/** Open the text editor for the active text layer (tap on a text layer with the text tool). */
export function editActiveText() {
  const L = active()
  if (L?.kind === 'text') set({ textEdit: { layerId: L.id }, panel: 'text', tool: 'text' })
}
