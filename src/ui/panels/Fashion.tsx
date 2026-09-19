import {
  ClipboardList, Grid3x3, ImagePlus, Layers2, Maximize, Move, Paintbrush, Palette, PenTool, Repeat, Ruler, Scissors, Shirt,
  SquareDashedBottom, Trash2, Waves,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { compositeDoc } from '../../engine/compositor'
import { GARMENTS, GARMENT_GROUPS, garmentThumb, printAreas, renderGarment, type GarmentOptions } from '../../engine/garments'
import { looksLikeFlatBackground, removeBackground } from '../../engine/bg'
import { patternFill, REPEATS, type PatternOpts } from '../../engine/pattern'
import { deletePattern, listPatterns, putPattern, type PatternItem } from '../../engine/storage'
import { blobToCanvas, canvasToBlob, contentBounds, ctx2d, makeCanvas, pickFile, thumbnail, uid, type Canvas } from '../../engine/util'
import { editPixels } from '../../state/history'
import { active, newLayer } from '../../state/docOps'
import { editor } from '../../state/editor'
import { commit, commitFrom, replaceDoc, snapshot } from '../../state/history'
import { newCanvas, saveCurrent } from '../../state/session'
import { get, set, toast, useStore } from '../../state/store'
import { finishModes, openAdjust } from '../actions'
import { Dialog, HSlider, Pop, Seg, Switch } from '../common'
import { ColorwayDialog, TechPackDialog } from './FashionDocs'

// ---------------------------------------------------------------- menu
export function FashionMenu() {
  const tile = useStore((s) => s.tileMode)
  const close = () => set({ panel: null })
  const item = (Icon: any, label: string, sub: string, fn: () => void) => (
    <button className="menu-item" onClick={fn} style={{ alignItems: 'flex-start' }}>
      <Icon size={18} style={{ marginTop: 2 }} />
      <span style={{ display: 'flex', flexDirection: 'column' }}>
        <span>{label}</span>
        <span style={{ color: 'var(--ink-3)', fontSize: 12 }}>{sub}</span>
      </span>
    </button>
  )
  return (
    <Pop onClose={close} align="left" width={360} title="Moda" anchor="fashion">
      <div className="pop-body">
        <div className="label" style={{ padding: '2px 10px 4px' }}>Diseñar la prenda</div>
        {item(Shirt, 'Plantillas de prendas', 'Planos técnicos delantero y espalda listos para colorear', () => set({ panel: null, fashionDialog: 'garment' }))}
        {item(Scissors, 'Pinceles de costura y textil', 'Pespuntes, cremalleras, cordones, denim, punto…', () => {
          const b = get().brushes.find((x) => x.category === 'Costura y textil')
          finishModes()
          set({ tool: 'paint', lastBrushTool: 'paint', libraryCategory: 'Costura y textil', panel: 'brushes', ...(b ? { toolBrush: { ...get().toolBrush, paint: b.id } } : {}) })
        })}
        {item(ImagePlus, 'Insertar diseño en la prenda', 'Quita el fondo y lo coloca dentro del área de estampado', () => { set({ panel: null }); insertDesign() })}
        {item(Paintbrush, 'Pintar zona', 'Colorea una parte de la prenda sin salirte de las costuras', () => { finishModes(); set({ panel: 'zone', tool: 'zone' }) })}
        {item(Scissors, 'Quitar fondo de una capa', 'Deja el diseño recortado sobre la prenda', () => openAdjust('removebg'))}
        {item(Maximize, 'Ajustar al área de estampado', 'Escala el diseño de la capa activa al área marcada', () => { set({ panel: null }); fitToPrintArea() })}
        {item(Ruler, 'Medidas', 'Cotas en cm o pulgadas sobre el plano, con calibración', () => { finishModes(); set({ panel: 'measure', tool: 'measure' }) })}
        <div className="divider" />
        <div className="label" style={{ padding: '2px 10px 4px' }}>Estampados</div>
        <Switch label="Modo repetición" sub="Pinta el módulo del estampado: los trazos continúan por el borde opuesto" on={tile} onChange={(v) => { set({ tileMode: v }); if (v) requestAnimationFrame(() => editor.setZoom(get().view.zoom * 0.6)) }} />
        {item(Move, 'Desplazar medio módulo', 'Lleva las juntas al centro para repasarlas', () => openAdjust('offset'))}
        {item(Repeat, 'Rellenar con estampado', 'Aplica un estampado repetido a la prenda o a una capa', () => { finishModes(); set({ panel: 'pattern' }) })}
        <div className="divider" />
        <div className="label" style={{ padding: '2px 10px 4px' }}>Presentar la colección</div>
        {item(Palette, 'Colorways', 'Variantes de color de la prenda y tablero comparativo', () => set({ panel: null, fashionDialog: 'colorway' }))}
        {item(Waves, 'Ajustar a tela (mockup)', 'Adapta un diseño a los pliegues de una foto de prenda', () => openAdjust('displace'))}
        <Switch label="Mostrar el área de estampado" sub="Guía amarilla con el espacio imprimible de la prenda" on={useStore.getState().showPrintAreas} onChange={(v) => set({ showPrintAreas: v })} />
        {item(ClipboardList, 'Ficha técnica', 'Tech pack en PDF: plano, colores, tejido y tabla de medidas', () => set({ panel: null, fashionDialog: 'techpack' }))}
      </div>
    </Pop>
  )
}

// ---------------------------------------------------------------- garment templates
export function insertGarment(gid: string, opts: GarmentOptions) {
  const d = get().doc
  const g = GARMENTS.find((x) => x.id === gid)
  if (!d || !g) return
  const { fill, lines } = renderGarment(g, d.width, d.height, opts)
  const areas = printAreas(g, d.width, d.height, opts)
  const group = newLayer(1, 1, `Plano · ${g.name}`, { kind: 'group', garment: { garment: g.id, views: opts.views, areas } })
  const base = newLayer(d.width, d.height, 'Color base', { parentId: group.id })
  ctx2d(base.canvas).drawImage(fill, 0, 0)
  const art = newLayer(d.width, d.height, 'Estampado y detalles', { parentId: group.id, clip: true })
  const ln = newLayer(d.width, d.height, 'Líneas', { parentId: group.id, reference: true })
  ctx2d(ln.canvas).drawImage(lines, 0, 0)
  commit('Plantilla de prenda', (doc) => ({
    ...doc,
    layers: [...doc.layers.map((l) => (l.reference ? { ...l, reference: false } : l)), group, base, art, ln],
    activeId: art.id,
  }))
  toast(`${g.name} añadida · pinta en «Estampado y detalles»: queda recortado a la prenda`)
}

/** Put a design image inside the garment: knock out its background, fit it to the print area and clip it. */
export async function insertDesign(file?: File) {
  const d = get().doc
  if (!d) return
  const f = file || (await pickFile('image/*'))[0]
  if (!f) return
  let art = await blobToCanvas(f)
  if (looksLikeFlatBackground(art)) {
    art = removeBackground(art, { mode: 'auto', color: '#ffffff', tolerance: 0.16, softness: 1, shrink: 1, trim: true })
    toast('Fondo quitado automáticamente · ajústalo en Ajustes › Quitar fondo')
  }
  const gm = editor.garmentMeta()
  const area = gm?.meta.areas[0] || { x: d.width * 0.25, y: d.height * 0.25, w: d.width * 0.5, h: d.height * 0.5 }
  const k = Math.min(area.w / art.width, area.h / art.height)
  const w = art.width * k, h = art.height * k
  const c = makeCanvas(d.width, d.height)
  const x = ctx2d(c)
  x.imageSmoothingQuality = 'high'
  x.drawImage(art, area.x + (area.w - w) / 2, area.y + (area.h - h) / 2, w, h)
  const L = newLayer(d.width, d.height, f.name.replace(/\.[^.]+$/, '').slice(0, 30) || 'Diseño', { clip: !!gm, parentId: gm ? gm.group.id : null })
  ctx2d(L.canvas).drawImage(c, 0, 0)
  commit('Insertar diseño', (doc) => ({ ...doc, layers: [...doc.layers, L], activeId: L.id }))
  set({ selection: null, panel: null, tool: 'transform' })
  editor.beginTransform()
  toast(gm ? 'El diseño se amplía solo dentro de la prenda' : 'Diseño insertado')
}

/** Scale the active layer's artwork to fill the print area of the garment. */
export function fitToPrintArea(index = 0) {
  const d = get().doc
  const L = active()
  const gm = editor.garmentMeta()
  if (!d || !L || L.kind === 'group' || !gm) { toast('Necesitas una plantilla de prenda y una capa con el diseño'); return }
  const area = gm.meta.areas[Math.min(index, gm.meta.areas.length - 1)]
  const b = contentBounds(L.canvas)
  if (!b) { toast('La capa está vacía'); return }
  const k = Math.min(area.w / b.w, area.h / b.h)
  const src = makeCanvas(b.w, b.h)
  ctx2d(src).drawImage(L.canvas, b.x, b.y, b.w, b.h, 0, 0, b.w, b.h)
  editPixels('Ajustar al área de estampado', L, (cv) => {
    const x = ctx2d(cv)
    x.clearRect(0, 0, cv.width, cv.height)
    x.imageSmoothingQuality = 'high'
    x.drawImage(src, area.x + (area.w - b.w * k) / 2, area.y + (area.h - b.h * k) / 2, b.w * k, b.h * k)
  })
  if (!L.clip) updateLayerClip(L.id)
  editor.invalidate()
}

function updateLayerClip(id: string) {
  commit('Recortar a la prenda', (doc) => ({ ...doc, layers: doc.layers.map((l) => (l.id === id ? { ...l, clip: true } : l)) }))
}

export function ZoneBar() {
  const z = useStore((s) => s.zone)
  const up = (p: Partial<typeof z>) => set({ zone: { ...get().zone, ...p } })
  return (
    <div className="bottombar" onPointerDown={(e) => e.stopPropagation()}>
      <span className="bb-btn" style={{ pointerEvents: 'none' }}><Paintbrush size={16} /> Toca una zona de la prenda</span>
      <div className="bb-sep" />
      <Seg value={z.mode} onChange={(v) => up({ mode: v })} options={[['fill', 'Rellenar'], ['select', 'Seleccionar']]} />
      <div className="bb-slider" style={{ minWidth: 200 }}>
        <HSlider name="Tolerancia" value={z.tolerance} min={0.05} max={0.8} onChange={(v) => up({ tolerance: v })} />
      </div>
      <button className="btn primary" onClick={() => set({ panel: null, tool: get().lastBrushTool })}>Hecho</button>
    </div>
  )
}

function GarmentDialog() {
  const [gid, setGid] = useState(GARMENTS[0].id)
  const [group, setGroup] = useState('Todas')
  const [views, setViews] = useState<GarmentOptions['views']>('both')
  const [color, setColor] = useState('#ffffff')
  const [lineColor, setLineColor] = useState('#1d1c1a')
  const [stitches, setStitches] = useState(true)
  const [weight, setWeight] = useState(1)
  const thumbs = useMemo(() => Object.fromEntries(GARMENTS.map((g) => [g.id, garmentThumb(g, 110)])), [])
  const close = () => set({ fashionDialog: null })
  const opts: GarmentOptions = { views, color, lineColor, stitches, weight }
  return (
    <Dialog onClose={close}>
      <h2>Plantillas de prendas</h2>
      <div style={{ display: 'flex', gap: 4, overflowX: 'auto', paddingBottom: 2 }}>
        {['Todas', ...GARMENT_GROUPS].map((gr) => (
          <button key={gr} className={'btn' + (group === gr ? ' primary' : '')} style={{ height: 28, fontSize: 12 }} onClick={() => setGroup(gr)}>{gr}</button>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 8, maxHeight: 320, overflowY: 'auto' }}>
        {GARMENTS.filter((g) => group === 'Todas' || g.group === group).map((g) => (
          <button key={g.id} className="btn" onClick={() => setGid(g.id)}
            style={{ height: 'auto', padding: 8, flexDirection: 'column', gap: 4, boxShadow: gid === g.id ? 'inset 0 0 0 2px var(--chalk)' : undefined }}>
            <img src={thumbs[g.id]} alt="" style={{ width: '100%', height: 56, objectFit: 'contain' }} draggable={false} />
            <span style={{ fontSize: 12 }}>{g.name}</span>
          </button>
        ))}
      </div>
      <Seg value={views} onChange={setViews} options={[['both', 'Delantero y espalda'], ['front', 'Delantero'], ['back', 'Espalda']]} />
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <label className="row"><span>Color de la prenda</span><input type="color" value={color} onChange={(e) => setColor(e.target.value)} style={{ width: 40, height: 30, border: 0, background: 'none' }} /></label>
        <label className="row"><span>Líneas</span><input type="color" value={lineColor} onChange={(e) => setLineColor(e.target.value)} style={{ width: 40, height: 30, border: 0, background: 'none' }} /></label>
      </div>
      <HSlider name="Grosor de línea" value={weight} min={0.4} max={2.5} onChange={setWeight} format={(v) => `${v.toFixed(1)}×`} />
      <Switch label="Pespuntes y costuras" on={stitches} onChange={setStitches} />
      <div className="row" style={{ justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <button className="btn ghost" onClick={close}>Cancelar</button>
        <button className="btn" onClick={async () => {
          close()
          await saveCurrent()
          const g = GARMENTS.find((x) => x.id === gid)!
          newCanvas(views === 'both' ? 4800 : 2800, 2800, 300, `Plano ${g.name}`)
          insertGarment(gid, opts)
        }}>Lienzo nuevo</button>
        <button className="btn primary" onClick={() => { close(); insertGarment(gid, opts) }}>Insertar en este lienzo</button>
      </div>
    </Dialog>
  )
}

// ---------------------------------------------------------------- pattern fill
const tileCache = new Map<string, Canvas>()
async function tileOf(p: PatternItem): Promise<Canvas> {
  let c = tileCache.get(p.id)
  if (!c) { c = await blobToCanvas(p.tile); tileCache.set(p.id, c) }
  return c
}

async function savePatternFrom(source: 'layer' | 'canvas' | 'file'): Promise<PatternItem | null> {
  const d = get().doc
  let c: Canvas | null = null
  let name = 'Estampado'
  if (source === 'file') {
    const [f] = await pickFile('image/*')
    if (!f) return null
    c = await blobToCanvas(f)
    name = f.name.replace(/\.[^.]+$/, '')
  } else if (d) {
    const full = makeCanvas(d.width, d.height)
    if (source === 'canvas') compositeDoc(d, full, { includeBg: d.bgVisible })
    else {
      const L = active()
      if (!L || L.kind === 'group') { toast('Selecciona una capa con el dibujo del estampado'); return null }
      ctx2d(full).drawImage(L.canvas, 0, 0)
      name = L.name
    }
    const sel = get().selection
    if (sel) {
      const x = ctx2d(full)
      x.globalCompositeOperation = 'destination-in'
      x.drawImage(sel, 0, 0)
    }
    // repeat mode: the whole canvas is the module; otherwise crop to the drawing
    const b = get().tileMode || source === 'canvas' ? { x: 0, y: 0, w: d.width, h: d.height } : contentBounds(full)
    if (!b) { toast('La capa está vacía'); return null }
    c = makeCanvas(b.w, b.h)
    ctx2d(c).drawImage(full, b.x, b.y, b.w, b.h, 0, 0, b.w, b.h)
    if (source === 'canvas') name = d.name
  }
  if (!c) return null
  const t = thumbnail(c, 1600)
  const item: PatternItem = { id: uid('pat'), name: name.slice(0, 40) || 'Estampado', tile: await canvasToBlob(t), width: t.width, height: t.height, created: Date.now() }
  await putPattern(item)
  toast('Estampado guardado en tu biblioteca')
  return item
}

export function PatternPanel() {
  const doc = useStore((s) => s.doc)!
  const [items, setItems] = useState<PatternItem[]>([])
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [sel, setSel] = useState<string | null>(null)
  const [o, setO] = useState<PatternOpts>({ scale: 0.35, rotation: 0, repeat: 'grid', offsetX: 0, offsetY: 0, gap: 0 })
  const [clip, setClip] = useState(true)
  const session = useRef<{ before: ReturnType<typeof snapshot>; layerId: string } | null>(null)

  const refresh = async () => {
    const a = await listPatterns()
    setItems(a)
    setUrls((old) => { Object.values(old).forEach(URL.revokeObjectURL); return Object.fromEntries(a.map((p) => [p.id, URL.createObjectURL(p.tile)])) })
    if (!sel && a[0]) setSel(a[0].id)
  }
  useEffect(() => { refresh(); return () => { if (session.current) cancel() } }, [])

  // live preview into a temporary layer, recorded as one history step on apply
  useEffect(() => {
    const p = items.find((x) => x.id === sel)
    if (!p) return
    let dead = false
    tileOf(p).then((tile) => {
      if (dead) return
      const d = get().doc!
      if (!session.current) {
        const before = snapshot(d)
        const L = newLayer(d.width, d.height, `Estampado · ${p.name}`, { clip })
        const act = active()
        const layers = [...d.layers]
        const i = act ? layers.indexOf(act) : layers.length - 1
        L.parentId = act ? act.parentId : null
        layers.splice(i + 1, 0, L)
        replaceDoc({ ...d, layers, activeId: L.id })
        session.current = { before, layerId: L.id }
      }
      const d2 = get().doc!
      const fill = patternFill(tile, d2.width, d2.height, o)
      const sel2 = get().selection
      if (sel2) { const fx = ctx2d(fill); fx.globalCompositeOperation = 'destination-in'; fx.drawImage(sel2, 0, 0) }
      replaceDoc({ ...d2, layers: d2.layers.map((l) => (l.id === session.current!.layerId ? { ...l, canvas: fill, clip, name: `Estampado · ${p.name}` } : l)) })
    })
    return () => { dead = true }
  }, [sel, o, clip, items])

  const cancel = () => {
    const s = session.current
    session.current = null
    if (s) { const d = get().doc!; replaceDoc({ ...d, ...s.before }) }
  }
  const apply = () => {
    const s = session.current
    session.current = null
    if (s) commitFrom('Rellenar con estampado', s.before)
    set({ panel: null })
  }
  const up = (p: Partial<PatternOpts>) => setO({ ...o, ...p })

  return (
    <div className="adjust-panel" onPointerDown={(e) => e.stopPropagation()} style={{ width: 'min(640px, calc(100vw - 24px))' }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div className="pop-title" style={{ fontSize: 15 }}>Rellenar con estampado</div>
        <div className="row" style={{ gap: 4 }}>
          <button className="btn ghost" onClick={() => { cancel(); set({ panel: null }) }}>Cancelar</button>
          <button className="btn primary" disabled={!session.current && !sel} onClick={apply}>Aplicar</button>
        </div>
      </div>
      <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
        <button className="btn" onClick={async () => { const it = await savePatternFrom('layer'); if (it) { await refresh(); setSel(it.id) } }}><Layers2 size={15} /> Desde la capa</button>
        <button className="btn" onClick={async () => { const it = await savePatternFrom('canvas'); if (it) { await refresh(); setSel(it.id) } }}><Grid3x3 size={15} /> Desde el lienzo</button>
        <button className="btn" onClick={async () => { const it = await savePatternFrom('file'); if (it) { await refresh(); setSel(it.id) } }}><ImagePlus size={15} /> Importar imagen</button>
      </div>
      {items.length ? (
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
          {items.map((p) => (
            <div key={p.id} style={{ position: 'relative', flex: 'none' }}>
              <button onClick={() => setSel(p.id)} title={p.name}
                style={{ width: 72, height: 72, borderRadius: 8, background: `url(${urls[p.id]}) center/cover`, boxShadow: sel === p.id ? '0 0 0 2px var(--chalk)' : '0 0 0 1px var(--line-2)' }} aria-label={`Usar ${p.name}`} />
              <button className="icon-btn" style={{ position: 'absolute', top: -6, right: -6, width: 22, height: 22, background: 'var(--sheet-3)', borderRadius: 11 }}
                aria-label="Eliminar estampado" onClick={async () => { await deletePattern(p.id); if (sel === p.id) setSel(null); refresh() }}><Trash2 size={12} /></button>
            </div>
          ))}
        </div>
      ) : (
        <p style={{ margin: 0, color: 'var(--ink-2)' }}>Tu biblioteca está vacía. Dibuja el módulo (activa el modo repetición para que encaje sin costuras) y guárdalo desde la capa o el lienzo, o importa una imagen.</p>
      )}
      <Seg value={o.repeat} onChange={(v) => up({ repeat: v })} options={REPEATS} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 18px' }}>
        <HSlider name="Escala" value={o.scale} min={0.03} max={2} onChange={(v) => up({ scale: v })} format={(v) => `${Math.round(v * 100)}%`} />
        <HSlider name="Rotación" value={o.rotation} min={-180} max={180} onChange={(v) => up({ rotation: v })} format={(v) => `${Math.round(v)}°`} />
        <HSlider name="Separación" value={o.gap} min={0} max={800} onChange={(v) => up({ gap: Math.round(v) })} format={(v) => `${Math.round(v)} px`} />
        <HSlider name="Desplazamiento X" value={o.offsetX} min={-doc.width / 2} max={doc.width / 2} onChange={(v) => up({ offsetX: v })} format={(v) => `${Math.round(v)} px`} />
        <HSlider name="Desplazamiento Y" value={o.offsetY} min={-doc.height / 2} max={doc.height / 2} onChange={(v) => up({ offsetY: v })} format={(v) => `${Math.round(v)} px`} />
      </div>
      <Switch label="Recortar a la capa de debajo" sub="Con una plantilla de prenda, el estampado queda dentro de la tela" on={clip} onChange={setClip} />
    </div>
  )
}

// ---------------------------------------------------------------- measurements
export function MeasureBar() {
  const m = useStore((s) => s.measure)
  const doc = useStore((s) => s.doc)!
  const [pending, setPending] = useState<number | null>(null)
  const [real, setReal] = useState('')
  useEffect(() => {
    editor.onCalibrate = (px) => { setPending(px); setReal('') }
    return () => { editor.onCalibrate = null }
  }, [])
  const up = (p: Partial<typeof m>) => set({ measure: { ...get().measure, ...p } })
  const ppc = m.pxPerCm || doc.dpi / 2.54
  const done = () => { up({ calibrating: false }); set({ panel: null, tool: get().lastBrushTool }) }
  const saveCal = () => {
    const v = parseFloat(real.replace(',', '.'))
    if (!(v > 0) || pending === null) { toast('Escribe la medida real de la línea'); return }
    const cm = m.unit === 'cm' ? v : v * 2.54
    up({ pxPerCm: pending / cm, calibrating: false })
    setPending(null)
    toast('Escala calibrada')
  }
  return (
    <div className="bottombar" onPointerDown={(e) => e.stopPropagation()}>
      <span className="bb-btn" style={{ pointerEvents: 'none' }}><PenTool size={16} /> {m.calibrating ? 'Traza una línea de longitud conocida' : 'Arrastra para acotar · Mayús: ángulos de 15°'}</span>
      <div className="bb-sep" />
      <Seg value={m.unit} onChange={(v) => up({ unit: v })} options={[['cm', 'cm'], ['in', 'pulgadas']]} />
      <input type="color" value={m.color} onChange={(e) => up({ color: e.target.value })} aria-label="Color de las cotas" style={{ width: 34, height: 30, border: 0, background: 'none' }} />
      <button className={'bb-btn' + (m.calibrating ? ' on' : '')} onClick={() => up({ calibrating: !m.calibrating })}>Calibrar escala</button>
      {m.pxPerCm && <button className="bb-btn" onClick={() => up({ pxPerCm: null })}>Usar {doc.dpi} ppp</button>}
      <span className="bb-btn num" style={{ pointerEvents: 'none' }}>1 cm = {ppc.toFixed(1)} px</span>
      {pending !== null && (
        <div className="bb-slider" style={{ flexBasis: '100%', justifyContent: 'center' }}>
          <span>Esa línea mide</span>
          <input className="field num" style={{ width: 90 }} autoFocus inputMode="decimal" value={real} onChange={(e) => setReal(e.target.value)} placeholder="52,5"
            onKeyDown={(e) => { if (e.key === 'Enter') saveCal() }} />
          <span>{m.unit === 'cm' ? 'cm' : 'pulgadas'}</span>
          <button className="btn primary" onClick={saveCal}>Guardar</button>
        </div>
      )}
      <button className="btn primary" onClick={done}>Hecho</button>
    </div>
  )
}

// ---------------------------------------------------------------- dialogs host
export { GARMENT_GROUPS }

export function FashionDialogs() {
  const d = useStore((s) => s.fashionDialog)
  if (d === 'garment') return <GarmentDialog />
  if (d === 'colorway') return <ColorwayDialog />
  if (d === 'techpack') return <TechPackDialog />
  return null
}
