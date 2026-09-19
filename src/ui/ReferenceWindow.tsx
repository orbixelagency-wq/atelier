import { ImagePlus, Monitor, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { hexToHsv, pickFile, rgbToHex } from '../engine/util'
import { editor } from '../state/editor'
import { get, set, useStore } from '../state/store'

export function ReferenceWindow() {
  const img = useStore((s) => s.referenceImage)
  const version = useStore((s) => s.docVersion)
  const [box, setBox] = useState({ x: window.innerWidth - 300, y: 70, w: 260, h: 220 })
  const ref = useRef<HTMLCanvasElement>(null)
  const imgEl = useRef<HTMLImageElement | null>(null)

  useEffect(() => {
    if (img) {
      const i = new Image()
      i.onload = () => { imgEl.current = i; draw() }
      i.src = img
    } else { imgEl.current = null; draw() }
  }, [img])

  const draw = () => {
    const c = ref.current
    if (!c) return
    const src: CanvasImageSource = imgEl.current || editor.composite
    const sw = imgEl.current ? imgEl.current.width : editor.composite.width
    const sh = imgEl.current ? imgEl.current.height : editor.composite.height
    const W = box.w, H = box.h - 32
    c.width = W * 2
    c.height = H * 2
    const x = c.getContext('2d')!
    const k = Math.min((W * 2) / sw, (H * 2) / sh)
    x.fillStyle = '#fff'
    x.fillRect(0, 0, c.width, c.height)
    x.drawImage(src, (c.width - sw * k) / 2, (c.height - sh * k) / 2, sw * k, sh * k)
  }
  useEffect(() => { const id = setTimeout(draw, 60); return () => clearTimeout(id) }, [version, box.w, box.h])

  const dragStart = (e: React.PointerEvent, kind: 'move' | 'resize') => {
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    const s = { x: e.clientX, y: e.clientY, b: { ...box } }
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - s.x, dy = ev.clientY - s.y
      setBox(kind === 'move' ? { ...s.b, x: s.b.x + dx, y: s.b.y + dy } : { ...s.b, w: Math.max(160, s.b.w + dx), h: Math.max(140, s.b.h + dy) })
    }
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  return (
    <div className="floating" style={{ left: box.x, top: box.y, width: box.w, height: box.h }} onPointerDown={(e) => e.stopPropagation()}>
      <div className="fh" onPointerDown={(e) => { if (!(e.target as HTMLElement).closest('button')) dragStart(e, 'move') }}>
        <span>Referencia</span>
        <div className="row" style={{ gap: 0 }}>
          <button className="icon-btn" title="Mostrar el lienzo" aria-label="Mostrar el lienzo" onClick={() => set({ referenceImage: null })}><Monitor size={15} /></button>
          <button className="icon-btn" title="Importar imagen" aria-label="Importar imagen de referencia" onClick={async () => {
            const [f] = await pickFile('image/*')
            if (!f) return
            const r = new FileReader()
            r.onload = () => set({ referenceImage: r.result as string })
            r.readAsDataURL(f)
          }}><ImagePlus size={15} /></button>
          <button className="icon-btn" aria-label="Cerrar referencia" onClick={() => set({ referenceOpen: false })}><X size={15} /></button>
        </div>
      </div>
      <canvas
        ref={ref}
        style={{ flex: 1, width: '100%', height: 'calc(100% - 32px)', cursor: 'crosshair' }}
        title="Toca para tomar un color"
        onPointerDown={(e) => {
          const c = ref.current!
          const r = c.getBoundingClientRect()
          const px = c.getContext('2d')!.getImageData(((e.clientX - r.left) / r.width) * c.width, ((e.clientY - r.top) / r.height) * c.height, 1, 1).data
          set({ color: { ...get().color, primary: hexToHsv(rgbToHex({ r: px[0], g: px[1], b: px[2] })) } })
        }}
      />
      <div className="resize" onPointerDown={(e) => dragStart(e, 'resize')} />
    </div>
  )
}
