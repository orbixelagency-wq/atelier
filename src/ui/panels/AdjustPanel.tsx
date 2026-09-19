import {
  Aperture, Blend, CircleDashed, Contrast, Droplets, Focus, Grid3x3, Layers2, Move, Palette, Rainbow, ScanLine,
  Eraser, Shirt, Sparkles, Spline, Stamp, SunMedium, Waves, Zap, MoveDiagonal,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as F from '../../engine/filters'
import { displace, offsetHalf, shadingFrom } from '../../engine/pattern'
import { removeBackground } from '../../engine/bg'
import { addLayer } from '../../state/docOps'
import type { Canvas } from '../../engine/util'
import { ctx2d, hsvToHex } from '../../engine/util'
import { active } from '../../state/docOps'
import { editor } from '../../state/editor'
import { editPixels } from '../../state/history'
import { get, set, toast, useStore, type AdjustKind } from '../../state/store'
import { openAdjust, registerAdjust } from '../actions'
import { HSlider, Pop, Seg } from '../common'

const MENU: { group: string; items: [AdjustKind, string, any][] }[] = [
  { group: 'Color', items: [['hsb', 'Tono, saturación y brillo', SunMedium], ['balance', 'Equilibrio de color', Blend], ['curves', 'Curvas', Spline], ['gradientMap', 'Mapa de degradado', Rainbow], ['levels', 'Niveles', Contrast]] },
  { group: 'Desenfoque', items: [['gaussian', 'Desenfoque gaussiano', CircleDashed], ['motion', 'Desenfoque de movimiento', Move], ['perspective', 'Desenfoque de perspectiva', Focus]] },
  { group: 'Efectos', items: [['noise', 'Ruido', Grid3x3], ['sharpen', 'Nitidez', Aperture], ['bloom', 'Resplandor', Sparkles], ['glitch', 'Fallo técnico', Zap], ['halftone', 'Semitono', Droplets], ['chromatic', 'Aberración cromática', Layers2]] },
  { group: 'Pintura', items: [['liquify', 'Licuar', Waves], ['clone', 'Clonar', Stamp]] },
  { group: 'Moda', items: [['removebg', 'Quitar fondo', Eraser], ['displace', 'Ajustar a tela (mockup)', Shirt], ['offset', 'Desplazar medio módulo', MoveDiagonal]] },
  { group: 'Otros', items: [['invert', 'Invertir', Palette], ['threshold', 'Umbral', ScanLine], ['posterize', 'Posterizar', Palette]] },
]

export const ADJUST_NAMES: Record<string, string> = Object.fromEntries(MENU.flatMap((g) => g.items.map(([k, n]) => [k, n])))

export function AdjustMenu() {
  return (
    <Pop onClose={() => set({ panel: null })} align="left" width={300} title="Ajustes" anchor="adjust">
      <div className="pop-body">
        {MENU.map((g, gi) => (
          <div key={g.group}>
            {gi > 0 && <div className="divider" />}
            {g.items.map(([k, n, Icon]) => (
              <button key={k} className="menu-item" onClick={() => openAdjust(k)}><Icon size={18} /> {n}</button>
            ))}
          </div>
        ))}
      </div>
    </Pop>
  )
}

type CurvePts = F.CurvePts
const lin = (): CurvePts => [{ x: 0, y: 0 }, { x: 1, y: 1 }]

const DEFAULTS: Record<string, any> = {
  hsb: { hue: 0, sat: 0, bright: 0 },
  balance: { shadows: [0, 0, 0], mid: [0, 0, 0], high: [0, 0, 0], range: 'mid' },
  curves: { master: lin(), r: lin(), g: lin(), b: lin(), ch: 'master' },
  gradientMap: { preset: 0, strength: 1 },
  gaussian: { radius: 8 },
  motion: { distance: 30, angle: 0 },
  perspective: { amount: 0.4, cx: 0.5, cy: 0.5, directional: false, angle: 0 },
  sharpen: { amount: 0.5 },
  noise: { amount: 0.25, mono: true },
  bloom: { threshold: 0.6, size: 18, burn: 0.4 },
  glitch: { amount: 0.4, block: 0.3, mode: 'artifact', seed: 7 },
  halftone: { size: 10, mode: 'full' },
  chromatic: { amount: 0.4, cx: 0.5, cy: 0.5, falloff: 0.5 },
  invert: {},
  threshold: { level: 0.5 },
  posterize: { levels: 5 },
  levels: { black: 0, white: 1, gamma: 1 },
  displace: { mapId: '', strength: 0.5, softness: 3, shade: true },
  offset: { fx: 0.5, fy: 0.5 },
  removebg: { mode: 'auto', color: '#ffffff', tolerance: 0.18, softness: 1, shrink: 1, trim: false },
}

function run(kind: AdjustKind, src: Canvas, p: any): Canvas {
  switch (kind) {
    case 'hsb': return F.hsb(src, p)
    case 'balance': return F.colorBalance(src, p)
    case 'curves': return F.curves(src, p)
    case 'gradientMap': return F.gradientMap(src, { stops: F.GRADIENT_PRESETS[p.preset].stops, strength: p.strength })
    case 'gaussian': return F.gaussian(src, p)
    case 'motion': return F.motionBlur(src, p)
    case 'perspective': return F.perspectiveBlur(src, p)
    case 'sharpen': return F.sharpen(src, p)
    case 'noise': return F.noise(src, p)
    case 'bloom': return F.bloom(src, p)
    case 'glitch': return F.glitch(src, p)
    case 'halftone': return F.halftone(src, p)
    case 'chromatic': return F.chromatic(src, p)
    case 'invert': return F.invert(src)
    case 'threshold': return F.threshold(src, p)
    case 'posterize': return F.posterize(src, p)
    case 'levels': return F.levels(src, p)
    case 'displace': {
      const map = get().doc?.layers.find((l) => l.id === p.mapId)
      return map ? displace(src, map.canvas, p.strength * 6, p.softness) : src
    }
    case 'offset': return offsetHalf(src, p.fx, p.fy)
    case 'removebg': return removeBackground(src, p)
    default: return src
  }
}

function CurveEditor({ pts, onChange }: { pts: CurvePts; onChange: (p: CurvePts) => void }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const drag = useRef<number | null>(null)
  const S = 240
  useEffect(() => {
    const x = ctx2d(ref.current!)
    x.clearRect(0, 0, S, S)
    x.strokeStyle = 'rgba(255,255,255,0.12)'
    x.lineWidth = 1
    for (let i = 1; i < 4; i++) {
      x.beginPath(); x.moveTo((S * i) / 4, 0); x.lineTo((S * i) / 4, S); x.moveTo(0, (S * i) / 4); x.lineTo(S, (S * i) / 4); x.stroke()
    }
    const lut = F.curveLUT(pts)
    x.strokeStyle = '#e9d25a'
    x.lineWidth = 2
    x.beginPath()
    for (let i = 0; i < 256; i++) { const px = (i / 255) * S, py = S - (lut[i] / 255) * S; i ? x.lineTo(px, py) : x.moveTo(px, py) }
    x.stroke()
    for (const p of pts) {
      x.beginPath(); x.arc(p.x * S, S - p.y * S, 6, 0, Math.PI * 2); x.fillStyle = '#fff'; x.fill()
    }
  }, [pts])
  const at = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect()
    return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, 1 - (e.clientY - r.top) / r.height)) }
  }
  return (
    <canvas
      ref={ref}
      width={S}
      height={S}
      style={{ width: S, height: S, alignSelf: 'center', background: 'rgba(0,0,0,0.25)', borderRadius: 8, touchAction: 'none' }}
      onPointerDown={(e) => {
        ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
        const p = at(e)
        let idx = pts.findIndex((q) => Math.hypot(q.x - p.x, q.y - p.y) < 0.06)
        if (idx < 0) { const np = [...pts, p].sort((a, b) => a.x - b.x); idx = np.indexOf(p); onChange(np) }
        drag.current = idx
      }}
      onPointerMove={(e) => {
        if (drag.current === null) return
        const p = at(e)
        const np = pts.map((q, i) => (i === drag.current ? p : q))
        onChange(np)
      }}
      onPointerUp={(e) => {
        const p = at(e)
        const i = drag.current
        drag.current = null
        // drag a point out of the box to delete it
        if (i !== null && pts.length > 2 && (p.y <= 0 || p.y >= 1) && i !== 0 && i !== pts.length - 1) onChange(pts.filter((_, k) => k !== i))
      }}
    />
  )
}

function FilterPanel({ kind }: { kind: AdjustKind }) {
  const layer = useMemo(() => active(), [kind])
  const [p, setP] = useState<any>(() => {
    const d = JSON.parse(JSON.stringify(DEFAULTS[kind]))
    if (kind === 'displace') {
      // default map: the nearest visible raster layer below (usually the garment photo)
      const doc = get().doc!
      const i = doc.layers.findIndex((l) => l.id === layer?.id)
      const below = doc.layers.slice(0, Math.max(0, i)).reverse().find((l) => l.kind !== 'group' && l.visible)
      d.mapId = below?.id || ''
    }
    return d
  })
  const [pencil, setPencil] = useState(false)
  const pencilAllowed = kind !== 'offset' && kind !== 'displace'
  const timer = useRef(0)
  const result = useRef<Canvas | null>(null)
  const selection = useStore((s) => s.selection)

  useEffect(() => {
    if (!layer || layer.kind === 'group') return
    clearTimeout(timer.current)
    result.current = null
    const heavy =['gaussian', 'bloom', 'sharpen', 'halftone', 'chromatic', 'perspective', 'motion'].includes(kind)
    timer.current = window.setTimeout(() => {
      const src = layer.canvas
      const filtered = run(kind, src, p)
      result.current = F.withinSelection(src, filtered, selection)
      if (pencil) {
        if (editor.filterPaint) editor.setFilterPaintFiltered(result.current)
        else editor.startFilterPaint(layer.id, src, result.current)
      } else editor.setFilterPreview(layer.id, result.current)
    }, heavy ? 90 : 25)
  }, [p, kind, selection, pencil])

  useEffect(() => {
    if (!pencil && editor.filterPaint) editor.stopFilterPaint()
    return () => { if (editor.filterPaint) editor.stopFilterPaint() }
  }, [pencil])

  const apply = () => {
    clearTimeout(timer.current)
    const L = active()
    if (L && layer && L.id === layer.id) {
      const painted = pencil ? editor.stopFilterPaint() : null
      const out = painted || result.current || F.withinSelection(layer.canvas, run(kind, layer.canvas, p), selection)
      editPixels(ADJUST_NAMES[kind], L, (cv) => {
        const x = ctx2d(cv)
        x.clearRect(0, 0, cv.width, cv.height)
        x.drawImage(out, 0, 0)
      })
    }
    editor.setFilterPreview('', null)
    set({ adjust: null })
    if (kind === 'displace' && p.shade && L && L.id === layer?.id) {
      const map = get().doc?.layers.find((l) => l.id === p.mapId)
      if (map) addLayer(shadingFrom(map.canvas), 'Sombras de la tela', { clip: true, blend: 'multiply' })
    }
  }
  const cancel = () => { clearTimeout(timer.current); editor.stopFilterPaint(); editor.setFilterPreview('', null); set({ adjust: null }) }
  useEffect(() => {
    registerAdjust({ apply, cancel })
    return () => registerAdjust(null)
  })

  if (!layer || layer.kind === 'group') return null
  const up = (patch: any) => setP({ ...p, ...patch })
  const S = (name: string, key: string, min = 0, max = 1, fmt?: (v: number) => string) => (
    <HSlider name={name} value={p[key]} min={min} max={max} onChange={(v) => up({ [key]: v })} format={fmt} />
  )
  const signed = (v: number) => `${v > 0 ? '+' : ''}${Math.round(v * 100)}%`

  let body: React.ReactNode = null
  switch (kind) {
    case 'hsb': body = <>{S('Tono', 'hue', -180, 180, (v) => `${Math.round(v)}°`)}{S('Saturación', 'sat', -1, 1, signed)}{S('Brillo', 'bright', -1, 1, signed)}</>; break
    case 'balance': {
      const r = p.range as 'shadows' | 'mid' | 'high'
      const tri = p[r] as number[]
      const setTri = (i: number, v: number) => { const t = [...tri]; t[i] = v; up({ [r]: t }) }
      body = <>
        <Seg value={r} onChange={(v) => up({ range: v })} options={[['shadows', 'Sombras'], ['mid', 'Medios tonos'], ['high', 'Luces']]} />
        <HSlider name="Cian ↔ Rojo" value={tri[0]} min={-1} max={1} onChange={(v) => setTri(0, v)} format={signed} />
        <HSlider name="Magenta ↔ Verde" value={tri[1]} min={-1} max={1} onChange={(v) => setTri(1, v)} format={signed} />
        <HSlider name="Amarillo ↔ Azul" value={tri[2]} min={-1} max={1} onChange={(v) => setTri(2, v)} format={signed} />
      </>
      break
    }
    case 'curves':
      body = <>
        <Seg value={p.ch} onChange={(v) => up({ ch: v })} options={[['master', 'Maestra'], ['r', 'Rojo'], ['g', 'Verde'], ['b', 'Azul']]} />
        <CurveEditor pts={p[p.ch]} onChange={(pts) => up({ [p.ch]: pts })} />
        <span className="label">Toca para añadir un punto · arrástralo fuera para quitarlo</span>
      </>
      break
    case 'gradientMap':
      body = <>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 6 }}>
          {F.GRADIENT_PRESETS.map((g, i) => (
            <button key={g.name} className="btn" onClick={() => up({ preset: i })} style={{ height: 44, flexDirection: 'column', gap: 3, boxShadow: p.preset === i ? 'inset 0 0 0 2px var(--chalk)' : undefined }}>
              <span style={{ width: '100%', height: 12, borderRadius: 4, background: `linear-gradient(to right, ${g.stops.map((s) => `${s.color} ${s.pos * 100}%`).join(',')})` }} />
              <span style={{ fontSize: 11 }}>{g.name}</span>
            </button>
          ))}
        </div>
        {S('Intensidad', 'strength')}
      </>
      break
    case 'gaussian': body = S('Radio', 'radius', 0, 120, (v) => `${v.toFixed(1)} px`); break
    case 'motion': body = <>{S('Distancia', 'distance', 0, 200, (v) => `${Math.round(v)} px`)}{S('Ángulo', 'angle', 0, 180, (v) => `${Math.round(v)}°`)}</>; break
    case 'perspective': body = <>
      <Seg value={p.directional ? 'dir' : 'pos'} onChange={(v) => up({ directional: v === 'dir' })} options={[['pos', 'Posicional'], ['dir', 'Direccional']]} />
      {S('Intensidad', 'amount')}{S('Centro X', 'cx')}{S('Centro Y', 'cy')}{p.directional && S('Ángulo', 'angle', 0, 180, (v) => `${Math.round(v)}°`)}
    </>; break
    case 'sharpen': body = S('Intensidad', 'amount'); break
    case 'noise': body = <>{S('Cantidad', 'amount')}<Seg value={p.mono ? 'mono' : 'color'} onChange={(v) => up({ mono: v === 'mono' })} options={[['mono', 'Monocromo'], ['color', 'Color']]} /></>; break
    case 'bloom': body = <>{S('Transición', 'threshold')}{S('Tamaño', 'size', 1, 80, (v) => `${Math.round(v)} px`)}{S('Intensidad', 'burn')}</>; break
    case 'glitch': body = <>
      <Seg value={p.mode} onChange={(v) => up({ mode: v })} options={[['artifact', 'Artefacto'], ['wave', 'Onda'], ['signal', 'Señal'], ['diverge', 'Divergir']]} />
      {S('Cantidad', 'amount')}{S('Tamaño de bloque', 'block')}
      <button className="btn" onClick={() => up({ seed: Math.floor(Math.random() * 1e6) })}>Otra variación</button>
    </>; break
    case 'halftone': body = <>
      <Seg value={p.mode} onChange={(v) => up({ mode: v })} options={[['full', 'Color completo'], ['screen', 'Serigrafía'], ['news', 'Periódico']]} />
      {S('Tamaño', 'size', 3, 60, (v) => `${Math.round(v)} px`)}
    </>; break
    case 'chromatic': body = <>{S('Intensidad', 'amount')}{S('Caída', 'falloff')}{S('Centro X', 'cx')}{S('Centro Y', 'cy')}</>; break
    case 'invert': body = <span className="label">Invierte los colores de la capa{selection ? ' dentro de la selección' : ''}.</span>; break
    case 'threshold': body = S('Nivel', 'level'); break
    case 'posterize': body = S('Niveles', 'levels', 2, 16, (v) => `${Math.round(v)}`); break
    case 'levels': body = <>{S('Negro', 'black')}{S('Blanco', 'white')}{S('Gamma', 'gamma', 0.2, 3, (v) => v.toFixed(2))}</>; break
    case 'displace': {
      const doc = get().doc!
      body = <>
        <span className="label" style={{ fontWeight: 500 }}>Coloca el diseño sobre la foto de la prenda. La foto guía los pliegues y, al aplicar, se añade una capa de sombras recortada al diseño.</span>
        <label className="row" style={{ justifyContent: 'space-between' }}>
          <span className="name" style={{ fontSize: 13, color: 'var(--ink-2)' }}>Foto de la tela</span>
          <select className="field" style={{ width: 'auto', maxWidth: 240 }} value={p.mapId} onChange={(e) => up({ mapId: e.target.value })}>
            <option value="">Elige una capa…</option>
            {doc.layers.filter((l) => l.kind !== 'group' && l.id !== layer.id).slice().reverse().map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </label>
        {S('Intensidad', 'strength')}{S('Suavizado', 'softness', 0, 12, (v) => `${v.toFixed(1)} px`)}
        <Seg value={p.shade ? 'on' : 'off'} onChange={(v) => up({ shade: v === 'on' })} options={[['on', 'Añadir sombras de la tela'], ['off', 'Solo deformar']]} />
      </>
      break
    }
    case 'removebg': body = <>
      <Seg value={p.mode} onChange={(v) => up({ mode: v })} options={[['auto', 'Fondo automático'], ['color', 'Quitar un color']]} />
      {p.mode === 'color' && (
        <label className="row" style={{ justifyContent: 'space-between' }}>
          <span className="name" style={{ fontSize: 13, color: 'var(--ink-2)' }}>Color a quitar</span>
          <span className="row" style={{ gap: 6 }}>
            <button className="btn" style={{ height: 28 }} onClick={() => up({ color: hsvToHex(get().color.primary) })}>Usar color actual</button>
            <input type="color" value={p.color} onChange={(e) => up({ color: e.target.value })} aria-label="Color a quitar" style={{ width: 40, height: 30, border: 0, background: 'none' }} />
          </span>
        </label>
      )}
      {S('Tolerancia', 'tolerance', 0.02, 0.6)}
      {S('Suavizar bordes', 'softness', 0, 6, (v) => `${v.toFixed(1)} px`)}
      {S('Recortar halo', 'shrink', 0, 6, (v) => `${Math.round(v)} px`)}
      <Seg value={p.trim ? 'on' : 'off'} onChange={(v) => up({ trim: v === 'on' })} options={[['off', 'Mantener tamaño'], ['on', 'Recortar al dibujo']]} />
    </>; break
    case 'offset': body = <>
      <span className="label" style={{ fontWeight: 500 }}>Desplaza la capa con envoltura para ver y repasar las juntas del módulo del estampado.</span>
      {S('Horizontal', 'fx')}{S('Vertical', 'fy')}
    </>; break
  }

  return (
    <div className="adjust-panel" onPointerDown={(e) => e.stopPropagation()}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div className="pop-title" style={{ fontSize: 15 }}>{ADJUST_NAMES[kind]} <span className="label" style={{ fontWeight: 500 }}>· {layer.name}</span></div>
        <div className="row" style={{ gap: 4 }}>
          <button className="btn ghost" onClick={cancel}>Cancelar</button>
          <button className="btn ghost" onClick={() => setP(JSON.parse(JSON.stringify(DEFAULTS[kind])))}>Restablecer</button>
          <button className="btn primary" onClick={apply}>Aplicar</button>
        </div>
      </div>
      {pencilAllowed && (
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <Seg value={pencil ? 'pen' : 'layer'} onChange={(v) => setPencil(v === 'pen')} options={[['layer', 'Capa'], ['pen', 'Pincel']]} />
          {pencil && <span className="label" style={{ fontWeight: 500 }}>Pinta sobre el lienzo para aplicar el ajuste; con Borrar lo quitas.</span>}
        </div>
      )}
      {body}
    </div>
  )
}

function LiquifyBar() {
  const mode = useStore((s) => s.liquifyMode)
  const lq = useStore((s) => s.liquify)
  useEffect(() => {
    registerAdjust({
      apply: () => { editor.commitLiquify(); set({ adjust: null }) },
      cancel: () => { editor.cancelLiquify(); set({ adjust: null }) },
    })
    return () => registerAdjust(null)
  }, [])
  const modes: [typeof mode, string][] = [['push', 'Empujar'], ['twirlR', 'Girar →'], ['twirlL', 'Girar ←'], ['pinch', 'Pellizcar'], ['expand', 'Expandir'], ['crystals', 'Cristales'], ['edge', 'Borde'], ['reconstruct', 'Reconstruir']]
  return (
    <div className="adjust-panel" onPointerDown={(e) => e.stopPropagation()}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div className="pop-title" style={{ fontSize: 15 }}>Licuar</div>
        <div className="row" style={{ gap: 4 }}>
          <button className="btn ghost" onClick={() => { editor.cancelLiquify(); set({ adjust: null }) }}>Cancelar</button>
          <button className="btn ghost" onClick={() => editor.liquifyReset()}>Restablecer</button>
          <button className="btn primary" onClick={() => { editor.commitLiquify(); set({ adjust: null }) }}>Aplicar</button>
        </div>
      </div>
      <div className="row" style={{ flexWrap: 'wrap', gap: 4 }}>
        {modes.map(([k, n]) => <button key={k} className={'bb-btn' + (mode === k ? ' on' : '')} onClick={() => set({ liquifyMode: k })}>{n}</button>)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 18px' }}>
        <HSlider name="Tamaño" value={lq.size} onChange={(v) => set({ liquify: { ...lq, size: Math.max(0.02, v) } })} />
        <HSlider name="Presión" value={lq.pressure} onChange={(v) => set({ liquify: { ...lq, pressure: v } })} />
        <HSlider name="Distorsión" value={lq.distortion} onChange={(v) => set({ liquify: { ...lq, distortion: v } })} />
      </div>
    </div>
  )
}

function CloneBar() {
  useEffect(() => {
    registerAdjust({ apply: () => set({ adjust: null, cloneSource: null }), cancel: () => set({ adjust: null, cloneSource: null }) })
    editor.resetClone()
    const d = get().doc
    if (d && !get().cloneSource) {
      const c = editor.toDoc(window.innerWidth / 2 - 120, window.innerHeight / 2)
      set({ cloneSource: { x: Math.round(c.x), y: Math.round(c.y) } })
    }
    toast('Arrastra el círculo al origen y pinta donde quieras copiar')
    return () => registerAdjust(null)
  }, [])
  return (
    <div className="bottombar" onPointerDown={(e) => e.stopPropagation()}>
      <span className="bb-btn" style={{ pointerEvents: 'none' }}>Clonar · usa el pincel activo</span>
      <div className="bb-sep" />
      <button className="bb-btn" onClick={() => { editor.resetClone(); toast('Origen reiniciado; el siguiente trazo fija el desplazamiento') }}>Reiniciar origen</button>
      <button className="bb-btn" onClick={() => set({ panel: 'brushes' })}>Pincel</button>
      <button className="btn primary" onClick={() => set({ adjust: null, cloneSource: null })}>Hecho</button>
    </div>
  )
}

export function AdjustPanel() {
  const kind = useStore((s) => s.adjust)
  if (!kind) return null
  if (kind === 'liquify') return <LiquifyBar />
  if (kind === 'clone') return <CloneBar />
  return <FilterPanel key={kind} kind={kind} />
}
