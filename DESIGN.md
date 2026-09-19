---
name: Atelier
description: Raster painting and image-editing studio in the browser; the canvas owns the screen, tools live in thin translucent chrome at the edges.
colors:
  desk: "#575655"
  desk-deep: "#2c2b2a"
  chrome: "rgba(24, 23, 22, 0.78)"
  chrome-solid: "#1c1b1a"
  sheet: "rgba(30, 29, 28, 0.94)"
  sheet-raised: "#262524"
  sheet-control: "#302f2d"
  line: "rgba(255, 255, 255, 0.09)"
  line-strong: "rgba(255, 255, 255, 0.16)"
  ink: "#f1f0ec"
  ink-secondary: "rgba(241, 240, 236, 0.72)"
  ink-tertiary: "rgba(241, 240, 236, 0.6)"
  chalk: "#e9d25a"
  chalk-ink: "#1c1a10"
  chalk-soft: "rgba(233, 210, 90, 0.16)"
  danger: "#ef6a5b"
  focus: "#8fc1ff"
typography:
  headline:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI Variable Text', 'Segoe UI', system-ui, Roboto, 'Helvetica Neue', sans-serif"
    fontSize: "17px"
    fontWeight: 650
    lineHeight: 1.4
    letterSpacing: "-0.015em"
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
  control:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI Variable Text', 'Segoe UI', system-ui, Roboto, 'Helvetica Neue', sans-serif"
    fontSize: "13px"
    fontWeight: 550
    lineHeight: 1.4
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI Variable Text', 'Segoe UI', system-ui, Roboto, 'Helvetica Neue', sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "0.01em"
  numeric:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI Variable Text', 'Segoe UI', system-ui, Roboto, 'Helvetica Neue', sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.4
    fontFeature: "tnum"
rounded:
  xs: "6px"
  sm: "8px"
  control: "9px"
  md: "12px"
  bar: "14px"
  dialog: "16px"
  rail: "22px"
  full: "50%"
spacing:
  hair: "2px"
  xs: "4px"
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "14px"
  gutter: "26px"
  bar-height: "46px"
components:
  button:
    backgroundColor: "{colors.sheet-control}"
    textColor: "{colors.ink}"
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    padding: "0 14px"
    height: "34px"
  button-hover:
    backgroundColor: "{colors.line-strong}"
  button-primary:
    backgroundColor: "{colors.chalk}"
    textColor: "{colors.chalk-ink}"
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    padding: "0 14px"
    height: "34px"
  button-danger:
    backgroundColor: "{colors.sheet-control}"
    textColor: "{colors.danger}"
    rounded: "{rounded.control}"
    height: "34px"
  tool-button:
    textColor: "{colors.ink-secondary}"
    rounded: "{rounded.control}"
    padding: "0 9px"
    height: "36px"
  tool-button-active:
    textColor: "{colors.ink}"
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
  segmented:
    backgroundColor: "{colors.sheet-control}"
    rounded: "10px"
    padding: "3px"
  segmented-active:
    backgroundColor: "{colors.chrome-solid}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    height: "28px"
  field:
    backgroundColor: "{colors.sheet-control}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "0 10px"
    height: "34px"
  popover:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
  list-row-selected:
    backgroundColor: "{colors.chalk-soft}"
    textColor: "{colors.ink}"
    rounded: "10px"
  blend-chip:
    backgroundColor: "{colors.sheet-control}"
    textColor: "{colors.ink-secondary}"
    rounded: "{rounded.xs}"
    height: "24px"
---

# Design System: Atelier

## Overview

**Creative North Star: "The Tailor's Bench"**

Atelier is a working surface, not a showcase. The artwork sits on a neutral mid-grey desk as a paper sheet with a soft cast shadow; everything else is graphite chrome, thin and translucent, pinned to the edges where a Procreate hand already reaches: a 46px top bar with navigation tools on the left and painting tools on the right, a floating pill sidebar for size and opacity, sheets that drop from the bar with a pointer notch. The interface recedes during long sessions and can be hidden entirely.

The one colour the chrome owns is tailor's-chalk yellow. It is a marker, not a paint: the 2px underline under the active tool, the tint behind the selected layer or brush, the primary action, a switch turned on, the text caret, the rotate handle of a transform. Sliders read as measuring tapes, ticked every 10%, and every number is set in tabular figures. Text hierarchy comes from ink opacity, not from hue or size jumps.

The chrome ships in two themes (graphite by default, a warm-paper light theme by preference); on-canvas overlays deliberately ignore the theme and are always drawn as a white-and-dark pair so they read over any pixel.

**Key Characteristics:**
- Canvas first: chrome is translucent graphite (78% opaque, 18px backdrop blur) over a neutral grey desk.
- One accent, chalk yellow, used only to mark state and the single primary action.
- System UI face throughout; weight and ink opacity carry hierarchy; tabular numerals for all values.
- Rounded, soft geometry: 9px controls, 12px sheets, pill sidebar.
- Measuring-tape sliders with 10% ticks, vertical in the sidebar, horizontal in sheets.
- Soft, diffuse shadows only on things that float over the canvas.

## Colors

A warm-neutral graphite scale with a single tailor's-chalk yellow marker; every neutral carries a faint warm tint.

### Primary
- **Tailor's Chalk** (chalk): the only accent. Active-tool underline, selected row/brush/category tint (via Chalk Wash), primary button fill, switch on, selection highlight, caret, drag-drop insertion line, transform rotate handle, focus of text fields. Light theme deepens it to `#b8981a` so it holds on paper.
- **Chalk Wash** (chalk-soft): 16% chalk tint behind a selected list row, brush, category or bottom-bar tool.
- **Chalk Ink** (chalk-ink): text and icons set on a chalk fill.

### Secondary
- **Clear-Sky Focus** (focus): the 2px keyboard focus outline, offset 2px. Kept blue so focus is never confused with chalk selection.
- **Kiln Red** (danger): destructive text and icons only (delete layer, destructive buttons). Never a fill.

### Neutral
- **Grey Desk** (desk): the editor background the canvas sheet sits on; neutral enough not to bias colour judgement.
- **Deep Desk** (desk-deep): gallery background and its sticky header (at 82% via color-mix with 16px blur).
- **Graphite Chrome** (chrome): top bar, sidebar, bottom tool bars, timeline; always paired with backdrop blur.
- **Solid Graphite** (chrome-solid): the selected segment of a segmented control, colour-well ring, icon on a checked visibility box.
- **Sheet** (sheet): popovers, dialogs, adjustment panel, floating windows, slider bubbles, toasts.
- **Raised Sheet / Control Sheet** (sheet-raised, sheet-control): control fills inside sheets: buttons, fields, segmented track, blend chips.
- **Hairline / Strong Hairline** (line, line-strong): 1px borders on every floating surface, dividers, hover fills on quiet controls; strong hairline is the slider track, the separators, the thumbnail ring.
- **Ink / Ink 72 / Ink 60** (ink, ink-secondary, ink-tertiary): primary text and active icons; resting icons and secondary text; labels, meta, units and slider ticks.

The light theme (`:root[data-theme='light']`) swaps the same roles to warm paper: desk `#9d9b97`, desk-deep `#e6e4df`, chrome `rgba(250, 249, 246, 0.84)`, sheet `rgba(250, 249, 246, 0.96)`, control sheets `#efeee9` / `#e4e2dc`, ink `#1d1c1a`, hairlines on black at the same 9% / 16%.

### Named Rules
**The Chalk Mark Rule.** Chalk yellow marks what is active, selected or primary, and nothing else. At most one chalk-filled button per surface; every other chalk use is a line, a ring or a 16% wash.

**The Ink Tiers Rule.** Text hierarchy is three opacities of one ink (100 / 72 / 60), never a second text hue.

**The Theme-Blind Overlay Rule.** Anything drawn on the canvas itself (marching ants, brush cursor, lasso, crop, transform box and handles, clone target, eyedropper loupe) is a white stroke paired with a dark stroke or dark ring, regardless of UI theme, so it reads over any artwork.

## Typography

**UI Font:** the platform system face (-apple-system / Segoe UI Variable Text / system-ui, with Roboto and Helvetica Neue fallbacks)

**Character:** the native face of whatever device the artist is on, so the chrome feels like the OS and never competes with the artwork. Hierarchy comes from weight (400, 550, 600, 650, 700) and ink opacity; sizes stay in a tight 11-18px band.

### Hierarchy
- **Headline** (650, 17px, -0.015em): sheet titles ("Capas", "Pinceles"); dialog titles sit one step up (18px, -0.02em). The gallery empty state is the only larger heading (30px, line-height 1.1, -0.03em).
- **Title** (600, 13px): layer names, brush names, artwork names in the gallery (14px there).
- **Body** (400, 14px, line-height 1.4): default text; empty-state copy at 15px in Ink 72.
- **Control** (550, 13px): segmented options, bottom-bar buttons, brush categories; buttons use 550 at the 14px body size.
- **Label** (600, 12px, +0.01em): field labels and section labels in Ink 60, sentence case.
- **Numeric** (400, 12px, tabular figures): slider values, dimensions, percentages, frame counters; 11px for layer meta and frame captions.

### Named Rules
**The Tabular Figures Rule.** Every number the user reads or scrubs (size, opacity, percent, px dimensions) uses tabular numerals so values don't jitter while dragging.

**The Sentence Case Rule.** Labels are sentence case at normal tracking; the chrome carries no uppercase, letter-spaced tags.

## Layout

The editor is a full-viewport stage: the canvas is centred and freely panned, zoomed and rotated; chrome floats above it in absolutely positioned layers. The top bar spans the full width at 46px (plus safe-area inset) with two tool groups pushed to either end (2px gaps, 1px separators 22px tall). The sidebar is a 44px-wide pill vertically centred 10px from the left edge (mirrored to the right for right-handed mode) holding a 150px size slider, the square modify button, the opacity slider, and undo/redo. Popovers drop 12px below the bar, 10px in from the side of the button that opened them. Contextual tool bars and the adjustment panel (max 560px) float centred 14px above the bottom edge; the animation timeline docks full-width to the bottom. Hiding the UI slides the bar up and the sidebar out (0.35s).

The gallery is a scrolling grid on the deep desk: 60px sticky header with the wordmark left and actions right, cards in `repeat(auto-fill, minmax(220px, 1fr))` with 34px row / 26px column gaps and 26px 30px padding; artworks sit bottom-aligned in 4:3 frames with name and dimensions centred beneath.

Spacing is a tight 2/4/6/8/10/14px rhythm inside chrome and sheets; larger gaps (26-34px) appear only in the gallery.

Below 700px: top-bar labels drop to icons (32px min width), popovers span the viewport with 8px margins, the brush library category column narrows to 110px, and the gallery grid drops to 150px minimum cards with 24px / 16px gaps.

## Elevation & Depth

A hybrid: chrome that is part of the frame (top bar, timeline, gallery header) is flat and separated by a hairline and backdrop blur; anything that floats over the canvas lifts with a soft, diffuse, two-layer shadow. The canvas and the gallery artworks behave as paper: a bright sheet with a soft cast shadow below it. No hard or offset shadows anywhere.

### Shadow Vocabulary
- **Sheet lift** (`box-shadow: 0 18px 50px rgba(0, 0, 0, 0.45), 0 2px 8px rgba(0, 0, 0, 0.3)`; light theme 0.18 / 0.1): popovers, dialogs, adjustment panel, floating windows, slider bubbles, toasts.
- **Chrome float** (`box-shadow: 0 6px 24px rgba(0, 0, 0, 0.25)` sidebar; `0 8px 30px rgba(0, 0, 0, 0.3)` bottom bar): floating chrome that stays on screen.
- **Paper cast** (`0 10px 28px rgba(0, 0, 0, 0.45), 0 1px 3px rgba(0, 0, 0, 0.3)`): gallery artwork; the editor canvas draws the same cast (blur 28, offset-y 10, 45% black).
- **Knob** (`0 1px 4px rgba(0, 0, 0, 0.45-0.5)`): slider thumbs; the selected segment gets `0 1px 3px rgba(0, 0, 0, 0.25)`.

### Named Rules
**The Float Only Rule.** Shadows belong to surfaces that float over the canvas; bar-attached chrome gets a hairline and blur instead.

**The Frosted Chrome Rule.** Every translucent chrome or sheet surface carries backdrop blur (18px chrome, 20-24px sheets); translucency without blur is not allowed.

## Shapes

Soft and rounded, never sharp, never pill-shaped buttons. Controls are 8-9px, sheets 12px, bottom bars and the adjustment panel 14px, dialogs 16px; the sidebar is a full pill (22px on a 44px width). Circles are reserved for the colour well, slider thumbs on horizontal rails, switch knobs, selection ticks and on-canvas handles. Thumbnails and chips are 6px. Popovers carry a 14px notch (a rotated square with a 3px corner) pointing at the bar button that opened them. Every floating surface has a 1px hairline border. Icons are Lucide outlines at the default 2px stroke, 19px in the top bar; checkmarks go to a 3px stroke.

## Components

### Buttons
Quiet, compact, tactile.
- **Shape:** gently rounded (9px), 34px tall, 14px horizontal padding, 7px icon gap.
- **Default:** Control Sheet fill with Ink text; hover lifts to the Strong Hairline fill; press scales to 0.98.
- **Primary:** Tailor's Chalk fill with Chalk Ink text; hover brightens 6%. One per surface (the gallery "Nuevo", dialog confirm).
- **Ghost / Danger:** ghost drops the fill; danger keeps the fill and turns the text Kiln Red.
- **Disabled:** 40% opacity.

### Tool buttons (top bar, sidebar, icon buttons)
- **Resting:** icon only in Ink 72, no fill; 36px tall in the top bar, 32px square elsewhere, 8-9px radius.
- **Hover:** Hairline fill, icon to full Ink.
- **Active:** icon to full Ink with a 2px chalk underline inset 10px from each side, 2px above the bottom edge. Icon buttons inside sheets mark "on" by turning the icon chalk.
- **Gallery text button:** "Galería" in weight 600, full Ink.

### Bottom-bar buttons
Contextual tool rows (selection, transform, adjustments) in a floating 14px-radius chrome bar. 34px, 13px/550 labels in Ink 72; active gets the Chalk Wash fill, full Ink, and an inset 2px chalk underline.

### Segmented control
3px-padded Control Sheet track (10px radius); 28px options in 13px/550 Ink 72; the selected option sits on Solid Graphite with full Ink and a small knob shadow.

### Inputs / Fields
- **Style:** 34px, Control Sheet fill, 8px radius, 1px transparent border, chalk caret.
- **Focus:** border turns chalk.
- **Switch:** 38x22 track in Strong Hairline, white 16px knob; on, the track turns chalk and the knob slides 16px.

### Measuring-tape sliders (signature)
- **Vertical (sidebar):** 6px track in Strong Hairline, Ink 72 fill from the bottom, 22x12 Ink knob, tick column every 10% in Ink 60 at 60% opacity. A bubble in Sheet with Sheet lift shows the value while dragging.
- **Horizontal (sheets):** name in 13px Ink 72, value right-aligned in tabular 12px Ink 60; 4px track, Ink 72 fill, 16px round knob, tick row every 10% below the track at 50% opacity.

### Popovers / sheets
Sheet fill, 1px Hairline, 12px radius, Sheet lift, 24px blur, notch pointing at the source button; 17px/650 title row (12px 14px 8px padding) with icon actions right; body padded 0 8px 10px; enters with a 0.22s fade-rise-scale on the house ease.

### List rows (layers, brushes, menus)
- **Menu item:** min 40px, 9px radius, icon in Ink 72, trailing sub-label in Ink 60; hover Hairline fill.
- **Layer row:** 52x40 thumbnail (6px, hairline ring, checkerboard for transparency), name 13px/600, blend chip (single-letter mode, 12px/700 on Control Sheet), visibility box (22px, 6px radius; checked = full Ink fill with Solid Graphite check). Selected: Chalk Wash with a 1px 50% chalk inset ring. Drag insertion is a 2px chalk line; drop-into is a 2px chalk inset ring; mask thumbnail shows a 2px chalk ring when targeted.
- **Brush item:** name plus a stroke preview 46px tall; selected = Chalk Wash with a 1px chalk inset ring; edit affordance appears on hover or selection.

### Colour well
30px circle of the current colour with a 2px Solid Graphite ring and a 1.5px Strong Hairline ring outside it; tap opens the colour sheet, drag onto the canvas fills (drag ghost: 34px circle with a white 3px ring).

### On-canvas chrome
- **Marching ants / lasso / rect-ellipse drafts:** 1.5px dashed (6/4) white stroke with an offset dark (`#111`) pass; lasso start point is a white dot with a dark ring.
- **Brush cursor:** 1px white circle at brush radius with a 60% black circle 1px outside it.
- **Transform box:** 3px 45%-black stroke under a 1.25px 95%-white stroke; handles are white circles (7px corners, 5px edges) with a 1.5px 55%-black ring; the rotate handle is chalk.
- **Crop:** 55% black veil outside, 2px white frame, rule-of-thirds lines at 50%.
- **Eyedropper loupe:** a 16px-thick ring 70px above the pointer, lower half previous colour, upper half sampled colour, framed in 1.5px 80% white with a centre cross.

### Gallery
Wordmark "Atelier" (20px/700, -0.03em) followed by a 22x3 chalk bar; header actions are text-plus-icon buttons with "Nuevo" as the single primary. Artwork cards lift 4px on hover (0.3s); in selection mode a 24px circular tick (white 2px ring over 30% black) turns chalk when selected and the artwork gets a 3px chalk outline offset 4px.

## Do's and Don'ts

### Do:
- **Do** keep chrome at the edges: top bar (46px), left pill sidebar, sheets dropping from the bar, contextual bars floating 14px above the bottom.
- **Do** pair every translucent surface with backdrop blur and a 1px hairline border.
- **Do** reserve chalk for active, selected and primary states; use the 16% Chalk Wash for selected rows and a 2px chalk line for the active tool.
- **Do** tick every continuous slider at 10% intervals and set its value in tabular numerals.
- **Do** draw on-canvas overlays as a white stroke paired with a dark stroke or ring, independent of the UI theme.
- **Do** read every colour from the custom properties so the light theme follows automatically.
- **Do** use the house ease `cubic-bezier(0.22, 1, 0.36, 1)` for entrances and chrome show/hide, and honour reduced motion.
- **Do** keep the keyboard focus ring blue (`2px`, offset `2px`), distinct from chalk.

### Don't:
- **Don't** introduce docked panel stacks, a menu bar or a tool palette; tools belong in the top bar, sidebar, sheets and contextual bottom bars.
- **Don't** add a second accent hue or use chalk as decoration, background or large fill beyond the single primary button.
- **Don't** use hard or offset shadows; depth is soft and diffuse, and only for floating surfaces.
- **Don't** add uppercase, letter-spaced labels or tags to the chrome.
- **Don't** make chrome opaque over the canvas; the artwork should stay faintly visible behind bars and sheets.
- **Don't** use Procreate's name, icons, brush files or other assets; the interaction model is shared, the identity is Atelier's.
