// UI-level tool switching and mode handling shared by bars, panels and shortcuts.
import type { BrushTool, Tool } from '../engine/types'
import { editor } from '../state/editor'
import { get, set, type AdjustKind, type Panel } from '../state/store'

let pendingAdjust: { apply: () => void; cancel: () => void } | null = null
export function registerAdjust(h: typeof pendingAdjust) { pendingAdjust = h }

/** Apply whatever modal operation is open (transform, adjustment, liquify, lasso). */
export function finishModes() {
  if (editor.transform) editor.commitTransform()
  if (pendingAdjust) { const p = pendingAdjust; pendingAdjust = null; p.apply() }
  else if (get().adjust) set({ adjust: null })
  if (editor.lasso.length > 2) editor.finishLasso()
  else editor.cancelLasso()
  if (get().cropping) editor.endCrop()
}

export function cancelModes() {
  if (editor.transform) editor.cancelTransform()
  if (pendingAdjust) { const p = pendingAdjust; pendingAdjust = null; p.cancel() }
  set({ adjust: null })
  editor.cancelLasso()
  if (get().cropping) editor.endCrop()
}

export function isBrushTool(t: Tool): t is BrushTool {
  return t === 'paint' || t === 'smudge' || t === 'erase'
}

export function selectTool(t: Tool) {
  const s = get()
  if (isBrushTool(t) && s.tool === t && !s.adjust) {
    set({ panel: s.panel === 'brushes' ? null : 'brushes' })
    return
  }
  if (t === 'select' && s.tool === 'select') {
    finishModes()
    set({ tool: s.lastBrushTool, panel: null })
    return
  }
  if (t === 'transform' && s.tool === 'transform') {
    finishModes()
    set({ tool: s.lastBrushTool, panel: null })
    return
  }
  finishModes()
  set({ tool: t, panel: null, ...(isBrushTool(t) ? { lastBrushTool: t } : {}) })
  if (t === 'transform') {
    if (!editor.beginTransform()) set({ tool: s.lastBrushTool })
  }
  if (t === 'select') editor.resetSelectionTool()
}

export function togglePanel(p: Panel) {
  const s = get()
  if (p === 'adjust' || p === 'actions') finishModes()
  set({ panel: s.panel === p ? null : p })
}

export function openAdjust(kind: AdjustKind) {
  finishModes()
  const s = get()
  const L = s.doc?.layers.find((l) => l.id === s.doc!.activeId)
  if (!L || L.kind === 'group') { set({ panel: null }); return }
  set({ adjust: kind, panel: null, tool: kind === 'clone' ? 'paint' : s.tool })
}
