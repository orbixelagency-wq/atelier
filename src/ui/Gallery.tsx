import { Check, Copy, Download, Image as ImageIcon, Plus, Trash2, Upload } from 'lucide-react'
import { useEffect, useState } from 'react'
import { listArt, estimateUsage, renameArt, type ArtMeta } from '../engine/storage'
import { downloadBlob, pickFile } from '../engine/util'
import { duplicateArt, exportArtPsd, importFileAsNew, newCanvas, openArt, removeArt } from '../state/session'
import { toast, useStore } from '../state/store'
import { Dialog, Seg } from './common'

const PRESETS: { name: string; w: number; h: number; dpi: number }[] = [
  { name: 'Pantalla', w: window.screen.width * Math.min(2, devicePixelRatio || 1), h: window.screen.height * Math.min(2, devicePixelRatio || 1), dpi: 132 },
  { name: 'Cuadrado', w: 2048, h: 2048, dpi: 132 },
  { name: '4K', w: 3840, h: 2160, dpi: 132 },
  { name: 'A4 · 300 ppp', w: 2480, h: 3508, dpi: 300 },
  { name: 'A3 · 300 ppp', w: 3508, h: 4961, dpi: 300 },
  { name: 'Carta · 300 ppp', w: 2550, h: 3300, dpi: 300 },
  { name: 'Post de Instagram 4:5', w: 1080, h: 1350, dpi: 72 },
  { name: 'Historia 9:16', w: 1080, h: 1920, dpi: 72 },
  { name: 'Estampado para camiseta', w: 4500, h: 5400, dpi: 300 },
  { name: 'Diseño técnico de prenda', w: 4000, h: 3000, dpi: 300 },
  { name: 'Patrón repetible', w: 2400, h: 2400, dpi: 300 },
  { name: 'Cómic', w: 2063, h: 3150, dpi: 300 },
]

function NewCanvas({ onClose }: { onClose: () => void }) {
  const [custom, setCustom] = useState(false)
  const [unit, setUnit] = useState<'px' | 'cm' | 'in'>('px')
  const [w, setW] = useState(2048)
  const [h, setH] = useState(2048)
  const [dpi, setDpi] = useState(300)
  const [name, setName] = useState('')
  const [bg, setBg] = useState('#ffffff')
  const toPx = (v: number) => Math.round(unit === 'px' ? v : unit === 'cm' ? (v / 2.54) * dpi : v * dpi)
  const pw = toPx(w), ph = toPx(h)
  const mem = (pw * ph * 4) / 1024 / 1024
  const tooBig = pw > 8192 || ph > 8192
  if (!custom) return (
    <Dialog onClose={onClose}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2>Lienzo nuevo</h2>
        <button className="btn" onClick={() => setCustom(true)}><Plus size={15} /> Personalizado</button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {PRESETS.map((p) => (
          <button key={p.name} className="preset" onClick={() => { onClose(); newCanvas(p.w, p.h, p.dpi, p.name === 'Pantalla' ? undefined : p.name) }}>
            <span>{p.name}</span><span className="d">{Math.round(p.w)} × {Math.round(p.h)} px</span>
          </button>
        ))}
      </div>
    </Dialog>
  )
  return (
    <Dialog onClose={onClose}>
      <h2>Lienzo personalizado</h2>
      <input className="field" placeholder="Nombre (opcional)" value={name} onChange={(e) => setName(e.target.value)} />
      <Seg value={unit} onChange={setUnit} options={[['px', 'Píxeles'], ['cm', 'Centímetros'], ['in', 'Pulgadas']]} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        <label className="label">Ancho<input className="field num" type="number" min={1} value={w} onChange={(e) => setW(+e.target.value)} /></label>
        <label className="label">Alto<input className="field num" type="number" min={1} value={h} onChange={(e) => setH(+e.target.value)} /></label>
        <label className="label">ppp<input className="field num" type="number" min={36} max={1200} value={dpi} onChange={(e) => setDpi(+e.target.value)} /></label>
      </div>
      <label className="row" style={{ justifyContent: 'space-between' }}>
        <span>Color de fondo</span>
        <input type="color" value={bg} onChange={(e) => setBg(e.target.value)} style={{ width: 44, height: 30, border: 0, background: 'none' }} />
      </label>
      <p className="label num" style={{ margin: 0, color: tooBig ? 'var(--danger)' : undefined }}>
        {pw} × {ph} px · {mem.toFixed(0)} MB por capa{tooBig ? ' · el máximo es 8192 px por lado' : ''}
      </p>
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn ghost" onClick={() => setCustom(false)}>Atrás</button>
        <button className="btn primary" disabled={tooBig || pw < 16 || ph < 16} onClick={() => { onClose(); newCanvas(pw, ph, dpi, name || undefined, bg) }}>Crear</button>
      </div>
    </Dialog>
  )
}

export function Gallery() {
  const [items, setItems] = useState<ArtMeta[] | null>(null)
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [selecting, setSelecting] = useState(false)
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [creating, setCreating] = useState(false)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [usage, setUsage] = useState('')
  const toastMsg = useStore((s) => s.toast)

  const load = async () => {
    try {
      const a = await listArt()
      setItems(a)
      const u: Record<string, string> = {}
      for (const m of a) u[m.id] = URL.createObjectURL(m.thumb)
      setUrls((old) => { Object.values(old).forEach(URL.revokeObjectURL); return u })
      setUsage(await estimateUsage())
    } catch {
      setItems([])
      toast('El navegador no permite guardar obras (almacenamiento bloqueado)')
    }
  }
  useEffect(() => { load() }, [])

  const importFiles = async (accept: string) => {
    const files = await pickFile(accept)
    if (files[0]) importFileAsNew(files[0])
  }

  const toggle = (id: string) => {
    const n = new Set(sel)
    n.has(id) ? n.delete(id) : n.add(id)
    setSel(n)
  }

  return (
    <div className="gallery" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) importFileAsNew(f) }}>
      <header className="g-head">
        <div className="wordmark">Atelier<i /></div>
        <div className="g-actions">
          {!!items?.length && <button className="tb-btn" onClick={() => { setSelecting(!selecting); setSel(new Set()) }}>{selecting ? 'Cancelar' : 'Seleccionar'}</button>}
          <button className="tb-btn" onClick={() => importFiles('image/*,.psd,.atelier')} title="Importar imagen, PSD o archivo .atelier"><Upload size={18} /><span className="lbl">Importar</span></button>
          <button className="tb-btn" onClick={() => importFiles('image/*')} title="Abrir una foto"><ImageIcon size={18} /><span className="lbl">Foto</span></button>
          <button className="btn primary" onClick={() => setCreating(true)} aria-label="Lienzo nuevo"><Plus size={18} /> Nuevo</button>
        </div>
      </header>

      {items && !items.length && (
        <div className="g-empty">
          <div className="g-empty-inner">
            <h1>Tu estudio está vacío</h1>
            <p>Crea un lienzo para pintar o importa una foto, un PSD o el plano de una prenda para empezar a editar.</p>
            <div className="row" style={{ gap: 8 }}>
              <button className="btn primary" onClick={() => setCreating(true)}><Plus size={17} /> Lienzo nuevo</button>
              <button className="btn" onClick={() => importFiles('image/*,.psd,.atelier')}><Upload size={17} /> Importar</button>
            </div>
            <p style={{ color: 'var(--ink-3)', fontSize: 13 }}>Puedes arrastrar archivos aquí. Todo se guarda en este dispositivo.</p>
          </div>
        </div>
      )}

      {!!items?.length && (
        <div className="g-grid">
          {items.map((a) => (
            <div key={a.id} className={'art' + (sel.has(a.id) ? ' selected' : '')}>
              <button className="frame" onClick={() => (selecting ? toggle(a.id) : openArt(a.id))} aria-label={`Abrir ${a.name}`}>
                {urls[a.id] && <img src={urls[a.id]} alt="" draggable={false} />}
              </button>
              {selecting && <span className="tick" onClick={() => toggle(a.id)}>{sel.has(a.id) && <Check size={14} strokeWidth={3} />}</span>}
              <div className="meta">
                {renaming === a.id ? (
                  <input
                    className="field"
                    autoFocus
                    defaultValue={a.name}
                    onBlur={async (e) => { await renameArt(a.id, e.target.value.trim() || a.name); setRenaming(null); load() }}
                    onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                    style={{ height: 28, textAlign: 'center' }}
                  />
                ) : (
                  <button className="name" onClick={() => setRenaming(a.id)} title="Renombrar">{a.name}</button>
                )}
                <span className="dims num">{a.width} × {a.height} px</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {usage && !!items?.length && <p className="num" style={{ color: 'var(--ink-3)', fontSize: 12, padding: '0 30px 40px', margin: 0 }}>{usage}</p>}

      {selecting && sel.size > 0 && (
        <div className="bottombar selbar" style={{ position: 'fixed' }}>
          <span className="bb-btn num" style={{ pointerEvents: 'none' }}>{sel.size} seleccionadas</span>
          <button className="bb-btn" onClick={async () => { for (const id of sel) { const r = await exportArtPsd(id); if (r) downloadBlob(r.blob, `${r.name}.psd`) } }}><Download size={16} /> Compartir PSD</button>
          <button className="bb-btn" onClick={async () => { for (const id of sel) await duplicateArt(id); setSel(new Set()); load() }}><Copy size={16} /> Duplicar</button>
          <button className="bb-btn" style={{ color: 'var(--danger)' }} onClick={async () => {
            if (!confirm(`¿Eliminar ${sel.size} obra(s)? Esta acción no se puede deshacer.`)) return
            for (const id of sel) await removeArt(id)
            setSel(new Set()); setSelecting(false); load()
          }}><Trash2 size={16} /> Eliminar</button>
        </div>
      )}

      {creating && <NewCanvas onClose={() => setCreating(false)} />}
      {toastMsg && <div className="toast" style={{ position: 'fixed', top: 70 }} role="status">{toastMsg.text}</div>}
    </div>
  )
}
