import { Brush, Eraser, Images, Layers, MousePointer2, Pointer, Shirt, SquareDashed, Wand2, Wrench } from 'lucide-react'
import { useRef, useState } from 'react'
import { hsvToHex } from '../engine/util'
import { editor } from '../state/editor'
import { closeToGallery } from '../state/session'
import { get, set, useStore } from '../state/store'
import { selectTool, togglePanel } from './actions'

/** Reads out what the pen will do right now: tool, brush and size. */
function StatusChip() {
  const tool = useStore((s) => s.tool)
  const adjust = useStore((s) => s.adjust)
  const brushes = useStore((s) => s.brushes)
  const bt = tool === 'smudge' || tool === 'erase' ? tool : 'paint'
  const brushId = useStore((s) => s.toolBrush[bt])
  const size = useStore((s) => s.toolSize[bt])
  const opacity = useStore((s) => s.toolOpacity[bt])
  const brush = brushes.find((b) => b.id === brushId)
  const names: Record<string, string> = {
    paint: 'Pintar', smudge: 'Difuminar', erase: 'Borrar', select: 'Selección', transform: 'Transformar',
    text: 'Texto', measure: 'Medidas', zone: 'Pintar zona', guide: 'Guía', eyedropper: 'Cuentagotas',
  }
  const label = adjust ? 'Ajuste' : names[tool] || 'Pintar'
  const px = brush ? Math.round(editor.sizePx(bt, brush.props.maxSize)) : 0
  void size
  return (
    <button className="tb-status" onClick={() => set({ panel: 'brushes' })} title="Abrir la biblioteca de pinceles">
      <span className="dot" />
      <span>{label}</span>
      {brush && <span className="num">· {brush.name} · {px} px · {Math.round(opacity * 100)}%</span>}
    </button>
  )
}

export function TopBar() {
  const tool = useStore((s) => s.tool)
  const adjust = useStore((s) => s.adjust)
  const panel = useStore((s) => s.panel)
  const color = useStore((s) => s.color.primary)
  const hex = hsvToHex(color)
  const [ghost, setGhost] = useState<{ x: number; y: number } | null>(null)
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null)

  const on = (t: string) => (tool === t && !adjust ? ' on' : '')

  // Color well: tap opens the color panel, drag onto the canvas = ColorDrop.
  const wellDown = (e: React.PointerEvent) => {
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    drag.current = { x: e.clientX, y: e.clientY, moved: false }
  }
  const wellMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d) return
    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 8) d.moved = true
    if (d.moved) setGhost({ x: e.clientX, y: e.clientY })
  }
  const wellUp = (e: React.PointerEvent) => {
    const d = drag.current
    drag.current = null
    setGhost(null)
    if (!d) return
    if (!d.moved) { togglePanel('color'); return }
    if (e.clientY > 50) editor.colorDropAt(e.clientX, e.clientY, hsvToHex(get().color.primary))
    useStore.setState({ panel: null })
    window.dispatchEvent(new CustomEvent('atelier:colordrop'))
  }

  return (
    <div className="topbar" onPointerDown={(e) => e.stopPropagation()}>
      <div className="tb-group">
        <button className="tb-btn text" onClick={() => closeToGallery()} title="Volver a la galería" aria-label="Galería">
          <Images size={19} className="only-narrow" />
          <span className="not-narrow">Galería</span>
        </button>
        <button className={'tb-btn' + (panel === 'actions' ? ' on' : '')} data-anchor="actions" onClick={() => togglePanel('actions')} title="Acciones" aria-label="Acciones"><Wrench size={19} /></button>
        <button className={'tb-btn' + (panel === 'adjust' || (adjust && adjust !== 'clone') ? ' on' : '')} data-anchor="adjust" onClick={() => togglePanel('adjust')} title="Ajustes" aria-label="Ajustes"><Wand2 size={19} /></button>
        <button className={'tb-btn' + on('select')} onClick={() => selectTool('select')} title="Selección (S)" aria-label="Selección"><SquareDashed size={19} /></button>
        <button className={'tb-btn' + on('transform')} onClick={() => selectTool('transform')} title="Transformar (V)" aria-label="Transformar"><MousePointer2 size={19} /></button>
        <span className="tb-sep" />
        <button className={'tb-btn' + (panel === 'fashion' || panel === 'pattern' || panel === 'measure' ? ' on' : '')} data-anchor="fashion" onClick={() => togglePanel('fashion')} title="Moda: prendas, estampados, colorways, medidas y fichas técnicas" aria-label="Moda"><Shirt size={19} /><span className="lbl">Moda</span></button>
      </div>
      <StatusChip />
      <div className="tb-group">
        <button className={'tb-btn' + on('paint') + (adjust === 'clone' ? ' on' : '')} data-anchor="paint" onClick={() => selectTool('paint')} title="Pintar (B)" aria-label="Pintar"><Brush size={19} /></button>
        <button className={'tb-btn' + on('smudge')} data-anchor="smudge" onClick={() => selectTool('smudge')} title="Difuminar (S+Mayús)" aria-label="Difuminar"><Pointer size={19} /></button>
        <button className={'tb-btn' + on('erase')} data-anchor="erase" onClick={() => selectTool('erase')} title="Borrar (E)" aria-label="Borrar"><Eraser size={19} /></button>
        <button className={'tb-btn' + (panel === 'layers' ? ' on' : '')} data-anchor="layers" onClick={() => togglePanel('layers')} title="Capas (L)" aria-label="Capas"><Layers size={19} /></button>
        <button
          className="color-well"
          data-anchor="color"
          style={{ background: hex }}
          aria-label="Color. Arrastra al lienzo para rellenar"
          title="Color — arrastra al lienzo para rellenar (ColorDrop)"
          onPointerDown={wellDown}
          onPointerMove={wellMove}
          onPointerUp={wellUp}
        />
      </div>
      {ghost && <div className="drop-ghost" style={{ left: ghost.x, top: ghost.y, background: hex }} />}
    </div>
  )
}
