import { Redo2, Undo2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { clamp } from '../engine/util'
import { editor } from '../state/editor'
import { get, set, useStore } from '../state/store'

function VSlider({ value, onChange, label, format }: { value: number; onChange: (v: number) => void; label: string; format: (v: number) => string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(false)
  const start = useRef<{ y: number; v: number } | null>(null)
  const H = 138
  const move = (e: React.PointerEvent) => {
    if (!start.current) return
    // relative drag for fine control
    const dv = (start.current.y - e.clientY) / H
    onChange(clamp(start.current.v + dv, 0.001, 1))
  }
  return (
    <div
      ref={ref}
      className="vslider"
      role="slider"
      aria-label={label}
      aria-valuenow={Math.round(value * 100)}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'ArrowUp') onChange(clamp(value + 0.02, 0.001, 1))
        if (e.key === 'ArrowDown') onChange(clamp(value - 0.02, 0.001, 1))
      }}
      onPointerDown={(e) => {
        ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
        const r = ref.current!.getBoundingClientRect()
        const v = clamp(1 - (e.clientY - r.top - 6) / (r.height - 12), 0.001, 1)
        // jump when tapping away from the thumb
        const thumbY = r.top + 6 + (1 - value) * (r.height - 12)
        const nv = Math.abs(e.clientY - thumbY) > 14 ? v : value
        onChange(nv)
        start.current = { y: e.clientY, v: nv }
        setActive(true)
      }}
      onPointerMove={move}
      onPointerUp={() => { start.current = null; setActive(false) }}
      onPointerCancel={() => { start.current = null; setActive(false) }}
    >
      <div className="track"><div className="fill" style={{ height: `${value * 100}%` }} /></div>
      <div className="ticks" />
      <div className="thumb" style={{ bottom: `calc(6px + ${value} * (100% - 12px))` }} />
      {active && (
        <div className="bubble num" style={{ bottom: `calc(6px + ${value} * (100% - 12px))` }}>
          <span style={{ color: 'var(--ink-3)' }}>{label}</span> {format(value)}
        </div>
      )}
    </div>
  )
}

export function SideBar() {
  const tool = useStore((s) => s.tool)
  const adjust = useStore((s) => s.adjust)
  const bt = adjust === 'clone' ? 'paint' : tool === 'paint' || tool === 'smudge' || tool === 'erase' ? tool : useStore.getState().lastBrushTool
  const size = useStore((s) => s.toolSize[bt])
  const opacity = useStore((s) => s.toolOpacity[bt])
  const canUndo = useStore((s) => s.canUndo)
  const canRedo = useStore((s) => s.canRedo)
  const brushes = useStore((s) => s.brushes)
  const brushId = useStore((s) => s.toolBrush[bt])
  const brush = brushes.find((b) => b.id === brushId) || brushes[0]
  const [modOn, setModOn] = useState(false)
  const hold = useRef(0)

  const px = () => editor.sizePx(bt, brush.props.maxSize)

  return (
    <div className="sidebar" onPointerDown={(e) => e.stopPropagation()}>
      <VSlider
        label="Tamaño"
        value={size}
        onChange={(v) => { set({ toolSize: { ...get().toolSize, [bt]: v } }); editor.invalidate(false) }}
        format={() => `${Math.round(px())} px`}
      />
      <button
        className={'modify' + (modOn ? ' on' : '')}
        aria-label="Cuentagotas"
        title="Cuentagotas (mantén Alt)"
        onPointerDown={() => { setModOn(true); hold.current = Date.now() }}
        onPointerUp={() => {
          setModOn(false)
          editor.eyedropperOnce = true
        }}
      />
      <VSlider
        label="Opacidad"
        value={opacity}
        onChange={(v) => set({ toolOpacity: { ...get().toolOpacity, [bt]: v } })}
        format={(v) => `${Math.round(v * 100)}%`}
      />
      <button className="side-btn" disabled={!canUndo} onClick={() => editor.undo()} aria-label="Deshacer" title="Deshacer (Ctrl+Z)"><Undo2 size={18} /></button>
      <button className="side-btn" disabled={!canRedo} onClick={() => editor.redo()} aria-label="Rehacer" title="Rehacer (Ctrl+Mayús+Z)"><Redo2 size={18} /></button>
    </div>
  )
}
