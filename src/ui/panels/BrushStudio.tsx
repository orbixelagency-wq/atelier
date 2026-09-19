import { RotateCcw, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Stroke } from '../../engine/brushEngine'
import { DEFAULT_BRUSHES, cloneBrush } from '../../engine/brushes'
import { GRAIN_SOURCES, registerImageTip, TIP_SOURCES } from '../../engine/tips'
import { BLEND_GROUPS, type Brush } from '../../engine/types'
import { ctx2d, pickFile } from '../../engine/util'
import { editor } from '../../state/editor'
import { get, set, useStore } from '../../state/store'
import { HSlider, Seg, Switch } from '../common'

type Section = 'stroke' | 'stab' | 'taper' | 'shape' | 'grain' | 'render' | 'wet' | 'color' | 'dyn' | 'pencil' | 'props' | 'about'
const SECTIONS: [Section, string][] = [
  ['stroke', 'Trazado'], ['stab', 'Estabilización'], ['taper', 'Afinado'], ['shape', 'Forma'], ['grain', 'Grano'],
  ['render', 'Renderizado'], ['wet', 'Mezcla húmeda'], ['color', 'Dinámica de color'], ['dyn', 'Dinámica'],
  ['pencil', 'Lápiz y presión'], ['props', 'Propiedades'], ['about', 'Acerca de'],
]

function Pad({ brush }: { brush: Brush }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const stroke = useRef<Stroke | null>(null)
  const layer = useRef<HTMLCanvasElement | null>(null)
  const W = 520, H = 300
  const redraw = () => {
    const c = ref.current!
    const x = ctx2d(c)
    x.clearRect(0, 0, W, H)
    x.fillStyle = '#fbfaf7'
    x.fillRect(0, 0, W, H)
    x.drawImage(layer.current!, 0, 0)
    if (stroke.current) {
      const tmp = document.createElement('canvas')
      tmp.width = W; tmp.height = H
      stroke.current.applyTo(tmp)
      x.drawImage(tmp, 0, 0)
    }
  }
  useEffect(() => {
    layer.current = document.createElement('canvas')
    layer.current.width = W
    layer.current.height = H
    redraw()
  }, [])
  const pt = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect()
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H, p: e.pointerType === 'pen' ? e.pressure : e.pointerType === 'touch' ? 0.75 : 1, tiltX: e.tiltX || 0, tiltY: e.tiltY || 0, t: e.timeStamp }
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <canvas
        ref={ref}
        width={W}
        height={H}
        style={{ width: '100%', aspectRatio: `${W}/${H}`, borderRadius: 10, touchAction: 'none', cursor: 'crosshair', boxShadow: '0 0 0 1px var(--line-2)' }}
        onPointerDown={(e) => {
          ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
          const s = get()
          const size = Math.min(80, editor.sizePx('paint', brush.props.maxSize))
          stroke.current = new Stroke(W, H, { brush, size, opacity: brush.props.maxOpacity, color: '#1d1c1a', mode: 'paint', layer: layer.current!, seed: 3 })
          void s
          stroke.current.addPoint(pt(e))
          stroke.current.render()
          redraw()
        }}
        onPointerMove={(e) => {
          if (!stroke.current) return
          const evs = (e.nativeEvent as any).getCoalescedEvents?.() || [e.nativeEvent]
          for (const ev of evs) stroke.current.addPoint(pt(ev))
          stroke.current.render()
          redraw()
        }}
        onPointerUp={() => {
          if (!stroke.current) return
          stroke.current.end()
          stroke.current.applyTo(layer.current!)
          stroke.current = null
          redraw()
        }}
      />
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="label">Zona de pruebas: dibuja para probar el pincel</span>
        <button className="btn ghost" onClick={() => { ctx2d(layer.current!).clearRect(0, 0, W, H); redraw() }}>Limpiar</button>
      </div>
    </div>
  )
}

export function BrushStudio() {
  const id = useStore((s) => s.studioBrushId)
  const brushes = useStore((s) => s.brushes)
  const src = brushes.find((b) => b.id === id)
  const [b, setB] = useState<Brush | null>(src ? cloneBrush(src) : null)
  const [sec, setSec] = useState<Section>('stroke')
  if (!b || !src) return null
  const original = DEFAULT_BRUSHES.find((d) => d.id === b.id)

  const up = <K extends keyof Brush>(k: K, patch: Partial<Brush[K]>) => {
    const nb = { ...b, [k]: { ...(b[k] as object), ...patch } } as Brush
    setB(nb)
  }
  const save = () => {
    const nb = { ...b, custom: true }
    set({ brushes: get().brushes.map((x) => (x.id === nb.id ? nb : x)), panel: 'brushes', studioBrushId: null })
  }
  const close = () => set({ panel: 'brushes', studioBrushId: null })

  const S = (name: string, v: number, on: (v: number) => void, min = 0, max = 1, fmt?: (v: number) => string) => (
    <HSlider name={name} value={v} min={min} max={max} onChange={on} format={fmt} />
  )

  const body = () => {
    switch (sec) {
      case 'stroke': return <>
        {S('Espaciado', b.stroke.spacing, (v) => up('stroke', { spacing: v }), 0.01, 2, (v) => `${Math.round(v * 100)}%`)}
        {S('Jitter lateral', b.stroke.jitter, (v) => up('stroke', { jitter: v }))}
        {S('Atenuación de caída', b.stroke.falloff, (v) => up('stroke', { falloff: v }))}
      </>
      case 'stab': return <>
        {S('StreamLine', b.stroke.streamline, (v) => up('stroke', { streamline: v }))}
        {S('Estabilización', b.stroke.stabilization, (v) => up('stroke', { stabilization: v }))}
      </>
      case 'taper': return <>
        {S('Afinado inicio', b.taper.start, (v) => up('taper', { start: v }))}
        {S('Afinado final', b.taper.end, (v) => up('taper', { end: v }))}
        {S('Afinado de tamaño', b.taper.size, (v) => up('taper', { size: v }))}
        {S('Afinado de opacidad', b.taper.opacity, (v) => up('taper', { opacity: v }))}
      </>
      case 'shape': return <>
        <div className="label">Fuente de la forma</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
          {TIP_SOURCES.map(([k, n]) => (
            <button key={k} className={'btn' + (b.shape.source === k ? ' primary' : '')} style={{ height: 30, fontSize: 12, padding: '0 6px' }}
              onClick={async () => {
                if (k === 'image') {
                  const [f] = await pickFile('image/*')
                  if (!f) return
                  const url = await new Promise<string>((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result as string); fr.readAsDataURL(f) })
                  await registerImageTip(url)
                  up('shape', { source: 'image', image: url })
                } else up('shape', { source: k })
              }}>{n}</button>
          ))}
        </div>
        {S('Dureza', b.shape.hardness, (v) => up('shape', { hardness: v }))}
        {S('Redondez', b.shape.roundness, (v) => up('shape', { roundness: Math.max(0.05, v) }))}
        {S('Ángulo', b.shape.angle, (v) => up('shape', { angle: v }), 0, 180, (v) => `${Math.round(v)}°`)}
        {S('Seguir el trazo', b.shape.follow, (v) => up('shape', { follow: v }))}
        {S('Rotación aleatoria', b.shape.rotJitter, (v) => up('shape', { rotJitter: v }))}
        {S('Dispersión', b.shape.scatter, (v) => up('shape', { scatter: v }))}
        {S('Número de sellos', b.shape.count, (v) => up('shape', { count: Math.round(v) }), 1, 10, (v) => `${Math.round(v)}`)}
        <Switch label="Volteo aleatorio" on={b.shape.flipRandom} onChange={(v) => up('shape', { flipRandom: v })} />
      </>
      case 'grain': return <>
        <div className="label">Textura del grano</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
          {GRAIN_SOURCES.map(([k, n]) => (
            <button key={k} className={'btn' + (b.grain.source === k ? ' primary' : '')} style={{ height: 30, fontSize: 12 }} onClick={() => up('grain', { source: k })}>{n}</button>
          ))}
        </div>
        {S('Escala', b.grain.scale, (v) => up('grain', { scale: v }), 0.1, 4, (v) => `${v.toFixed(2)}×`)}
        {S('Profundidad', b.grain.depth, (v) => up('grain', { depth: v }))}
        <Switch label="Escalar con el pincel" on={b.grain.zoomWithBrush} onChange={(v) => up('grain', { zoomWithBrush: v })} />
      </>
      case 'render': return <>
        <div className="label">Modo de renderizado</div>
        <Seg value={b.render.mode} options={[['glaze', 'Glaseado'], ['build', 'Acumulación'], ['wash', 'Aguada']]} onChange={(v) => up('render', { mode: v })} />
        {S('Flujo', b.render.flow, (v) => up('render', { flow: v }))}
        {S('Bordes húmedos', b.render.wetEdges, (v) => up('render', { wetEdges: v }))}
        <div className="label">Modo de fusión del pincel</div>
        <select className="field" value={b.render.blend} onChange={(e) => up('render', { blend: e.target.value as any })}>
          {BLEND_GROUPS.flatMap((g) => g.modes).map(([k, n]) => <option key={k} value={k}>{n}</option>)}
        </select>
      </>
      case 'wet': return <>
        {S('Arrastre (recoge color)', b.wet.pull, (v) => up('wet', { pull: v }))}
        {S('Carga', b.wet.charge, (v) => up('wet', { charge: v }))}
        {S('Dilución', b.wet.dilution, (v) => up('wet', { dilution: v }))}
      </>
      case 'color': return <>
        {S('Jitter de tono', b.color.hue, (v) => up('color', { hue: v }))}
        {S('Jitter de saturación', b.color.sat, (v) => up('color', { sat: v }))}
        {S('Jitter de brillo', b.color.bright, (v) => up('color', { bright: v }))}
        {S('Tono por trazo', b.color.strokeHue, (v) => up('color', { strokeHue: v }))}
      </>
      case 'dyn': return <>
        {S('Velocidad → tamaño', b.dynamics.speedSize, (v) => up('dynamics', { speedSize: v }), -1, 1, (v) => `${Math.round(v * 100)}%`)}
        {S('Velocidad → opacidad', b.dynamics.speedOpacity, (v) => up('dynamics', { speedOpacity: v }), -1, 1, (v) => `${Math.round(v * 100)}%`)}
        {S('Jitter de tamaño', b.dynamics.sizeJitter, (v) => up('dynamics', { sizeJitter: v }))}
        {S('Jitter de opacidad', b.dynamics.opacityJitter, (v) => up('dynamics', { opacityJitter: v }))}
      </>
      case 'pencil': return <>
        {S('Presión → tamaño', b.pencil.pressureSize, (v) => up('pencil', { pressureSize: v }))}
        {S('Presión → opacidad', b.pencil.pressureOpacity, (v) => up('pencil', { pressureOpacity: v }))}
        {S('Presión → flujo', b.pencil.pressureFlow, (v) => up('pencil', { pressureFlow: v }))}
        {S('Inclinación → tamaño', b.pencil.tiltSize, (v) => up('pencil', { tiltSize: v }))}
        {S('Inclinación → opacidad', b.pencil.tiltOpacity, (v) => up('pencil', { tiltOpacity: v }))}
        <Switch label="Orientar la punta con la inclinación" on={b.pencil.tiltAngle} onChange={(v) => up('pencil', { tiltAngle: v })} />
      </>
      case 'props': return <>
        {S('Tamaño máximo', b.props.maxSize, (v) => up('props', { maxSize: Math.round(v) }), 1, 500, (v) => `${Math.round(v)} px`)}
        {S('Tamaño mínimo', b.props.minSize, (v) => up('props', { minSize: v }))}
        {S('Opacidad máxima', b.props.maxOpacity, (v) => up('props', { maxOpacity: v }))}
        {S('Opacidad mínima', b.props.minOpacity, (v) => up('props', { minOpacity: v }))}
        <Switch label="Orientar a la pantalla" sub="La punta no gira al rotar el lienzo" on={b.props.screenOrient} onChange={(v) => up('props', { screenOrient: v })} />
      </>
      case 'about': return <>
        <div className="label">Nombre</div>
        <input className="field" value={b.name} onChange={(e) => setB({ ...b, name: e.target.value })} />
        <div className="label">Categoría</div>
        <input className="field" value={b.category} onChange={(e) => setB({ ...b, category: e.target.value || 'Mis pinceles' })} />
        {original && <button className="btn" onClick={() => setB(cloneBrush(original))}><RotateCcw size={15} /> Restablecer pincel</button>}
      </>
    }
  }

  return (
    <div className="dialog-wrap" onPointerDown={(e) => { if (e.target === e.currentTarget) close() }}>
      <div className="dialog" style={{ width: 'min(1040px, 100%)', padding: 0, gap: 0, height: 'min(640px, calc(100vh - 32px))' }}>
        <div className="pop-head" style={{ borderBottom: '1px solid var(--line)', padding: '12px 14px' }}>
          <div className="pop-title">Brush Studio · {b.name}</div>
          <div className="row" style={{ gap: 6 }}>
            <button className="btn ghost" onClick={close}>Cancelar</button>
            <button className="btn primary" onClick={save}>Hecho</button>
            <button className="icon-btn" onClick={close} aria-label="Cerrar"><X size={18} /></button>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '170px minmax(260px, 1fr) minmax(280px, 1.2fr)', flex: 1, minHeight: 0 }}>
          <div className="brush-cats">
            {SECTIONS.map(([k, n]) => <button key={k} className={'brush-cat' + (k === sec ? ' on' : '')} onClick={() => setSec(k)}>{n}</button>)}
          </div>
          <div style={{ overflow: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 12, borderRight: '1px solid var(--line)' }}>{body()}</div>
          <div style={{ padding: 14, overflow: 'auto' }}><Pad brush={b} /></div>
        </div>
      </div>
    </div>
  )
}
