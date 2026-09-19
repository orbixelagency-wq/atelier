// Technical flats. Each view is authored in a 1000×1000 box, x = 500 is the centre line.
// Outlines are given as the right half (from the centre top to the centre bottom) and mirrored.
import { ctx2d, makeCanvas, type Canvas } from './util'

type Node = [number, number] | [number, number, number, number, number, number] // [x,y] line · [x,y,c1x,c1y,c2x,c2y] cubic
type DetailKind = 'line' | 'stitch' | 'zip' | 'thin'
interface Detail { d: string; kind: DetailKind; mirror?: boolean }
interface View { outline: Node[]; details: Detail[] }
export interface Garment { id: string; name: string; front: View; back: View }

const m = (x: number) => 1000 - x

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

const circle = (x: number, y: number, r: number) => `M${x - r} ${y} a${r} ${r} 0 1 0 ${r * 2} 0 a${r} ${r} 0 1 0 ${-r * 2} 0`

// ---------------- shared bodies ----------------
const teeBody = (neckY: number, neckC: number): Node[] => [
  [500, neckY], [592, 118, 548, neckY, 582, neckC], [748, 160], [880, 372], [792, 418], [706, 318],
  [712, 878, 700, 500, 712, 700], [500, 892, 640, 888, 570, 892],
]
const teeDetails = (front: boolean): Detail[] => [
  { d: front ? 'M500 210 C558 210 590 172 604 124' : 'M500 162 C552 162 586 150 602 124', kind: 'line', mirror: true },
  { d: front ? 'M500 224 C562 224 596 180 612 126' : 'M500 176 C556 176 592 158 610 126', kind: 'stitch', mirror: true },
  { d: 'M748 160 C724 220 706 270 706 318', kind: 'line', mirror: true },
  { d: 'M863 345 L775 391', kind: 'stitch', mirror: true },
  { d: 'M712 846 C640 856 570 860 500 860', kind: 'stitch', mirror: true },
]

const longBody = (neckY: number, neckC: number): Node[] => [
  [500, neckY], [592, 118, 548, neckY, 582, neckC], [748, 160], [918, 760], [846, 782], [706, 318],
  [712, 878, 700, 500, 712, 700], [500, 892, 640, 888, 570, 892],
]

const crewBody = (topY: number): Node[] => [
  [500, topY], [600, 115, 552, topY, 590, (topY + 115) / 2 + 12], [762, 166], [932, 790], [852, 815], [720, 332],
  [736, 822, 724, 520, 736, 700], [726, 905], [500, 910, 650, 910, 560, 910],
]
const ribDetails: Detail[] = [
  { d: 'M736 824 C650 830 570 832 500 832', kind: 'line', mirror: true },
  { d: 'M913 728 L838 752', kind: 'line', mirror: true },
  { d: 'M762 166 C736 230 720 280 720 332', kind: 'line', mirror: true },
]

// ---------------- catalogue ----------------
export const GARMENTS: Garment[] = [
  {
    id: 'tee', name: 'Camiseta',
    front: { outline: teeBody(178, 152), details: teeDetails(true) },
    back: { outline: teeBody(138, 130), details: teeDetails(false) },
  },
  {
    id: 'longsleeve', name: 'Camiseta manga larga',
    front: { outline: longBody(178, 152), details: [...teeDetails(true).slice(0, 3), { d: 'M899 700 L826 722', kind: 'line', mirror: true }, { d: 'M712 846 C640 856 570 860 500 860', kind: 'stitch', mirror: true }] },
    back: { outline: longBody(138, 130), details: [...teeDetails(false).slice(0, 3), { d: 'M899 700 L826 722', kind: 'line', mirror: true }, { d: 'M712 846 C640 856 570 860 500 860', kind: 'stitch', mirror: true }] },
  },
  {
    id: 'crew', name: 'Sudadera cuello redondo',
    front: { outline: crewBody(170), details: [{ d: 'M500 214 C562 214 598 172 614 120', kind: 'line', mirror: true }, ...ribDetails] },
    back: { outline: crewBody(135), details: [{ d: 'M500 172 C556 172 594 152 612 120', kind: 'line', mirror: true }, ...ribDetails] },
  },
  {
    id: 'hoodie', name: 'Sudadera con capucha',
    front: {
      outline: [
        [500, 40], [640, 176, 612, 40, 652, 110], [772, 192], [942, 800], [862, 826], [730, 352],
        [744, 822, 734, 520, 744, 700], [734, 905], [500, 910, 650, 910, 560, 910],
      ],
      details: [
        { d: 'M500 252 C562 212 604 126 574 72 C556 50 524 48 500 48', kind: 'line', mirror: true },
        { d: 'M500 236 C552 202 588 128 564 84', kind: 'stitch', mirror: true },
        { d: 'M478 244 L468 430', kind: 'line' }, { d: 'M522 244 L532 430', kind: 'line' },
        { d: circle(478, 240, 7), kind: 'line' }, { d: circle(522, 240, 7), kind: 'line' },
        { d: 'M330 800 L372 624 Q380 604 402 604 L598 604 Q620 604 628 624 L670 800', kind: 'line' },
        { d: 'M344 792 L384 632 L616 632 L656 792', kind: 'stitch' },
        { d: 'M744 824 C650 830 570 832 500 832', kind: 'line', mirror: true },
        { d: 'M922 736 L846 760', kind: 'line', mirror: true },
        { d: 'M772 192 C744 250 730 300 730 352', kind: 'line', mirror: true },
      ],
    },
    back: {
      outline: [
        [500, 40], [640, 176, 612, 40, 652, 110], [772, 192], [942, 800], [862, 826], [730, 352],
        [744, 822, 734, 520, 744, 700], [734, 905], [500, 910, 650, 910, 560, 910],
      ],
      details: [
        { d: 'M500 44 L500 250', kind: 'line' },
        { d: 'M500 250 C566 250 618 216 640 176', kind: 'line', mirror: true },
        { d: 'M744 824 C650 830 570 832 500 832', kind: 'line', mirror: true },
        { d: 'M922 736 L846 760', kind: 'line', mirror: true },
        { d: 'M772 192 C744 250 730 300 730 352', kind: 'line', mirror: true },
      ],
    },
  },
  {
    id: 'bomber', name: 'Chaqueta bomber',
    front: {
      outline: [
        [500, 150], [590, 110, 540, 150, 580, 130], [760, 160], [935, 790], [855, 815], [722, 330],
        [740, 810, 730, 520, 740, 700], [728, 905], [500, 910, 650, 910, 560, 910],
      ],
      details: [
        { d: 'M500 150 L500 910', kind: 'zip' },
        { d: 'M506 192 C552 182 586 150 598 114', kind: 'line', mirror: true },
        { d: 'M740 812 C650 820 570 822 506 822', kind: 'line', mirror: true },
        { d: 'M916 728 L842 752', kind: 'line', mirror: true },
        { d: 'M760 160 C736 226 722 280 722 330', kind: 'line', mirror: true },
        { d: 'M600 600 L642 704', kind: 'line', mirror: true },
        { d: 'M614 596 L656 700', kind: 'stitch', mirror: true },
        { d: 'M798 330 L858 318 L872 392 L812 404 Z', kind: 'line' },
        { d: 'M800 344 L862 332', kind: 'stitch' },
      ],
    },
    back: {
      outline: [
        [500, 120], [590, 110, 540, 120, 580, 116], [760, 160], [935, 790], [855, 815], [722, 330],
        [740, 810, 730, 520, 740, 700], [728, 905], [500, 910, 650, 910, 560, 910],
      ],
      details: [
        { d: 'M500 150 C556 148 588 132 600 112', kind: 'line', mirror: true },
        { d: 'M740 812 C650 820 570 822 500 822', kind: 'line', mirror: true },
        { d: 'M916 728 L842 752', kind: 'line', mirror: true },
        { d: 'M760 160 C736 226 722 280 722 330', kind: 'line', mirror: true },
      ],
    },
  },
  {
    id: 'jogger', name: 'Pantalón jogger',
    front: {
      outline: [[500, 80], [700, 80], [706, 150], [735, 330, 720, 200, 735, 260], [740, 860, 745, 520, 742, 700], [730, 945], [562, 945], [550, 860], [500, 400, 556, 650, 522, 440]],
      details: [
        { d: 'M294 150 L706 150', kind: 'line' },
        { d: 'M300 118 L700 118', kind: 'stitch' },
        { d: 'M486 150 C476 200 466 232 474 266', kind: 'line', mirror: true },
        { d: 'M740 860 L550 860', kind: 'line', mirror: true },
        { d: 'M708 162 C682 222 690 272 730 304', kind: 'stitch', mirror: true },
        { d: 'M500 150 L500 400', kind: 'line' },
      ],
    },
    back: {
      outline: [[500, 80], [700, 80], [706, 150], [735, 330, 720, 200, 735, 260], [740, 860, 745, 520, 742, 700], [730, 945], [562, 945], [550, 860], [500, 400, 556, 650, 522, 440]],
      details: [
        { d: 'M294 150 L706 150', kind: 'line' },
        { d: 'M740 860 L550 860', kind: 'line', mirror: true },
        { d: 'M570 232 L668 232 L664 312 L574 312 Z', kind: 'line', mirror: true },
        { d: 'M500 150 L500 400', kind: 'line' },
      ],
    },
  },
  {
    id: 'shorts', name: 'Pantalón corto',
    front: {
      outline: [[500, 80], [700, 80], [706, 150], [745, 300, 722, 190, 740, 240], [762, 560], [540, 582], [500, 420, 530, 500, 510, 440]],
      details: [
        { d: 'M294 150 L706 150', kind: 'line' },
        { d: 'M486 150 C476 200 466 232 474 266', kind: 'line', mirror: true },
        { d: 'M758 528 L540 550', kind: 'stitch', mirror: true },
        { d: 'M708 162 C682 222 690 272 734 300', kind: 'stitch', mirror: true },
        { d: 'M500 150 L500 420', kind: 'line' },
      ],
    },
    back: {
      outline: [[500, 80], [700, 80], [706, 150], [745, 300, 722, 190, 740, 240], [762, 560], [540, 582], [500, 420, 530, 500, 510, 440]],
      details: [
        { d: 'M294 150 L706 150', kind: 'line' },
        { d: 'M758 528 L540 550', kind: 'stitch', mirror: true },
        { d: 'M572 224 L666 224 L662 300 L576 300 Z', kind: 'line', mirror: true },
        { d: 'M500 150 L500 420', kind: 'line' },
      ],
    },
  },
  {
    id: 'cap', name: 'Gorra',
    front: {
      outline: [[500, 190], [776, 470, 660, 190, 762, 300], [772, 548], [700, 652, 792, 600, 764, 640], [500, 694, 634, 676, 562, 694]],
      details: [
        { d: 'M772 548 C700 596 600 606 500 606', kind: 'line', mirror: true },
        { d: 'M500 198 C472 330 470 450 482 606', kind: 'line', mirror: true },
        { d: 'M742 594 C680 636 592 652 500 654', kind: 'stitch', mirror: true },
        { d: 'M718 622 C660 656 586 670 500 672', kind: 'stitch', mirror: true },
        { d: circle(500, 186, 13), kind: 'line' },
        { d: circle(660, 330, 9), kind: 'thin', mirror: true },
      ],
    },
    back: {
      outline: [[500, 190], [776, 470, 660, 190, 762, 300], [792, 582], [500, 592, 700, 592, 600, 592]],
      details: [
        { d: 'M404 588 Q500 440 596 588', kind: 'line' },
        { d: 'M380 552 L620 552 L620 586 L380 586 Z', kind: 'line' },
        { d: 'M500 198 L500 470', kind: 'line' },
        { d: 'M500 198 C600 270 680 380 712 512', kind: 'line', mirror: true },
        { d: circle(500, 186, 13), kind: 'line' },
      ],
    },
  },
  {
    id: 'tote', name: 'Bolsa tote',
    front: {
      outline: [[500, 330], [760, 330], [790, 900], [500, 900]],
      details: [
        { d: 'M380 330 C380 118 620 118 620 330', kind: 'line' },
        { d: 'M420 330 C420 170 580 170 580 330', kind: 'line' },
        { d: 'M244 362 L756 362', kind: 'stitch' },
        { d: 'M370 336 L430 336 L430 404 L370 404 Z M370 336 L430 404 M430 336 L370 404', kind: 'stitch', mirror: true },
      ],
    },
    back: {
      outline: [[500, 330], [760, 330], [790, 900], [500, 900]],
      details: [
        { d: 'M380 330 C380 118 620 118 620 330', kind: 'line' },
        { d: 'M420 330 C420 170 580 170 580 330', kind: 'line' },
        { d: 'M244 362 L756 362', kind: 'stitch' },
      ],
    },
  },
]

export interface GarmentOptions {
  views: 'front' | 'back' | 'both'
  color: string
  stitches: boolean
  lineColor: string
  weight: number // 0.5 - 2
}

function placeViews(w: number, h: number, views: GarmentOptions['views']) {
  const n = views === 'both' ? 2 : 1
  const s = Math.min((w * 0.92) / (n * 1000), (h * 0.92) / 1000)
  const total = n * 1000 * s
  const x0 = (w - total) / 2, y0 = (h - 1000 * s) / 2
  const list: { view: 'front' | 'back'; x: number; y: number; s: number }[] = []
  if (views !== 'back') list.push({ view: 'front', x: x0, y: y0, s })
  if (views !== 'front') list.push({ view: 'back', x: x0 + (views === 'both' ? 1000 * s : 0), y: y0, s })
  return list
}

/** Render a garment flat into a colour-fill canvas and a line-art canvas the size of the document. */
export function renderGarment(g: Garment, w: number, h: number, o: GarmentOptions): { fill: Canvas; lines: Canvas } {
  const fill = makeCanvas(w, h), lines = makeCanvas(w, h)
  const fx = ctx2d(fill), lx = ctx2d(lines)
  for (const p of placeViews(w, h, o.views)) {
    const v = g[p.view]
    const outline = new Path2D(symPath(v.outline))
    for (const x of [fx, lx]) { x.save(); x.translate(p.x, p.y); x.scale(p.s, p.s) }
    fx.fillStyle = o.color
    fx.fill(outline)
    const unit = 1 / p.s // 1 device px in view units
    const base = Math.max(1.2, 3 * o.weight * p.s * 1.4) * unit
    lx.strokeStyle = o.lineColor
    lx.fillStyle = o.lineColor
    lx.lineJoin = 'round'
    lx.lineCap = 'round'
    lx.lineWidth = base * 1.25
    lx.stroke(outline)
    for (const det of v.details) {
      if (det.kind === 'stitch' && !o.stitches) continue
      const paths = [new Path2D(det.d)]
      const drawOne = (path: Path2D) => {
        lx.setLineDash([])
        if (det.kind === 'stitch') {
          lx.lineWidth = base * 0.55
          lx.setLineDash([9, 6])
        } else if (det.kind === 'thin') lx.lineWidth = base * 0.5
        else lx.lineWidth = base * 0.85
        lx.stroke(path)
        if (det.kind === 'zip') {
          lx.lineWidth = base * 0.45
          lx.setLineDash([3, 5])
          lx.save()
          lx.lineWidth = 12
          lx.globalAlpha = 0.9
          lx.stroke(path)
          lx.restore()
        }
      }
      for (const path of paths) drawOne(path)
      if (det.mirror) {
        lx.save()
        lx.translate(1000, 0)
        lx.scale(-1, 1)
        for (const path of paths) drawOne(path)
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
  const { fill, lines } = renderGarment(g, size * 2, size, { views: 'both', color: 'rgba(255,255,255,0.08)', stitches: false, lineColor: ink, weight: 0.8 })
  const c = makeCanvas(size * 2, size)
  const x = ctx2d(c)
  x.drawImage(fill, 0, 0)
  x.drawImage(lines, 0, 0)
  return c.toDataURL()
}
