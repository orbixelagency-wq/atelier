import { useEffect } from 'react'
import { invertMask } from '../engine/selection'
import { addLayer, clearLayer, copy, copyMerged, deleteLayer, duplicateLayer, mergeDown, paste } from '../state/docOps'
import { editor } from '../state/editor'
import { setSelection } from '../state/history'
import { insertImage } from '../state/session'
import { get, set, useStore } from '../state/store'
import { cancelModes, finishModes, selectTool, togglePanel } from './actions'
import { CanvasView } from './CanvasView'
import { ActionsPanel } from './panels/ActionsPanel'
import { AdjustMenu, AdjustPanel } from './panels/AdjustPanel'
import { BrushLibrary } from './panels/BrushLibrary'
import { BrushStudio } from './panels/BrushStudio'
import { ColorPanel } from './panels/ColorPanel'
import { LayersPanel } from './panels/LayersPanel'
import { TextPanel } from './panels/TextPanel'
import { ReferenceWindow } from './ReferenceWindow'
import { SideBar } from './SideBar'
import { PageStrip, Timeline } from './Timeline'
import { CropBar, GuidesPanel, SelectionBar, TransformBar } from './ToolBars'
import { TopBar } from './TopBar'
import { FashionDialogs, FashionMenu, MeasureBar, PatternPanel } from './panels/Fashion'

function typing(e: KeyboardEvent) {
  const t = e.target as HTMLElement
  return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)
}

function useShortcuts() {
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      editor.key(e, true)
      if (typing(e)) return
      if ((e.key === 'Enter' || e.key === ' ') && (e.target as HTMLElement)?.closest?.('button, [role="slider"]')) return
      const s = get()
      const mod = e.ctrlKey || e.metaKey
      const k = e.key.toLowerCase()
      if (mod && k === 'z') { e.preventDefault(); e.shiftKey ? editor.redo() : editor.undo(); return }
      if (mod && k === 'y') { e.preventDefault(); editor.redo(); return }
      if (mod && k === 'c') { e.preventDefault(); e.shiftKey ? copyMerged() : copy(); return }
      if (mod && k === 'x') { e.preventDefault(); copy(true); return }
      if (mod && k === 'v') return // handled by paste event (images) or internal clipboard below
      if (mod && k === 'j') { e.preventDefault(); duplicateLayer(s.doc!.activeId); return }
      if (mod && e.shiftKey && k === 'n') { e.preventDefault(); addLayer(); return }
      if (mod && k === 'e') { e.preventDefault(); mergeDown(s.doc!.activeId); return }
      if (mod && k === 'd') { e.preventDefault(); if (s.selection) setSelection('Deseleccionar', null); return }
      if (mod && e.shiftKey && k === 'i') { e.preventDefault(); if (s.selection) setSelection('Invertir selección', invertMask(s.selection)); return }
      if (mod && k === 'a') { e.preventDefault(); const d = s.doc!; const m = document.createElement('canvas'); m.width = d.width; m.height = d.height; const x = m.getContext('2d')!; x.fillStyle = '#fff'; x.fillRect(0, 0, d.width, d.height); setSelection('Seleccionar todo', m); return }
      if (mod && k === '0') { e.preventDefault(); editor.fit(); return }
      if (mod && k === '1') { e.preventDefault(); editor.setZoom(1); return }
      if (mod && (k === '=' || k === '+')) { e.preventDefault(); editor.setZoom(s.view.zoom * 1.25); return }
      if (mod && k === '-') { e.preventDefault(); editor.setZoom(s.view.zoom / 1.25); return }
      if (mod) return
      if (e.key === 'Escape') { if (s.panel) set({ panel: null }); else cancelModes(); return }
      if (e.key === 'Enter') { finishModes(); if (s.tool === 'transform') set({ tool: s.lastBrushTool }); return }
      if (e.key === 'Tab') { e.preventDefault(); set({ uiHidden: !s.uiHidden }); return }
      if (e.key === 'Delete' || e.key === 'Backspace') { if (s.selection) clearLayer(); else if (e.key === 'Delete') deleteLayer(s.doc!.activeId); return }
      if (k === 'b') selectTool('paint')
      else if (k === 's' && e.shiftKey) selectTool('smudge')
      else if (k === 's') selectTool('select')
      else if (k === 'e') selectTool('erase')
      else if (k === 'v') selectTool('transform')
      else if (k === 'l') togglePanel('layers')
      else if (k === 'c') togglePanel('color')
      else if (k === 'h') editor.flipView()
      else if (k === 'r') editor.rotateView(e.shiftKey ? -Math.PI / 12 : Math.PI / 12)
      else if (k === 'i') editor.eyedropperOnce = true
      else if (k === '[' || k === ']') {
        const bt = s.tool === 'smudge' || s.tool === 'erase' ? s.tool : 'paint'
        const v = Math.max(0.005, Math.min(1, s.toolSize[bt] + (k === ']' ? 0.03 : -0.03)))
        set({ toolSize: { ...s.toolSize, [bt]: v } })
        editor.invalidate(false)
      } else if (/^[0-9]$/.test(k)) {
        const bt = s.tool === 'smudge' || s.tool === 'erase' ? s.tool : 'paint'
        set({ toolOpacity: { ...s.toolOpacity, [bt]: k === '0' ? 1 : +k / 10 } })
      }
    }
    const up = (e: KeyboardEvent) => editor.key(e, false)
    const onPaste = (e: ClipboardEvent) => {
      if (typing(e as any)) return
      const f = [...(e.clipboardData?.files || [])].find((x) => x.type.startsWith('image/'))
      if (f) { e.preventDefault(); insertImage(f) } else paste()
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('paste', onPaste)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('paste', onPaste)
    }
  }, [])
}

export function Editor() {
  useShortcuts()
  const panel = useStore((s) => s.panel)
  const tool = useStore((s) => s.tool)
  const adjust = useStore((s) => s.adjust)
  const uiHidden = useStore((s) => s.uiHidden)
  const right = useStore((s) => s.prefs.rightHanded)
  const anim = useStore((s) => s.anim.enabled)
  const pagesOn = useStore((s) => s.pages.enabled)
  const refOpen = useStore((s) => s.referenceOpen)
  const cropping = useStore((s) => s.cropping)
  const toast = useStore((s) => s.toast)
  const studio = useStore((s) => s.studioBrushId)

  const bottom = cropping ? <CropBar /> : panel === 'text' ? <TextPanel /> : panel === 'guides' ? <GuidesPanel /> : panel === 'pattern' ? <PatternPanel /> : panel === 'measure' ? <MeasureBar /> : adjust ? <AdjustPanel /> : tool === 'select' ? <SelectionBar /> : tool === 'transform' ? <TransformBar /> : null

  return (
    <div className={'editor' + (uiHidden ? ' hidden-ui' : '') + (right ? ' right-handed' : '')}>
      <CanvasView />
      <TopBar />
      <SideBar />
      {!uiHidden && bottom}
      {anim && !uiHidden && !bottom && <Timeline />}
      {pagesOn && !uiHidden && !bottom && <PageStrip />}
      {refOpen && <ReferenceWindow />}
      {panel === 'brushes' && <BrushLibrary />}
      {panel === 'studio' && studio && <BrushStudio />}
      {panel === 'layers' && <LayersPanel />}
      {panel === 'color' && <ColorPanel />}
      {panel === 'actions' && <ActionsPanel />}
      {panel === 'adjust' && <AdjustMenu />}
      {panel === 'fashion' && <FashionMenu />}
      <FashionDialogs />
      {toast && <div className="toast" key={toast.id} role="status">{toast.text}</div>}
    </div>
  )
}
