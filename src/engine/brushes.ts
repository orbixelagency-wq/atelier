import type { Brush } from './types'

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? Partial<T[K]> : T[K] }

export function baseBrush(): Brush {
  return {
    id: '', name: '', category: '',
    shape: { source: 'round', hardness: 0.9, roundness: 1, angle: 0, follow: 0, rotJitter: 0, scatter: 0, count: 1, flipRandom: false },
    grain: { source: 'none', scale: 1, depth: 0.6, zoomWithBrush: false },
    stroke: { spacing: 0.08, jitter: 0, falloff: 0, streamline: 0.25, stabilization: 0 },
    taper: { start: 0.08, end: 0.08, size: 0.6, opacity: 0, pressureTaper: true },
    render: { flow: 1, mode: 'glaze', blend: 'source-over', wetEdges: 0, glow: 0 },
    wet: { dilution: 0, charge: 1, pull: 0, grade: 0 },
    color: { hue: 0, sat: 0, bright: 0, strokeHue: 0 },
    dynamics: { speedSize: 0, speedOpacity: 0, sizeJitter: 0, opacityJitter: 0 },
    pencil: { pressureSize: 0.7, pressureOpacity: 0, pressureFlow: 0, tiltSize: 0, tiltOpacity: 0, tiltAngle: false },
    props: { maxSize: 60, minSize: 0.02, maxOpacity: 1, minOpacity: 0, screenOrient: false },
  }
}

export function makeBrush(category: string, name: string, o: DeepPartial<Brush> = {}): Brush {
  const b = baseBrush()
  b.category = category
  b.name = name
  b.id = (category + '-' + name).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-')
  for (const k of Object.keys(o) as (keyof Brush)[]) {
    const v = o[k] as any
    if (v && typeof v === 'object' && !Array.isArray(v)) Object.assign((b as any)[k], v)
    else (b as any)[k] = v
  }
  return b
}

export const cloneBrush = (b: Brush): Brush => JSON.parse(JSON.stringify(b))

const C = {
  sketch: 'Bocetos', ink: 'Entintado', draw: 'Dibujo', paint: 'Pintura', art: 'Artístico', calli: 'Caligrafía',
  air: 'Aerógrafo', tex: 'Texturas', abs: 'Abstracto', char: 'Carboncillo', elem: 'Elementos', spray: 'Aerosoles',
  touch: 'Retoques', retro: 'Retro', lum: 'Luminancia', ind: 'Industrial', org: 'Orgánico', water: 'Agua',
}

export const CATEGORIES = Object.values(C)

export const DEFAULT_BRUSHES: Brush[] = [
  // Bocetos
  makeBrush(C.sketch, 'Lápiz HB', { shape: { source: 'pencil', hardness: 0.5 }, grain: { source: 'paper', depth: 0.7, scale: 0.8 }, stroke: { spacing: 0.05, streamline: 0.1 }, pencil: { pressureSize: 0.4, pressureOpacity: 0.8, tiltSize: 0.6 }, props: { maxSize: 14, minOpacity: 0.1 } }),
  makeBrush(C.sketch, 'Lápiz 6B', { shape: { source: 'pencil', hardness: 0.3 }, grain: { source: 'paper', depth: 0.8, scale: 1.2 }, stroke: { spacing: 0.05, streamline: 0.1 }, pencil: { pressureSize: 0.5, pressureOpacity: 0.7, tiltSize: 1 }, props: { maxSize: 28, minOpacity: 0.15 } }),
  makeBrush(C.sketch, 'Portaminas', { shape: { source: 'round', hardness: 0.95 }, grain: { source: 'paper', depth: 0.35 }, stroke: { spacing: 0.04, streamline: 0.2 }, pencil: { pressureSize: 0.2, pressureOpacity: 0.8 }, props: { maxSize: 6 } }),
  makeBrush(C.sketch, 'Boceto suelto', { shape: { source: 'chalk', hardness: 0.5 }, grain: { source: 'paper', depth: 0.6 }, stroke: { spacing: 0.06, jitter: 0.02 }, pencil: { pressureSize: 0.5, pressureOpacity: 0.6 }, props: { maxSize: 20, minOpacity: 0.2 } }),
  makeBrush(C.sketch, 'Grafito plano', { shape: { source: 'flat', hardness: 0.6, follow: 1 }, grain: { source: 'paper', depth: 0.8 }, stroke: { spacing: 0.03 }, pencil: { pressureOpacity: 0.9, pressureSize: 0.2, tiltSize: 1 }, props: { maxSize: 40 } }),
  makeBrush(C.sketch, 'Lápiz de color', { shape: { source: 'pencil', hardness: 0.6 }, grain: { source: 'paper', depth: 0.75, scale: 0.7 }, stroke: { spacing: 0.05 }, color: { bright: 0.04 }, pencil: { pressureSize: 0.3, pressureOpacity: 0.8 }, props: { maxSize: 16, minOpacity: 0.1 } }),

  // Entintado
  makeBrush(C.ink, 'Tinta técnica', { shape: { source: 'round', hardness: 1 }, stroke: { spacing: 0.03, streamline: 0.4 }, taper: { start: 0.05, end: 0.05, size: 0.4 }, pencil: { pressureSize: 0.3 }, props: { maxSize: 14 } }),
  makeBrush(C.ink, 'Rotulador', { shape: { source: 'round', hardness: 1 }, stroke: { spacing: 0.03, streamline: 0.45 }, taper: { start: 0, end: 0 }, pencil: { pressureSize: 0 }, props: { maxSize: 18 } }),
  makeBrush(C.ink, 'Pluma de estudio', { shape: { source: 'round', hardness: 1 }, stroke: { spacing: 0.02, streamline: 0.55 }, taper: { start: 0.15, end: 0.2, size: 0.95 }, pencil: { pressureSize: 0.85 }, props: { maxSize: 24, minSize: 0.05 } }),
  makeBrush(C.ink, 'Tinta seca', { shape: { source: 'chalk', hardness: 0.9 }, grain: { source: 'paper', depth: 0.5 }, stroke: { spacing: 0.04, streamline: 0.3 }, pencil: { pressureSize: 0.8 }, props: { maxSize: 22 } }),
  makeBrush(C.ink, 'Tinta derramada', { shape: { source: 'round', hardness: 0.85 }, stroke: { spacing: 0.03, streamline: 0.3 }, render: { wetEdges: 0.6 }, pencil: { pressureSize: 0.9 }, props: { maxSize: 30 } }),
  makeBrush(C.ink, 'Plumilla', { shape: { source: 'round', hardness: 1, roundness: 0.35, angle: 45 }, stroke: { spacing: 0.02, streamline: 0.4 }, taper: { start: 0.1, end: 0.15, size: 1 }, pencil: { pressureSize: 1 }, props: { maxSize: 16 } }),

  // Dibujo
  makeBrush(C.draw, 'Ceras', { shape: { source: 'chalk', hardness: 0.7 }, grain: { source: 'concrete', depth: 0.75, scale: 1.4 }, stroke: { spacing: 0.05 }, pencil: { pressureOpacity: 0.6, pressureSize: 0.3 }, props: { maxSize: 30, minOpacity: 0.3 } }),
  makeBrush(C.draw, 'Pastel', { shape: { source: 'chalk', hardness: 0.4 }, grain: { source: 'paper', depth: 0.9, scale: 1.5 }, stroke: { spacing: 0.06 }, wet: { pull: 0.1 }, pencil: { pressureOpacity: 0.7, pressureSize: 0.3 }, props: { maxSize: 50, minOpacity: 0.2 } }),
  makeBrush(C.draw, 'Conté', { shape: { source: 'square', hardness: 0.7, follow: 0.5 }, grain: { source: 'paper', depth: 0.85 }, stroke: { spacing: 0.04 }, pencil: { pressureOpacity: 0.7 }, props: { maxSize: 26 } }),
  makeBrush(C.draw, 'Oleo pastel', { shape: { source: 'bristle', hardness: 0.6, follow: 1 }, grain: { source: 'canvas', depth: 0.5 }, stroke: { spacing: 0.04 }, wet: { pull: 0.2 }, pencil: { pressureSize: 0.4 }, props: { maxSize: 45 } }),
  makeBrush(C.draw, 'Bolígrafo', { shape: { source: 'round', hardness: 0.98 }, stroke: { spacing: 0.03, streamline: 0.2 }, pencil: { pressureSize: 0.25, pressureOpacity: 0.3 }, props: { maxSize: 5 } }),

  // Pintura
  makeBrush(C.paint, 'Óleo redondo', { shape: { source: 'bristle', hardness: 0.7, follow: 1 }, grain: { source: 'canvas', depth: 0.35 }, stroke: { spacing: 0.03 }, wet: { pull: 0.35, charge: 0.8 }, render: { flow: 0.9 }, pencil: { pressureSize: 0.6, pressureOpacity: 0.3 }, props: { maxSize: 70 } }),
  makeBrush(C.paint, 'Gouache', { shape: { source: 'chalk', hardness: 0.8 }, grain: { source: 'paper', depth: 0.3 }, stroke: { spacing: 0.04 }, wet: { pull: 0.2 }, pencil: { pressureSize: 0.5, pressureOpacity: 0.4 }, props: { maxSize: 60 } }),
  makeBrush(C.paint, 'Acrílico plano', { shape: { source: 'flat', hardness: 0.7, follow: 1 }, grain: { source: 'canvas', depth: 0.4 }, stroke: { spacing: 0.02 }, wet: { pull: 0.25 }, pencil: { pressureSize: 0.3, pressureOpacity: 0.5 }, props: { maxSize: 80 } }),
  makeBrush(C.paint, 'Espátula', { shape: { source: 'square', hardness: 0.95, roundness: 0.25, follow: 1 }, stroke: { spacing: 0.02 }, wet: { pull: 0.55 }, pencil: { pressureSize: 0.3 }, props: { maxSize: 90 } }),
  makeBrush(C.paint, 'Pintura seca', { shape: { source: 'bristle', hardness: 0.5, follow: 1 }, grain: { source: 'charcoal', depth: 0.7 }, stroke: { spacing: 0.03 }, pencil: { pressureOpacity: 0.6 }, props: { maxSize: 70 } }),
  makeBrush(C.paint, 'Pintura suave', { shape: { source: 'soft', hardness: 0.35 }, stroke: { spacing: 0.05 }, wet: { pull: 0.15 }, render: { flow: 0.6 }, pencil: { pressureOpacity: 0.9, pressureSize: 0.3 }, props: { maxSize: 120 } }),

  // Artístico
  makeBrush(C.art, 'Impresionista', { shape: { source: 'leaf', hardness: 0.8, follow: 1, rotJitter: 0.1, scatter: 0.3 }, stroke: { spacing: 0.35 }, color: { hue: 0.03, bright: 0.08 }, pencil: { pressureSize: 0.5 }, props: { maxSize: 40 } }),
  makeBrush(C.art, 'Puntillismo', { shape: { source: 'dots', hardness: 0.9, rotJitter: 1, scatter: 0.4 }, stroke: { spacing: 0.5 }, color: { bright: 0.1, hue: 0.02 }, pencil: { pressureSize: 0.3 }, props: { maxSize: 50 } }),
  makeBrush(C.art, 'Tramado', { shape: { source: 'hatch', hardness: 0.9 }, stroke: { spacing: 0.3 }, pencil: { pressureOpacity: 0.8 }, props: { maxSize: 60 } }),
  makeBrush(C.art, 'Acuarela húmeda', { shape: { source: 'cloud', hardness: 0.3 }, grain: { source: 'watercolor', depth: 0.5 }, stroke: { spacing: 0.08 }, render: { flow: 0.25, wetEdges: 0.5, blend: 'multiply' }, wet: { pull: 0.2, dilution: 0.5 }, props: { maxSize: 140 } }),
  makeBrush(C.art, 'Pincel japonés', { shape: { source: 'bristle', hardness: 0.8, follow: 1 }, grain: { source: 'paper', depth: 0.4 }, stroke: { spacing: 0.02, streamline: 0.35 }, taper: { start: 0.2, end: 0.35, size: 1 }, pencil: { pressureSize: 1 }, props: { maxSize: 60 } }),

  // Caligrafía
  makeBrush(C.calli, 'Monoline', { shape: { source: 'round', hardness: 1 }, stroke: { spacing: 0.02, streamline: 0.6 }, taper: { start: 0, end: 0 }, pencil: { pressureSize: 0 }, props: { maxSize: 20 } }),
  makeBrush(C.calli, 'Script', { shape: { source: 'round', hardness: 1 }, stroke: { spacing: 0.02, streamline: 0.6 }, taper: { start: 0.05, end: 0.08, size: 0.8 }, pencil: { pressureSize: 1 }, props: { maxSize: 30, minSize: 0.08 } }),
  makeBrush(C.calli, 'Cincel', { shape: { source: 'flat', hardness: 1, angle: 40 }, stroke: { spacing: 0.01, streamline: 0.5 }, pencil: { pressureSize: 0.2 }, props: { maxSize: 36 } }),
  makeBrush(C.calli, 'Pincel de letras', { shape: { source: 'round', hardness: 0.9 }, stroke: { spacing: 0.02, streamline: 0.7 }, taper: { start: 0.1, end: 0.15, size: 0.9 }, pencil: { pressureSize: 1 }, props: { maxSize: 44, minSize: 0.1 } }),
  makeBrush(C.calli, 'Tiza de pizarra', { shape: { source: 'chalk', hardness: 0.7 }, grain: { source: 'concrete', depth: 0.8 }, stroke: { spacing: 0.04, streamline: 0.5 }, pencil: { pressureSize: 0.2 }, props: { maxSize: 30 } }),

  // Aerógrafo
  makeBrush(C.air, 'Aerógrafo suave', { shape: { source: 'soft', hardness: 0 }, stroke: { spacing: 0.05, streamline: 0.1 }, taper: { start: 0, end: 0 }, render: { flow: 0.12, mode: 'build' }, pencil: { pressureOpacity: 0.8, pressureSize: 0 }, props: { maxSize: 300 } }),
  makeBrush(C.air, 'Aerógrafo medio', { shape: { source: 'soft', hardness: 0.4 }, stroke: { spacing: 0.05 }, taper: { start: 0, end: 0 }, render: { flow: 0.2, mode: 'build' }, pencil: { pressureOpacity: 0.8, pressureSize: 0 }, props: { maxSize: 200 } }),
  makeBrush(C.air, 'Aerógrafo duro', { shape: { source: 'round', hardness: 0.8 }, stroke: { spacing: 0.05 }, taper: { start: 0, end: 0 }, render: { flow: 0.4, mode: 'build' }, pencil: { pressureOpacity: 0.8, pressureSize: 0 }, props: { maxSize: 150 } }),
  makeBrush(C.air, 'Pulverizador', { shape: { source: 'spray', hardness: 0.5, rotJitter: 1 }, stroke: { spacing: 0.1 }, taper: { start: 0, end: 0 }, render: { flow: 0.5, mode: 'build' }, pencil: { pressureOpacity: 0.8, pressureSize: 0.2 }, props: { maxSize: 200 } }),

  // Texturas
  makeBrush(C.tex, 'Semitono', { shape: { source: 'soft', hardness: 0.5 }, grain: { source: 'halftone', depth: 1, scale: 1 }, stroke: { spacing: 0.08 }, taper: { start: 0, end: 0 }, props: { maxSize: 200 } }),
  makeBrush(C.tex, 'Lona', { shape: { source: 'soft', hardness: 0.6 }, grain: { source: 'canvas', depth: 0.9, scale: 1 }, stroke: { spacing: 0.08 }, taper: { start: 0, end: 0 }, props: { maxSize: 200 } }),
  makeBrush(C.tex, 'Veta de madera', { shape: { source: 'soft', hardness: 0.6 }, grain: { source: 'wood', depth: 0.8, scale: 1 }, stroke: { spacing: 0.08 }, taper: { start: 0, end: 0 }, props: { maxSize: 250 } }),
  makeBrush(C.tex, 'Hormigón', { shape: { source: 'soft', hardness: 0.6 }, grain: { source: 'concrete', depth: 1, scale: 1.2 }, stroke: { spacing: 0.08 }, taper: { start: 0, end: 0 }, props: { maxSize: 250 } }),
  makeBrush(C.tex, 'Papel reciclado', { shape: { source: 'soft', hardness: 0.6 }, grain: { source: 'paper', depth: 1, scale: 2.5 }, stroke: { spacing: 0.08 }, taper: { start: 0, end: 0 }, props: { maxSize: 250 } }),

  // Abstracto
  makeBrush(C.abs, 'Anillos', { shape: { source: 'ring', hardness: 1, scatter: 0.6 }, stroke: { spacing: 0.9 }, dynamics: { sizeJitter: 0.7 }, color: { hue: 0.05 }, props: { maxSize: 80 } }),
  makeBrush(C.abs, 'Estrellas', { shape: { source: 'star', hardness: 1, rotJitter: 1, scatter: 0.8, count: 2 }, stroke: { spacing: 1.2 }, dynamics: { sizeJitter: 0.8 }, color: { hue: 0.08, bright: 0.2 }, props: { maxSize: 60 } }),
  makeBrush(C.abs, 'Confeti', { shape: { source: 'square', hardness: 1, rotJitter: 1, scatter: 1, count: 3, roundness: 0.5 }, stroke: { spacing: 1 }, dynamics: { sizeJitter: 0.8 }, color: { hue: 0.5, sat: 0.2 }, props: { maxSize: 30 } }),
  makeBrush(C.abs, 'Cristales', { shape: { source: 'sparkle', hardness: 1, rotJitter: 0.2, scatter: 0.5 }, stroke: { spacing: 0.8 }, dynamics: { sizeJitter: 0.6 }, render: { blend: 'screen' }, props: { maxSize: 60 } }),

  // Carboncillo
  makeBrush(C.char, 'Carbón vegetal', { shape: { source: 'charcoal', hardness: 0.5, rotJitter: 1 }, grain: { source: 'charcoal', depth: 0.8 }, stroke: { spacing: 0.05 }, pencil: { pressureOpacity: 0.7, pressureSize: 0.3, tiltSize: 1 }, props: { maxSize: 40, minOpacity: 0.2 } }),
  makeBrush(C.char, 'Carbón comprimido', { shape: { source: 'charcoal', hardness: 0.8, rotJitter: 1 }, grain: { source: 'paper', depth: 0.7 }, stroke: { spacing: 0.04 }, pencil: { pressureOpacity: 0.6, pressureSize: 0.3 }, props: { maxSize: 30, minOpacity: 0.3 } }),
  makeBrush(C.char, 'Barra de carbón', { shape: { source: 'square', hardness: 0.6, roundness: 0.3, follow: 1 }, grain: { source: 'charcoal', depth: 0.9 }, stroke: { spacing: 0.03 }, pencil: { pressureOpacity: 0.8 }, props: { maxSize: 70 } }),
  makeBrush(C.char, 'Sanguina', { shape: { source: 'chalk', hardness: 0.6 }, grain: { source: 'paper', depth: 0.85, scale: 1.3 }, stroke: { spacing: 0.05 }, pencil: { pressureOpacity: 0.7 }, props: { maxSize: 36 } }),

  // Elementos
  makeBrush(C.elem, 'Nubes', { shape: { source: 'cloud', hardness: 0.3, rotJitter: 1, scatter: 0.3 }, stroke: { spacing: 0.2 }, render: { flow: 0.5 }, dynamics: { sizeJitter: 0.4 }, props: { maxSize: 300 } }),
  makeBrush(C.elem, 'Hierba', { shape: { source: 'grass', hardness: 1, scatter: 0.5 }, stroke: { spacing: 0.25 }, color: { hue: 0.03, bright: 0.12 }, dynamics: { sizeJitter: 0.3 }, props: { maxSize: 90 } }),
  makeBrush(C.elem, 'Follaje', { shape: { source: 'leaf', hardness: 1, rotJitter: 1, scatter: 0.9, count: 3 }, stroke: { spacing: 0.4 }, color: { hue: 0.04, bright: 0.15, sat: 0.1 }, dynamics: { sizeJitter: 0.5 }, props: { maxSize: 60 } }),
  makeBrush(C.elem, 'Lluvia', { shape: { source: 'flat', hardness: 1, roundness: 0.08, angle: 80, scatter: 1, count: 4 }, stroke: { spacing: 0.5 }, dynamics: { sizeJitter: 0.6, opacityJitter: 0.5 }, props: { maxSize: 80 } }),
  makeBrush(C.elem, 'Nieve', { shape: { source: 'soft', hardness: 0.6, scatter: 1, count: 5 }, stroke: { spacing: 0.9 }, dynamics: { sizeJitter: 0.9, opacityJitter: 0.4 }, props: { maxSize: 20 } }),
  makeBrush(C.elem, 'Fuego', { shape: { source: 'soft', hardness: 0.3, scatter: 0.3 }, stroke: { spacing: 0.1 }, render: { flow: 0.4, blend: 'screen' }, color: { hue: 0.05, bright: 0.2 }, props: { maxSize: 120 } }),
  makeBrush(C.elem, 'Burbujas', { shape: { source: 'drop', hardness: 1, scatter: 1, count: 2 }, stroke: { spacing: 1.1 }, dynamics: { sizeJitter: 0.8 }, props: { maxSize: 70 } }),

  // Aerosoles
  makeBrush(C.spray, 'Bote fino', { shape: { source: 'spray', hardness: 0.5, rotJitter: 1 }, stroke: { spacing: 0.06 }, taper: { start: 0, end: 0 }, render: { flow: 0.8, mode: 'build' }, pencil: { pressureOpacity: 0.7, pressureSize: 0 }, props: { maxSize: 60 } }),
  makeBrush(C.spray, 'Bote ancho', { shape: { source: 'spray', hardness: 0.5, rotJitter: 1 }, stroke: { spacing: 0.06 }, taper: { start: 0, end: 0 }, render: { flow: 0.6, mode: 'build' }, pencil: { pressureOpacity: 0.7, pressureSize: 0 }, props: { maxSize: 220 } }),
  makeBrush(C.spray, 'Salpicaduras', { shape: { source: 'splatter', hardness: 1, rotJitter: 1, scatter: 0.4 }, stroke: { spacing: 0.7 }, dynamics: { sizeJitter: 0.5 }, taper: { start: 0, end: 0 }, props: { maxSize: 200 } }),
  makeBrush(C.spray, 'Goteo', { shape: { source: 'splatter', hardness: 1, rotJitter: 1, scatter: 0.2 }, stroke: { spacing: 0.5 }, render: { wetEdges: 0.4 }, props: { maxSize: 120 } }),

  // Retoques
  makeBrush(C.touch, 'Difuminar suave', { shape: { source: 'soft', hardness: 0.2 }, stroke: { spacing: 0.05 }, taper: { start: 0, end: 0 }, render: { flow: 0.5 }, pencil: { pressureOpacity: 0.6, pressureSize: 0 }, props: { maxSize: 150 } }),
  makeBrush(C.touch, 'Retoque piel', { shape: { source: 'soft', hardness: 0.1 }, stroke: { spacing: 0.04 }, taper: { start: 0, end: 0 }, render: { flow: 0.25, mode: 'build' }, pencil: { pressureOpacity: 0.8, pressureSize: 0 }, props: { maxSize: 120 } }),
  makeBrush(C.touch, 'Borrador duro', { shape: { source: 'round', hardness: 1 }, stroke: { spacing: 0.04 }, taper: { start: 0, end: 0 }, pencil: { pressureSize: 0 }, props: { maxSize: 100 } }),
  makeBrush(C.touch, 'Poros', { shape: { source: 'noise', hardness: 0.6, rotJitter: 1 }, stroke: { spacing: 0.3 }, taper: { start: 0, end: 0 }, render: { flow: 0.3 }, props: { maxSize: 80 } }),

  // Retro
  makeBrush(C.retro, 'Trama de cómic', { shape: { source: 'square', hardness: 1 }, grain: { source: 'halftone', depth: 1, scale: 0.6 }, stroke: { spacing: 0.08 }, taper: { start: 0, end: 0 }, props: { maxSize: 150 } }),
  makeBrush(C.retro, 'Serigrafía', { shape: { source: 'chalk', hardness: 0.9 }, grain: { source: 'concrete', depth: 0.6 }, stroke: { spacing: 0.04 }, taper: { start: 0, end: 0 }, pencil: { pressureSize: 0.2 }, props: { maxSize: 80 } }),
  makeBrush(C.retro, 'Pixel', { shape: { source: 'square', hardness: 1 }, stroke: { spacing: 0.5, streamline: 0 }, taper: { start: 0, end: 0 }, pencil: { pressureSize: 0 }, props: { maxSize: 12 } }),
  makeBrush(C.retro, 'Tinta gastada', { shape: { source: 'round', hardness: 0.9 }, grain: { source: 'concrete', depth: 0.5 }, stroke: { spacing: 0.03, streamline: 0.3 }, pencil: { pressureSize: 0.7 }, props: { maxSize: 24 } }),

  // Luminancia
  makeBrush(C.lum, 'Neón', { shape: { source: 'soft', hardness: 0.6 }, stroke: { spacing: 0.04, streamline: 0.5 }, render: { blend: 'screen', glow: 1 }, props: { maxSize: 40 } }),
  makeBrush(C.lum, 'Bokeh', { shape: { source: 'soft', hardness: 0.8, scatter: 1, count: 2 }, stroke: { spacing: 1.5 }, render: { blend: 'screen', flow: 0.5 }, dynamics: { sizeJitter: 0.8, opacityJitter: 0.6 }, color: { hue: 0.04 }, props: { maxSize: 140 } }),
  makeBrush(C.lum, 'Destello', { shape: { source: 'sparkle', hardness: 1, rotJitter: 0.1 }, stroke: { spacing: 2 }, render: { blend: 'screen' }, dynamics: { sizeJitter: 0.6 }, props: { maxSize: 120 } }),
  makeBrush(C.lum, 'Luz suave', { shape: { source: 'soft', hardness: 0 }, stroke: { spacing: 0.05 }, taper: { start: 0, end: 0 }, render: { blend: 'screen', flow: 0.2, mode: 'build' }, props: { maxSize: 300 } }),

  // Industrial
  makeBrush(C.ind, 'Óxido', { shape: { source: 'splatter', hardness: 0.8, rotJitter: 1, scatter: 0.3 }, grain: { source: 'concrete', depth: 0.8 }, stroke: { spacing: 0.3 }, color: { bright: 0.1 }, props: { maxSize: 150 } }),
  makeBrush(C.ind, 'Metal rayado', { shape: { source: 'flat', hardness: 1, roundness: 0.05, rotJitter: 0.05, scatter: 0.6, count: 3 }, stroke: { spacing: 0.3 }, dynamics: { opacityJitter: 0.6 }, props: { maxSize: 120 } }),
  makeBrush(C.ind, 'Plantilla', { shape: { source: 'square', hardness: 1 }, grain: { source: 'noise', depth: 0.3 }, stroke: { spacing: 0.05 }, taper: { start: 0, end: 0 }, pencil: { pressureSize: 0 }, props: { maxSize: 100 } }),

  // Orgánico
  makeBrush(C.org, 'Bambú', { shape: { source: 'bristle', hardness: 0.9, follow: 1 }, stroke: { spacing: 0.02, streamline: 0.3 }, taper: { start: 0.15, end: 0.3, size: 1 }, pencil: { pressureSize: 1 }, props: { maxSize: 60 } }),
  makeBrush(C.org, 'Musgo', { shape: { source: 'noise', hardness: 0.6, rotJitter: 1, scatter: 0.5 }, stroke: { spacing: 0.3 }, color: { hue: 0.04, bright: 0.12 }, props: { maxSize: 90 } }),
  makeBrush(C.org, 'Ramas', { shape: { source: 'grass', hardness: 1, rotJitter: 1, scatter: 0.3 }, stroke: { spacing: 0.4 }, dynamics: { sizeJitter: 0.4 }, props: { maxSize: 100 } }),
  makeBrush(C.org, 'Corteza', { shape: { source: 'charcoal', hardness: 0.8, rotJitter: 1 }, grain: { source: 'wood', depth: 0.8 }, stroke: { spacing: 0.1 }, props: { maxSize: 100 } }),

  // Agua
  makeBrush(C.water, 'Aguada', { shape: { source: 'soft', hardness: 0.4 }, grain: { source: 'watercolor', depth: 0.4 }, stroke: { spacing: 0.06 }, render: { flow: 0.3, wetEdges: 0.6, blend: 'multiply' }, wet: { pull: 0.3, dilution: 0.6 }, props: { maxSize: 160 } }),
  makeBrush(C.water, 'Acuarela seca', { shape: { source: 'chalk', hardness: 0.5 }, grain: { source: 'watercolor', depth: 0.7 }, stroke: { spacing: 0.05 }, render: { flow: 0.45, blend: 'multiply' }, props: { maxSize: 90 } }),
  makeBrush(C.water, 'Gota de tinta', { shape: { source: 'drop', hardness: 0.9 }, stroke: { spacing: 0.8 }, render: { flow: 0.5, blend: 'multiply' }, dynamics: { sizeJitter: 0.4 }, props: { maxSize: 140 } }),
  makeBrush(C.water, 'Sal', { shape: { source: 'spray', hardness: 0.5, rotJitter: 1 }, stroke: { spacing: 0.3 }, render: { blend: 'screen', flow: 0.6 }, props: { maxSize: 120 } }),
]

export const DEFAULT_TOOL_BRUSH = {
  paint: 'entintado-pluma-de-estudio',
  smudge: 'retoques-difuminar-suave',
  erase: 'aerografo-aerografo-duro',
}
