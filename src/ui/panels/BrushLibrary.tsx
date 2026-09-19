import { Copy, Plus, SlidersHorizontal, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { previewStroke } from '../../engine/brushEngine'
import { baseBrush, CATEGORIES, cloneBrush } from '../../engine/brushes'
import type { Brush } from '../../engine/types'
import { uid } from '../../engine/util'
import { get, set, toast, useStore } from '../../state/store'
import { Pop } from '../common'

const previewCache = new Map<string, string>()
export function brushPreview(b: Brush, w = 260, h = 56): string {
  const key = b.id + JSON.stringify(b).length + (b.custom ? JSON.stringify(b) : '') + w
  let u = previewCache.get(key)
  if (!u) {
    u = previewStroke(b, w, h).toDataURL()
    previewCache.set(key, u)
  }
  return u
}

const RECENT = 'Recientes'
const CUSTOM = 'Mis pinceles'

export function BrushLibrary() {
  const tool = useStore((s) => s.tool)
  const bt = tool === 'smudge' || tool === 'erase' ? tool : 'paint'
  const brushes = useStore((s) => s.brushes)
  const current = useStore((s) => s.toolBrush[bt])
  const recent = useStore((s) => s.recentBrushes)
  const cur = brushes.find((b) => b.id === current)
  const [cat, setCat] = useState<string>(cur?.category || CATEGORIES[0])
  const [ready, setReady] = useState(false)
  useEffect(() => { const id = requestAnimationFrame(() => setReady(true)); return () => cancelAnimationFrame(id) }, [])

  const cats = useMemo(() => {
    const c = [...CATEGORIES]
    if (brushes.some((b) => b.category === CUSTOM)) c.unshift(CUSTOM)
    if (recent.length) c.unshift(RECENT)
    return c
  }, [brushes, recent])

  const list = cat === RECENT ? recent.map((id) => brushes.find((b) => b.id === id)).filter(Boolean) as Brush[] : brushes.filter((b) => b.category === cat)

  const pick = (b: Brush) => {
    const s = get()
    set({
      toolBrush: { ...s.toolBrush, [bt]: b.id },
      recentBrushes: [b.id, ...s.recentBrushes.filter((x) => x !== b.id)].slice(0, 12),
    })
  }

  const createBrush = () => {
    const b = baseBrush()
    b.id = uid('brush')
    b.name = 'Pincel nuevo'
    b.category = CUSTOM
    b.custom = true
    set({ brushes: [...get().brushes, b], studioBrushId: b.id, panel: 'studio' })
    pick(b)
  }

  const duplicate = (b: Brush) => {
    const c = cloneBrush(b)
    c.id = uid('brush')
    c.name = b.name + ' copia'
    c.category = CUSTOM
    c.custom = true
    set({ brushes: [...get().brushes, c] })
    setCat(CUSTOM)
    pick(c)
    toast('Pincel duplicado en «Mis pinceles»')
  }

  const remove = (b: Brush) => {
    if (!b.custom || b.category !== CUSTOM) return
    const rest = get().brushes.filter((x) => x.id !== b.id)
    set({ brushes: rest })
    if (current === b.id) pick(rest[0])
  }

  const names: Record<string, string> = { paint: 'Pintar', smudge: 'Difuminar', erase: 'Borrar' }

  return (
    <Pop
      onClose={() => set({ panel: null })}
      width={560}
      anchor={bt}
      title={`Biblioteca de pinceles · ${names[bt]}`}
      actions={<button className="icon-btn" onClick={createBrush} aria-label="Crear pincel" title="Crear pincel"><Plus size={18} /></button>}
    >
      <div className="brush-lib">
        <div className="brush-cats">
          {cats.map((c) => (
            <button key={c} className={'brush-cat' + (c === cat ? ' on' : '')} onClick={() => setCat(c)}>{c}</button>
          ))}
        </div>
        <div className="brush-list">
          {list.map((b) => (
            <div key={b.id} className={'brush-item' + (b.id === current ? ' on' : '')} role="button" tabIndex={0} onClick={() => pick(b)} onKeyDown={(e) => e.key === 'Enter' && pick(b)}>
              <span className="bn">{b.name}</span>
              {ready ? <img alt="" src={brushPreview(b)} draggable={false} /> : <div style={{ height: 46 }} />}
              <div className="edit row" style={{ gap: 0 }}>
                <button className="icon-btn" title="Editar en Brush Studio" aria-label="Editar pincel" onClick={(e) => { e.stopPropagation(); pick(b); set({ studioBrushId: b.id, panel: 'studio' }) }}><SlidersHorizontal size={16} /></button>
                <button className="icon-btn" title="Duplicar" aria-label="Duplicar pincel" onClick={(e) => { e.stopPropagation(); duplicate(b) }}><Copy size={16} /></button>
                {b.category === CUSTOM && <button className="icon-btn" title="Eliminar" aria-label="Eliminar pincel" onClick={(e) => { e.stopPropagation(); remove(b) }}><Trash2 size={16} /></button>}
              </div>
            </div>
          ))}
          {!list.length && <p style={{ color: 'var(--ink-3)', padding: 12 }}>Aún no hay pinceles aquí.</p>}
        </div>
      </div>
    </Pop>
  )
}
