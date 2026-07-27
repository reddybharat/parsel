---
name: Parsel
description: Mono Signal layout with Precision cyan accents and JetBrains Mono
colors:
  primary: "#00a3c4"
  primary-dark: "#35d0ef"
  canvas: "#f3f3f3"
  canvas-dark: "#0a0a0a"
  surface: "#ffffff"
  surface-dark: "#111111"
  soft: "#ebebeb"
  soft-dark: "#1a1a1a"
  text: "#0a0a0a"
  text-dark: "#f5f5f5"
  muted: "#6b6b6b"
  muted-dark: "#a3a3a3"
  border: "#d4d4d4"
  border-dark: "#2a2a2a"
  pos: "#15803d"
  neg: "#b91c1c"
  pos-dark: "#4ade80"
  neg-dark: "#f87171"
typography:
  body:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  title:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.35
  headline:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.2
  label:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "0.75rem"
    fontWeight: 600
    letterSpacing: "0.06em"
rounded:
  none: "0px"
spacing:
  tight: "6px"
  sm: "8px"
  md: "12px"
  lg: "16px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    rounded: "{rounded.none}"
    padding: "8px 16px"
    height: "36px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.none}"
    padding: "12px"
---

# Design System: Parsel

## Overview

**Creative North Star: "Mono Signal × Precision Cyan"**

Parsel is a sharp personal INR console: black/white chrome, zero radius, JetBrains Mono throughout. Cyan (`#00a3c4` / `#35d0ef`) is the only brand accent — used for primary buttons, charts, focus, and brand wordmark. Green and red encode money direction only. Dashboard packing is intentionally tight (≈6px gaps) to cut dead space between cards.

**Key Characteristics:**
- Monochrome surfaces and hairline borders
- Cyan for actions + charts only
- Green/red for inflow/outflow
- JetBrains Mono as the single typeface
- Sharp corners, no resting shadows, dense card rhythm

## Colors

### Primary
- **Precision Cyan** (#00a3c4 / dark #35d0ef): Buttons, charts, focus rings, brand.

### Neutral
- Ink / paper / soft / hairline borders as listed in frontmatter.

### Semantic money
- **Inflow green** and **outflow red** — never used for decorative chrome.

### Named Rules
**The Cyan Lane Rule.** Cyan is for action and data visualization — not large decorative washes.

**The Money Meaning Rule.** Green/red appear only on signed amounts and money deltas.

## Typography

**Body / Display:** JetBrains Mono

**The One Voice Rule.** No second face. Hierarchy is size and weight only.

## Layout

Operate-mode density. Overview card gaps ≈ 6px (`gap-1.5`). Sharp tiles, no soft radius.

## Elevation & Depth

Flat by default. Structure from canvas → surface + 1px borders only.

## Shapes

**Zero radius** on cards, buttons, nav items, and avatars in the shell/overview system.

## Components

### Buttons
Primary = cyan fill. Outline = hairline mono. Sharp corners, no shadow.

### Cards
Hairline border, flat surface, tight padding (12px), dense gaps between siblings.

### Charts
Single-series fills/strokes use Precision Cyan.

## Do's and Don'ts

### Do:
- **Do** keep dashboard gaps tight.
- **Do** use cyan for primary CTAs and charts.
- **Do** keep money amounts in green/red.

### Don't:
- **Don't** reintroduce soft card shadows or large radii on Overview.
- **Don't** paint inflow amounts in cyan — cyan is not money-positive.
- **Don't** add a second display font.
