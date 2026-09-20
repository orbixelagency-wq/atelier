// Technical flats, drawn as vectors. Each view lives in a 1000×1000 box with x = 500 as the
// centre line: outlines are authored as the right half and mirrored, so every garment is symmetric.
// Streetwear range: boxy and oversized fits, hoods, zips, workwear and accessories.
import { ctx2d, makeCanvas, type Canvas } from './util'

type Node = [number, number] | [number, number, number, number, number, number] // [x,y] line · [x,y,c1x,c1y,c2x,c2y] cubic
type DetailKind = 'line' | 'stitch' | 'zip' | 'thin' | 'rib' | 'dark'
interface Detail { d: string; kind: DetailKind; mirror?: boolean }
export interface View { outline: Node[]; details: Detail[]; print: [number, number, number, number]; pair?: boolean }
export interface Garment { id: string; name: string; group: string; front: View; back: View }

const m = (x: number) => 1000 - x
const P = (x: number, y: number): Node => [x, y]
const C = (x: number, y: number, c1x: number, c1y: number, c2x: number, c2y: number): Node => [x, y, c1x, c1y, c2x, c2y]

function symPath(nodes: Node[]): string {
  const [x0, y0] = nodes[0]
  let d = `M${x0} ${y0}`
  for (let i = 1; i < nodes.length; i++) {
    const n = nodes[i]
    d += n.length === 6 ? ` C${n[2]} ${n[3]} ${n[4]} ${n[5]} ${n[0]} ${n[1]}` : ` L${n[0]} ${n[1]}`
  }
  for (let i = nodes.length - 1; i >= 1; i--) {
    const n = nodes[i], p = nodes[i - 1]
    d += n.length === 6 ? ` C${m(n[4])} ${n[5]} ${m(n[2])} ${n[3]} ${m(p[0])} ${p[1]}` : ` L${m(p[0])} ${p[1]}`
  }
  return d + ' Z'
}

/** Closes the authored half on its own, for garments that come as a mirrored pair. */
function halfPath(nodes: Node[]): string {
  const [x0, y0] = nodes[0]
  let d = `M${x0} ${y0}`
  for (let i = 1; i < nodes.length; i++) {
    const n = nodes[i]
    d += n.length === 6 ? ` C${n[2]} ${n[3]} ${n[4]} ${n[5]} ${n[0]} ${n[1]}` : ` L${n[0]} ${n[1]}`
  }
  return d + ' Z'
}

const circle = (x: number, y: number, r: number) => `M${x - r} ${y} a${r} ${r} 0 1 0 ${r * 2} 0 a${r} ${r} 0 1 0 ${-r * 2} 0`
const across = (y: number, half: number, sag = 6) => `M${500 + half} ${y} C${500 + half * 0.6} ${y + sag} ${500 + half * 0.25} ${y + sag} 500 ${y + sag}`

// ---------------------------------------------------------------- tops
interface TopSpec {
  sy: number; nw: number; nd: number; ndb?: number; sh: number; ay: number; ch: number; hy: number; hh: number
  sleeve: 'short' | 'long' | 'none'
  sd?: number // shoulder drop: hooded garments carry the shoulder below the hood base
  hood?: { w: number; top: number }
  taperSide?: number
}

const shoulder = (s: TopSpec) => ({ x: 500 + s.sh, y: s.sy + (s.sd ?? 0) })
const armpit = (s: TopSpec) => ({ x: 500 + s.ch - 6, y: s.ay })
const cuffOuter = (s: TopSpec) => (s.sleeve === 'long'
  ? { x: 500 + s.sh + 150, y: shoulder(s).y + 578 }
  : { x: 500 + s.sh + 96, y: shoulder(s).y + 212 })
const cuffInner = (s: TopSpec) => (s.sleeve === 'long'
  ? { x: 500 + s.sh + 74, y: shoulder(s).y + 604 }
  : { x: 500 + s.sh + 6, y: shoulder(s).y + 256 })

function topOutline(s: TopSpec, back = false): Node[] {
  const n: Node[] = []
  const S = shoulder(s), A = armpit(s), co = cuffOuter(s), ci = cuffInner(s)
  if (s.hood) {
    const { w, top } = s.hood
    n.push(P(500, top))
    n.push(C(500 + w, s.sy - 12, 500 + w * 0.72, top, 500 + w, top + (s.sy - top) * 0.55))
    n.push(P(S.x, S.y))
  } else {
    const nd = back ? (s.ndb ?? Math.round(s.nd * 0.32)) : s.nd
    n.push(P(500, s.sy + nd))
    n.push(C(500 + s.nw, s.sy, 500 + s.nw * 0.5, s.sy + nd, 500 + s.nw * 0.86, s.sy + nd * 0.42))
    n.push(P(S.x, S.y))
  }
  if (s.sleeve === 'none') {
    n.push(C(A.x, A.y, S.x + 16, S.y + 120, A.x + 34, A.y - 120))
  } else {
    n.push(P(co.x, co.y))
    n.push(P(ci.x, ci.y))
    n.push(P(A.x, A.y))
  }
  const t = s.taperSide ?? 0
  n.push(C(500 + s.hh, s.hy, 500 + s.ch + 2, s.ay + (s.hy - s.ay) * 0.4, 500 + s.hh + t, s.ay + (s.hy - s.ay) * 0.82))
  n.push(C(500, s.hy + 8, 500 + s.hh * 0.74, s.hy + 10, 500 + s.hh * 0.32, s.hy + 8))
  return n
}

const armholeSeam = (s: TopSpec): Detail => {
  const S = shoulder(s), A = armpit(s)
  return { d: `M${S.x} ${S.y} C${S.x - 24} ${S.y + 70} ${A.x + 6} ${A.y - 80} ${A.x} ${A.y}`, kind: 'line', mirror: true }
}
const cuffBand = (s: TopSpec, depth = 62): Detail => {
  const co = cuffOuter(s), ci = cuffInner(s)
  const dx = shoulder(s).x - co.x, dy = shoulder(s).y - co.y
  const l = Math.hypot(dx, dy) || 1
  const ux = (dx / l) * depth, uy = (dy / l) * depth
  return { d: `M${Math.round(co.x + ux)} ${Math.round(co.y + uy)} L${Math.round(ci.x + ux)} ${Math.round(ci.y + uy)}`, kind: 'rib', mirror: true }
}
const sleeveHemStitch = (s: TopSpec): Detail => {
  const co = cuffOuter(s), ci = cuffInner(s)
  const dx = shoulder(s).x - co.x, dy = shoulder(s).y - co.y
  const l = Math.hypot(dx, dy) || 1
  const ux = (dx / l) * 26, uy = (dy / l) * 26
  return { d: `M${Math.round(co.x + ux)} ${Math.round(co.y + uy)} L${Math.round(ci.x + ux)} ${Math.round(ci.y + uy)}`, kind: 'stitch', mirror: true }
}
const hemBand = (s: TopSpec, depth = 62): Detail => ({ d: across(s.hy - depth, s.hh + 2, 5), kind: 'rib', mirror: true })
const hemStitch = (s: TopSpec): Detail => ({ d: across(s.hy - 30, s.hh + 1, 5), kind: 'stitch', mirror: true })
const neckBand = (s: TopSpec, back: boolean, depth = 30): Detail => {
  const nd = back ? (s.ndb ?? Math.round(s.nd * 0.32)) : s.nd
  return { d: `M500 ${s.sy + nd + depth} C${500 + s.nw * 0.62} ${s.sy + nd + depth} ${500 + s.nw + depth * 0.5} ${s.sy + nd * 0.5} ${500 + s.nw + depth * 0.62} ${s.sy - depth * 0.35}`, kind: 'rib', mirror: true }
}
const chestPrint = (s: TopSpec): [number, number, number, number] => {
  const w = Math.min(360, s.ch * 1.35)
  const top = s.sy + 150
  const h = Math.min(420, s.hy - 120 - top)
  return [500 - w / 2, top, w, h]
}

function top(spec: TopSpec, opts: { frontExtra?: Detail[]; backExtra?: Detail[]; band?: number; print?: [number, number, number, number] } = {}): { front: View; back: View } {
  const base = (back: boolean): Detail[] => {
    const d: Detail[] = []
    if (!spec.hood) d.push(neckBand(spec, back, opts.band ?? 30))
    d.push(armholeSeam(spec))
    d.push(spec.sleeve === 'long' ? sleeveHemStitch(spec) : sleeveHemStitch(spec))
    d.push(hemStitch(spec))
    return d
  }
  const print = opts.print || chestPrint(spec)
  return {
    front: { outline: topOutline(spec, false), details: [...base(false), ...(opts.frontExtra || [])], print },
    back: { outline: topOutline(spec, true), details: [...base(true), ...(opts.backExtra || [])], print },
  }
}

// ---------------------------------------------------------------- bottoms
interface PantSpec {
  wy: number; wh: number; band: number; hipY: number; hipH: number
  hy: number; outHalf: number; inHalf: number; crotchY: number
  cuff?: number
}
function pantOutline(s: PantSpec): Node[] {
  return [
    P(500, s.wy), P(500 + s.wh, s.wy), P(500 + s.wh + 4, s.wy + s.band),
    C(500 + s.hipH, s.hipY, 500 + s.wh + 22, s.wy + s.band + 40, 500 + s.hipH, s.hipY - 70),
    C(500 + s.outHalf, s.hy, 500 + s.hipH + 6, s.hipY + (s.hy - s.hipY) * 0.45, 500 + s.outHalf + 6, s.hipY + (s.hy - s.hipY) * 0.8),
    P(500 + s.inHalf, s.hy + 4),
    C(500, s.crotchY, 500 + s.inHalf - 10, s.hy - (s.hy - s.crotchY) * 0.45, 500 + (s.inHalf - 500 + 500) * 0.12 + 34, s.crotchY + 44),
  ]
}
const pantBase = (s: PantSpec): Detail[] => [
  { d: `M${m(500 + s.wh)} ${s.wy + s.band} L${500 + s.wh} ${s.wy + s.band}`, kind: 'line' },
  { d: `M${m(500 + s.wh - 10)} ${s.wy + 26} L${500 + s.wh - 10} ${s.wy + 26}`, kind: 'stitch' },
  { d: `M500 ${s.wy + s.band} L500 ${s.crotchY}`, kind: 'line' },
]
const cuffBandPant = (s: PantSpec): Detail => ({ d: `M${500 + s.outHalf - 2} ${s.hy - (s.cuff || 70)} L${500 + s.inHalf + 2} ${s.hy - (s.cuff || 70)}`, kind: 'rib', mirror: true })
const legPrint = (s: PantSpec): [number, number, number, number] => [500 + s.hipH - 216, s.hipY + 120, 150, 200]

function pant(spec: PantSpec, front: Detail[], back: Detail[]): { front: View; back: View } {
  const outline = pantOutline(spec)
  return {
    front: { outline, details: [...pantBase(spec), ...front], print: legPrint(spec) },
    back: { outline, details: [...pantBase(spec), ...back], print: legPrint(spec) },
  }
}

// ---------------------------------------------------------------- catalogue
const TEE = { sy: 152, nw: 88, nd: 52, sh: 252, ay: 332, ch: 212, hy: 880, hh: 216, sleeve: 'short' as const }
const TEE_OVER = { sy: 162, nw: 96, nd: 50, sh: 300, ay: 402, ch: 254, hy: 906, hh: 258, sleeve: 'short' as const }
const TEE_BOXY = { sy: 166, nw: 102, nd: 48, sh: 300, ay: 386, ch: 272, hy: 772, hh: 276, sleeve: 'short' as const }
const CREW = { sy: 152, nw: 100, nd: 46, sh: 264, ay: 344, ch: 224, hy: 878, hh: 214, sleeve: 'long' as const }
const CREW_BOXY = { sy: 162, nw: 108, nd: 44, sh: 300, ay: 378, ch: 270, hy: 792, hh: 264, sleeve: 'long' as const }
const HOOD = { sd: 34, sy: 182, nw: 108, nd: 60, sh: 292, ay: 392, ch: 262, hy: 900, hh: 256, sleeve: 'long' as const, hood: { w: 198, top: 46 } }
const HOOD_BOXY = { ...HOOD, sy: 190, sh: 306, ay: 394, ch: 280, hy: 800, hh: 274 }
const HOOD_CROP = { ...HOOD, hy: 646, hh: 258 }

const kangaroo: Detail = { d: 'M330 812 L374 640 Q382 618 404 618 L596 618 Q618 618 626 640 L670 812', kind: 'line' }
const kangarooStitch: Detail = { d: 'M346 804 L388 650 L612 650 L654 804', kind: 'stitch' }
const drawcords: Detail[] = [
  { d: 'M476 262 C468 330 462 380 470 438', kind: 'line' },
  { d: 'M524 262 C532 330 538 380 530 438', kind: 'line' },
  { d: circle(476, 256, 8), kind: 'thin' },
  { d: circle(524, 256, 8), kind: 'thin' },
]
const hoodOpening = (s: typeof HOOD): Detail[] => [
  { d: `M500 ${s.sy + 84} C${500 + s.hood!.w * 0.44} ${s.sy + 40} ${500 + s.hood!.w * 0.72} ${s.hood!.top + 74} ${500 + s.hood!.w * 0.52} ${s.hood!.top + 26} C${500 + s.hood!.w * 0.3} ${s.hood!.top + 2} 520 ${s.hood!.top + 2} 500 ${s.hood!.top + 4}`, kind: 'line', mirror: true },
  { d: `M500 ${s.sy + 66} C${500 + s.hood!.w * 0.38} ${s.sy + 26} ${500 + s.hood!.w * 0.6} ${s.hood!.top + 82} ${500 + s.hood!.w * 0.44} ${s.hood!.top + 44}`, kind: 'stitch', mirror: true },
  hoodSeam(s),
]
const hoodSeam = (s: typeof HOOD): Detail => ({
  d: `M${500 + s.hood!.w - 10} ${s.sy - 4} C${500 + s.hood!.w * 0.62} ${s.sy + 30} ${500 + s.hood!.w * 0.3} ${s.sy + 38} 500 ${s.sy + 38}`,
  kind: 'line', mirror: true,
})
const hoodBack = (s: typeof HOOD): Detail[] => [
  hoodSeam(s),
  { d: `M500 ${s.hood!.top + 6} L500 ${s.sy + 40}`, kind: 'line' },
  { d: `M500 ${s.sy + 40} C${500 + s.hood!.w * 0.6} ${s.sy + 38} ${500 + s.hood!.w * 0.92} ${s.sy + 26} ${500 + s.hood!.w} ${s.sy + 26}`, kind: 'line', mirror: true },
]
const zipLine = (top: number, bottom: number): Detail => ({ d: `M500 ${top} L500 ${bottom}`, kind: 'zip' })

function ribbed(spec: TopSpec, extraFront: Detail[] = [], extraBack: Detail[] = [], band = 66) {
  const t = top(spec, {
    frontExtra: [hemBand(spec, band), cuffBand(spec, band), ...extraFront],
    backExtra: [hemBand(spec, band), cuffBand(spec, band), ...extraBack],
  })
  return t
}

const tees: Garment[] = [
  { id: 'tee', name: 'Camiseta', group: 'Camisetas', ...top(TEE) },
  { id: 'tee-over', name: 'Camiseta oversize', group: 'Camisetas', ...top(TEE_OVER) },
  { id: 'tee-boxy', name: 'Camiseta boxy', group: 'Camisetas', ...top(TEE_BOXY) },
  {
    id: 'tee-ringer', name: 'Camiseta ringer', group: 'Camisetas',
    ...top({ ...TEE_OVER }, {
      frontExtra: [{ d: across(TEE_OVER.sy + 50 + 26, TEE_OVER.nw + 24, 8), kind: 'rib', mirror: true }, cuffBand(TEE_OVER, 40)],
      backExtra: [cuffBand(TEE_OVER, 40)],
      band: 34,
    }),
  },
  {
    id: 'longsleeve', name: 'Camiseta manga larga', group: 'Camisetas',
    ...top({ ...TEE_OVER, sleeve: 'long' }, { frontExtra: [cuffBand({ ...TEE_OVER, sleeve: 'long' }, 46)], backExtra: [cuffBand({ ...TEE_OVER, sleeve: 'long' }, 46)] }),
  },
  {
    id: 'tank', name: 'Camiseta de tirantes', group: 'Camisetas',
    ...top({ sy: 176, nw: 118, nd: 96, sh: 176, ay: 380, ch: 222, hy: 866, hh: 222, sleeve: 'none' }, { band: 26 }),
  },
  {
    id: 'shirt', name: 'Camisa', group: 'Camisetas',
    ...top({ ...TEE_OVER, nd: 26, nw: 74 }, {
      frontExtra: [
        { d: 'M500 202 L500 900', kind: 'line' },
        { d: 'M540 214 L540 890', kind: 'stitch' },
        { d: 'M500 226 L436 206 L452 272 L500 286 Z', kind: 'line', mirror: true },
        { d: 'M500 246 L452 226', kind: 'stitch', mirror: true },
        { d: circle(520, 340, 7), kind: 'thin' }, { d: circle(520, 470, 7), kind: 'thin' },
        { d: circle(520, 600, 7), kind: 'thin' }, { d: circle(520, 730, 7), kind: 'thin' },
        { d: 'M606 420 L706 420 L706 520 L606 520 Z', kind: 'line' },
      ],
      backExtra: [{ d: across(300, TEE_OVER.ch + 6, 10), kind: 'line', mirror: true }],
      band: 24,
      print: [340, 330, 320, 340],
    }),
  },
]

const sweats: Garment[] = [
  { id: 'crew', name: 'Sudadera cuello redondo', group: 'Sudaderas', ...ribbed(CREW) },
  { id: 'crew-boxy', name: 'Sudadera boxy', group: 'Sudaderas', ...ribbed(CREW_BOXY) },
  {
    id: 'hoodie', name: 'Sudadera con capucha', group: 'Sudaderas',
    ...ribbed(HOOD, [...hoodOpening(HOOD), ...drawcords, kangaroo, kangarooStitch], hoodBack(HOOD)),
  },
  {
    id: 'hoodie-boxy', name: 'Sudadera capucha boxy', group: 'Sudaderas',
    ...ribbed(HOOD_BOXY, [...hoodOpening(HOOD_BOXY), ...drawcords, { d: 'M330 712 L372 556 Q380 536 402 536 L598 536 Q620 536 628 556 L670 712', kind: 'line' }], hoodBack(HOOD_BOXY)),
  },
  {
    id: 'hoodie-zip', name: 'Sudadera con cremallera', group: 'Sudaderas',
    ...ribbed(HOOD, [...hoodOpening(HOOD), ...drawcords, zipLine(HOOD.sy + 84, HOOD.hy - 4),
      { d: 'M336 800 L372 660 L470 660 L470 800 Z', kind: 'line', mirror: true }], hoodBack(HOOD)),
  },
  {
    id: 'hoodie-fullzip', name: 'Sudadera cremallera completa', group: 'Sudaderas',
    ...ribbed(HOOD, [zipLine(HOOD.hood!.top + 10, HOOD.hy - 4),
      { d: `M500 ${HOOD.hood!.top + 10} C${500 + 70} ${HOOD.hood!.top + 14} ${500 + 130} ${HOOD.sy + 10} ${500 + HOOD.hood!.w - 6} ${HOOD.sy + 30}`, kind: 'line', mirror: true },
      { d: 'M336 800 L372 660 L470 660 L470 800 Z', kind: 'line', mirror: true }], hoodBack(HOOD)),
  },
  {
    id: 'hoodie-crop-zip', name: 'Sudadera corta con cremallera', group: 'Sudaderas',
    ...ribbed(HOOD_CROP, [...hoodOpening(HOOD_CROP), zipLine(HOOD_CROP.sy + 84, HOOD_CROP.hy - 4)], hoodBack(HOOD_CROP), 54),
  },
]

const JACKET = { sy: 158, nw: 96, nd: 44, sh: 276, ay: 352, ch: 238, hy: 872, hh: 232, sleeve: 'long' as const }
const jackets: Garment[] = [
  {
    id: 'fleece', name: 'Chaqueta polar', group: 'Chaquetas',
    ...ribbed(JACKET, [zipLine(JACKET.sy + 20, JACKET.hy - 4),
      { d: `M500 ${JACKET.sy + 20} C560 ${JACKET.sy + 4} 600 ${JACKET.sy - 40} ${500 + JACKET.nw + 10} ${JACKET.sy - 54}`, kind: 'line', mirror: true },
      { d: 'M596 560 L664 560 L664 690 L596 690', kind: 'line', mirror: true }],
      [{ d: across(300, JACKET.ch + 4, 8), kind: 'line', mirror: true }]),
  },
  {
    id: 'track', name: 'Chaqueta de chándal', group: 'Chaquetas',
    ...ribbed(JACKET, [zipLine(JACKET.sy + 10, JACKET.hy - 4),
      { d: `M500 ${JACKET.sy + 10} C556 ${JACKET.sy - 6} 594 ${JACKET.sy - 44} ${500 + JACKET.nw + 8} ${JACKET.sy - 58}`, kind: 'line', mirror: true },
      { d: `M${500 + JACKET.sh - 10} ${JACKET.sy + 16} C${500 + JACKET.sh + 40} ${JACKET.sy + 200} ${500 + JACKET.sh + 110} ${JACKET.sy + 420} ${500 + JACKET.sh + 132} ${JACKET.sy + 560}`, kind: 'stitch', mirror: true },
      { d: 'M588 600 L652 700', kind: 'line', mirror: true }], []),
  },
  {
    id: 'varsity', name: 'Chaqueta varsity', group: 'Chaquetas',
    ...ribbed({ ...JACKET, sh: 286, ch: 248 }, [
      { d: 'M500 178 L500 872', kind: 'line' },
      { d: circle(534, 300, 12), kind: 'thin' }, { d: circle(534, 420, 12), kind: 'thin' },
      { d: circle(534, 540, 12), kind: 'thin' }, { d: circle(534, 660, 12), kind: 'thin' },
      { d: `M500 206 C562 198 598 176 ${500 + JACKET.nw + 14} 150`, kind: 'rib', mirror: true },
      { d: 'M596 600 L668 690', kind: 'line', mirror: true },
      { d: `M${500 + 286 - 6} ${JACKET.sy + 24} C${500 + 286 + 40} ${JACKET.sy + 220} ${500 + 286 + 110} ${JACKET.sy + 430} ${500 + 286 + 130} ${JACKET.sy + 566}`, kind: 'line', mirror: true },
    ], []),
  },
  {
    id: 'workwear', name: 'Chaqueta workwear', group: 'Chaquetas',
    ...top({ ...JACKET, hy: 830, hh: 244, nd: 26, nw: 78 }, {
      frontExtra: [
        { d: 'M500 196 L500 826', kind: 'line' },
        { d: 'M448 196 L448 826', kind: 'stitch', mirror: true },
        { d: 'M500 220 L432 200 L448 266 L500 282 Z', kind: 'line', mirror: true },
        { d: 'M500 240 L450 220', kind: 'stitch', mirror: true },
        { d: circle(538, 330, 9), kind: 'thin' }, { d: circle(538, 450, 9), kind: 'thin' },
        { d: circle(538, 570, 9), kind: 'thin' }, { d: circle(538, 690, 9), kind: 'thin' },
        { d: 'M584 400 L714 400 L714 510 L584 510 Z', kind: 'line', mirror: true },
        { d: 'M584 620 L714 620 L714 760 L584 760 Z', kind: 'line', mirror: true },
        cuffBand({ ...JACKET, hy: 830 }, 50),
      ],
      backExtra: [{ d: across(330, JACKET.ch + 8, 10), kind: 'line', mirror: true }, cuffBand({ ...JACKET, hy: 830 }, 50)],
      band: 24,
    }),
  },
  {
    id: 'windbreaker', name: 'Cortavientos', group: 'Chaquetas',
    ...top({ ...HOOD, hy: 856, hh: 268 }, {
      frontExtra: [
        ...hoodOpening(HOOD),
        { d: 'M320 560 L680 560 L680 700 L320 700 Z', kind: 'line' },
        { d: 'M330 572 L670 572', kind: 'stitch' },
        { d: `M500 ${HOOD.sy + 96} L500 ${HOOD.sy + 190}`, kind: 'zip' },
        { d: across(486, 268, 6), kind: 'line', mirror: true },
        hemBand({ ...HOOD, hy: 856, hh: 268 }, 46),
        cuffBand({ ...HOOD, hy: 856 }, 46),
      ],
      backExtra: [...hoodBack(HOOD), hemBand({ ...HOOD, hy: 856, hh: 268 }, 46), cuffBand({ ...HOOD, hy: 856 }, 46)],
      print: [340, 300, 320, 220],
    }),
  },
  {
    id: 'puffer', name: 'Abrigo acolchado', group: 'Chaquetas',
    ...top({ ...HOOD, sh: 306, ch: 292, hy: 880, hh: 288, hood: { w: 214, top: 54 } }, {
      frontExtra: [
        ...hoodOpening({ ...HOOD, hood: { w: 214, top: 54 } } as typeof HOOD),
        zipLine(250, 872),
        { d: across(400, 290, 6), kind: 'line', mirror: true },
        { d: across(530, 292, 6), kind: 'line', mirror: true },
        { d: across(660, 292, 6), kind: 'line', mirror: true },
        { d: across(780, 290, 6), kind: 'line', mirror: true },
        { d: 'M580 700 L700 700', kind: 'line', mirror: true },
      ],
      backExtra: [...hoodBack({ ...HOOD, hood: { w: 168, top: 62 } } as typeof HOOD),
        { d: across(400, 290, 6), kind: 'line', mirror: true },
        { d: across(530, 292, 6), kind: 'line', mirror: true },
        { d: across(660, 292, 6), kind: 'line', mirror: true },
        { d: across(780, 290, 6), kind: 'line', mirror: true }],
      print: [360, 290, 280, 90],
    }),
  },
  {
    id: 'gilet', name: 'Chaleco acolchado', group: 'Chaquetas',
    ...top({ sy: 160, nw: 100, nd: 40, sh: 214, ay: 340, ch: 258, hy: 852, hh: 256, sleeve: 'none' }, {
      frontExtra: [
        zipLine(200, 846),
        { d: across(380, 256, 6), kind: 'line', mirror: true },
        { d: across(510, 258, 6), kind: 'line', mirror: true },
        { d: across(640, 258, 6), kind: 'line', mirror: true },
        { d: 'M578 700 L700 700', kind: 'line', mirror: true },
      ],
      backExtra: [
        { d: across(380, 256, 6), kind: 'line', mirror: true },
        { d: across(510, 258, 6), kind: 'line', mirror: true },
        { d: across(640, 258, 6), kind: 'line', mirror: true },
      ],
      band: 22,
      print: [370, 260, 260, 100],
    }),
  },
  {
    id: 'utility-gilet', name: 'Chaleco utility', group: 'Chaquetas',
    ...top({ sy: 160, nw: 100, nd: 40, sh: 214, ay: 340, ch: 262, hy: 828, hh: 262, sleeve: 'none' }, {
      frontExtra: [
        { d: 'M500 200 L500 822', kind: 'line' },
        { d: 'M566 300 L700 300 L700 430 L566 430 Z', kind: 'line', mirror: true },
        { d: 'M566 314 L700 314', kind: 'stitch', mirror: true },
        { d: 'M560 470 L712 470 L712 660 L560 660 Z', kind: 'line', mirror: true },
        { d: 'M560 486 L712 486', kind: 'stitch', mirror: true },
        { d: 'M580 700 L700 700 L700 790 L580 790 Z', kind: 'line', mirror: true },
      ],
      backExtra: [{ d: across(320, 262, 8), kind: 'line', mirror: true }],
      band: 22,
      print: [370, 250, 260, 60],
    }),
  },
]

const SWEATPANT: PantSpec = { wy: 110, wh: 196, band: 66, hipY: 360, hipH: 232, hy: 926, outHalf: 214, inHalf: 62, crotchY: 430, cuff: 76 }
const STRAIGHT: PantSpec = { wy: 110, wh: 192, band: 60, hipY: 360, hipH: 236, hy: 940, outHalf: 244, inHalf: 56, crotchY: 430 }
const CARGO: PantSpec = { wy: 110, wh: 200, band: 62, hipY: 366, hipH: 250, hy: 940, outHalf: 262, inHalf: 52, crotchY: 436 }
const JEAN: PantSpec = { wy: 112, wh: 188, band: 56, hipY: 352, hipH: 228, hy: 936, outHalf: 226, inHalf: 58, crotchY: 424 }
const SHORT: PantSpec = { wy: 110, wh: 196, band: 60, hipY: 340, hipH: 240, hy: 620, outHalf: 258, inHalf: 54, crotchY: 430 }

const drawcordPant: Detail[] = [
  { d: 'M482 176 C474 226 466 258 474 292', kind: 'line', mirror: true },
  { d: circle(482, 172, 7), kind: 'thin', mirror: true },
]
const backPockets: Detail[] = [{ d: 'M566 238 L672 238 L666 322 L572 322 Z', kind: 'line', mirror: true }, { d: 'M570 252 L668 252', kind: 'stitch', mirror: true }]

const pants: Garment[] = [
  { id: 'sweatpants', name: 'Pantalón de chándal', group: 'Pantalones', ...pant(SWEATPANT, [...drawcordPant, cuffBandPant(SWEATPANT)], [cuffBandPant(SWEATPANT), ...backPockets]) },
  { id: 'sweatpants-straight', name: 'Chándal recto', group: 'Pantalones', ...pant(STRAIGHT, [...drawcordPant], [...backPockets]) },
  {
    id: 'cargo', name: 'Pantalón cargo', group: 'Pantalones',
    ...pant(CARGO, [
      ...drawcordPant,
      { d: 'M596 430 L742 430 L748 596 L602 596 Z', kind: 'line', mirror: true },
      { d: 'M600 446 L744 446', kind: 'stitch', mirror: true },
      { d: 'M614 596 L732 596 L732 630 L614 630 Z', kind: 'line', mirror: true },
      { d: 'M540 196 C520 250 528 300 566 330', kind: 'stitch', mirror: true },
    ], [...backPockets, { d: 'M600 480 L740 480 L744 600 L604 600 Z', kind: 'line', mirror: true }]),
  },
  {
    id: 'carpenter', name: 'Pantalón carpenter', group: 'Pantalones',
    ...pant(CARGO, [
      { d: 'M500 176 L500 436', kind: 'line' },
      { d: 'M536 190 L536 430', kind: 'stitch' },
      { d: 'M614 430 L746 430 L750 560 L618 560 Z', kind: 'line', mirror: true },
      { d: 'M742 300 L742 430', kind: 'line' },
      { d: 'M758 300 L758 430', kind: 'line' },
      { d: 'M540 196 C520 250 528 300 566 330', kind: 'stitch', mirror: true },
    ], [...backPockets, { d: 'M690 470 L760 470 L762 600 L692 600 Z', kind: 'line' }]),
  },
  {
    id: 'jeans', name: 'Vaqueros', group: 'Pantalones',
    ...pant(JEAN, [
      { d: 'M500 168 L500 402', kind: 'stitch' },
      { d: 'M534 178 C540 270 536 340 528 400', kind: 'stitch' },
      { d: 'M534 168 C572 200 584 260 586 300', kind: 'line', mirror: true },
      { d: 'M598 178 L636 178 L640 236 L600 236 Z', kind: 'line' },
      { d: circle(596, 176, 7), kind: 'thin', mirror: true },
    ], [
      { d: 'M500 168 L500 240', kind: 'line' },
      { d: 'M378 226 L500 250 L622 226', kind: 'line' },
      { d: 'M566 286 L676 286 L666 372 L572 372 Z', kind: 'line', mirror: true },
      { d: 'M570 300 L672 300', kind: 'stitch', mirror: true },
    ]),
  },
  {
    id: 'shorts', name: 'Pantalón corto', group: 'Pantalones',
    ...pant(SHORT, [...drawcordPant, { d: 'M556 586 L752 564', kind: 'stitch', mirror: true }], [...backPockets, { d: 'M556 586 L752 564', kind: 'stitch', mirror: true }]),
  },
  {
    id: 'shorts-denim', name: 'Short vaquero', group: 'Pantalones',
    ...pant({ ...SHORT, hy: 600, outHalf: 250 }, [
      { d: 'M500 168 L500 402', kind: 'stitch' },
      { d: 'M534 168 C572 200 584 260 586 300', kind: 'line', mirror: true },
      { d: 'M552 568 L748 546', kind: 'stitch', mirror: true },
    ], [
      { d: 'M566 286 L676 286 L666 372 L572 372 Z', kind: 'line', mirror: true },
      { d: 'M552 568 L748 546', kind: 'stitch', mirror: true },
    ]),
  },
]

// ---------------------------------------------------------------- accessories
const cap: Garment = {
  id: 'cap', name: 'Gorra', group: 'Accesorios',
  front: {
    outline: [P(500, 196), C(772, 470, 662, 196, 760, 300), P(768, 548), C(700, 652, 790, 600, 762, 640), C(500, 694, 634, 676, 562, 694)],
    details: [
      { d: 'M768 548 C700 596 600 606 500 606', kind: 'line', mirror: true },
      { d: 'M500 204 C472 336 470 454 482 606', kind: 'line', mirror: true },
      { d: 'M742 594 C680 636 592 652 500 654', kind: 'stitch', mirror: true },
      { d: 'M718 622 C660 656 586 670 500 672', kind: 'stitch', mirror: true },
      { d: circle(500, 192, 13), kind: 'line' },
      { d: circle(636, 350, 9), kind: 'thin', mirror: true },
    ],
    print: [400, 420, 200, 140],
  },
  back: {
    outline: [P(500, 196), C(772, 470, 662, 196, 760, 300), P(776, 586), C(500, 596, 700, 596, 600, 596)],
    details: [
      { d: 'M404 592 Q500 444 596 592', kind: 'line' },
      { d: 'M382 556 L618 556 L618 590 L382 590 Z', kind: 'line' },
      { d: 'M500 204 L500 470', kind: 'line' },
      { d: 'M500 204 C598 274 678 384 710 514', kind: 'line', mirror: true },
      { d: circle(500, 192, 13), kind: 'line' },
    ],
    print: [410, 440, 180, 110],
  },
}

const trucker: Garment = {
  id: 'trucker', name: 'Gorra trucker', group: 'Accesorios',
  front: {
    outline: cap.front.outline,
    details: [...cap.front.details, { d: 'M500 204 C560 300 590 430 596 600', kind: 'line', mirror: true }],
    print: [400, 420, 200, 140],
  },
  back: {
    outline: cap.back.outline,
    details: [
      { d: 'M382 556 L618 556 L618 590 L382 590 Z', kind: 'line' },
      { d: 'M404 592 Q500 444 596 592', kind: 'line' },
      { d: 'M500 204 L500 470', kind: 'line' },
      ...Array.from({ length: 5 }, (_, i) => ({ d: `M${520 + i * 46} ${250 + i * 18} C${540 + i * 46} ${360} ${548 + i * 44} ${450} ${552 + i * 40} ${540}`, kind: 'thin' as const, mirror: true })),
      { d: circle(500, 192, 13), kind: 'line' },
    ],
    print: [410, 440, 180, 110],
  },
}

const beanie: Garment = {
  id: 'beanie', name: 'Gorro de punto', group: 'Accesorios',
  front: {
    outline: [P(500, 262), C(722, 520, 640, 262, 716, 380), P(726, 760), C(500, 786, 700, 782, 600, 786)],
    details: [
      { d: 'M724 618 C640 632 570 636 500 636', kind: 'line', mirror: true },
      ...Array.from({ length: 6 }, (_, i) => ({ d: `M${524 + i * 38} 640 L${524 + i * 38} 778`, kind: 'thin' as const, mirror: true })),
      { d: 'M500 640 L500 780', kind: 'thin' },
    ],
    print: [400, 660, 200, 100],
  },
  back: {
    outline: [P(500, 262), C(722, 520, 640, 262, 716, 380), P(726, 760), C(500, 786, 700, 782, 600, 786)],
    details: [
      { d: 'M724 618 C640 632 570 636 500 636', kind: 'line', mirror: true },
      ...Array.from({ length: 6 }, (_, i) => ({ d: `M${524 + i * 38} 640 L${524 + i * 38} 778`, kind: 'thin' as const, mirror: true })),
    ],
    print: [400, 660, 200, 100],
  },
}

const bucket: Garment = {
  id: 'bucket', name: 'Gorro bucket', group: 'Accesorios',
  front: {
    outline: [P(500, 288), C(690, 520, 616, 288, 686, 404), P(716, 560), C(846, 676, 800, 604, 838, 644), C(500, 716, 800, 712, 650, 716)],
    details: [
      { d: 'M716 560 C640 596 570 606 500 606', kind: 'line', mirror: true },
      { d: 'M812 656 C720 690 610 700 500 700', kind: 'stitch', mirror: true },
      { d: circle(660, 460, 8), kind: 'thin', mirror: true },
    ],
    print: [400, 380, 200, 180],
  },
  back: {
    outline: [P(500, 288), C(690, 520, 616, 288, 686, 404), P(716, 560), C(846, 676, 800, 604, 838, 644), C(500, 716, 800, 712, 650, 716)],
    details: [{ d: 'M716 560 C640 596 570 606 500 606', kind: 'line', mirror: true }, { d: 'M812 656 C720 690 610 700 500 700', kind: 'stitch', mirror: true }],
    print: [400, 380, 200, 180],
  },
}

const balaclava: Garment = {
  id: 'balaclava', name: 'Pasamontañas', group: 'Accesorios',
  front: {
    outline: [P(500, 180), C(716, 430, 636, 180, 710, 300), C(700, 760, 724, 560, 706, 690), C(500, 820, 660, 812, 580, 820)],
    details: [
      { d: 'M388 402 Q500 362 612 402 Q612 486 500 496 Q388 486 388 402 Z', kind: 'dark' },
      ...Array.from({ length: 7 }, (_, i) => ({ d: `M${514 + i * 30} 200 C${520 + i * 30} 420 ${520 + i * 30} 620 ${512 + i * 28} 810`, kind: 'thin' as const, mirror: true })),
      { d: 'M500 190 L500 810', kind: 'thin' },
    ],
    print: [410, 560, 180, 180],
  },
  back: {
    outline: [P(500, 180), C(716, 430, 636, 180, 710, 300), C(700, 760, 724, 560, 706, 690), C(500, 820, 660, 812, 580, 820)],
    details: [
      ...Array.from({ length: 7 }, (_, i) => ({ d: `M${514 + i * 30} 200 C${520 + i * 30} 420 ${520 + i * 30} 620 ${512 + i * 28} 810`, kind: 'thin' as const, mirror: true })),
      { d: 'M500 190 L500 810', kind: 'thin' },
    ],
    print: [410, 400, 180, 180],
  },
}

const sockShape: Node[] = [
  P(556, 210), P(688, 210), P(696, 560),
  C(836, 726, 706, 660, 812, 676),
  C(846, 806, 856, 754, 856, 782),
  C(690, 812, 812, 828, 736, 820),
  C(566, 640, 622, 796, 566, 720),
]
const sockDetails = (back: boolean): Detail[] => [
  { d: 'M556 302 L692 302', kind: 'line' },
  ...Array.from({ length: 6 }, (_, i) => ({ d: `M${572 + i * 22} 214 L${572 + i * 22} 298`, kind: 'thin' as const })),
  ...(back
    ? [{ d: 'M700 566 C776 600 806 660 812 706', kind: 'line' as const }, { d: 'M690 806 C744 800 800 782 838 752', kind: 'stitch' as const }]
    : [{ d: 'M690 806 C744 800 800 782 838 752', kind: 'stitch' as const }, { d: 'M818 700 C836 726 848 762 850 790', kind: 'stitch' as const }]),
]
const socks: Garment = {
  id: 'socks', name: 'Calcetines', group: 'Accesorios',
  front: { outline: sockShape, details: sockDetails(false), print: [566, 330, 120, 190], pair: true },
  back: { outline: sockShape, details: sockDetails(true), print: [566, 330, 120, 190], pair: true },
}

const boxerShape: Node[] = [
  P(500, 286), P(706, 286), P(716, 356),
  C(744, 574, 736, 430, 746, 508),
  C(624, 606, 706, 600, 668, 606),
  C(500, 588, 588, 606, 542, 600),
]
const boxer: Garment = {
  id: 'boxer', name: 'Bóxer', group: 'Accesorios',
  front: {
    outline: boxerShape,
    details: [
      { d: `M${m(710)} 356 L710 356`, kind: 'rib' },
      { d: `M${m(700)} 300 L700 300`, kind: 'stitch' },
      { d: `M${m(700)} 342 L700 342`, kind: 'stitch' },
      { d: 'M500 372 C560 412 596 470 606 556', kind: 'line' },
      { d: 'M514 380 C568 420 600 476 610 552', kind: 'stitch' },
      { d: 'M736 552 C696 578 656 592 618 598', kind: 'stitch', mirror: true },
    ],
    print: [560, 390, 140, 140],
  },
  back: {
    outline: boxerShape,
    details: [
      { d: `M${m(710)} 356 L710 356`, kind: 'rib' },
      { d: `M${m(700)} 300 L700 300`, kind: 'stitch' },
      { d: 'M500 356 L500 546', kind: 'line' },
      { d: 'M736 552 C696 578 656 592 618 598', kind: 'stitch', mirror: true },
    ],
    print: [560, 390, 140, 140],
  },
}

const tote: Garment = {
  id: 'tote', name: 'Bolsa tote', group: 'Accesorios',
  front: {
    outline: [P(500, 330), P(756, 330), P(788, 898), C(500, 906, 740, 906, 620, 906)],
    details: [
      { d: 'M380 330 C380 118 620 118 620 330', kind: 'line' },
      { d: 'M422 330 C422 168 578 168 578 330', kind: 'line' },
      { d: 'M256 364 L744 364', kind: 'stitch' },
      { d: 'M368 336 L432 336 L432 408 L368 408 Z M368 336 L432 408 M432 336 L368 408', kind: 'stitch', mirror: true },
    ],
    print: [370, 440, 260, 320],
  },
  back: {
    outline: [P(500, 330), P(756, 330), P(788, 898), C(500, 906, 740, 906, 620, 906)],
    details: [
      { d: 'M380 330 C380 118 620 118 620 330', kind: 'line' },
      { d: 'M422 330 C422 168 578 168 578 330', kind: 'line' },
      { d: 'M256 364 L744 364', kind: 'stitch' },
    ],
    print: [370, 440, 260, 320],
  },
}

const packShape: Node[] = [
  P(500, 236),
  C(722, 356, 634, 236, 712, 282),
  C(744, 828, 740, 520, 748, 706),
  C(500, 872, 738, 866, 618, 872),
]
const backpack: Garment = {
  id: 'backpack', name: 'Mochila', group: 'Accesorios',
  front: {
    outline: packShape,
    details: [
      { d: 'M500 452 C596 450 684 434 718 416', kind: 'line', mirror: true },
      { d: 'M500 468 C592 466 676 452 710 436', kind: 'stitch', mirror: true },
      { d: 'M356 584 C420 570 580 570 644 584 L660 752 C560 766 440 766 340 752 Z', kind: 'line' },
      { d: 'M362 600 C424 588 576 588 638 600', kind: 'zip' },
      { d: 'M470 240 C470 214 530 214 530 240', kind: 'line' },
      { d: 'M606 268 C664 292 700 330 716 382', kind: 'line', mirror: true },
      { d: 'M356 470 L330 470 L330 508 L356 508', kind: 'line', mirror: true },
      { d: 'M420 796 L580 796', kind: 'stitch' },
    ],
    print: [386, 300, 228, 230],
  },
  back: {
    outline: packShape,
    details: [
      { d: 'M424 302 C396 426 396 648 428 802 C436 830 470 832 478 812 C448 656 448 434 476 314 Z', kind: 'line', mirror: true },
      { d: 'M440 340 C416 452 416 646 444 786', kind: 'stitch', mirror: true },
      { d: 'M470 240 C470 214 530 214 530 240', kind: 'line' },
      { d: 'M404 340 C440 326 560 326 596 340', kind: 'line' },
      { d: 'M388 560 L612 560', kind: 'line' },
      { d: 'M388 596 L612 596', kind: 'stitch' },
      { d: 'M436 560 L436 596', kind: 'thin', mirror: true },
    ],
    print: [420, 620, 160, 160],
  },
}

const deck: Garment = {
  id: 'deck', name: 'Tabla de skate', group: 'Accesorios',
  front: {
    outline: [P(500, 92), C(596, 300, 570, 110, 594, 190), C(596, 700, 600, 420, 600, 560), C(500, 908, 592, 810, 560, 900)],
    details: [
      { d: 'M404 300 L596 300', kind: 'thin' },
      { d: 'M404 700 L596 700', kind: 'thin' },
      { d: circle(452, 250, 9), kind: 'thin', mirror: true },
      { d: circle(452, 330, 9), kind: 'thin', mirror: true },
      { d: circle(452, 670, 9), kind: 'thin', mirror: true },
      { d: circle(452, 750, 9), kind: 'thin', mirror: true },
    ],
    print: [410, 180, 180, 640],
  },
  back: {
    outline: [P(500, 92), C(596, 300, 570, 110, 594, 190), C(596, 700, 600, 420, 600, 560), C(500, 908, 592, 810, 560, 900)],
    details: [{ d: 'M404 300 L596 300', kind: 'thin' }, { d: 'M404 700 L596 700', kind: 'thin' }],
    print: [410, 180, 180, 640],
  },
}

export const GARMENTS: Garment[] = [...tees, ...sweats, ...jackets, ...pants, cap, trucker, beanie, bucket, balaclava, socks, boxer, tote, backpack, deck]
export const GARMENT_GROUPS = ['Camisetas', 'Sudaderas', 'Chaquetas', 'Pantalones', 'Accesorios']

export interface GarmentOptions {
  views: 'front' | 'back' | 'both'
  color: string
  stitches: boolean
  lineColor: string
  weight: number
}

export function placeViews(w: number, h: number, views: GarmentOptions['views']) {
  const n = views === 'both' ? 2 : 1
  const s = Math.min((w * 0.92) / (n * 1000), (h * 0.92) / 1000)
  const total = n * 1000 * s
  const x0 = (w - total) / 2, y0 = (h - 1000 * s) / 2
  const list: { view: 'front' | 'back'; x: number; y: number; s: number }[] = []
  if (views !== 'back') list.push({ view: 'front', x: x0, y: y0, s })
  if (views !== 'front') list.push({ view: 'back', x: x0 + (views === 'both' ? 1000 * s : 0), y: y0, s })
  return list
}

/** Print areas in document pixels: where a design may sit on each view. */
export function printAreas(g: Garment, w: number, h: number, o: GarmentOptions) {
  return placeViews(w, h, o.views).map((p) => {
    const [px, py, pw, ph] = g[p.view].print
    return { view: p.view, x: p.x + px * p.s, y: p.y + py * p.s, w: pw * p.s, h: ph * p.s }
  })
}

/** Render a garment flat into a colour-fill canvas and a line-art canvas the size of the document. */
export function renderGarment(g: Garment, w: number, h: number, o: GarmentOptions): { fill: Canvas; lines: Canvas } {
  const fill = makeCanvas(w, h), lines = makeCanvas(w, h)
  const fx = ctx2d(fill), lx = ctx2d(lines)
  for (const p of placeViews(w, h, o.views)) {
    const v = g[p.view]
    const outline = new Path2D(v.pair ? halfPath(v.outline) : symPath(v.outline))
    for (const x of [fx, lx]) { x.save(); x.translate(p.x, p.y); x.scale(p.s, p.s) }
    fx.fillStyle = o.color
    fx.fill(outline)
    if (v.pair) {
      fx.save(); fx.translate(1000, 0); fx.scale(-1, 1); fx.fill(outline); fx.restore()
    }
    const unit = 1 / p.s
    const base = Math.max(1.2, 3 * o.weight * p.s * 1.4) * unit
    lx.strokeStyle = o.lineColor
    lx.fillStyle = o.lineColor
    lx.lineJoin = 'round'
    lx.lineCap = 'round'
    lx.lineWidth = base * 1.3
    lx.stroke(outline)
    if (v.pair) {
      lx.save(); lx.translate(1000, 0); lx.scale(-1, 1); lx.stroke(outline); lx.restore()
    }
    for (const det of v.details) {
      if (det.kind === 'stitch' && !o.stitches) continue
      const path = new Path2D(det.d)
      const drawOne = () => {
        lx.setLineDash([])
        lx.globalAlpha = 1
        if (det.kind === 'stitch') { lx.lineWidth = base * 0.55; lx.setLineDash([9, 6]) }
        else if (det.kind === 'thin') lx.lineWidth = base * 0.5
        else if (det.kind === 'rib') lx.lineWidth = base * 0.8
        else if (det.kind === 'dark') { lx.lineWidth = base * 0.8; lx.fill(path) }
        else lx.lineWidth = base * 0.85
        lx.stroke(path)
        if (det.kind === 'zip') {
          lx.setLineDash([3, 7])
          lx.lineWidth = base * 1.5
          lx.globalAlpha = 0.7
          lx.stroke(path)
          lx.globalAlpha = 1
        }
      }
      drawOne()
      if (det.mirror || v.pair) {
        lx.save()
        lx.translate(1000, 0)
        lx.scale(-1, 1)
        drawOne()
        lx.restore()
      }
    }
    lx.setLineDash([])
    for (const x of [fx, lx]) x.restore()
  }
  return { fill, lines }
}

/** Small preview used in the picker. */
export function garmentThumb(g: Garment, size = 120, ink = '#f1f0ec'): string {
  const { fill, lines } = renderGarment(g, size * 2, size, { views: 'both', color: 'rgba(255,255,255,0.10)', stitches: false, lineColor: ink, weight: 0.8 })
  const c = makeCanvas(size * 2, size)
  const x = ctx2d(c)
  x.drawImage(fill, 0, 0)
  x.drawImage(lines, 0, 0)
  return c.toDataURL()
}
