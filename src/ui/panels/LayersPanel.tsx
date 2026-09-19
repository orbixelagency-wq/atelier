import {
  Check, ChevronDown, ChevronRight, Copy, Eye, FolderOpen, FolderPlus, Lock, Plus, Trash2, Unlock,
} from 'lucide-react'
import { useRef, useState } from 'react'
import { BLEND_GROUPS, blendShort, type Layer } from '../../engine/types'
import {
  addLayer, addMask, applyMask, clearLayer, copy, deleteLayer, duplicateLayer, fillLayer, flattenAll, flattenGroup, groupLayer,
  invertLayer, mergeDown, moveLayer, paste, removeMask, renameLayer, selectLayer, selectLayerContents, setBackground,
  setBlend, setLayerLive, toggleBackground, toggleLayer, ungroup, updateLayer,
} from '../../state/docOps'
import { commitFrom, snapshot } from '../../state/history'
import { get, set, useStore } from '../../state/store'
import { HSlider, Pop, useCanvasImage } from '../common'

function Thumb({ layer, version }: { layer: Layer; version: number }) {
  const url = useCanvasImage(layer.kind === 'group' ? null : layer.canvas, version, 120, true)
  const mask = useCanvasImage(layer.mask, version, 60)
  return (
    <div className="row" style={{ gap: 4 }}>
      <div
        className={'thumb checker' + (layer.mask && !layer.editMask ? ' mask-on' : '')}
        onClick={(e) => { if (layer.mask) { e.stopPropagation(); updateLayer(layer.id, { editMask: false }, 'Editar capa') } }}
      >
        {layer.kind === 'group' ? <div style={{ display: 'grid', placeItems: 'center', height: '100%', background: 'var(--chrome-solid)', color: 'var(--ink-2)' }}><FolderOpen size={18} /></div> : url && <img src={url} alt="" draggable={false} />}
      </div>
      {layer.mask && (
        <div className={'mask-thumb' + (layer.editMask ? ' on' : '')} title="Máscara de capa" onClick={(e) => { e.stopPropagation(); updateLayer(layer.id, { editMask: true }, 'Editar máscara') }}>
          {mask && <img src={mask} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} draggable={false} />}
        </div>
      )}
    </div>
  )
}

function BlendSheet({ layer, onClose }: { layer: Layer; onClose: () => void }) {
  const start = useRef(snapshot(get().doc!))
  return (
    <div style={{ padding: '4px 8px 10px', display: 'flex', flexDirection: 'column', gap: 10, borderTop: '1px solid var(--line)', marginTop: 4 }}>
      <HSlider
        name="Opacidad"
        value={layer.opacity}
        onChange={(v) => setLayerLive(layer.id, { opacity: v })}
        onCommit={() => { commitFrom('Opacidad de capa', start.current); start.current = snapshot(get().doc!) }}
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 4, maxHeight: 260, overflow: 'auto' }}>
        {BLEND_GROUPS.flatMap((g) => g.modes).map(([k, n]) => (
          <button key={k} className={'menu-item'} style={{ minHeight: 32, padding: '4px 10px', background: layer.blend === k ? 'var(--chalk-soft)' : undefined }} onClick={() => setBlend(layer.id, k)}>
            <span style={{ fontSize: 13 }}>{n}</span>
            {layer.blend === k && <Check size={14} style={{ marginLeft: 'auto' }} />}
          </button>
        ))}
      </div>
      <button className="btn ghost" onClick={onClose}>Cerrar</button>
    </div>
  )
}

function LayerMenu({ layer, onClose }: { layer: Layer; onClose: () => void }) {
  const [name, setName] = useState(layer.name)
  const it = (label: string, fn: () => void, on?: boolean, disabled?: boolean) => (
    <button className="menu-item" disabled={disabled} onClick={() => { fn(); onClose() }} style={{ minHeight: 34 }}>
      <span>{label}</span>
      {on !== undefined && <span className={'switch' + (on ? ' on' : '')} style={{ marginLeft: 'auto', transform: 'scale(0.8)' }} />}
    </button>
  )
  const group = layer.kind === 'group'
  return (
    <div style={{ padding: '6px 6px 8px', borderTop: '1px solid var(--line)', marginTop: 4 }}>
      <input
        className="field"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => name !== layer.name && renameLayer(layer.id, name)}
        onKeyDown={(e) => { if (e.key === 'Enter') { renameLayer(layer.id, name); onClose() } }}
        aria-label="Nombre de la capa"
        style={{ marginBottom: 6 }}
      />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
        {layer.kind === 'text' && it('Editar texto', () => { selectLayer(layer.id); set({ textEdit: { layerId: layer.id }, panel: 'text', tool: 'text' }) })}
        {!group && it('Seleccionar', () => selectLayerContents(layer.id))}
        {!group && it('Copiar', () => copy())}
        {it('Pegar', () => paste())}
        {!group && it('Rellenar capa', () => fillLayer())}
        {!group && it('Borrar', () => clearLayer())}
        {!group && it('Invertir', () => invertLayer())}
        {!group && it('Bloqueo alfa', () => toggleLayer(layer.id, 'alphaLock'), layer.alphaLock)}
        {it('Máscara de recorte', () => toggleLayer(layer.id, 'clip'), layer.clip)}
        {!group && it('Referencia', () => toggleLayer(layer.id, 'reference'), layer.reference)}
        {it('Bloquear', () => toggleLayer(layer.id, 'locked'), layer.locked)}
        {!group && !layer.mask && it('Máscara de capa', () => addMask(layer.id))}
        {layer.mask && it('Aplicar máscara', () => applyMask(layer.id))}
        {layer.mask && it('Eliminar máscara', () => removeMask(layer.id))}
        {!group && it('Combinar abajo', () => mergeDown(layer.id))}
        {it('Agrupar', () => groupLayer(layer.id))}
        {group && it('Aplanar grupo', () => flattenGroup(layer.id))}
        {group && it('Desagrupar', () => ungroup(layer.id))}
        {it('Aplanar todo', () => flattenAll())}
      </div>
    </div>
  )
}

interface Row { layer: Layer; depth: number }

function buildRows(layers: Layer[]): Row[] {
  const rows: Row[] = []
  const walk = (pid: string | null, depth: number) => {
    const kids = layers.filter((l) => l.parentId === pid)
    for (let i = kids.length - 1; i >= 0; i--) {
      rows.push({ layer: kids[i], depth })
      if (kids[i].kind === 'group' && !kids[i].collapsed) walk(kids[i].id, depth + 1)
    }
  }
  walk(null, 0)
  return rows
}

export function LayersPanel() {
  const doc = useStore((s) => s.doc)!
  const version = useStore((s) => s.docVersion)
  useStore((s) => s.layersVersion)
  const [menu, setMenu] = useState<{ id: string; kind: 'options' | 'blend' } | null>(null)
  const [drag, setDrag] = useState<{ id: string; over: string | null; place: 'above' | 'below' | 'into' } | null>(null)
  const list = useRef<HTMLDivElement>(null)
  const dragRef = useRef<typeof drag>(null)
  const rows = buildRows(doc.layers)

  const startDrag = (id: string, e: React.PointerEvent) => {
    const y0 = e.clientY
    let started = false
    const move = (ev: PointerEvent) => {
      if (!started && Math.abs(ev.clientY - y0) < 8) return
      started = true
      const el = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('[data-layer]') as HTMLElement | null
      if (!el) return
      const over = el.dataset.layer!
      const r = el.getBoundingClientRect()
      const t = (ev.clientY - r.top) / r.height
      const isGroup = doc.layers.find((l) => l.id === over)?.kind === 'group'
      const place = isGroup && t > 0.3 && t < 0.7 ? 'into' : t < 0.5 ? 'above' : 'below'
      dragRef.current = { id, over, place }
      setDrag(dragRef.current)
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      const d = dragRef.current
      dragRef.current = null
      setDrag(null)
      if (d && d.over && d.over !== d.id) moveLayer(d.id, d.over, d.place)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    dragRef.current = { id, over: null, place: 'above' }
    setDrag(dragRef.current)
  }

  return (
    <Pop
      onClose={() => set({ panel: null })}
      width={340}
      title="Capas"
      anchor="layers"
      actions={<>
        <button className="icon-btn" title="Nuevo grupo" aria-label="Nuevo grupo" onClick={() => groupLayer(doc.activeId)}><FolderPlus size={18} /></button>
        <button className="icon-btn" title="Nueva capa" aria-label="Nueva capa" onClick={() => addLayer()}><Plus size={20} /></button>
      </>}
    >
      <div className="pop-body" ref={list} style={{ maxHeight: 'calc(100vh - 140px)' }}>
        {rows.map(({ layer: l, depth }) => {
          const on = l.id === doc.activeId
          const dragCls = drag && drag.over === l.id && drag.id !== l.id ? ' drop-' + drag.place : ''
          return (
            <div key={l.id}>
              <div
                data-layer={l.id}
                className={'layer-row' + (on ? ' on' : '') + (l.clip ? ' clip' : '') + dragCls + (drag?.id === l.id && drag.over ? ' dragging' : '')}
                style={{ marginLeft: depth * 16 + (l.clip ? 14 : 0) }}
                onPointerDown={(e) => {
                  if ((e.target as HTMLElement).closest('button')) return
                  startDrag(l.id, e)
                }}
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest('button')) return
                  if (on) setMenu(menu?.id === l.id && menu.kind === 'options' ? null : { id: l.id, kind: 'options' })
                  else { selectLayer(l.id); setMenu(null) }
                }}
              >
                <div className="row" style={{ gap: 4 }}>
                  {l.kind === 'group' && (
                    <button className="icon-btn" style={{ width: 18, marginLeft: -6 }} aria-label={l.collapsed ? 'Expandir' : 'Contraer'} onClick={() => updateLayer(l.id, { collapsed: !l.collapsed }, 'Grupo')}>
                      {l.collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                    </button>
                  )}
                  <Thumb layer={l} version={version} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div className="layer-name" title={l.name}>{l.name}</div>
                  <div className="layer-meta">
                    {l.locked && <Lock size={11} />}
                    {l.alphaLock && <span>α</span>}
                    {l.reference && <span>Ref.</span>}
                    {l.editMask && l.mask && <span>Máscara</span>}
                    {l.kind === 'text' && <span>Texto</span>}
                    {l.opacity < 1 && <span className="num">{Math.round(l.opacity * 100)}%</span>}
                  </div>
                </div>
                <button className="blend-chip" onClick={() => setMenu(menu?.id === l.id && menu.kind === 'blend' ? null : { id: l.id, kind: 'blend' })} title="Modo de fusión y opacidad">{blendShort(l.blend)}</button>
                <button className={'vis' + (l.visible ? ' on' : '')} aria-label={l.visible ? 'Ocultar capa' : 'Mostrar capa'} onClick={() => toggleLayer(l.id, 'visible')}>
                  {l.visible && <Check size={13} strokeWidth={3} />}
                </button>
              </div>
              {on && menu?.id === l.id && menu.kind === 'options' && <LayerMenu layer={l} onClose={() => setMenu(null)} />}
              {menu?.id === l.id && menu.kind === 'blend' && <BlendSheet layer={l} onClose={() => setMenu(null)} />}
            </div>
          )
        })}
        <div className="layer-row" style={{ gridTemplateColumns: '52px 1fr auto auto' }}>
          <label className="thumb" style={{ background: doc.background, cursor: 'pointer' }} title="Color de fondo">
            <input type="color" value={doc.background} onChange={(e) => setBackground(e.target.value)} style={{ opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }} />
          </label>
          <div className="layer-name">Color de fondo</div>
          <span />
          <button className={'vis' + (doc.bgVisible ? ' on' : '')} aria-label="Mostrar fondo" onClick={() => toggleBackground()}>{doc.bgVisible && <Check size={13} strokeWidth={3} />}</button>
        </div>
        <div className="divider" />
        <div className="row" style={{ justifyContent: 'space-between', padding: '2px 4px' }}>
          <div className="row" style={{ gap: 2 }}>
            <button className="icon-btn" title="Bloquear/desbloquear" aria-label="Bloquear capa" onClick={() => toggleLayer(doc.activeId, 'locked')}>
              {doc.layers.find((l) => l.id === doc.activeId)?.locked ? <Unlock size={17} /> : <Lock size={17} />}
            </button>
            <button className="icon-btn" title="Duplicar" aria-label="Duplicar capa" onClick={() => duplicateLayer(doc.activeId)}><Copy size={17} /></button>
            <button className="icon-btn" title="Mostrar/ocultar" aria-label="Visibilidad" onClick={() => toggleLayer(doc.activeId, 'visible')}><Eye size={17} /></button>
          </div>
          <button className="icon-btn" title="Eliminar capa" aria-label="Eliminar capa" style={{ color: 'var(--danger)' }} onClick={() => deleteLayer(doc.activeId)}><Trash2 size={17} /></button>
        </div>
        <p className="label" style={{ padding: '4px 8px', fontWeight: 500 }}>
          {doc.layers.length} {doc.layers.length === 1 ? 'capa' : 'capas'} · toca la capa activa para ver sus opciones · arrastra para reordenar
        </p>
      </div>
    </Pop>
  )
}
