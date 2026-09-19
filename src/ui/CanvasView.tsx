import { useEffect, useRef } from 'react'
import { editor } from '../state/editor'
import { insertImage } from '../state/session'
import { get, set } from '../state/store'

export function CanvasView() {
  const host = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const h = host.current!, c = canvas.current!
    editor.attach(h, c)
    const ro = new ResizeObserver(() => editor.resize())
    ro.observe(h)
    const wheel = (e: WheelEvent) => editor.wheel(e)
    h.addEventListener('wheel', wheel, { passive: false })
    const prevent = (e: Event) => e.preventDefault()
    h.addEventListener('contextmenu', prevent)
    // iOS Safari: prevent page gestures
    h.addEventListener('gesturestart', prevent as EventListener)
    h.addEventListener('touchmove', prevent, { passive: false })
    return () => {
      ro.disconnect()
      h.removeEventListener('wheel', wheel)
      h.removeEventListener('contextmenu', prevent)
      h.removeEventListener('gesturestart', prevent as EventListener)
      h.removeEventListener('touchmove', prevent)
      editor.detach()
    }
  }, [])

  return (
    <div
      ref={host}
      className="stage"
      onPointerDown={(e) => {
        ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
        if (get().panel) { set({ panel: null }); return }
        editor.shiftKey = e.shiftKey
        editor.pointerDown(e.nativeEvent)
      }}
      onPointerMove={(e) => { editor.shiftKey = e.shiftKey; editor.pointerMove(e.nativeEvent) }}
      onPointerUp={(e) => editor.pointerUp(e.nativeEvent)}
      onPointerCancel={(e) => editor.pointerUp(e.nativeEvent)}
      onPointerLeave={() => editor.pointerLeave()}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault()
        const f = e.dataTransfer.files?.[0]
        if (f && f.type.startsWith('image/')) insertImage(f)
      }}
    >
      <canvas ref={canvas} />
    </div>
  )
}
