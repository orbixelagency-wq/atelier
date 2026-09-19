# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

delegated: React + Vite + TypeScript, painting engine hand-written on Canvas 2D (per-layer offscreen canvases, stamp-based brush engine with Pointer Events pressure/tilt). Installable as a PWA, works offline. Chosen because the tool surface is large (many panels, state, undo) and the engine needs direct pixel control without a heavy graphics dependency.

## Users

The owner of Orbixel / the THANK YOU clothing brand, and creatives like them: people who illustrate, retouch photos, design prints and garments. They work on a PC with mouse or graphics tablet, or on an iPad/tablet with a stylus in the browser.

## Product Purpose

Atelier is a full raster painting and image editing studio in the browser, with the same breadth as Procreate: gallery, canvases, brush library and brush studio, layers with blend modes and masks, adjustments, selections, transform, color tools, drawing guides, text, animation assist, and import/export. It is a general base, not specialised on one use case; garments, prints and photo edits are all just images to it. Success: the user can open any image or start a blank canvas and do everything they would do in Procreate without leaving the browser.

## Positioning

Procreate-class depth without an iPad: runs in any modern browser, on desktop and tablet, free and local-first (artworks stay on the device).

## Operating Context

Long sessions with the canvas occupying the screen; interface must recede. Stylus pressure/tilt, touch gestures (pinch zoom/rotate, two-finger undo, three-finger redo) and keyboard shortcuts on desktop.

## Capabilities and Constraints

- Name: Atelier. Must never be called or branded Procreate; no Procreate assets, icons or brush files are copied.
- Everything runs client-side; artworks persist in IndexedDB.
- Undecided: native .procreate file import (proprietary format), 3D painting, video timelapse export.

## Brand Commitments

User explicitly asked that it behave and contain what Procreate contains ("que sea como procreate, que contenga lo mismo"). Familiar Procreate interaction model is binding.

## Product Principles

1. Canvas first: chrome is minimal and translucent over the art.
2. Feature parity over novelty: if Procreate has it, Atelier has it.
3. Local and private by default.
4. Every destructive action is undoable.
