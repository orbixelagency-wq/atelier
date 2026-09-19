import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { clamp } from '../engine/util'

export function HSlider(props: {
  name: string
  value: number
  min?: number
  max?: number
  step?: number
  format?: (v: number) => string
  onChange: (v: number) => void
  onCommit?: (v: number) => void
}) {
  const { name, value, min = 0, max = 1, step = 0, format, onChange, onCommit } = props
  const rail = useRef<HTMLDivElement>(null)
  const last = useRef(value)
  const t = clamp((value - min) / (max - min))
  const fromEvent = (e: React.PointerEvent) => {
    const r = rail.current!.getBoundingClientRect()
    let v = min + clamp((e.clientX - r.left) / r.width) * (max - min)
    if (step) v = Math.round(v / step) * step
    last.current = v
    onChange(v)
  }
  const key = (e: React.KeyboardEvent) => {
    const s = step || (max - min) / 100
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); const v = clamp(value + s, min, max); onChange(v); onCommit?.(v) }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); const v = clamp(value - s, min, max); onChange(v); onCommit?.(v) }
  }
  return (
    <div className="hslider">
      <span className="name">{name}</span>
      <span className="val">{format ? format(value) : `${Math.round(t * 100)}%`}</span>
      <div
        className="rail"
        ref={rail}
        role="slider"
        tabIndex={0}
        aria-label={name}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        onKeyDown={key}
        onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture(e.pointerId); fromEvent(e) }}
        onPointerMove={(e) => { if (e.buttons || e.pressure) fromEvent(e) }}
        onPointerUp={() => onCommit?.(last.current)}
      >
        <div className="t" />
        <div className="f" style={{ width: `${t * 100}%` }} />
        <div className="tk" />
        <div className="th" style={{ left: `${t * 100}%` }} />
      </div>
    </div>
  )
}

export function Switch({ on, onChange, label, sub }: { on: boolean; onChange: (v: boolean) => void; label: ReactNode; sub?: ReactNode }) {
  return (
    <button className="check" role="switch" aria-checked={on} onClick={() => onChange(!on)} style={{ width: '100%' }}>
      <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left' }}>
        <span>{label}</span>
        {sub && <span style={{ color: 'var(--ink-3)', fontSize: 12 }}>{sub}</span>}
      </span>
      <span className={'switch' + (on ? ' on' : '')} />
    </button>
  )
}

export function Seg<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="seg" role="tablist">
      {options.map(([v, l]) => (
        <button key={v} role="tab" aria-selected={v === value} className={v === value ? 'on' : ''} onClick={() => onChange(v)}>{l}</button>
      ))}
    </div>
  )
}

/** Popover sheet anchored below the top bar. */
export function Pop({ children, onClose, align = 'right', width = 360, title, actions, anchor }: {
  children: ReactNode
  onClose: () => void
  align?: 'left' | 'right'
  width?: number
  title?: ReactNode
  actions?: ReactNode
  anchor?: string // data-anchor of the top-bar button that opened it
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [notch, setNotch] = useState<number | null>(null)
  useLayoutEffect(() => {
    const place = () => {
      const btn = anchor ? document.querySelector(`[data-anchor="${anchor}"]`) : null
      const pop = ref.current
      if (!btn || !pop) { setNotch(null); return }
      const b = btn.getBoundingClientRect(), p = pop.getBoundingClientRect()
      const x = b.left + b.width / 2 - p.left
      setNotch(x > 16 && x < p.width - 16 ? x : null)
    }
    place()
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [anchor, width])
  return (
    <>
      <div className="backdrop" onPointerDown={onClose} />
      <div className="pop" ref={ref} style={{ width, [align]: 10 }} onPointerDown={(e) => e.stopPropagation()}>
        {notch !== null && <span className="pop-notch" style={{ left: notch }} aria-hidden="true" />}
        <div className="clip">
          {(title || actions) && (
            <div className="pop-head">
              <div className="pop-title">{title}</div>
              <div className="row" style={{ gap: 2 }}>{actions}</div>
            </div>
          )}
          {children}
        </div>
      </div>
    </>
  )
}

export function useCanvasImage(canvas: HTMLCanvasElement | null | undefined, version: number, max = 96, boost = false) {
  const [url, setUrl] = useState('')
  useEffect(() => {
    if (!canvas) return
    const id = window.setTimeout(() => {
      const s = Math.min(1, max / Math.max(canvas.width, canvas.height))
      const c = document.createElement('canvas')
      c.width = Math.max(1, Math.round(canvas.width * s))
      c.height = Math.max(1, Math.round(canvas.height * s))
      const x = c.getContext('2d')!
      x.imageSmoothingQuality = 'high'
      x.drawImage(canvas, 0, 0, c.width, c.height)
      if (boost) {
        // thin strokes average away when downsampled; lift their coverage so the thumbnail shows them
        const d = x.getImageData(0, 0, c.width, c.height)
        for (let i = 3; i < d.data.length; i += 4) if (d.data[i]) d.data[i] = Math.min(255, d.data[i] * 4)
        x.putImageData(d, 0, 0)
      }
      setUrl(c.toDataURL())
    }, 120)
    return () => clearTimeout(id)
  }, [canvas, version, max, boost])
  return url
}

export function Dialog({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  return (
    <div className="dialog-wrap" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="dialog" role="dialog" aria-modal="true">{children}</div>
    </div>
  )
}

export const pct = (v: number) => `${Math.round(v * 100)}%`
