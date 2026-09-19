import {
  Camera, ClipboardPaste, Copy, Crop, Download, FileImage, FlipHorizontal2, FlipVertical2, Film, Info, Layers,
  Maximize, PenLine, Play, RotateCcw, RotateCw, Ruler, Scissors, Type, Video,
} from 'lucide-react'
import { Fragment, useEffect, useRef, useState } from 'react'
import { animFrames, exportGif, exportImage, exportLayersPng, exportPsd, exportVideo, serializeDoc } from '../../engine/io'
import { downloadBlob, makeCanvas, pickFile } from '../../engine/util'
import { buildPdf, buildTiff } from '../../engine/pdf'
import { compositeDoc, frameLayers } from '../../engine/compositor'
import { copy, copyMerged, flipCanvas, hasClipboard, paste, rotateCanvas, trimToContent } from '../../state/docOps'
import { editor } from '../../state/editor'
import { insertImage, renameCurrent } from '../../state/session'
import { get, set, toast, useStore } from '../../state/store'
import { Dialog, HSlider, Pop, Seg, Switch } from '../common'
import { addTextLayer } from './TextPanel'

type Tab = 'add' | 'canvas' | 'share' | 'video' | 'prefs' | 'help'

const safeName = (n: string) => (n || 'atelier').replace(/[\\/:*?"<>|]+/g, '').trim() || 'atelier'

function PressureCurve() {
  const curve = useStore((s) => s.prefs.pressureCurve)
  const ref = useRef<HTMLCanvasElement>(null)
  const drag = useRef<number | null>(null)
  const S = 200
  useEffect(() => {
    const x = ref.current!.getContext('2d')!
    x.clearRect(0, 0, S, S)
    x.strokeStyle = 'rgba(128,128,128,0.25)'
    x.strokeRect(0.5, 0.5, S - 1, S - 1)
    const [x1, y1, x2, y2] = curve
    x.strokeStyle = '#e9d25a'
    x.lineWidth = 2
    x.beginPath()
    x.moveTo(0, S)
    x.bezierCurveTo(x1 * S, S - y1 * S, x2 * S, S - y2 * S, S, 0)
    x.stroke()
    x.fillStyle = '#fff'
    for (const [px, py] of [[x1, y1], [x2, y2]]) { x.beginPath(); x.arc(px * S, S - py * S, 7, 0, Math.PI * 2); x.fill() }
  }, [curve])
  const at = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect()
    return [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, 1 - (e.clientY - r.top) / r.height))]
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
      <canvas ref={ref} width={S} height={S} style={{ width: S, height: S, borderRadius: 8, background: 'rgba(0,0,0,0.2)', touchAction: 'none' }}
        onPointerDown={(e) => {
          ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
          const [px, py] = at(e)
          drag.current = Math.hypot(px - curve[0], py - curve[1]) < Math.hypot(px - curve[2], py - curve[3]) ? 0 : 1
        }}
        onPointerMove={(e) => {
          if (drag.current === null) return
          const [px, py] = at(e)
          const c = [...curve] as [number, number, number, number]
          c[drag.current * 2] = px
          c[drag.current * 2 + 1] = py
          set({ prefs: { ...get().prefs, pressureCurve: c } })
        }}
        onPointerUp={() => (drag.current = null)}
      />
      <button className="btn ghost" onClick={() => set({ prefs: { ...get().prefs, pressureCurve: [0.25, 0.25, 0.75, 0.75] } })}>Restablecer curva</button>
    </div>
  )
}

function TimelapsePlayer({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const frames = editor.timelapse
  const [i, setI] = useState(0)
  const [playing, setPlaying] = useState(true)
  useEffect(() => {
    if (!playing || !frames.length) return
    const id = setInterval(() => setI((v) => (v + 1) % frames.length), 1000 / 24)
    return () => clearInterval(id)
  }, [playing, frames.length])
  useEffect(() => {
    const f = frames[i]
    const c = ref.current
    if (!f || !c) return
    c.width = f.width
    c.height = f.height
    c.getContext('2d')!.drawImage(f, 0, 0)
  }, [i, frames])
  return (
    <Dialog onClose={onClose}>
      <h2>Repetición del timelapse</h2>
      {frames.length ? (
        <>
          <canvas ref={ref} style={{ width: '100%', borderRadius: 8, background: '#fff' }} />
          <HSlider name="Fotograma" value={i} min={0} max={Math.max(1, frames.length - 1)} step={1} onChange={(v) => { setPlaying(false); setI(Math.round(v)) }} format={(v) => `${Math.round(v) + 1} / ${frames.length}`} />
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <button className="btn" onClick={() => setPlaying(!playing)}>{playing ? 'Pausa' : 'Reproducir'}</button>
            <button className="btn primary" onClick={onClose}>Cerrar</button>
          </div>
        </>
      ) : (
        <>
          <p style={{ color: 'var(--ink-2)', margin: 0 }}>Aún no hay grabación. Cada trazo que hagas con la grabación activada se añade al timelapse de esta sesión.</p>
          <button className="btn primary" onClick={onClose}>Entendido</button>
        </>
      )}
    </Dialog>
  )
}

function CanvasInfo({ onClose }: { onClose: () => void }) {
  const d = useStore((s) => s.doc)!
  const [name, setName] = useState(d.name)
  const mem = d.layers.reduce((a, l) => a + (l.kind === 'group' ? 0 : l.canvas.width * l.canvas.height * 4 * (l.mask ? 2 : 1)), 0)
  const t = d.timeSpent
  const rows: [string, string][] = [
    ['Dimensiones', `${d.width} × ${d.height} px`],
    ['Tamaño de impresión', `${((d.width / d.dpi) * 2.54).toFixed(1)} × ${((d.height / d.dpi) * 2.54).toFixed(1)} cm a ${d.dpi} ppp`],
    ['Capas', `${d.layers.length}`],
    ['Memoria de capas', `${(mem / 1024 / 1024).toFixed(0)} MB`],
    ['Trazos', `${d.strokes}`],
    ['Tiempo dedicado', `${Math.floor(t / 3600)} h ${Math.floor((t % 3600) / 60)} min`],
    ['Creado', new Date(d.created).toLocaleString()],
  ]
  return (
    <Dialog onClose={onClose}>
      <h2>Información del lienzo</h2>
      <input className="field" value={name} onChange={(e) => setName(e.target.value)} onBlur={() => renameCurrent(name)} aria-label="Nombre de la obra" />
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px 16px' }}>
        {rows.map(([k, v]) => <Fragment key={k}><span className="label">{k}</span><span className="num">{v}</span></Fragment>)}
      </div>
      <button className="btn primary" onClick={() => { renameCurrent(name); onClose() }}>Hecho</button>
    </Dialog>
  )
}

export function ActionsPanel() {
  const [tab, setTab] = useState<Tab>('add')
  const [dialog, setDialog] = useState<null | 'timelapse' | 'info'>(null)
  const [busy, setBusy] = useState(false)
  const prefs = useStore((s) => s.prefs)
  const anim = useStore((s) => s.anim)
  const guides = useStore((s) => s.guides)
  const refOpen = useStore((s) => s.referenceOpen)
  const tl = useStore((s) => s.timelapse)
  const pages = useStore((s) => s.pages)
  const d = useStore((s) => s.doc)!
  const setPref = (patch: Partial<typeof prefs>) => set({ prefs: { ...prefs, ...patch } })
  const close = () => set({ panel: null })

  const task = async (label: string, fn: () => Promise<void> | void) => {
    setBusy(true)
    toast(label)
    try { await fn() } catch (e) { toast((e as Error).message || 'Algo salió mal') }
    setBusy(false)
  }

  const item = (Icon: any, label: string, fn: () => void, sub?: string, disabled = false) => (
    <button className="menu-item" disabled={disabled || busy} onClick={fn}><Icon size={18} /> <span>{label}</span>{sub && <span className="sub">{sub}</span>}</button>
  )

  const name = safeName(d.name)

  return (
    <Pop onClose={close} align="left" width={430} title="Acciones" anchor="actions">
      <div style={{ padding: '0 12px 8px' }}>
        <Seg value={tab} onChange={setTab} options={[['add', 'Añadir'], ['canvas', 'Lienzo'], ['share', 'Compartir'], ['video', 'Vídeo'], ['prefs', 'Prefs.'], ['help', 'Ayuda']]} />
      </div>
      <div className="pop-body">
        {tab === 'add' && <>
          {item(FileImage, 'Insertar un archivo', async () => { const [f] = await pickFile('image/*'); if (f) { close(); insertImage(f) } })}
          {item(Camera, 'Hacer una foto', async () => {
            const input = document.createElement('input')
            input.type = 'file'; input.accept = 'image/*'; input.setAttribute('capture', 'environment')
            input.onchange = () => { const f = input.files?.[0]; if (f) { close(); insertImage(f) } }
            input.click()
          })}
          {item(Type, 'Añadir texto', () => { close(); addTextLayer() })}
          <div className="divider" />
          {item(Scissors, 'Cortar', () => copy(true), 'Ctrl+X')}
          {item(Copy, 'Copiar', () => copy(), 'Ctrl+C')}
          {item(Layers, 'Copiar todo', () => copyMerged(), 'Ctrl+Mayús+C')}
          {item(ClipboardPaste, 'Pegar', () => { paste(); close() }, 'Ctrl+V', !hasClipboard())}
        </>}
        {tab === 'canvas' && <>
          {item(Crop, 'Recortar y redimensionar', () => { close(); editor.startCrop() })}
          {item(Maximize, 'Ajustar el lienzo al contenido', () => trimToContent())}
          <Switch label="Asistente de animación" sub="Cada capa o grupo es un fotograma" on={anim.enabled} onChange={(v) => { set({ anim: { ...anim, enabled: v, frame: 0, playing: false }, pages: { enabled: false, page: 0 } }); if (!v) editor.stop() }} />
          <Switch label="Asistente de página" sub="Cada capa o grupo es una página: catálogos, lookbooks, cómics" on={pages.enabled} onChange={(v) => { editor.stop(); set({ pages: { enabled: v, page: 0 }, anim: { ...anim, enabled: false, playing: false } }) }} />
          <Switch label="Guía de dibujo" on={guides.enabled} onChange={(v) => set({ guides: { ...guides, enabled: v } })} />
          {item(Ruler, 'Editar guía de dibujo', () => { set({ guides: { ...guides, enabled: true }, panel: 'guides', tool: 'guide' }) })}
          <Switch label="Referencia" sub="Ventana flotante con el lienzo o una imagen" on={refOpen} onChange={(v) => set({ referenceOpen: v })} />
          <div className="divider" />
          {item(FlipHorizontal2, 'Voltear lienzo horizontalmente', () => flipCanvas(true))}
          {item(FlipVertical2, 'Voltear lienzo verticalmente', () => flipCanvas(false))}
          {item(RotateCw, 'Rotar lienzo 90° a la derecha', () => { rotateCanvas(true); editor.fit() })}
          {item(RotateCcw, 'Rotar lienzo 90° a la izquierda', () => { rotateCanvas(false); editor.fit() })}
          {item(Info, 'Información del lienzo', () => setDialog('info'))}
        </>}
        {tab === 'share' && <>
          <div className="label" style={{ padding: '4px 10px' }}>Compartir imagen</div>
          {item(Download, 'Atelier', () => task('Preparando archivo…', async () => downloadBlob(await serializeDoc(d), `${name}.atelier`)), 'con capas')}
          {item(Download, 'PSD', () => task('Generando PSD…', () => downloadBlob(exportPsd(d), `${name}.psd`)), 'Photoshop')}
          {item(Download, 'PNG', () => task('Exportando PNG…', async () => downloadBlob(await exportImage(d, 'image/png'), `${name}.png`)), 'transparencia')}
          {item(Download, 'JPEG', () => task('Exportando JPEG…', async () => downloadBlob(await exportImage(d, 'image/jpeg', 0.93), `${name}.jpg`)))}
          {item(Download, 'WebP', () => task('Exportando WebP…', async () => downloadBlob(await exportImage(d, 'image/webp', 0.92), `${name}.webp`)))}
          {item(Download, 'PDF', () => task('Generando PDF…', async () => {
            const pt = (px: number) => (px / d.dpi) * 72
            let pagesOut: HTMLCanvasElement[]
            if (pages.enabled) {
              pagesOut = frameLayers(d).map((_, i) => {
                const c = makeCanvas(d.width, d.height)
                compositeDoc(d, c, { includeBg: true, anim: { frame: i, onionBefore: 0, onionAfter: 0, onionOpacity: 0, bgFrame: false, fgFrame: false, playing: true } })
                return c
              })
            } else {
              const c = makeCanvas(d.width, d.height)
              compositeDoc(d, c, { includeBg: true })
              pagesOut = [c]
            }
            downloadBlob(await buildPdf(pagesOut.map((c) => ({ canvas: c, widthPt: pt(d.width), heightPt: pt(d.height) })), d.name), `${name}.pdf`)
          }), pages.enabled ? 'todas las páginas' : 'imprimible')}
          {item(Download, 'TIFF', () => task('Exportando TIFF…', () => {
            const c = makeCanvas(d.width, d.height)
            compositeDoc(d, c, { includeBg: d.bgVisible })
            downloadBlob(buildTiff(c, d.dpi), `${name}.tif`)
          }), 'sin compresión')}
          <div className="label" style={{ padding: '8px 10px 4px' }}>Compartir capas</div>
          {item(Layers, 'Capas como PNG', () => task('Exportando capas…', async () => {
            const files = await exportLayersPng(d)
            for (const f of files) { downloadBlob(f.blob, `${name}-${f.name}`); await new Promise((r) => setTimeout(r, 250)) }
          }))}
          {item(Film, 'GIF animado', () => task('Generando GIF…', () => downloadBlob(exportGif(animFrames(d, anim, 800), anim.fps, anim.mode), `${name}.gif`)), `${anim.fps} fps`)}
          {item(Video, 'Vídeo animado', () => task('Grabando vídeo…', async () => downloadBlob(await exportVideo(animFrames(d, anim, 1080), anim.fps), `${name}.webm`)), 'WebM')}
        </>}
        {tab === 'video' && <>
          <Switch label="Grabar timelapse" sub="Graba un fotograma por trazo durante esta sesión" on={tl} onChange={(v) => set({ timelapse: v })} />
          {item(Play, 'Repetición del timelapse', () => setDialog('timelapse'), `${editor.timelapse.length} fotogramas`)}
          {item(Video, 'Exportar timelapse', () => task('Grabando timelapse…', async () => {
            if (!editor.timelapse.length) throw new Error('Aún no hay timelapse grabado')
            const frames = editor.timelapse.map((b) => { const c = makeCanvas(b.width, b.height); c.getContext('2d')!.drawImage(b, 0, 0); return c })
            downloadBlob(await exportVideo(frames, 30), `${name}-timelapse.webm`)
          }), 'WebM')}
          {item(RotateCcw, 'Borrar grabación', () => { editor.resetTimelapse(); toast('Timelapse borrado') })}
        </>}
        {tab === 'prefs' && <>
          <Switch label="Interfaz clara" on={prefs.light} onChange={(v) => setPref({ light: v })} />
          <Switch label="Interfaz para diestros" sub="Barra lateral a la derecha" on={prefs.rightHanded} onChange={(v) => setPref({ rightHanded: v })} />
          <Switch label="Contorno del pincel" on={prefs.brushCursor} onChange={(v) => setPref({ brushCursor: v })} />
          <Switch label="Escalado dinámico del pincel" sub="El tamaño se mantiene en pantalla al hacer zoom" on={prefs.dynamicScaling} onChange={(v) => setPref({ dynamicScaling: v })} />
          <div className="divider" />
          <div className="label" style={{ padding: '4px 10px' }}>Curva de presión</div>
          <PressureCurve />
          <div className="divider" />
          <div className="label" style={{ padding: '4px 10px' }}>Controles de gestos</div>
          <Switch label="Pintar con el dedo" sub="Desactívalo si usas lápiz: el dedo solo moverá el lienzo" on={prefs.touchPaint} onChange={(v) => setPref({ touchPaint: v })} />
          <Switch label="Toque con dos dedos para deshacer" sub="Tres dedos rehace, cuatro oculta la interfaz" on={prefs.tapUndo} onChange={(v) => setPref({ tapUndo: v })} />
          <Switch label="Mantener pulsado = cuentagotas" on={prefs.holdEyedropper} onChange={(v) => setPref({ holdEyedropper: v })} />
          <Switch label="QuickShape" sub="Mantén al final del trazo para convertirlo en forma" on={prefs.quickShape} onChange={(v) => setPref({ quickShape: v })} />
          <div style={{ padding: '4px 10px' }}>
            <HSlider name="Retardo de QuickShape" value={prefs.quickShapeDelay} min={250} max={1500} onChange={(v) => setPref({ quickShapeDelay: Math.round(v) })} format={(v) => `${(v / 1000).toFixed(2)} s`} />
          </div>
          <Switch label="Presión simulada con ratón" sub="Trazos al 70% en lugar de presión completa" on={prefs.mousePressure === 'speed'} onChange={(v) => setPref({ mousePressure: v ? 'speed' : 'full' })} />
        </>}
        {tab === 'help' && <div style={{ padding: '4px 10px', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 14px', fontSize: 13 }}>
          {([
            ['B / S / E', 'Pintar · Difuminar (Mayús+S) · Borrar'], ['L / C', 'Capas · Color'], ['V', 'Transformar'], ['S', 'Selección'],
            ['[ ]', 'Tamaño del pincel'], ['1–0', 'Opacidad del pincel'], ['Ctrl+Z', 'Deshacer'], ['Ctrl+Mayús+Z / Ctrl+Y', 'Rehacer'],
            ['Alt (mantener)', 'Cuentagotas'], ['Espacio + arrastrar', 'Mover el lienzo'], ['Ctrl + rueda', 'Zoom'], ['Alt + rueda', 'Rotar el lienzo'],
            ['Ctrl+0', 'Ajustar a la pantalla'], ['Ctrl+1', 'Tamaño real'], ['H', 'Voltear la vista'], ['Tab', 'Ocultar la interfaz'],
            ['Ctrl+J', 'Duplicar capa'], ['Ctrl+Mayús+N', 'Nueva capa'], ['Ctrl+E', 'Combinar abajo'], ['Ctrl+D', 'Deseleccionar'],
            ['Ctrl+Mayús+I', 'Invertir selección'], ['Supr', 'Borrar capa o selección'], ['Intro / Esc', 'Aplicar / cancelar'],
            ['2 dedos (toque)', 'Deshacer'], ['3 dedos (toque)', 'Rehacer'], ['4 dedos (toque)', 'Pantalla completa'], ['Pellizcar', 'Zoom y rotación'],
          ] as [string, string][]).map(([k, v]) => <Fragment key={k}><kbd className="num" style={{ color: 'var(--ink-3)', fontFamily: 'inherit' }}>{k}</kbd><span>{v}</span></Fragment>)}
        </div>}
        <div style={{ padding: '8px 10px 2px' }}>
          <span className="label"><PenLine size={12} style={{ verticalAlign: '-2px' }} /> Atelier guarda tus obras en este dispositivo.</span>
        </div>
      </div>
      {dialog === 'timelapse' && <TimelapsePlayer onClose={() => setDialog(null)} />}
      {dialog === 'info' && <CanvasInfo onClose={() => setDialog(null)} />}
    </Pop>
  )
}
