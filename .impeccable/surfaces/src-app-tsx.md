---
version: 1
slug: "src-app-tsx"
primary_target: "src/App.tsx"
related_targets: []
---

# Surface brief: Atelier studio (canvas editor + gallery)

Scope: the whole app — Gallery and Canvas editor. Mode: Operate.
Audience/job: illustrate, retouch, design prints and garments on desktop (mouse/tablet) and tablet (stylus). Task parity with Procreate is the brief.
Constraints: user pinned the Procreate interaction model ("que sea como procreate, que contenga lo mismo"). Canon taken by user pin; roll 26cd26bb overridden. Code-led (no image generation in harness).

## Direction contract

THESIS: The canvas owns the screen; every tool lives in thin translucent chrome at the edges, exactly where a Procreate user reaches for it. Refuses the desktop-editor arrangement (Photoshop menus, docked panel stacks, tool palettes).

OWN-WORLD: Graphite chrome (near-black warm grey, 72% opaque, backdrop blur) over a neutral mid-grey desk; icons 1.5px stroke, white at 70%, active tool full white with a tailor's-chalk yellow underline. Sliders read as a measuring tape: tick marks every 10%. Popovers are dark rounded sheets with 12px radius and a pointer notch. System UI face; tabular numerals for sizes/percents.

STORY: User opens the gallery, starts a canvas or imports a photo, paints with pressure-sensitive brushes, stacks layers with blend modes, adjusts, selects, transforms, exports PNG/JPG/PSD-free formats. Nothing needs a manual.

FIRST VIEWPORT: Editor: 44px top bar — left: Gallery, Actions, Adjustments, Selection, Transform; right: Brush, Smudge, Eraser, Layers, color well. Left edge floating sidebar: size slider, modify square (eyedropper), opacity slider, undo/redo. Canvas centered, shadowed sheet on the desk. Gallery: grid of artwork thumbnails, top-right Select/Import/Photo/+.

FORM: Canon (Procreate interaction model), user-pinned; list position n/a; seed key 26cd26bb.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
