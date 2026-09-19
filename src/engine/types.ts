import type { Canvas } from './util'

export type BlendMode =
  | 'source-over' | 'multiply' | 'darken' | 'color-burn'
  | 'lighten' | 'screen' | 'color-dodge'
  | 'overlay' | 'soft-light' | 'hard-light'
  | 'difference' | 'exclusion' | 'lighter'
  | 'hue' | 'saturation' | 'color' | 'luminosity'

export const BLEND_GROUPS: { label: string; modes: [BlendMode, string, string][] }[] = [
  { label: 'Normal', modes: [['source-over', 'Normal', 'N']] },
  { label: 'Oscurecer', modes: [['multiply', 'Multiplicar', 'M'], ['darken', 'Oscurecer', 'Os'], ['color-burn', 'Subexponer color', 'Sc']] },
  { label: 'Aclarar', modes: [['lighten', 'Aclarar', 'Ac'], ['screen', 'Trama', 'T'], ['color-dodge', 'Sobreexponer color', 'Se'], ['lighter', 'Añadir', 'Añ']] },
  { label: 'Contraste', modes: [['overlay', 'Superponer', 'Su'], ['soft-light', 'Luz suave', 'Ls'], ['hard-light', 'Luz fuerte', 'Lf']] },
  { label: 'Diferencia', modes: [['difference', 'Diferencia', 'D'], ['exclusion', 'Exclusión', 'E']] },
  { label: 'Color', modes: [['hue', 'Tono', 'To'], ['saturation', 'Saturación', 'Sa'], ['color', 'Color', 'C'], ['luminosity', 'Luminosidad', 'L']] },
]

export const blendShort = (m: BlendMode) => {
  for (const g of BLEND_GROUPS) for (const [id, , s] of g.modes) if (id === m) return s
  return 'N'
}
export const blendName = (m: BlendMode) => {
  for (const g of BLEND_GROUPS) for (const [id, n] of g.modes) if (id === m) return n
  return 'Normal'
}

export interface TextMeta {
  text: string
  font: string
  size: number
  color: string
  align: 'left' | 'center' | 'right'
  bold: boolean
  italic: boolean
  tracking: number
  leading: number
  x: number
  y: number
  vertical?: boolean
  outline?: boolean
}

export interface GarmentMeta {
  garment: string
  views: 'front' | 'back' | 'both'
  areas: { view: 'front' | 'back'; x: number; y: number; w: number; h: number }[]
}

export interface Layer {
  id: string
  name: string
  kind: 'raster' | 'text' | 'group'
  canvas: Canvas
  visible: boolean
  opacity: number
  blend: BlendMode
  alphaLock: boolean
  clip: boolean
  locked: boolean
  reference: boolean
  mask: Canvas | null
  editMask: boolean
  parentId: string | null
  collapsed?: boolean
  text?: TextMeta
  hold?: number // animation: extra frames to hold
  garment?: GarmentMeta // set on the group a garment flat was inserted as
}

export interface Doc {
  id: string
  name: string
  width: number
  height: number
  dpi: number
  background: string
  bgVisible: boolean
  layers: Layer[] // index 0 = bottom
  activeId: string
  created: number
  timeSpent: number
  strokes: number
}

export interface DocSnapshot {
  layers: Layer[]
  activeId: string
  width: number
  height: number
  background: string
  bgVisible: boolean
}

// ---------------- Brushes ----------------
export type TipSource =
  | 'round' | 'soft' | 'square' | 'flat' | 'pencil' | 'charcoal' | 'chalk' | 'spray' | 'splatter'
  | 'bristle' | 'leaf' | 'star' | 'cloud' | 'grass' | 'dots' | 'hatch' | 'noise' | 'drop' | 'ring' | 'sparkle' | 'image'
  | 'stitch' | 'dstitch' | 'zigzag' | 'zipper' | 'rope' | 'overlock' | 'satin' | 'rivet'

export type GrainSource = 'none' | 'paper' | 'canvas' | 'noise' | 'charcoal' | 'watercolor' | 'halftone' | 'wood' | 'concrete'
  | 'twill' | 'knit' | 'rib' | 'corduroy' | 'leather' | 'fleece' | 'mesh'

export interface Brush {
  id: string
  name: string
  category: string
  custom?: boolean
  shape: {
    source: TipSource
    image?: string // dataURL for 'image'
    hardness: number // 0-1
    roundness: number // 0.05-1
    angle: number // degrees
    follow: number // 0-1 rotate along stroke direction
    rotJitter: number // 0-1
    scatter: number // 0-1 of size
    count: number // stamps per dab
    flipRandom: boolean
  }
  grain: {
    source: GrainSource
    scale: number // 0.1-4
    depth: number // 0-1
    zoomWithBrush: boolean
  }
  stroke: {
    spacing: number // fraction of size, 0.01-2
    jitter: number // lateral 0-1
    falloff: number // 0-1 opacity drop over length
    streamline: number // 0-1
    stabilization: number // 0-1
  }
  taper: {
    start: number // 0-1 length
    end: number
    size: number // 0-1 how much taper affects size
    opacity: number
    pressureTaper: boolean
  }
  render: {
    flow: number // 0-1
    mode: 'glaze' | 'build' | 'wash'
    blend: BlendMode
    wetEdges: number
    glow?: number // 0-1: soft halo plus a hot, near-white core
  }
  /** Dual brush: a second tip whose coverage masks the first. */
  dual?: { enabled: boolean; source: TipSource; scale: number; scatter: number; hardness: number }
  wet: {
    dilution: number
    charge: number
    pull: number // 0-1 picks up color underneath
    grade: number
  }
  color: {
    hue: number // per-stamp jitter 0-1
    sat: number
    bright: number
    strokeHue: number // per-stroke jitter
  }
  dynamics: {
    speedSize: number // -1..1
    speedOpacity: number
    sizeJitter: number
    opacityJitter: number
  }
  pencil: {
    pressureSize: number // 0-1
    pressureOpacity: number
    pressureFlow: number
    tiltSize: number
    tiltOpacity: number
    tiltAngle: boolean
  }
  props: {
    maxSize: number // px at 100%
    minSize: number // fraction 0-1
    maxOpacity: number
    minOpacity: number
    screenOrient: boolean
  }
}

export interface Palette { id: string; name: string; colors: (string | null)[] }

export type Tool = 'paint' | 'smudge' | 'erase' | 'select' | 'transform' | 'eyedropper' | 'liquify' | 'clone' | 'text' | 'crop' | 'guide' | 'filterPen' | 'measure' | 'zone'
export type BrushTool = 'paint' | 'smudge' | 'erase'
