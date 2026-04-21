---
phase: 0
slug: waveform-prototype
status: approved
shadcn_initialized: false
preset: none
created: 2026-04-21
reviewed_at: 2026-04-21
---

# Phase 0 — UI Design Contract

> Visual and interaction contract for the Phase 0 waveform prototype. This is a **throwaway `/prototype` route** whose job is to make an iPhone-Safari screenshot defensible. No design system, no component library — just page chrome sufficient to prove the Canvas primitive. Substantive design decisions for the real monitor land in Phase 2's UI-SPEC under clinical sign-off.
>
> All prototype-scope decisions are locked in `00-CONTEXT.md` (D-01 through D-16). This document records the visual/interaction contract that falls out of those decisions and fills the small gap CONTEXT delegated to Claude's discretion (FPS overlay layout, background color, overlay font).

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none |
| Preset | not applicable — P0 is throwaway; real design system lands in Phase 2 |
| Component library | none — Phase 0 renders one canvas and one overlay, nothing else |
| Icon library | none |
| Font | system font stack: `ui-monospace, SFMono-Regular, Menlo, monospace` for FPS overlay; `-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif` for any page text |

**Rationale:** D-02 explicitly defers Tailwind v4, shadcn/ui, Zustand, Zod, Web Audio, and Pusher to Phase 2. Phase 0 ships with **zero UI dependencies** beyond React 19 itself. All chrome is inline `style={}` or a single `app/prototype/page.module.css` at Claude's discretion during execution. System fonts mean no `next/font` wiring and no download cost.

---

## Spacing Scale

Prototype uses a minimal 4-based scale for the small amount of chrome present. No layout grid, no card system — these are Phase 2 concerns.

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | FPS overlay internal padding |
| sm | 8px | Overlay edge offset from canvas corner |
| md | 16px | Page padding around the canvas block |
| lg | 24px | (unused in P0 — reserved for Phase 2 inheritance) |

Exceptions: none.

---

## Typography

Phase 0 renders **two strings on screen** total: the FPS overlay and an optional page title. No body copy, no headings, no labels beyond that.

| Role | Size | Weight | Line Height | Usage |
|------|------|--------|-------------|-------|
| Overlay numeric | 14px | 600 | 1.2 | `fps: 60 · min: 58` text in FPS overlay |
| Overlay label | 11px | 500 | 1.2 | `FPS` tag inside overlay |
| Page title (optional) | 16px | 500 | 1.3 | `/prototype` — throwaway route label (top-left, 16px page padding). Optional — Claude may omit entirely if `<title>` suffices. |

**Rationale:** Monospace for the FPS overlay so the digits don't jitter width frame-to-frame (would distract from assessing the waveform during screenshot capture). 14px is comfortable on iPhone at DPR=3 without dominating the canvas area.

---

## Color

This palette is deliberately NOT the Phase 2 monitor palette. It's prototype chrome — black background + green waveform + dim white overlay. The Phase 2 clinical palette (HR green, SpO₂ cyan, white NIBP, red alarm) is defined in Phase 2's UI-SPEC and must not be inferred from this document.

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `#000000` | Page background, canvas background — matches the "bedside monitor" mental model from `design/src/canvasChannel.jsx` (which used `#0a0a0c`; we round to pure black for Phase 0 because there is nothing else on screen to contrast against) |
| Secondary (30%) | `#0a0a0c` | Optional very-dark-gray zone around the canvas bounds if Claude wants visual separation between canvas and page — otherwise unused |
| Accent (10%) | `#22c55e` | ECG Lead II sinus waveform stroke (locked by D-06: "green, not a vendor-specific green") |
| Overlay text | `rgba(255, 255, 255, 0.72)` | FPS overlay — dim enough to not distract during waveform screenshot capture, bright enough to read at a glance |
| Overlay warning | `#f59e0b` | Optional: FPS overlay tints amber when rolling-avg drops below 55 fps — helps Claude + user spot throttling during the 60-second capture run |

**Accent reserved for:**
- ECG Lead II waveform stroke (single polyline, drawn at `lineWidth = ceil(DPR * 1.4)` CSS-px per D-06 / Pitfall 4). **Not used for anything else on the page.** No buttons, no borders, no overlay tint.

**Rationale:**
- Black-on-black background eliminates all visual competition with the green waveform during 60-second FPS capture. This is the entire point of the prototype.
- `#22c55e` is Tailwind's `green-500` — a neutral, non-vendor green. Locked by D-06.
- Overlay amber warning (`#f59e0b`) is a Claude's-discretion addition under the CONTEXT "FPS overlay visual layout" delegation. The signal-to-noise benefit during testing outweighs the "one more color" cost.

---

## Copywriting Contract

The prototype has almost no copy. What little exists is locked here so execution has a single source of truth and doesn't invent alternates.

| Element | Copy |
|---------|------|
| HTML `<title>` | `NeoSim — Waveform Prototype` |
| Page heading (optional, top-left) | `/prototype` |
| FPS overlay (rolling-avg ≥ 55 fps) | `FPS  60 · min 58` (format: `FPS {avgRounded} · min {min}` — both numbers are rolling over the last ~3 seconds) |
| FPS overlay (rolling-avg < 55 fps) | Same format, overlay text color switches to `#f59e0b` (amber). No text change. |
| Primary CTA | **none** — prototype auto-starts rendering on route load; no user gesture needed at P0 because no Web Audio (deferred to P2 per D-02) |
| Empty state | **not applicable** — engine always renders; "no data" is not a possible state |
| Error state | **not applicable** — if canvas init fails, render a minimal inline text node: `Canvas init failed — open this page in iPhone Safari 16.4+` in overlay-text color. No fancy error boundary. |
| Destructive confirmation | **not applicable** — no destructive actions in the prototype |
| Legal footer | **not required at P0** — the "NOT A MEDICAL DEVICE · EDUCATIONAL" persistent footer is a Phase 2 requirement (LEGAL-02, MON-09). The prototype is an internal testing surface, not a user-facing route. |

**Rationale for omitting CTAs, empty states, and error flows:** CONTEXT §Phase Boundary limits P0 to "a single canvas rendering one ECG Lead II sinus channel" plus FPS overlay. Inventing CTA or empty-state copy would be out-of-scope design work that gets thrown away when the `/prototype` route is deleted after Phase 2.

---

## Layout & Interaction

Not in the template but worth locking explicitly so executor has no ambiguity.

### Page layout

- Single full-viewport page at `/prototype` (no header, no nav, no footer).
- Landscape and portrait both render the same — no orientation prompt at P0 (that's MON-10 / Phase 2). User is expected to hold the phone in landscape for the screenshot.
- Canvas fills a rectangle in the CSS viewport. Recommended: full viewport width, `height: 40vh` to `60vh` range. Claude picks the exact height during execution to balance waveform visibility against iPhone Safari chrome taking vertical space.
- Optional 16px page padding around the canvas block. Zero padding is also acceptable if Claude prefers true edge-to-edge.

### FPS overlay

- Position: **top-right** corner, inset 8px from canvas edges. Top-right (not top-left) so it never overlaps the QRS spike area when the sweep cursor is near the beginning of a sweep.
- Size: auto-width, ~60px wide × ~32px tall at baseline text size.
- Background: `rgba(0, 0, 0, 0.55)` with `backdrop-filter: blur(6px)` (falls back gracefully on iOS — blur is visual-polish-only, not a correctness requirement).
- Border radius: 6px. Padding: 4px 8px.
- Updates: once per second, reading rolling-avg and min from a `performance.now()`-backed ring (last ~180 frame deltas ≈ 3 seconds at 60 fps). Do NOT update per-frame — that creates a text-layout reflow at 60 Hz and invalidates its own measurement.
- Text content format: `FPS {avg} · min {min}` where both values are rounded integers. Example: `FPS 60 · min 58`.

### Canvas surface

- Backing store: `cssWidth × DPR` and `cssHeight × DPR` with `ctx.scale(DPR, DPR)` once at init. **No `Math.min(DPR, 2)` cap** — WAVE-05 + D-07 require real DPR=3 support.
- Fill: `#000000` at init; thereafter only the clear-ahead rect is cleared per frame (sweep-draw primitive per D-06, Pitfall 4).
- Stroke: `#22c55e`, `lineWidth = ceil(DPR * 1.4)` CSS-px, `lineJoin: "round"`, `lineCap: "round"`.
- Clear-ahead width: `ceil(pxPerFrame) + lineWidth + 2` CSS-px (Pitfall 4 envelope). Exact formula at Claude's discretion within that envelope.
- Sweep direction: left-to-right. Sweep window: 5 seconds.
- No grid, no calibration bars, no paper-speed label at P0 — all Phase 2.

### Interaction

- Zero interactive elements at P0. No buttons, no sliders, no keyboard handlers, no tap targets.
- Route renders and runs autonomously. User's interaction model is "load the page, wait 60 seconds, screenshot."

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | none | not applicable — shadcn not initialized at P0 (D-02 defers to Phase 2) |
| third-party | none | not applicable |

**Rationale:** Zero UI components are imported in Phase 0. Registry vetting gate is trivially satisfied by not having any registry entries.

---

## Accessibility Notes

Prototype accessibility is minimal-but-not-broken:
- Canvas has `role="img"` and `aria-label="ECG Lead II sinus rhythm waveform — prototype"` so a screen reader doesn't announce "canvas" with no context. This is the only a11y concession at P0.
- FPS overlay is `aria-hidden="true"` (developer instrumentation, not user-facing).
- No focus management needed — there is nothing focusable on the page.
- Phase 2 inherits a full a11y contract under its own UI-SPEC. Do not treat this minimal scaffold as the a11y target for the real monitor.

---

## Phase-2 Handoff Notes

What this UI-SPEC does **not** define (intentionally; these are Phase 2's UI-SPEC responsibilities):

- Monitor tile layout (HR green, SpO₂ cyan, NIBP white, NIBP cuff animation, APGAR timer)
- Alarm banner and tile flash styling
- Rhythm picker UI
- Color contract for the full clinical palette
- Typography scale beyond the prototype's monospace overlay
- Legal disclaimer footer (LEGAL-02 / MON-09)
- Portrait-rotate overlay (MON-10 / Phase 3)
- Tap-to-start overlay (ALRM-12 / Phase 3)
- Any shadcn preset, Tailwind tokens, or design-system initialization

These are **not omissions** — they are correctly deferred per D-02 and Phase 2's requirement scope. Any Phase 0 executor who feels the urge to pre-build these belongs in Phase 2 instead.

---

## Checker Sign-Off

- [x] Dimension 1 Copywriting: PASS — overlay format locked, no invented CTAs, out-of-scope items explicitly marked `not applicable`
- [x] Dimension 2 Visuals: PASS — canvas + overlay + black background, nothing else on screen
- [x] Dimension 3 Color: PASS — 60/30/10 split (black dominant / dark-gray secondary / green accent), accent reserved-for list names exactly one element (waveform stroke)
- [x] Dimension 4 Typography: PASS — two font stacks declared (monospace for overlay, system sans for optional title); three size/weight combinations total
- [x] Dimension 5 Spacing: PASS — 4/8/16 multiples only; `lg` declared-but-unused and flagged as P2 inheritance
- [x] Dimension 6 Registry Safety: PASS — no registries in use, no third-party blocks, vetting gate trivially satisfied

**Approval:** pending (gsd-ui-checker to verify and upgrade status to `approved`)

---

*Phase 0 UI-SPEC drafted: 2026-04-21*
*Upstream decisions consumed: CONTEXT.md D-01..D-16; ROADMAP.md §Phase 0 success criteria; REQUIREMENTS.md WAVE-01/03/04/05/07/10; PITFALLS.md §4/§5/§13*
