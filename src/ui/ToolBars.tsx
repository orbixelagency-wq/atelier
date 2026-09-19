import {
  Circle, ClipboardCopy, Eraser, FlipHorizontal2, FlipVertical2, Lasso, Magnet, PaintBucket, RotateCw, Save, Square,
  Wand, X,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { featherMask, invertMask } from '../engine/selection'
import { cloneCanvas } from '../engine/util'
import { clearLayer, copy, cropResize, fillLayer, paste } from '../state/docOps'
import { editor } from '../state/editor'
import { setSelection } from '../state/history'
import { get, set, toast, useStore } from '../state/store'
import { finishModes } from './actions'
import { HSlider, Seg, Switch } from './common'

export function SelectionBar() {
  const mode = useStore((s) => s.selectMode)
  const op = useStore((s) => s.selectOp)
  const sel = useStore((s) => s.selection)
  const th = useStore((s) => s.autoThreshold)
  const saved = useStore((s) => s.savedSelections)
  const [feather, setFeather] = useState<null | number>(null)
  const [base, setBase] = useState<HTMLCanvasElement | null>(null)

  const modes: [typeof mode, string, any][] = [['auto', 'Automática', Wand], ['free', 'A mano alzada', Lasso], ['rect', 'Rectángulo', Square], ['ellipse', 'Elipse', Circle]]
  return (
    <div className="bottombar" onPointerDown={(e) => e.stopPropagation()}>
      {modes.map(([k, n, Icon]) => (
        <button key={k} className={'bb-btn' + (mode === k ? ' on' : '')} onClick={() => { editor.cancelLasso(); set({ selectMode: k }) }} title={n}><Icon size={16} /><span className="lbl">{n}</span></button>
      ))}
      <div className="bb-sep" />
      <Seg value={op} onChange={(v) => set({ selectOp: v })} options={[['replace', 'Nueva'], ['add', 'Añadir'], ['subtract', 'Restar']]} />
      <div className="bb-sep" />
      {mode === 'free' && <button className="bb-btn" onClick={() => editor.finishLasso()}>Cerrar forma</button>}
      {mode === 'auto' && <span className="bb-btn num" style={{ pointerEvents: 'none' }}>Umbral {Math.round(th * 100)}% · arrastra ←→</span>}
      <button className="bb-btn" disabled={!sel} onClick={() => sel && setSelection('Invertir selección', invertMask(sel))}>Invertir</button>
      <button className="bb-btn" disabled={!sel} onClick={() => { copy(); paste() }} title="Copiar y pegar en capa nueva"><ClipboardCopy size={16} /><span className="lbl">Copiar y pegar</span></button>
      <button className="bb-btn" disabled={!sel} onClick={() => { setBase(sel); setFeather(0) }}>Desvanecer</button>
      <button className="bb-btn" disabled={!sel} onClick={() => { set({ savedSelections: [...saved, cloneCanvas(sel!)].slice(-8) }); toast('Selección guardada') }} title="Guardar selección"><Save size={16} /></button>
      {saved.length > 0 && <button className="bb-btn" onClick={() => setSelection('Cargar selección', cloneCanvas(saved[saved.length - 1]))}>Cargar</button>}
      <button className="bb-btn" disabled={!sel} onClick={() => fillLayer()} title="Rellenar con color"><PaintBucket size={16} /></button>
      <button className="bb-btn" disabled={!sel} onClick={() => clearLayer()} title="Borrar contenido"><Eraser size={16} /></button>
      <button className="bb-btn" disabled={!sel} onClick={() => setSelection('Deseleccionar', null)} title="Quitar selección"><X size={16} /><span className="lbl">Quitar</span></button>
      {feather !== null && base && (
        <div className="bb-slider" style={{ flexBasis: '100%' }}>
          <HSlider name="Desvanecer" value={feather} min={0} max={100} onChange={(v) => { setFeather(v); set({ selection: featherMask(base, v), selVersion: get().selVersion + 1 }) }} format={(v) => `${Math.round(v)} px`} />
          <button className="btn primary" onClick={() => { const r = get().selection; set({ selection: base }); setSelection('Desvanecer selección', r); setFeather(null) }}>Aplicar</button>
        </div>
      )}
    </div>
  )
}

export function TransformBar() {
  const mode = useStore((s) => s.transformMode)
  const snap = useStore((s) => s.transformSnap)
  const smooth = useStore((s) => s.transformSmooth)
  return (
    <div className="bottombar" onPointerDown={(e) => e.stopPropagation()}>
      <Seg value={mode} onChange={(v) => set({ transformMode: v })} options={[['free', 'Forma libre'], ['uniform', 'Uniforme'], ['distort', 'Distorsionar'], ['warp', 'Deformar']]} />
      <div className="bb-sep" />
      <button className={'bb-btn' + (snap ? ' on' : '')} onClick={() => set({ transformSnap: !snap })} title="Ajuste magnético"><Magnet size={16} /></button>
      <button className="bb-btn" onClick={() => editor.transformAction('flipH')} title="Voltear horizontal"><FlipHorizontal2 size={16} /></button>
      <button className="bb-btn" onClick={() => editor.transformAction('flipV')} title="Voltear vertical"><FlipVertical2 size={16} /></button>
      <button className="bb-btn" onClick={() => editor.transformAction('rot45')} title="Rotar 45°"><RotateCw size={16} /> 45°</button>
      <button className="bb-btn" onClick={() => editor.transformAction('fit')}>Ajustar a pantalla</button>
      <button className={'bb-btn' + (smooth ? ' on' : '')} onClick={() => set({ transformSmooth: !smooth })}>{smooth ? 'Bilineal' : 'Vecino más cercano'}</button>
      <button className="bb-btn" onClick={() => editor.transformAction('reset')}>Restablecer</button>
      <div className="bb-sep" />
      <button className="btn ghost" onClick={() => { editor.cancelTransform(); set({ tool: get().lastBrushTool }) }}>Cancelar</button>
      <button className="btn primary" onClick={() => { finishModes(); set({ tool: get().lastBrushTool }) }}>Aplicar</button>
    </div>
  )
}

export function CropBar() {
  const doc = useStore((s) => s.doc)!
  const [r, setR] = useState({ x: 0, y: 0, w: doc.width, h: doc.height })
  const [resample, setResample] = useState(false)
  const [out, setOut] = useState({ w: doc.width, h: doc.height })
  const [lock, setLock] = useState(true)
  useEffect(() => {
    editor.onCropChange = (c) => { setR(c); if (!resample) setOut({ w: c.w, h: c.h }) }
    return () => { editor.onCropChange = null }
  }, [resample])
  const setW = (w: number) => {
    if (resample) setOut({ w, h: lock ? Math.round((w * out.h) / out.w) : out.h })
    else { const c = { ...r, w, h: lock ? Math.round((w * r.h) / r.w) : r.h }; setR(c); editor.setCrop(c) }
  }
  const setH = (h: number) => {
    if (resample) setOut({ h, w: lock ? Math.round((h * out.w) / out.h) : out.w })
    else { const c = { ...r, h, w: lock ? Math.round((h * r.w) / r.h) : r.w }; setR(c); editor.setCrop(c) }
  }
  const cur = resample ? out : r
  return (
    <div className="adjust-panel" onPointerDown={(e) => e.stopPropagation()}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div className="pop-title" style={{ fontSize: 15 }}>Recortar y redimensionar</div>
        <div className="row" style={{ gap: 4 }}>
          <button className="btn ghost" onClick={() => editor.endCrop()}>Cancelar</button>
          <button className="btn ghost" onClick={() => { const c = { x: 0, y: 0, w: doc.width, h: doc.height }; setR(c); editor.setCrop(c); setOut({ w: doc.width, h: doc.height }) }}>Restablecer</button>
          <button className="btn primary" onClick={() => {
            cropResize(r.x, r.y, r.w, r.h, resample ? out.w : r.w, resample ? out.h : r.h, resample)
            editor.endCrop()
            requestAnimationFrame(() => editor.fit())
          }}>Hecho</button>
        </div>
      </div>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <label className="row" style={{ gap: 6 }}><span className="label">Ancho</span><input className="field num" style={{ width: 96 }} type="number" min={1} max={16384} value={cur.w} onChange={(e) => setW(Math.max(1, +e.target.value || 1))} /></label>
        <label className="row" style={{ gap: 6 }}><span className="label">Alto</span><input className="field num" style={{ width: 96 }} type="number" min={1} max={16384} value={cur.h} onChange={(e) => setH(Math.max(1, +e.target.value || 1))} /></label>
        <span className="label num">{((cur.w * cur.h) / 1e6).toFixed(1)} Mpx</span>
      </div>
      <Switch label="Mantener proporción" on={lock} onChange={setLock} />
      <Switch label="Remuestrear el lienzo" sub="Escala el contenido al nuevo tamaño en lugar de recortar" on={resample} onChange={setResample} />
    </div>
  )
}

export function GuidesPanel() {
  const g = useStore((s) => s.guides)
  const up = (p: Partial<typeof g>) => set({ guides: { ...g, ...p } })
  const done = () => set({ panel: null, tool: get().lastBrushTool })
  return (
    <div className="adjust-panel" onPointerDown={(e) => e.stopPropagation()}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div className="pop-title" style={{ fontSize: 15 }}>Guía de dibujo</div>
        <button className="btn primary" onClick={done}>Hecho</button>
      </div>
      <Seg value={g.type} onChange={(v) => up({ type: v })} options={[['grid', 'Cuadrícula 2D'], ['iso', 'Isométrica'], ['perspective', 'Perspectiva'], ['symmetry', 'Simetría']]} />
      {g.type === 'perspective' && <span className="label">Toca el lienzo para añadir hasta 3 puntos de fuga · arrástralos para moverlos · {g.vps.length} puntos {g.vps.length > 0 && <button className="btn ghost" style={{ height: 24 }} onClick={() => up({ vps: [] })}>Quitar puntos</button>}</span>}
      {g.type === 'symmetry' && <>
        <Seg value={g.symmetry} onChange={(v) => up({ symmetry: v })} options={[['vertical', 'Vertical'], ['horizontal', 'Horizontal'], ['quadrant', 'Cuadrante'], ['radial', 'Radial']]} />
        {g.symmetry === 'radial' && <HSlider name="Segmentos" value={g.radial} min={2} max={16} step={1} onChange={(v) => up({ radial: Math.round(v) })} format={(v) => `${Math.round(v)}`} />}
        <Switch label="Simetría rotacional" sub="Sin espejo; solo repite girando" on={g.rotational} onChange={(v) => up({ rotational: v })} />
        <span className="label">Arrastra el punto central en el lienzo para moverlo.</span>
      </>}
      {(g.type === 'grid' || g.type === 'iso') && <HSlider name="Tamaño de la cuadrícula" value={g.gridSize} min={10} max={600} onChange={(v) => up({ gridSize: Math.round(v) })} format={(v) => `${Math.round(v)} px`} />}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 18px' }}>
        <HSlider name="Opacidad" value={g.opacity} onChange={(v) => up({ opacity: v })} />
        <HSlider name="Grosor" value={g.thickness} min={0.5} max={6} onChange={(v) => up({ thickness: v })} format={(v) => `${v.toFixed(1)} px`} />
      </div>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <Switch label="Dibujo asistido" sub={g.type === 'symmetry' ? 'Necesario para pintar en simetría' : 'Los trazos siguen la guía'} on={g.assisted} onChange={(v) => up({ assisted: v })} />
        <input type="color" value={g.color} onChange={(e) => up({ color: e.target.value })} aria-label="Color de la guía" style={{ width: 40, height: 32, border: 0, background: 'none' }} />
      </div>
    </div>
  )
}
