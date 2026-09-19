---
name: Atelier
description: Raster painting, image editing and garment design in the browser; the canvas owns the screen, tools live in thin translucent glass at the edges.
colors:
  desk: "#575655"
  desk-deep: "#2c2b2a"
  chrome: "rgba(26, 25, 24, 0.64)"
  chrome-solid: "#1a1918"
  sheet: "rgba(32, 31, 30, 0.80)"
  sheet-raised: "rgba(255, 255, 255, 0.06)"
  sheet-control: "rgba(255, 255, 255, 0.08)"
  track: "rgba(255, 255, 255, 0.07)"
  fill-raised: "rgba(255, 255, 255, 0.09)"
  fill-strong: "rgba(255, 255, 255, 0.15)"
  line: "rgba(255, 255, 255, 0.08)"
  line-strong: "rgba(255, 255, 255, 0.15)"
  ink: "#f1f0ec"
  ink-secondary: "rgba(241, 240, 236, 0.72)"
  ink-tertiary: "rgba(241, 240, 236, 0.6)"
  chalk: "#e9d25a"
  chalk-ink: "#1c1a10"
  chalk-soft: "rgba(233, 210, 90, 0.16)"
  chalk-tint: "rgba(233, 210, 90, 0.12)"
  danger: "#ef6a5b"
  blue: "#0a84ff"
typography:
  headline:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI Variable Text', 'Segoe UI', system-ui, Roboto, 'Helvetica Neue', sans-serif"
    fontSize: "18px"
    fontWeight: 680
    lineHeight: 1.4
    letterSpacing: "-0.022em"
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI Variable Text', 'Segoe UI', system-ui, Roboto, 'Helvetica Neue', sans-serif"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI Variable Text', 'Segoe UI', system-ui, Roboto, 'Helvetica Neue', sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "-0.005em"
  control:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI Variable Text', 'Segoe UI', system-ui, Roboto, 'Helvetica Neue', sans-serif"
    fontSize: "14px"
    fontWeight: 590
    lineHeight: 1.4
    letterSpacing: "-0.01em"
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI Variable Text', 'Segoe UI', system-ui, Roboto, 'Helvetica Neue', sans-serif"
    fontSize: "12px"
    fontWeight: 590
    lineHeight: 1.4
    letterSpacing: "0.005em"
  numeric:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI Variable Text', 'Segoe UI', system-ui, Roboto, 'Helvetica Neue', sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.4
    fontFeature: "tnum"
rounded:
  xs: "8px"
  sm: "9px"
  control: "10px"
  md: "11px"
  row: "12px"
  chip: "15px"
  sheet: "18px"
  dialog: "22px"
  rail: "24px"
  full: "50%"
spacing:
  hair: "2px"
  xs: "4px"
  sm: "6px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  gutter: "26px"
  bar-height: "48px"
  gallery-head: "64px"
components:
  button:
    backgroundColor: "{colors.fill-raised}"
    textColor: "{colors.ink}"
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    padding: "0 14px"
    height: "34px"
  button-hover:
    backgroundColor: "{colors.fill-strong}"
  button-primary:
    backgroundColor: "{colors.chalk}"
    textColor: "{colors.chalk-ink}"
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    padding: "0 14px"
    height: "34px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    height: "34px"
  button-danger:
    backgroundColor: "{colors.fill-raised}"
    textColor: "{colors.danger}"
    rounded: "{rounded.control}"
    height: "34px"
  tool-button:
    textColor: "{colors.ink-secondary}"
    rounded: "{rounded.control}"
    padding: "0 9px"
    height: "36px"
  tool-button-active:
    backgroundColor: "{colors.chalk-soft}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    height: "36px"
  icon-button:
    textColor: "{colors.ink-secondary}"
    rounded: "{rounded.sm}"
    size: "32px"
  icon-button-active:
    textColor: "{colors.chalk}"
  bar-button-active:
    backgroundColor: "{colors.chalk-soft}"
    textColor: "{colors.ink}"
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    height: "34px"
  status-chip:
    backgroundColor: "{colors.track}"
    textColor: "{colors.ink-secondary}"
    rounded: "{rounded.chip}"
    padding: "0 11px"
    height: "30px"
  segmented:
    backgroundColor: "{colors.track}"
    rounded: "{rounded.md}"
    padding: "2px"
  segmented-active:
    backgroundColor: "{colors.fill-strong}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    height: "28px"
  field:
    backgroundColor: "{colors.track}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0 10px"
    height: "36px"
  menu-item:
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "8px 10px"
    height: "44px"
  popover:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sheet}"
  dialog:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.dialog}"
    padding: "20px"
  list-row-selected:
    backgroundColor: "{colors.chalk-tint}"
    textColor: "{colors.ink}"
    rounded: "{rounded.row}"
    padding: "8px"
  blend-chip:
    backgroundColor: "{colors.sheet-control}"
    textColor: "{colors.ink-secondary}"
    rounded: "{rounded.xs}"
    height: "26px"
---

# Design System: Atelier

## Overview

**Creative North Star: "The Tailor's Bench"**

Atelier is a working surface, not a showcase. The artwork sits on a neutral mid-grey desk as a paper sheet with a soft cast shadow; everything else is chrome pinned to the edges where a Procreate hand already reaches: a 48px top bar with navigation and fashion tools on the left and painting tools on the right, a floating pill sidebar for size and opacity, sheets that drop from the bar with a pointer notch. The interface recedes during long sessions and can be hidden entirely.

The chrome is now real glass rather than tinted panel. Every floating surface is 64-86% opaque over a `blur(32px) saturate(180%)` backdrop, bounded by a 0.5px hairline and lit by an inset 0.5px top highlight, so the artwork keeps moving underneath it. Surfaces materialize instead of fading: sheets arrive from -10px at 96.5% scale with a 4px blur that resolves, on a single spring-like curve (`cubic-bezier(0.32, 0.72, 0, 1)`), and every control answers a pointer-down with an instant scale-down (0.965 for buttons, 0.9 for bare icon tools). Radii grew with the material: 10px controls, 18px sheets and bars, 22px dialogs, a 24px sidebar rail.

The one colour the chrome owns is still tailor's-chalk yellow, and it is still a marker rather than a paint: the wash-plus-ring behind an active tool, the tint behind the selected layer or brush, the primary action, a switch turned on, the text caret, the transform rotate handle, and the dashed guides of the fashion module. Keyboard focus is the one deliberate second hue: a 3.5px system-blue halo, never confused with chalk. Text hierarchy comes from weight and ink opacity, not from hue.

The fashion module is a peer of the painting tools, not a mode: one top-bar entry ("Moda") opens a three-part menu (design the garment / prints / present the collection) that ships technical flats as clipped layer groups, a pattern-fill panel, colorway swapping and a tech-pack dialog. It reuses the same sheets, sliders and buttons; it adds no chrome of its own.

**Key Characteristics:**
- Canvas first: chrome is translucent glass (64% opaque, 32px blur, 180% saturation) over a neutral grey desk.
- One accent, chalk yellow, for state and the single primary action; one blue, for keyboard focus only.
- System UI face throughout; weight (400-680) and ink opacity carry hierarchy; tabular numerals for all values.
- Soft, large geometry: 10px controls, 18px sheets, 22px dialogs, 24px sidebar rail, 0.5px hairlines.
- Spring motion on one curve, plus a press-scale on every tappable thing.
- Measuring-tape sliders with 10% ticks, vertical in the sidebar, horizontal in sheets.
- A fashion module that borrows the whole kit: flats, print areas, patterns, colorways, tech packs.

## Colors

A warm-neutral graphite scale, now mostly expressed as white-alpha fills over blurred glass, with a single tailor's-chalk yellow marker and a single blue focus hue.

### Primary
- **Tailor's Chalk** (chalk): the only accent. Active-tool wash and ring, selected row/brush/category tint, primary button fill, switch on, selection highlight, caret, drag-drop insertion line, transform rotate handle, status-chip dot, and the dashed on-canvas guides of the fashion module. Light theme deepens it to `#b8981a` so it holds on paper.
- **Chalk Wash** (chalk-soft): 16% chalk behind an active top-bar or bottom-bar tool, paired with a 40-42% chalk inset ring.
- **Chalk Tint** (chalk-tint): the quieter 10-12% chalk behind a selected layer or brush row, paired with a 38% chalk inset ring.
- **Chalk Ink** (chalk-ink): text and icons set on a chalk fill.

### Secondary
- **System Blue** (blue): keyboard focus only, as a 3.5px halo at 55% (45% on fields). It replaces the old 2px outline; focus is never chalk.
- **Kiln Red** (danger): destructive text and icons only (delete layer, destructive buttons). Never a fill.

### Neutral
- **Grey Desk** (desk): the editor background the canvas sheet sits on; neutral enough not to bias colour judgement.
- **Deep Desk** (desk-deep): gallery background and its 64px header.
- **Glass Chrome** (chrome): top bar, sidebar, bottom bars, timeline, gallery header; always paired with the glass backdrop.
- **Solid Graphite** (chrome-solid): the colour-well ring, the icon on a checked visibility box, and the opaque substitute for every glass surface under reduced transparency or increased contrast.
- **Sheet** (sheet): popovers, dialogs, adjustment and pattern panels, floating windows, slider bubbles, toasts.
- **Raised Sheet / Control Sheet** (sheet-raised, sheet-control): 6% and 8% white fills for raised areas and small controls (blend chips, thumbnails' backing).
- **Track / Raised Fill / Strong Fill** (track, fill-raised, fill-strong): the three working fills of the glass kit: 7% for segmented tracks, fields and the status chip; 9% for buttons and menu-row hover; 15-16% for button hover and the selected segment.
- **Hairline / Strong Hairline** (line, line-strong): 8% and 15% white; strong hairline draws the 0.5px border of every floating surface, plus slider tracks, separators and thumbnail rings.
- **Ink / Ink 72 / Ink 60** (ink, ink-secondary, ink-tertiary): primary text and active icons; resting icons and secondary text; labels, meta, units and slider ticks.

The light theme (`:root[data-theme='light']`) swaps the same roles to warm paper: desk `#9d9b97`, desk-deep `#e6e4df`, chrome `rgba(252, 251, 249, 0.68)`, chrome-solid `#fbfaf8`, sheet `rgba(252, 251, 249, 0.86)`, raised/control fills as 4% and 6% black, hairlines at 8% / 14% black, ink `#1d1c1a`.

### Named Rules
**The Chalk Mark Rule.** Chalk yellow marks what is active, selected or primary, and nothing else. At most one chalk-filled button per surface; every other chalk use is a line, a ring, a dashed guide or a 10-16% wash.

**The Ink Tiers Rule.** Text hierarchy is three opacities of one ink (100 / 72 / 60), never a second text hue.

**The Themed Fill Rule.** A surface fill is a token, not a literal: read `--track`, `--sheet-2`, `--sheet-3`, `--line` so the light theme follows. A raw `rgba(255,255,255,…)` fill is a bug waiting for the light theme, not a style.

**The Theme-Blind Overlay Rule.** Anything drawn on the artwork itself (marching ants, brush cursor, lasso, crop, transform box and handles, clone target, eyedropper loupe) is a white stroke paired with a dark stroke or dark ring, regardless of UI theme, so it reads over any pixel.

**The Chalk Guide Rule.** The exception to the rule above: fashion guides that describe the garment rather than the edit (print area, repeat-module boundary) are dashed chalk at 80-85% opacity, 1.5px and dash lengths divided by the zoom so they stay hairline at any scale.

## Typography

**UI Font:** the platform system face (-apple-system / Segoe UI Variable Text / system-ui, with Roboto and Helvetica Neue fallbacks)

**Character:** the native face of whatever device the artist is on, so the chrome feels like the OS and never competes with the artwork. Hierarchy comes from weight and ink opacity; the Apple pass tightened the whole body by -0.005em, disabled synthetic weights (`font-synthesis-weight: none`) and moved the scale onto the variable axis (550 → 570/580/590, 650 → 680).

### Hierarchy
- **Headline** (680, 18px, -0.022em): sheet titles ("Capas", "Moda", "Pinceles"); dialog titles step up to 21px / -0.024em. The gallery empty state is the only larger heading (30px, line-height 1.1, -0.03em).
- **Title** (600, 13px): layer names, brush names, artwork names in the gallery (590 / 14px there, -0.01em).
- **Body** (400, 14px, line-height 1.4, -0.005em): default text and menu rows; empty-state and explanatory copy in Ink 72.
- **Control** (590, 14px, -0.01em): buttons; the same voice at smaller weights runs the segmented control (580 / 13px), bottom-bar buttons (570 / 13px), the status chip (550 / 12.5px), toasts (560) and slider bubbles (550).
- **Label** (590, 12px, +0.005em): field labels, section labels and tech-pack table headers in Ink 60, sentence case.
- **Numeric** (400, 12px, tabular figures): slider values, dimensions, percentages, measurement readouts, frame counters; 11px for layer meta and frame captions.

### Named Rules
**The Tabular Figures Rule.** Every number the user reads or scrubs (size, opacity, percent, px dimensions, centimetres, tolerances) uses tabular numerals so values don't jitter while dragging.

**The Sentence Case Rule.** Labels are sentence case at normal tracking; the chrome carries no uppercase, letter-spaced tags, no kickers and no eyebrow lines above titles.

**The Real Weight Rule.** Weights are variable-axis values (550-680) with synthesis off; never fake a weight the face doesn't have.

## Layout

The editor is a full-viewport stage: the canvas is centred and freely panned, zoomed and rotated; chrome floats above it in absolutely positioned layers. The top bar spans the full width at 48px (plus safe-area inset) with 12px side padding, a tool group at each end (2px gaps, 1px separators 22px tall) and the status chip centred between them. The sidebar is a 44px-wide rail vertically centred 10px from the left edge (mirrored right for right-handed mode) holding a 150px size slider, the square modify button, the opacity slider, and undo/redo. Popovers drop 12px below the bar, 10px in from the side of the button that opened them, and fade out their last 14px of scroll under a mask. Contextual tool bars and the adjustment and pattern panels (max 560-640px) float centred 14px above the bottom edge; the animation timeline docks full-width to the bottom. Hiding the UI slides the bar up and the sidebar out (0.35s).

The gallery is a scrolling grid on the deep desk: 64px sticky glass header with the wordmark left and actions right, cards in `repeat(auto-fill, minmax(220px, 1fr))` with 34px row / 26px column gaps and 26px 30px padding; artworks sit bottom-aligned in 4:3 frames with name and dimensions centred beneath.

Spacing is a 2/4/6/8/12/16px rhythm inside chrome and sheets (the Apple pass widened sheet padding to 14-16px and menu rows to a 44px minimum); larger gaps (26-34px) appear only in the gallery.

Responsive steps: below 1100px the status chip is dropped; below 700px top-bar labels become icons (32px min width), popovers span the viewport with 8px margins, the brush library category column narrows to 110px, and the gallery grid drops to 150px minimum cards; below 560px narrow-only icon variants replace text ("Galería"), tool gaps close to 0 and the colour well shrinks to 28px; below 480px the separators disappear and the well goes to 26px.

## Elevation & Depth

A hybrid, now weighted toward material. Glass surfaces read as depth in themselves: translucency plus a 32px 180%-saturated backdrop, a 0.5px hairline and an inset 0.5px top highlight. On top of that, anything that floats over the canvas carries one large, diffuse, two-layer shadow; the top bar is the only chrome with no border, held instead by its own inset highlight and a 12px ambient shadow. The canvas and the gallery artworks behave as paper: a bright sheet with a soft cast below it. No hard or offset shadows anywhere.

### Shadow Vocabulary
- **Sheet lift** (`box-shadow: 0 24px 64px rgba(0, 0, 0, 0.46), 0 2px 10px rgba(0, 0, 0, 0.3)`; light theme 0.16 / 0.08): popovers, dialogs, adjustment and pattern panels, floating windows, toasts.
- **Glass edge** (`inset 0 0.5px 0 rgba(255, 255, 255, 0.10-0.12)`): the top highlight every glass surface carries; the sidebar uses 0.12.
- **Bar ambient** (`0 1px 12px rgba(0, 0, 0, 0.22)` top bar; `0 12px 36px rgba(0, 0, 0, 0.3)` sidebar): chrome that stays on screen.
- **Paper cast** (`0 14px 34px rgba(0, 0, 0, 0.4), 0 1px 3px rgba(0, 0, 0, 0.3)`, deepening to `0 22px 48px rgba(0, 0, 0, 0.48)` on hover): gallery artwork; the editor canvas draws its own cast.
- **Knob** (`0 1px 4px rgba(0, 0, 0, 0.45), 0 0 0 0.5px rgba(0, 0, 0, 0.25)`): slider thumbs; the selected segment gets `0 1px 2px rgba(0, 0, 0, 0.28)` plus a 25% white inset top edge.

### Named Rules
**The Float Only Rule.** Big shadows belong to surfaces that float over the canvas; bar-attached chrome gets glass, a hairline and an inset highlight instead.

**The Real Glass Rule.** Every translucent chrome or sheet surface carries `backdrop-filter: blur(32px) saturate(180%)`; translucency without blur is not allowed, and glass without an accessible fallback is not shipped: under `prefers-reduced-transparency: reduce` or `prefers-contrast: more` the same surfaces fall back to opaque Solid Graphite.

**The One Curve Rule.** Sheets, bars, dialogs, toasts, switch knobs, slider thumbs and artwork hovers all move on `cubic-bezier(0.32, 0.72, 0, 1)` at 0.16-0.4s; entrances also resolve a 4px blur. Reduced motion collapses every entrance to an 0.18s fade.

## Shapes

Soft and large. Controls are 9-12px (icon buttons 9, buttons/fields/top-bar tools 10, segmented and menu rows 11, layer and brush rows 12); sheets, bottom bars and the adjustment panel are 18px; dialogs 22px; the sidebar rail 24px on a 44px width; toasts 13px; floating windows 16px; thumbnails, blend chips and visibility boxes 7-8px. Pills exist where a control is a readout rather than an action: the status chip (30px tall, 15px radius) and the sidebar rail. Circles are reserved for the colour well, slider thumbs on horizontal rails, switch knobs, selection ticks and on-canvas handles. Every floating surface has a 0.5px hairline border; popovers keep a 14px rotated-square notch (3px corner) pointing at the bar button that opened them. Icons are Lucide outlines at the default 2px stroke, 19px in the top bar, 15-18px in sheets; checkmarks go to a 3px stroke. Garment flats are drawn line art: a user-set line colour and weight (0.4-2.5x) with dashed stitch runs.

## Components

### Buttons
Quiet, compact, tactile; they answer the finger before they answer the app.
- **Shape:** rounded (10px), 34px tall, 14px horizontal padding, 7px icon gap.
- **Default:** 9% white fill with Ink text at weight 590; hover to 15%; press scales to 0.965.
- **Primary:** Tailor's Chalk fill with Chalk Ink text and a 1px-3px drop; hover brightens 6%. One per surface (the gallery "Nuevo", dialog confirm, "Aplicar", "Hecho").
- **Ghost / Danger:** ghost drops the fill and hovers to 9%; danger keeps the fill and turns the text Kiln Red.
- **Disabled:** 40% opacity.

### Tool buttons (top bar, sidebar, icon buttons)
- **Resting:** icon only in Ink 72, no fill; 36px tall in the top bar (10px radius), 32px square elsewhere (9px).
- **Hover:** a 10% white fill, icon to full Ink.
- **Active:** the chalk underline is gone; an active tool now sits on the 16% Chalk Wash with full Ink and a 1px 40%-chalk inset ring. Icon buttons inside sheets still mark "on" by turning the icon chalk.
- **Press:** bare icon tools scale to 0.9, the most emphatic press in the system.

### Status chip (signature)
A centred pill in the top bar that reads out what the pen will do right now: an 8px chalk dot, the tool name in Ink 72, then brush name, size in px and opacity in tabular Ink 60. 30px tall, 15px radius, 7% white fill, 12.5px / 550, max 280px with overflow hidden; hover lifts the fill to 12% and the text to full Ink; tapping it opens the brush library. Hidden below 1100px.

### Bottom-bar buttons
Contextual tool rows (selection, transform, adjustments, zone paint, measurements) in a floating 18px-radius glass bar with 8px padding. 34px, 13px / 570 labels in Ink 72; active gets the Chalk Wash fill and a 1px 42%-chalk inset ring. Non-interactive hint text rides in the same shape with pointer events off.

### Segmented control
2px-padded 7% track (11px radius); 28px options in 13px / 580 Ink 72; the selected option sits on a 16% white fill with full Ink, a small drop and a 25% white inset top edge (a plain white fill in the light theme).

### Inputs / Fields
- **Style:** 36px, 7% fill, 10px radius, 0.5px hairline border, chalk caret.
- **Focus:** the border goes transparent and a 3.5px 45% System Blue halo takes over.
- **Switch:** 44x26 track, 22px white knob, 18px travel on the house curve; on, the track turns chalk.
- **Keyboard focus anywhere else:** a 3.5px 55% blue halo with an 8px radius and no outline.

### Measuring-tape sliders (signature)
- **Vertical (sidebar):** 6px track in Strong Hairline, Ink 72 fill from the bottom, 24x13 Ink knob that stretches (1.1x / 1.15x) while dragging, tick column every 10% in Ink 60. A 12px-radius glass bubble with a 0.5px hairline shows the value.
- **Horizontal (sheets):** name in 13px Ink 72, value right-aligned in tabular 12px Ink 60; 5px track, Ink 72 fill, 18px round knob that scales 1.14x while dragging, tick row every 10% below the track.

### Popovers / sheets
Sheet fill, 0.5px Strong Hairline, 18px radius, Sheet lift plus glass edge, 32px/180% backdrop, notch pointing at the source button; 18px / 680 title row (14px 16px 8px padding) with icon actions right; body padded 0 10px 12px and masked to fade its last 14px. Enters with `material-in`: 0.3s, from -10px at 0.965 scale and 4px blur, transform-origin top centre.

### List rows (layers, brushes, menus)
- **Menu item:** min 44px, 11px radius, 14px gap, icon in Ink 72, trailing sub-label in Ink 60; hover 9% fill. The fashion menu uses a stacked variant: label over a 12px Ink 60 description, icon top-aligned.
- **Layer row:** 12px radius, 8px padding, 12px gap, 52x40 thumbnail (8px, hairline ring, checkerboard for transparency), name 13px / 600, blend chip (single letter, 650 on the 8% control fill, 26px, 8px radius), visibility box (7px radius). Selected: 12% Chalk Tint with a 1px 38%-chalk inset ring. Drag insertion is a 2px chalk line; drop-into is a 2px chalk inset ring. Nested rows (a garment group's children) are indented with an "L" marker.
- **Brush item:** 12px radius, name plus a stroke preview; selected = 10% Chalk Tint with the same 38% chalk ring. Categories are 13.5px / 9px-radius rows against a 0.5px divider column; the selected category takes a 12% white fill.

### Colour well
30px circle of the current colour with a 2px Solid Graphite ring and a 1.5px Strong Hairline ring outside it; tap opens the colour sheet, drag onto the canvas fills (drag ghost: 34px circle with a white 3px ring).

### On-canvas chrome
- **Marching ants / lasso / rect-ellipse drafts:** 1.5px dashed (6/4) white stroke with an offset dark (`#111`) pass; lasso start point is a white dot with a dark ring.
- **Brush cursor:** 1px white circle at brush radius with a 60% black circle 1px outside it.
- **Transform box:** 3px 45%-black stroke under a 1.25px 95%-white stroke; handles are white circles (7px corners, 5px edges) with a 1.5px 55%-black ring; the rotate handle is chalk.
- **Crop:** 55% black veil outside, 2px white frame, rule-of-thirds lines at 50%.
- **Eyedropper loupe:** a 16px-thick ring 70px above the pointer, lower half previous colour, upper half sampled colour, framed in 1.5px 80% white with a centre cross.
- **Fashion guides:** print areas are dashed chalk rectangles (10/7 dash, 85%); the repeat-module boundary is a dashed chalk frame around the whole canvas (8/6 dash, 80%). Both divide their widths and dashes by the zoom.
- **Dimension lines:** drawn in a user-chosen colour with the value in tabular figures; Shift constrains to 15° angles.

### Fashion module
One top-bar entry ("Moda", icon plus label) opens a 360px menu in three labelled blocks: *Diseñar la prenda* (garment templates, sewing brushes, insert design, zone paint, remove background, fit to print area, measurements), *Estampados* (repeat mode switch, half-module offset, pattern fill), *Presentar la colección* (colorways, fabric mockup, print-area switch, tech pack).
- **Garment dialog:** a category filter row of 28px buttons (the chosen one takes the chalk primary fill), a `minmax(130px, 1fr)` thumbnail grid whose selected tile carries a 2px chalk inset ring, a views segmented control, two native colour wells, a line-weight slider (`1.0x` format) and a stitches switch; three actions, with "Insertar en este lienzo" as the single primary.
- **Garment output:** a layer group named `Plano · <garment>`, containing a base colour layer, a clipped artwork layer and a reference line layer, so every subsequent paint or pattern stays inside the flat.
- **Pattern panel:** a bottom-floating panel (max 640px) with three source buttons, a horizontal 72px tile strip (selected tile ringed 2px chalk, delete as a 22px icon button pinned to its corner), a repeat segmented control, a two-column slider grid, and a clip switch; live-previews into a temporary layer and commits as one history step.
- **Colorway dialog:** rows of 34px swatch / hex in tabular label / arrow / new swatch; saved colorways appear as six-swatch strips on 34px menu rows.
- **Tech pack dialog:** an 820px dialog with a field grid and a measurement table whose headers are Labels and whose cells are tabular fields; exports A4 landscape PDF or PNG, with "Exportar PDF" as the single primary.

### Gallery
Wordmark "Atelier" (21px / 700, -0.03em) followed by a chalk bar; 64px glass header; actions are text-plus-icon buttons with "Nuevo" as the single primary. Artwork images carry a 3px radius and the paper cast, lifting 6px and scaling 1.015 over 0.4s on hover; in selection mode a 24px circular tick turns chalk when selected and the artwork gets a chalk outline.

## Do's and Don'ts

### Do:
- **Do** keep chrome at the edges: top bar (48px), sidebar rail, sheets dropping from the bar, contextual bars floating 14px above the bottom.
- **Do** give every translucent surface `blur(32px) saturate(180%)`, a 0.5px hairline and an inset 0.5px top highlight, and keep the opaque fallbacks for reduced transparency and increased contrast.
- **Do** reserve chalk for active, selected and primary states: the 16% wash plus a 40% ring for active tools, the 10-12% tint plus a 38% ring for selected rows, one chalk button per surface.
- **Do** give every tappable element a press response: 0.965 for buttons and segments, 0.9 for bare icon tools, 0.995 for rows.
- **Do** animate on the single house curve `cubic-bezier(0.32, 0.72, 0, 1)` and honour reduced motion.
- **Do** tick every continuous slider at 10% intervals and set its value in tabular numerals.
- **Do** draw edit overlays as a white stroke paired with a dark stroke or ring, independent of the UI theme; reserve dashed chalk for fashion guides, scaled by zoom.
- **Do** read every colour and fill from the custom properties so the light theme follows automatically.
- **Do** keep the keyboard focus halo blue (`3.5px`, 55%), distinct from chalk.
- **Do** build new fashion surfaces out of the existing kit: menu rows, sheets, segmented controls, horizontal sliders, switches, one primary button.

### Don't:
- **Don't** introduce docked panel stacks, a menu bar or a tool palette; tools belong in the top bar, sidebar, sheets and contextual bottom bars.
- **Don't** add a second accent hue, or use chalk as decoration, background or large fill beyond the single primary button.
- **Don't** use hard or offset shadows; depth is soft, diffuse and paired with glass.
- **Don't** add uppercase, letter-spaced labels, kickers or eyebrow lines to the chrome.
- **Don't** make a glass surface opaque over the canvas except through the accessibility fallbacks; the artwork should stay visible behind bars and sheets.
- **Don't** hard-code a white or black alpha fill where a token exists; unthemed literals break the light theme.
- **Don't** shape an action like a pill: pills are for readouts (the status chip) and the sidebar rail.
- **Don't** use Procreate's name, icons, brush files or other assets, or any real brand's garment artwork; the interaction model is shared, the identity is Atelier's.
