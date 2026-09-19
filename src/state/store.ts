import { create } from 'zustand'
import type { Brush, BrushTool, Doc, Palette, Tool } from '../engine/types'
import { DEFAULT_BRUSHES, DEFAULT_TOOL_BRUSH } from '../engine/brushes'
import type { HSV } from '../engine/util'
import type { Canvas } from '../engine/util'

export type Panel = null | 'brushes' | 'layers' | 'color' | 'actions' | 'adjust' | 'studio' | 'text' | 'guides' | 'fashion' | 'pattern' | 'measure' | 'zone'
export type SelectMode = 'auto' | 'free' | 'rect' | 'ellipse'
export type SelectOp = 'replace' | 'add' | 'subtract'
export type TransformMode = 'free' | 'uniform' | 'distort' | 'warp'
export type AdjustKind =
  | 'hsb' | 'balance' | 'curves' | 'gradientMap' | 'gaussian' | 'motion' | 'perspective' | 'sharpen' | 'noise'
  | 'liquify' | 'clone' | 'displace' | 'offset' | 'removebg' | 'bloom' | 'glitch' | 'halftone' | 'chromatic' | 'invert' | 'threshold' | 'posterize' | 'levels'

export interface View { zoom: number; rot: number; tx: number; ty: number; flip: boolean }

export interface Guides {
  enabled: boolean
  type: 'grid' | 'iso' | 'perspective' | 'symmetry'
  assisted: boolean
  gridSize: number
  color: string
  opacity: number
  thickness: number
  vps: { x: number; y: number }[] // perspective vanishing points (doc coords)
  symmetry: 'vertical' | 'horizontal' | 'quadrant' | 'radial'
  radial: number
  rotational: boolean
  center: { x: number; y: number } | null
}

export interface AnimSettings {
  enabled: boolean
  frame: number
  fps: number
  mode: 'loop' | 'pingpong' | 'once'
  onion: number
  onionOpacity: number
  bgFrame: boolean
  fgFrame: boolean
  playing: boolean
}

export interface Colorway { id: string; name: string; pairs: { from: string; to: string }[] }

export interface MeasureSettings { unit: 'cm' | 'in'; pxPerCm: number | null; color: string; calibrating: boolean }

export interface Prefs {
  light: boolean
  rightHanded: boolean
  brushCursor: boolean
  dynamicScaling: boolean
  pressureCurve: [number, number, number, number] // cubic bezier control points (x1,y1,x2,y2)
  touchPaint: boolean
  tapUndo: boolean
  holdEyedropper: boolean
  quickShape: boolean
  quickShapeDelay: number
  mousePressure: 'full' | 'speed'
  projectCanvas: boolean
}

export interface ColorState { primary: HSV; secondary: HSV }

export interface TextEdit { layerId: string | null }

export interface State {
  screen: 'gallery' | 'editor'
  doc: Doc | null
  docVersion: number
  layersVersion: number
  tool: Tool
  lastBrushTool: BrushTool
  toolBrush: Record<BrushTool, string>
  toolSize: Record<BrushTool, number> // 0-1
  toolOpacity: Record<BrushTool, number>
  brushes: Brush[]
  recentBrushes: string[]
  studioBrushId: string | null
  color: ColorState
  colorHistory: string[]
  palettes: Palette[]
  activePalette: string
  panel: Panel
  view: View
  selection: Canvas | null
  selVersion: number
  selectMode: SelectMode
  selectOp: SelectOp
  selectFeather: number
  autoThreshold: number
  savedSelections: Canvas[]
  transformMode: TransformMode
  transformSnap: boolean
  transformSmooth: boolean
  adjust: AdjustKind | null
  guides: Guides
  anim: AnimSettings
  prefs: Prefs
  canUndo: boolean
  canRedo: boolean
  uiHidden: boolean
  toast: { id: number; text: string } | null
  cloneSource: { x: number; y: number } | null
  referenceOpen: boolean
  referenceImage: string | null
  textEdit: TextEdit | null
  cropping: boolean
  colorDropThreshold: number
  liquifyMode: 'push' | 'twirlR' | 'twirlL' | 'pinch' | 'expand' | 'crystals' | 'edge' | 'reconstruct'
  liquify: { size: number; pressure: number; distortion: number; momentum: number }
  timelapse: boolean
  tileMode: boolean
  pages: { enabled: boolean; page: number }
  measure: MeasureSettings
  colorways: Colorway[]
  stacks: { id: string; name: string }[]
  fashionDialog: null | 'garment' | 'colorway' | 'techpack'
  zone: { mode: 'fill' | 'select'; tolerance: number }
  transformClamp: boolean
  showPrintAreas: boolean
  libraryCategory: string | null
}

const LS = 'atelier:'
function load<T>(k: string, d: T): T {
  try {
    const v = localStorage.getItem(LS + k)
    return v ? { ...d, ...JSON.parse(v) } : d
  } catch { return d }
}
function loadArr<T>(k: string, d: T[]): T[] {
  try {
    const v = localStorage.getItem(LS + k)
    return v ? JSON.parse(v) : d
  } catch { return d }
}
export function save(k: string, v: unknown) {
  try { localStorage.setItem(LS + k, JSON.stringify(v)) } catch { /* storage full or blocked */ }
}

function mergeBrushes(custom: Brush[]): Brush[] {
  const byId = new Map(custom.map((b) => [b.id, b]))
  const out = DEFAULT_BRUSHES.map((b) => byId.get(b.id) || b)
  for (const b of custom) if (!DEFAULT_BRUSHES.some((d) => d.id === b.id)) out.push(b)
  return out
}

const defaultPrefs: Prefs = {
  light: false,
  rightHanded: false,
  brushCursor: true,
  dynamicScaling: false,
  pressureCurve: [0.25, 0.25, 0.75, 0.75],
  touchPaint: true,
  tapUndo: true,
  holdEyedropper: true,
  quickShape: true,
  quickShapeDelay: 650,
  mousePressure: 'full',
  projectCanvas: false,
}

const defaultPalettes: Palette[] = [
  {
    id: 'default', name: 'Estudio', colors: [
      '#111111', '#3a3a3a', '#6b6b6b', '#a3a3a3', '#d6d6d6', '#ffffff',
      '#7a1f1f', '#c0392b', '#e8674a', '#f2a65a', '#f6d365', '#fbf1c7',
      '#1d3b2a', '#2e7d4f', '#6fbf73', '#a8d5a2', '#1b2a4a', '#2c5aa0',
      '#4f8fd6', '#9cc3f0', '#3d1f4a', '#7b3fa0', '#c17fd6', '#f0c9e0',
      '#5a3e2b', '#8b5e3c', '#c48a5a', '#e7c9a9', null, null,
    ],
  },
  { id: 'skin', name: 'Pieles', colors: ['#3b2219', '#5c3a2e', '#8d5524', '#a8703f', '#c68642', '#d6a37c', '#e0ac69', '#f1c27d', '#f6d7b0', '#ffe0bd', null, null] },
  { id: 'denim', name: 'Textil', colors: ['#1c2a3a', '#2f4560', '#50698a', '#8ea4bf', '#c8a97e', '#e6d5b8', '#f4efe6', '#2d2d2d', '#6e1e2b', '#3f5a36', null, null] },
]

export const useStore = create<State>(() => ({
  screen: 'gallery',
  doc: null,
  docVersion: 0,
  layersVersion: 0,
  tool: 'paint',
  lastBrushTool: 'paint',
  toolBrush: load('toolBrush', { ...DEFAULT_TOOL_BRUSH }),
  toolSize: load('toolSize', { paint: 0.3, smudge: 0.4, erase: 0.4 }),
  toolOpacity: load('toolOpacity', { paint: 1, smudge: 0.7, erase: 1 }),
  brushes: mergeBrushes(loadArr<Brush>('customBrushes', [])),
  recentBrushes: loadArr<string>('recentBrushes', []),
  studioBrushId: null,
  color: load('color', { primary: { h: 20, s: 0.75, v: 0.35 }, secondary: { h: 0, s: 0, v: 1 } }),
  colorHistory: loadArr<string>('colorHistory', []),
  palettes: loadArr<Palette>('palettes', defaultPalettes),
  activePalette: 'default',
  panel: null,
  view: { zoom: 1, rot: 0, tx: 0, ty: 0, flip: false },
  selection: null,
  selVersion: 0,
  selectMode: 'free',
  selectOp: 'replace',
  selectFeather: 0,
  autoThreshold: 0.25,
  savedSelections: [],
  transformMode: 'free',
  transformSnap: true,
  transformSmooth: true,
  adjust: null,
  guides: load<Guides>('guides', {
    enabled: false, type: 'grid', assisted: false, gridSize: 100, color: '#4fa3ff', opacity: 0.5, thickness: 1,
    vps: [], symmetry: 'vertical', radial: 6, rotational: false, center: null,
  }),
  anim: { enabled: false, frame: 0, fps: 12, mode: 'loop', onion: 2, onionOpacity: 0.35, bgFrame: false, fgFrame: false, playing: false },
  prefs: load('prefs', defaultPrefs),
  canUndo: false,
  canRedo: false,
  uiHidden: false,
  toast: null,
  cloneSource: null,
  referenceOpen: false,
  referenceImage: null,
  textEdit: null,
  cropping: false,
  colorDropThreshold: 0.3,
  liquifyMode: 'push',
  liquify: { size: 0.3, pressure: 0.6, distortion: 0.5, momentum: 0 },
  timelapse: true,
  tileMode: false,
  pages: { enabled: false, page: 0 },
  measure: { unit: 'cm', pxPerCm: null, color: '#e0443e', calibrating: false },
  colorways: loadArr<Colorway>('colorways', []),
  stacks: loadArr<{ id: string; name: string }>('stacks', []),
  fashionDialog: null,
  libraryCategory: null,
  zone: { mode: 'fill', tolerance: 0.3 },
  transformClamp: true,
  showPrintAreas: true,
}))

export const get = useStore.getState
export const set = useStore.setState

let toastId = 0
export function toast(text: string) {
  const id = ++toastId
  set({ toast: { id, text } })
  setTimeout(() => { if (get().toast?.id === id) set({ toast: null }) }, 2200)
}

// Persist a few user choices.
useStore.subscribe((s, p) => {
  if (s.toolBrush !== p.toolBrush) save('toolBrush', s.toolBrush)
  if (s.toolSize !== p.toolSize) save('toolSize', s.toolSize)
  if (s.toolOpacity !== p.toolOpacity) save('toolOpacity', s.toolOpacity)
  if (s.prefs !== p.prefs) save('prefs', s.prefs)
  if (s.palettes !== p.palettes) save('palettes', s.palettes)
  if (s.colorHistory !== p.colorHistory) save('colorHistory', s.colorHistory)
  if (s.color !== p.color) save('color', s.color)
  if (s.recentBrushes !== p.recentBrushes) save('recentBrushes', s.recentBrushes)
  if (s.guides !== p.guides) save('guides', { ...s.guides, vps: [], center: null })
  if (s.colorways !== p.colorways) save('colorways', s.colorways)
  if (s.stacks !== p.stacks) save('stacks', s.stacks)
  if (s.brushes !== p.brushes) save('customBrushes', s.brushes.filter((b) => b.custom))
})
