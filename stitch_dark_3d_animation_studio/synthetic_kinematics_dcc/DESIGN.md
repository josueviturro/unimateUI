---
name: Synthetic Kinematics DCC
colors:
  surface: '#10141a'
  surface-dim: '#10141a'
  surface-bright: '#353940'
  surface-container-lowest: '#0a0e14'
  surface-container-low: '#181c22'
  surface-container: '#1c2026'
  surface-container-high: '#262a31'
  surface-container-highest: '#31353c'
  on-surface: '#dfe2eb'
  on-surface-variant: '#bbcabf'
  inverse-surface: '#dfe2eb'
  inverse-on-surface: '#2d3137'
  outline: '#86948a'
  outline-variant: '#3c4a42'
  surface-tint: '#4edea3'
  primary: '#4edea3'
  on-primary: '#003824'
  primary-container: '#10b981'
  on-primary-container: '#00422b'
  inverse-primary: '#006c49'
  secondary: '#4cd7f6'
  on-secondary: '#003640'
  secondary-container: '#03b5d3'
  on-secondary-container: '#00424e'
  tertiary: '#ffb95f'
  on-tertiary: '#472a00'
  tertiary-container: '#e29100'
  on-tertiary-container: '#523200'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#6ffbbe'
  primary-fixed-dim: '#4edea3'
  on-primary-fixed: '#002113'
  on-primary-fixed-variant: '#005236'
  secondary-fixed: '#acedff'
  secondary-fixed-dim: '#4cd7f6'
  on-secondary-fixed: '#001f26'
  on-secondary-fixed-variant: '#004e5c'
  tertiary-fixed: '#ffddb8'
  tertiary-fixed-dim: '#ffb95f'
  on-tertiary-fixed: '#2a1700'
  on-tertiary-fixed-variant: '#653e00'
  background: '#10141a'
  on-background: '#dfe2eb'
  surface-variant: '#31353c'
typography:
  headline-lg:
    fontFamily: Geist
    fontSize: 1.5rem
    fontWeight: '600'
    lineHeight: 2rem
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Geist
    fontSize: 1.25rem
    fontWeight: '600'
    lineHeight: 1.75rem
    letterSpacing: -0.015em
  headline-sm:
    fontFamily: Geist
    fontSize: 1rem
    fontWeight: '600'
    lineHeight: 1.5rem
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Geist
    fontSize: 0.875rem
    fontWeight: '400'
    lineHeight: 1.375rem
  body-md:
    fontFamily: Geist
    fontSize: 0.8125rem
    fontWeight: '400'
    lineHeight: 1.25rem
  body-sm:
    fontFamily: Geist
    fontSize: 0.75rem
    fontWeight: '400'
    lineHeight: 1.125rem
  label-lg:
    fontFamily: JetBrains Mono
    fontSize: 0.8125rem
    fontWeight: '500'
    lineHeight: 1.125rem
    letterSpacing: -0.01em
  label-md:
    fontFamily: JetBrains Mono
    fontSize: 0.75rem
    fontWeight: '500'
    lineHeight: 1rem
    letterSpacing: 0em
  label-sm:
    fontFamily: JetBrains Mono
    fontSize: 0.6875rem
    fontWeight: '400'
    lineHeight: 0.875rem
    letterSpacing: 0.02em
  label-xs:
    fontFamily: JetBrains Mono
    fontSize: 0.625rem
    fontWeight: '400'
    lineHeight: 0.75rem
    letterSpacing: 0.04em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 0.25rem
  margin: 0.5rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1rem
  space-xl: 1.5rem
---

## Brand & Style

This design system is tailored for a professional 3D AI animation workstation and creative pipeline suite where precision, speed, and sustained cognitive focus are essential. It serves technical directors, AI riggers, character animators, and computational pipeline artists handling generative kinematics, scene descriptors, node graphs, and deep telemetry.

The visual style merges high-density technical utility with modern workstation refinement. It draws heavily from structural technical minimalism and high-contrast instrumentation design:
- **Low-Fatigue Dark Neutrality:** Deep, matte obsidian and slate foundations prioritize viewport contrast, reducing optic strain during multi-hour rigging and graph-editing sessions.
- **Instrument Precision:** Information hierarchy relies on micro-borders, sharp structural containment, and crisp tactical status accents (neon emerald, cyan, and amber) rather than decorative gradients or soft blurs.
- **Surgical Density:** Component spacing balances tight 4px/8px incremental micro-padding with readable structural docking systems, allowing extensive property inspector trees, telemetry matrices, and spatial timelines to cohabitate without perceptual noise.

## Colors

The palette uses a low-luminance neutral ramp paired with distinct, high-signal chromatic accents designed for immediate state interpretation across viewport overlays and node states.

### Palette Architecture
- **Canvas & Viewport Root (`#0d1117`):** The foundational substrate. Used for viewport underlays, root graph canvases, and global window scaffolding.
- **Surface Elevation 1 (`#161b22`):** Primary structural surface for docked panels, outliners, and inspector sidebars.
- **Surface Elevation 2 (`#21262d`):** Interactive containers, header ribbons, active tabs, floating gizmo palettes, and card rows.
- **Surface Elevation 3 (`#30363d`):** Elevated utility components, hover states, input wells, and dialogs.
- **Structural Lines & Outlines (`#30363d` to `#484f58`):** Delimiting borders across all splitters, dock headers, and matrix inputs.

### Accents & Status Semantics
- **Primary Accent (`#10b981` — Emerald):** Pipeline execution, active rigging constraints, successful generative compute, confirmed keyframes, active selection highlights.
- **Secondary Accent (`#06b6d4` — Cyan):** AI inference cycles, latent diffusion progress, procedural modifiers, camera spatial telemetry, FK/IK toggle nodes.
- **Tertiary Accent (`#f59e0b` — Amber):** GPU memory thresholds, constraint over-extension warnings, unbaked dynamic caches, pending pipeline jobs.
- **Critical / Fault (`#ef4444` — Crimson):** Unresolved joint errors, VRAM allocation faults, syntax failures in procedural node code.
- **Text & Numeric Metrics:** `#f0f6fc` for high-emphasis metric displays and node titles; `#8b949e` for parameter keys, spatial axes labels, and inactive properties; `#484f58` for disabled indicators and timeline ticks.

## Typography

Typography prioritizes tabular legibility, rapid scannability, and numeric alignment. 

- **Geist** provides an unembellished, highly structured grotesque base for operational hierarchies, panel titles, inspector groups, modal alerts, and general pipeline documentation.
- **JetBrains Mono** governs all data-dense coordinates (X, Y, Z, W), quaternion matrices, bone hierarchy keys, prompt tokens, timeline frame counters, and hardware compute rates (VRAM, TFLOPS, CUDA cores). Its fixed character widths prevent visual jitter during real-time animation scrub and active parameter scrubbing.

### Hierarchical Usage Rules
- `headline-*` levels are strictly reserved for module headers, primary DCC workbench mode indicators, and top-level pipeline modal titles.
- `body-*` levels drive descriptive tooltips, inspector field documentation, workflow logs, and interactive assistant output.
- `label-*` levels drive all scrubbable inputs, timeline intervals, bone telemetry, telemetry graphs, and terminal output. Micro-labels (`label-xs`) apply to 3D gizmo tags and mini graph axis markers.

## Layout & Spacing

The workstation uses a high-density, multi-pane docking architecture composed of resizable, split-pane quadrants around a dominant 3D canvas viewport.

### Layout Model
- **Docker Framework:** Zero extraneous negative space. Panels abut one another separated by explicit 1px splitters with 4px interactive hit-targets.
- **4px Base Grid:** Every component, input row, toolbar segment, and dock tab adheres to an absolute 4px baseline grid. Inspector fields maintain uniform heights of 24px (compact) or 28px (standard).
- **Responsive Workspace Modes:**
  - **Quad / Studio Mode (>1600px):** Simultaneous rendering of 3D Viewport (Center/Flex), Graph/Timeline (Bottom/Fixed 240px–360px), Inspector & Rig Tree (Right/320px), and Prompt/Generative Node Queue (Left/300px).
  - **Dual Pane Mode (1024px–1599px):** Inspector and Pipeline Queue collapse into tabbed sidebars; timeline remains docked to the bottom.
  - **Single Focus / Compact Mode (<1024px):** Intended for telemetry monitoring or review playback; toolbars collapse into floating HUD drawers over the canvas viewport.

## Elevation & Depth

Visual hierarchy uses flat, high-contrast surface tiers and crisp micro-borders rather than ambient blur drop-shadows. This preserves render clarity and avoids muddying dark viewport backgrounds.

### Elevation Tiers
- **Sub-Floor (`#090d12`):** Sunken wells, terminal panels, and timeline track backgrounds.
- **Ground Tier (`#0d1117`):** Native 3D viewport canvas and background workspace canvas.
- **Docked Surface Tier (`#161b22`):** Primary inspector sheets, sidebars, and structural toolbars. Demarcated by a 1px border of `#30363d`.
- **Raised Tool Tier (`#21262d`):** Active buttons, contextual parameter panels, and floating gizmo overlay bars.
- **Overlay HUD Tier (`#161b22` with 95% opacity):** Viewport HUD indicators, bone parameter floaters, and right-click context menus. Uses a precise 1px border of `#484f58` and a disciplined shadow (`0 4px 12px rgba(0, 0, 0, 0.65)`).
- **Focus / Active Glow:** Focused inputs and active transform handles use zero shadow blur, instead employing a crisp 1px direct border in `#10b981` or `#06b6d4`.

## Shapes

The geometric language uses precise, industrial contours.

- **Corner Geometry (`roundedness: 1`):** Micro-radius (4px / 0.25rem) across panel elements, inputs, buttons, and node containers. Dock windows, viewport borders, and splitters maintain hard 0px boundaries against display edges to retain screen real estate.
- **Pills and Badges:** Status chips and telemetry pills utilize an 8px (`rounded-lg`) radius to clearly distinguish dynamic operational statuses from structural data inputs.
- **Node Graph Elements:** Node cards utilize 4px outer corner radii, with sharp interior dividers for input and output sockets to maintain exact alignment with connection bezier wires.

## Components

### Buttons & Scrubbable Triggers
- **Primary Action (Execute/Bake/Generate):** Background `#10b981`, text `#0d1117` (bold `Geist`), hover `#34d399`. Height 28px, padding `0 12px`.
- **Secondary / Panel Tools:** Background `#21262d`, border 1px solid `#30363d`, text `#f0f6fc`, hover background `#30363d`.
- **Numeric Drag Scrubbers:** Background `#161b22`, border 1px solid `#30363d`, label in `#8b949e`, value in `#f0f6fc` (`JetBrains Mono`). During horizontal drag-scrub, display a thin `#06b6d4` progress floor fill under the numerical text.

### Parameter Inputs & Text Fields
- **Inspector Coordinates (X/Y/Z):** Rendered in a joint 3-segment input group. Prefix badges with distinct axis colors (X: `#f87171` muted red, Y: `#4ade80` muted green, Z: `#60a5fa` muted blue). Value text in `JetBrains Mono` at `label-md`.
- **Prompt Formulation Field:** Multi-line text well in `#0d1117`, border 1px solid `#30363d`, focus border 1px solid `#06b6d4`. Token chips embedded directly within the field.

### Status Indicators & Chips
- **Telemetry Pills:** 18px height, `label-xs` typography, background `#161b22`, border 1px solid `#30363d`. Contains a 4px circular LED dot: pulsing `#06b6d4` for active generation, static `#10b981` for idle/ready, and `#f59e0b` for memory saturation.
- **Bone Hierarchy Tree Items:** Indented row items (18px height) with hover state `#21262d`. Selection indicated by a solid 2px left border in `#10b981` with background `#161b22`.

### Dock Tabs & Viewport Header Bars
- **Tab Headers:** 26px height, font `label-md`. Inactive tabs render in `#8b949e` on `#161b22`; active tabs render in `#f0f6fc` on `#21262d` with an accent border (1px solid `#10b981`) along the top edge.

### Telemetry & Resource Gauges
- **VRAM / GPU Performance Strip:** Horizontal slim-line bars (4px height) set inside `#0d1117` tracks. Fill dynamic transitions from `#06b6d4` (<70%) to `#f59e0b` (70-90%) to `#ef4444` (>90%). Paired with numerical value display in `label-xs`.