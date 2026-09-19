import { ArrowLeftRight, ImagePlus, Plus, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { compositeDoc } from '../../engine/compositor'
import type { Palette } from '../../engine/types'
import { blobToCanvas, clamp, ctx2d, hexToHsv, hexToRgb, hsvToHex, hsvToRgb, makeCanvas, pickFile, rgbToHex, rgbToHsv, uid, type Canvas, type HSV } from '../../engine/util'
import { get, set, toast, useStore } from '../../state/store'
import { HSlider, Pop, Seg } from '../common'

type Tab = 'disc' | 'classic' | 'harmony' | 'value' | 'palettes'

function setPrimary(c: HSV) {
  set({ color: { ...get().color, primary: { h: ((c.h % 360) + 360) % 360, s: clamp(c.s), v: clamp(c.v) } } })
}

function useDrag(onPoint: (x: number, y: number, first: boolean) => void) {
  return {
    onPointerDown: (e: React.PointerEvent) => {
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
      const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
      onPoint((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height, true)
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (!e.buttons && e.pointerType === 'mouse') return
      if (!(e.target as HTMLElement).hasPointerCapture?.(e.pointerId)) return
      const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
      onPoint((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height, false)
    },
  }
}

// ---------- Disc ----------
function Disc({ c }: { c: HSV }) {
  const ring = useRef<HTMLCanvasElement>(null)
  const inner = useRef<HTMLCanvasElement>(null)
  const mode = useRef<'ring' | 'inner'>('inner')
  const S = 280
  useEffect(() => {
    const x = ctx2d(ring.current!)
    const img = x.createImageData(S, S)
    for (let y = 0; y < S; y++) for (let i = 0; i < S; i++) {
      const dx = i - S / 2, dy = y - S / 2
      const r = Math.hypot(dx, dy) / (S / 2)
      if (r < 0.8 || r > 1) continue
      const h = ((Math.atan2(dy, dx) * 180) / Math.PI + 450) % 360
      const { r: R, g, b } = hsvToRgb({ h, s: 1, v: 1 })
      const k = (y * S + i) * 4
      const aa = Math.min(1, (1 - r) * S, (r - 0.8) * S)
      img.data[k] = R; img.data[k + 1] = g; img.data[k + 2] = b; img.data[k + 3] = aa * 255
    }
    x.putImageData(img, 0, 0)
  }, [])
  useEffect(() => {
    const x = ctx2d(inner.current!)
    const n = 200
    const img = x.createImageData(n, n)
    for (let y = 0; y < n; y++) for (let i = 0; i < n; i++) {
      const dx = i - n / 2, dy = y - n / 2
      const r = Math.hypot(dx, dy) / (n / 2)
      if (r > 1) continue
      const { r: R, g, b } = hsvToRgb({ h: c.h, s: i / n, v: 1 - y / n })
      const k = (y * n + i) * 4
      img.data[k] = R; img.data[k + 1] = g; img.data[k + 2] = b; img.data[k + 3] = Math.min(1, (1 - r) * n / 2) * 255
    }
    x.putImageData(img, 0, 0)
  }, [c.h])
  const drag = useDrag((u, v, first) => {
    const dx = u - 0.5, dy = v - 0.5
    const r = Math.hypot(dx, dy) * 2
    if (first) mode.current = r > 0.78 ? 'ring' : 'inner'
    if (mode.current === 'ring') setPrimary({ ...c, h: ((Math.atan2(dy, dx) * 180) / Math.PI + 450) % 360 })
    else {
      // inner disc occupies the central 71% square
      const k = 0.71
      setPrimary({ ...c, s: clamp((u - (1 - k) / 2) / k), v: clamp(1 - (v - (1 - k) / 2) / k) })
    }
  })
  const ha = ((c.h - 90) * Math.PI) / 180
  const k = 0.71
  return (
    <div style={{ position: 'relative', width: S, height: S, margin: '4px auto', touchAction: 'none' }} {...drag}>
      <canvas ref={ring} width={S} height={S} style={{ position: 'absolute', inset: 0 }} />
      <canvas ref={inner} width={200} height={200} style={{ position: 'absolute', left: (S * (1 - k)) / 2, top: (S * (1 - k)) / 2, width: S * k, height: S * k }} />
      <div style={{ position: 'absolute', left: S / 2 + Math.cos(ha) * S * 0.45 - 10, top: S / 2 + Math.sin(ha) * S * 0.45 - 10, width: 20, height: 20, borderRadius: 10, border: '3px solid #fff', boxShadow: '0 1px 4px rgba(0,0,0,.5)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', left: (S * (1 - k)) / 2 + c.s * S * k - 11, top: (S * (1 - k)) / 2 + (1 - c.v) * S * k - 11, width: 22, height: 22, borderRadius: 11, border: '3px solid #fff', background: hsvToHex(c), boxShadow: '0 1px 4px rgba(0,0,0,.5)', pointerEvents: 'none' }} />
    </div>
  )
}

// ---------- Classic ----------
function Classic({ c }: { c: HSV }) {
  const drag = useDrag((u, v) => setPrimary({ ...c, s: clamp(u), v: clamp(1 - v) }))
  const hue = hsvToHex({ h: c.h, s: 1, v: 1 })
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div {...drag} style={{ position: 'relative', height: 220, borderRadius: 10, touchAction: 'none', background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${hue})` }}>
        <div style={{ position: 'absolute', left: `calc(${c.s * 100}% - 10px)`, top: `calc(${(1 - c.v) * 100}% - 10px)`, width: 20, height: 20, borderRadius: 10, border: '3px solid #fff', boxShadow: '0 1px 4px rgba(0,0,0,.5)', pointerEvents: 'none' }} />
      </div>
      <HueBar c={c} />
      <HSlider name="Saturación" value={c.s} onChange={(v) => setPrimary({ ...c, s: v })} />
      <HSlider name="Brillo" value={c.v} onChange={(v) => setPrimary({ ...c, v })} />
    </div>
  )
}

function HueBar({ c }: { c: HSV }) {
  const drag = useDrag((u) => setPrimary({ ...c, h: clamp(u) * 359.9 }))
  return (
    <div {...drag} style={{ position: 'relative', height: 22, borderRadius: 11, touchAction: 'none', background: 'linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)' }}>
      <div style={{ position: 'absolute', left: `calc(${(c.h / 360) * 100}% - 11px)`, top: 0, width: 22, height: 22, borderRadius: 11, border: '3px solid #fff', boxShadow: '0 1px 4px rgba(0,0,0,.5)', pointerEvents: 'none' }} />
    </div>
  )
}

// ---------- Harmony ----------
type HMode = 'comp' | 'split' | 'analog' | 'triad' | 'tetrad'
const HARM: Record<HMode, number[]> = { comp: [0, 180], split: [0, 150, 210], analog: [0, -30, 30], triad: [0, 120, 240], tetrad: [0, 90, 180, 270] }
function Harmony({ c }: { c: HSV }) {
  const [mode, setMode] = useState<HMode>('comp')
  const wheel = useRef<HTMLCanvasElement>(null)
  const S = 250
  useEffect(() => {
    const x = ctx2d(wheel.current!)
    const img = x.createImageData(S, S)
    for (let y = 0; y < S; y++) for (let i = 0; i < S; i++) {
      const dx = i - S / 2, dy = y - S / 2
      const r = Math.hypot(dx, dy) / (S / 2)
      if (r > 1) continue
      const h = ((Math.atan2(dy, dx) * 180) / Math.PI + 450) % 360
      const { r: R, g, b } = hsvToRgb({ h, s: r, v: c.v })
      const k = (y * S + i) * 4
      img.data[k] = R; img.data[k + 1] = g; img.data[k + 2] = b; img.data[k + 3] = Math.min(1, (1 - r) * S / 2) * 255
    }
    x.putImageData(img, 0, 0)
  }, [c.v])
  const drag = useDrag((u, v) => {
    const dx = u - 0.5, dy = v - 0.5
    setPrimary({ ...c, h: ((Math.atan2(dy, dx) * 180) / Math.PI + 450) % 360, s: clamp(Math.hypot(dx, dy) * 2) })
  })
  const pts = HARM[mode].map((o) => ({ h: (c.h + o + 360) % 360, s: c.s, v: c.v }))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
      <select className="field" value={mode} onChange={(e) => setMode(e.target.value as HMode)}>
        <option value="comp">Complementario</option>
        <option value="split">Complementario dividido</option>
        <option value="analog">Análogo</option>
        <option value="triad">Triádico</option>
        <option value="tetrad">Tetrádico</option>
      </select>
      <div {...drag} style={{ position: 'relative', width: S, height: S, touchAction: 'none' }}>
        <canvas ref={wheel} width={S} height={S} />
        {pts.map((p, i) => {
          const a = ((p.h - 90) * Math.PI) / 180
          return <div key={i} style={{ position: 'absolute', left: S / 2 + Math.cos(a) * p.s * (S / 2) - (i ? 9 : 12), top: S / 2 + Math.sin(a) * p.s * (S / 2) - (i ? 9 : 12), width: i ? 18 : 24, height: i ? 18 : 24, borderRadius: 12, border: `${i ? 2 : 3}px solid #fff`, background: hsvToHex(p), boxShadow: '0 1px 4px rgba(0,0,0,.5)', pointerEvents: 'none' }} />
        })}
      </div>
      <div className="row" style={{ gap: 8 }}>
        {pts.map((p, i) => <button key={i} className="swatch" style={{ width: 40, background: hsvToHex(p) }} aria-label="Usar color armónico" onClick={() => setPrimary(p)} />)}
      </div>
      <div style={{ width: '100%' }}><HSlider name="Brillo" value={c.v} onChange={(v) => setPrimary({ ...c, v })} /></div>
    </div>
  )
}

// ---------- Value ----------
function Value({ c }: { c: HSV }) {
  const rgb = hsvToRgb(c)
  const [hex, setHex] = useState(hsvToHex(c))
  useEffect(() => setHex(hsvToHex(c)), [c.h, c.s, c.v])
  const setRgb = (k: 'r' | 'g' | 'b', v: number) => setPrimary(rgbToHsv({ ...rgb, [k]: Math.round(v) }))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <HSlider name="Tono" value={c.h} min={0} max={359.9} onChange={(v) => setPrimary({ ...c, h: v })} format={(v) => `${Math.round(v)}°`} />
      <HSlider name="Saturación" value={c.s} onChange={(v) => setPrimary({ ...c, s: v })} />
      <HSlider name="Brillo" value={c.v} onChange={(v) => setPrimary({ ...c, v })} />
      <div className="divider" />
      <HSlider name="Rojo" value={rgb.r} min={0} max={255} onChange={(v) => setRgb('r', v)} format={(v) => `${Math.round(v)}`} />
      <HSlider name="Verde" value={rgb.g} min={0} max={255} onChange={(v) => setRgb('g', v)} format={(v) => `${Math.round(v)}`} />
      <HSlider name="Azul" value={rgb.b} min={0} max={255} onChange={(v) => setRgb('b', v)} format={(v) => `${Math.round(v)}`} />
      <div className="row">
        <span className="label" style={{ width: 90 }}>Hexadecimal</span>
        <input className="field num" value={hex} onChange={(e) => setHex(e.target.value)} onBlur={() => /^#?[0-9a-f]{6}$/i.test(hex.trim()) && setPrimary(hexToHsv(hex.trim().startsWith('#') ? hex.trim() : '#' + hex.trim()))}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} aria-label="Color hexadecimal" />
      </div>
    </div>
  )
}

// ---------- Palettes ----------
function quantizeCanvas(c: Canvas, k = 30): string[] {
  const s = Math.min(1, 160 / Math.max(c.width, c.height))
  const t = makeCanvas(c.width * s, c.height * s)
  const x = ctx2d(t, true)
  x.drawImage(c, 0, 0, t.width, t.height)
  const d = x.getImageData(0, 0, t.width, t.height).data
  const px: number[][] = []
  for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 128) px.push([d[i], d[i + 1], d[i + 2]])
  if (!px.length) return []
  // k-means++ lite
  const cent: number[][] = [px[Math.floor(Math.random() * px.length)]]
  while (cent.length < Math.min(k, px.length)) {
    let best = px[0], bd = -1
    for (let i = 0; i < px.length; i += 7) {
      const p = px[i]
      let m = Infinity
      for (const cc of cent) m = Math.min(m, (p[0] - cc[0]) ** 2 + (p[1] - cc[1]) ** 2 + (p[2] - cc[2]) ** 2)
      if (m > bd) { bd = m; best = p }
    }
    cent.push([...best])
  }
  for (let it = 0; it < 6; it++) {
    const sum = cent.map(() => [0, 0, 0, 0])
    for (const p of px) {
      let bi = 0, bd = Infinity
      for (let j = 0; j < cent.length; j++) {
        const cc = cent[j]
        const dd = (p[0] - cc[0]) ** 2 + (p[1] - cc[1]) ** 2 + (p[2] - cc[2]) ** 2
        if (dd < bd) { bd = dd; bi = j }
      }
      sum[bi][0] += p[0]; sum[bi][1] += p[1]; sum[bi][2] += p[2]; sum[bi][3]++
    }
    sum.forEach((sm, j) => { if (sm[3]) cent[j] = [sm[0] / sm[3], sm[1] / sm[3], sm[2] / sm[3]] })
  }
  return cent.map((cc) => rgbToHex({ r: cc[0], g: cc[1], b: cc[2] })).sort((a, b) => hexToHsv(a).h - hexToHsv(b).h)
}

function Palettes() {
  const palettes = useStore((s) => s.palettes)
  const activeId = useStore((s) => s.activePalette)
  const c = useStore((s) => s.color.primary)
  const update = (p: Palette) => set({ palettes: get().palettes.map((x) => (x.id === p.id ? p : x)) })
  const addPalette = (name: string, colors: (string | null)[]) => {
    const p: Palette = { id: uid('pal'), name, colors: [...colors, ...Array(Math.max(0, 30 - colors.length)).fill(null)].slice(0, 30) }
    set({ palettes: [...get().palettes, p], activePalette: p.id })
  }
  const fromImage = async () => {
    const [f] = await pickFile('image/*')
    if (!f) return
    const cv = await blobToCanvas(f)
    addPalette(f.name.replace(/\.[^.]+$/, '').slice(0, 24), quantizeCanvas(cv))
    toast('Paleta creada a partir de la imagen')
  }
  const fromCanvas = () => {
    const d = get().doc
    if (!d) return
    const cv = makeCanvas(d.width, d.height)
    compositeDoc(d, cv)
    addPalette(d.name.slice(0, 24) || 'Lienzo', quantizeCanvas(cv))
    toast('Paleta creada a partir del lienzo')
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
        <button className="btn" onClick={() => addPalette('Paleta nueva', [])}><Plus size={15} /> Nueva</button>
        <button className="btn" onClick={fromImage}><ImagePlus size={15} /> Desde imagen</button>
        <button className="btn" onClick={fromCanvas}>Desde el lienzo</button>
      </div>
      {palettes.map((p) => (
        <div key={p.id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <input className="field" style={{ height: 28, background: 'transparent', padding: 0, fontWeight: 600 }} value={p.name} onChange={(e) => update({ ...p, name: e.target.value })} aria-label="Nombre de la paleta" />
            <div className="row" style={{ gap: 2 }}>
              <button className={'btn ghost'} style={{ height: 26, fontSize: 12, color: p.id === activeId ? 'var(--chalk)' : undefined }} onClick={() => set({ activePalette: p.id })}>{p.id === activeId ? 'Predeterminada' : 'Usar'}</button>
              {palettes.length > 1 && <button className="icon-btn" aria-label="Eliminar paleta" onClick={() => set({ palettes: palettes.filter((x) => x.id !== p.id), activePalette: activeId === p.id ? palettes[0].id : activeId })}><Trash2 size={15} /></button>}
            </div>
          </div>
          <div className="palette-grid">
            {p.colors.map((col, i) => (
              <button
                key={i}
                className={'swatch' + (col ? '' : ' empty')}
                style={col ? { background: col } : undefined}
                aria-label={col ? `Color ${col}` : 'Añadir color actual'}
                title={col ? 'Toca para usar · clic derecho para quitar' : 'Toca para guardar el color actual'}
                onClick={() => {
                  if (col) setPrimary(hexToHsv(col))
                  else { const cs = [...p.colors]; cs[i] = hsvToHex(c); update({ ...p, colors: cs }) }
                }}
                onContextMenu={(e) => { e.preventDefault(); const cs = [...p.colors]; cs[i] = null; update({ ...p, colors: cs }) }}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export function ColorPanel() {
  const [tab, setTab] = useState<Tab>(() => (localStorage.getItem('atelier:colorTab') as Tab) || 'disc')
  const c = useStore((s) => s.color.primary)
  const sec = useStore((s) => s.color.secondary)
  const hist = useStore((s) => s.colorHistory)
  const palettes = useStore((s) => s.palettes)
  const active = palettes.find((p) => p.id === useStore.getState().activePalette) || palettes[0]
  useEffect(() => { try { localStorage.setItem('atelier:colorTab', tab) } catch { /* ignore */ } }, [tab])
  const rgb = hexToRgb(hsvToHex(c))
  return (
    <Pop
      onClose={() => set({ panel: null })}
      width={350}
      title="Color"
      anchor="color"
      actions={
        <div className="row" style={{ gap: 6 }}>
          <button aria-label="Intercambiar colores" title="Intercambiar primario y secundario" className="icon-btn" onClick={() => set({ color: { primary: sec, secondary: c } })}><ArrowLeftRight size={16} /></button>
          <div style={{ position: 'relative', width: 44, height: 30 }}>
            <div className="swatch" style={{ position: 'absolute', right: 0, bottom: 0, width: 22, height: 22, background: hsvToHex(sec), borderRadius: 5 }} />
            <div className="swatch" style={{ position: 'absolute', left: 0, top: 0, width: 26, height: 26, background: hsvToHex(c), borderRadius: 6, boxShadow: '0 0 0 2px var(--sheet)' }} />
          </div>
        </div>
      }
    >
      <div className="pop-body" style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '0 14px 14px' }}>
        {tab === 'disc' && <Disc c={c} />}
        {tab === 'classic' && <Classic c={c} />}
        {tab === 'harmony' && <Harmony c={c} />}
        {tab === 'value' && <Value c={c} />}
        {tab === 'palettes' && <Palettes />}
        {tab !== 'palettes' && (
          <>
            {!!hist.length && (
              <div className="hist-row" aria-label="Historial">
                {hist.map((h, i) => <button key={i} className="swatch" style={{ background: h }} aria-label={`Color reciente ${h}`} onClick={() => setPrimary(hexToHsv(h))} />)}
              </div>
            )}
            <div className="palette-grid">
              {active.colors.slice(0, 10).map((col, i) => col
                ? <button key={i} className="swatch" style={{ background: col }} aria-label={`Color ${col}`} onClick={() => setPrimary(hexToHsv(col))} />
                : <span key={i} className="swatch empty" />)}
            </div>
          </>
        )}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <Seg value={tab} onChange={setTab} options={[['disc', 'Disco'], ['classic', 'Clásico'], ['harmony', 'Armonía'], ['value', 'Valor'], ['palettes', 'Paletas']]} />
        </div>
        <div className="label num" style={{ textAlign: 'center' }}>{hsvToHex(c).toUpperCase()} · R{rgb.r} G{rgb.g} B{rgb.b}</div>
      </div>
    </Pop>
  )
}
