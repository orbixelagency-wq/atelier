import { Pause, Play, Plus, Settings2 } from 'lucide-react'
import { useState } from 'react'
import { frameLayers } from '../engine/compositor'
import type { Layer } from '../engine/types'
import { addLayer, duplicateLayer, selectLayer, updateLayer } from '../state/docOps'
import { editor } from '../state/editor'
import { set, useStore } from '../state/store'
import { HSlider, Seg, Switch, useCanvasImage } from './common'

function FrameThumb({ l, v }: { l: Layer; v: number }) {
  const url = useCanvasImage(l.kind === 'group' ? null : l.canvas, v, 120)
  return <div className="thumb">{url && <img src={url} alt="" draggable={false} />}</div>
}

export function Timeline() {
  const doc = useStore((s) => s.doc)!
  const anim = useStore((s) => s.anim)
  const v = useStore((s) => s.docVersion)
  useStore((s) => s.layersVersion)
  const [settings, setSettings] = useState(false)
  const frames = frameLayers(doc)
  const up = (p: Partial<typeof anim>) => set({ anim: { ...anim, ...p } })
  const cur = Math.min(anim.frame, frames.length - 1)

  const go = (i: number) => {
    editor.stop()
    up({ frame: i, playing: false })
    const f = frames[i]
    if (f) selectLayer(f.id)
  }

  return (
    <div className="timeline" onPointerDown={(e) => e.stopPropagation()}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div className="row" style={{ gap: 4 }}>
          <button className="btn" onClick={() => (anim.playing ? editor.stop() : editor.play())} aria-label={anim.playing ? 'Pausa' : 'Reproducir'}>
            {anim.playing ? <Pause size={16} /> : <Play size={16} />} {anim.playing ? 'Pausa' : 'Reproducir'}
          </button>
          <button className="btn ghost" onClick={() => setSettings(!settings)}><Settings2 size={16} /> Ajustes</button>
        </div>
        <div className="row" style={{ gap: 4 }}>
          <button className="btn ghost" onClick={() => { const f = frames[cur]; if (f) { duplicateLayer(f.id); up({ frame: cur + 1 }) } }}>Duplicar fotograma</button>
          <button className="btn" onClick={() => { const f = frames[frames.length - 1]; if (f) selectLayer(f.id); addLayer(undefined, `Fotograma ${frames.length + 1}`); up({ frame: frames.length }) }}><Plus size={16} /> Añadir fotograma</button>
        </div>
      </div>
      {settings && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '6px 20px' }}>
          <Seg value={anim.mode} onChange={(m) => up({ mode: m })} options={[['loop', 'Bucle'], ['pingpong', 'Ping-pong'], ['once', 'Una vez']]} />
          <HSlider name="Fotogramas por segundo" value={anim.fps} min={1} max={60} step={1} onChange={(f) => up({ fps: Math.round(f) })} format={(f) => `${Math.round(f)}`} />
          <HSlider name="Fotogramas de piel de cebolla" value={anim.onion} min={0} max={6} step={1} onChange={(f) => up({ onion: Math.round(f) })} format={(f) => `${Math.round(f)}`} />
          <HSlider name="Opacidad de piel de cebolla" value={anim.onionOpacity} onChange={(o) => up({ onionOpacity: o })} />
          <Switch label="Primer fotograma como fondo" on={anim.bgFrame} onChange={(b) => up({ bgFrame: b })} />
          <Switch label="Último fotograma como primer plano" on={anim.fgFrame} onChange={(b) => up({ fgFrame: b })} />
          {frames[cur] && <HSlider name="Retener este fotograma" value={frames[cur].hold || 0} min={0} max={24} step={1} onChange={(h) => updateLayer(frames[cur].id, { hold: Math.round(h) }, 'Retener fotograma')} format={(h) => `${Math.round(h)}`} />}
        </div>
      )}
      <div className="frames">
        {frames.map((f, i) => (
          <button key={f.id} className={'frame-cell' + (i === cur ? ' on' : '')} onClick={() => go(i)}>
            <FrameThumb l={f} v={v} />
            <span className="num">{i + 1}{f.hold ? ` +${f.hold}` : ''}{anim.bgFrame && i === 0 ? ' · fondo' : ''}{anim.fgFrame && i === frames.length - 1 ? ' · frente' : ''}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
