# Phase 0: Waveform Prototype on iPhone — Research

**Researched:** 2026-04-21
**Domain:** Next.js 15.5 scaffold + DPR-aware Canvas 2D sweep-draw + time-based ECG waveform engine on iPhone Safari
**Confidence:** HIGH (scaffold, Canvas DPR, sweep-draw math, engine separation — all verified against official docs + npm registry + cited research files). MEDIUM on Vitest+React19+Next 15.5 interaction (verified by peer-dep inspection, not yet executed on disk).

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Scaffold**
- **D-01:** Real Next.js 15.5 project scaffold is created in Phase 0 and lives on into Phase 2. Only `app/prototype/page.tsx` is the throwaway artifact; `lib/waveforms/engine-state.ts`, `lib/waveforms/sampleEcg.ts`, `lib/clinical/`, and all TS/test/lint config ship forward unchanged.
- **D-02:** Minimum scaffold kit at P0: Next.js 15.5 (App Router) · React 19 · TypeScript strict · Vitest · **pnpm** (package manager) · **biome** (single tool for lint + format, replaces ESLint + Prettier). Deferred to Phase 2: Tailwind v4, shadcn/ui, Zustand v5, Zod v4, Web Audio, Pusher client.
- **D-03:** Directory layout at P0: `app/prototype/page.tsx` (throwaway render harness) · `lib/waveforms/engine-state.ts` (phase, jitter, rFired — WAVE-10) · `lib/waveforms/sampleEcg.ts` (ported sinus template from `design/src/waveforms.js`) · `lib/waveforms/sweepCanvas.ts` (DPR-aware sweep-draw primitive) · `lib/clinical/` (empty placeholder so P2 has a home for `nrp.ts`) · `tests/waveforms/`.

**Prototype Scope**
- **D-04:** Render exactly one channel: ECG Lead II sinus rhythm, template-lookup beat (WAVE-07) at 250 Hz (WAVE-01). No pleth, no rhythm switch, no asystole at P0.
- **D-05:** Drop the design prototype's `ecgVtTemplate`, `ecgVfPoint`, `sampleCapno`, and any afib/vf/vt branches during the port.
- **D-06:** Sweep window 5 seconds, sweep direction left-to-right with clear-ahead region, line color green (#22c55e-ish, not a vendor-specific green), line width scaled with DPR per Pitfall 4 (`ceil(pxPerFrame) + lineWidth + 2` clear-ahead). Clinical 25 mm/s paper speed is the target mental model; exact px/sec Claude's discretion during implementation.
- **D-07:** Canvas backing store is `cssSize × devicePixelRatio` with real `DPR=3` support (not the design prototype's `Math.min(DPR, 2)` shortcut — WAVE-05 explicitly requires DPR=3 crisp).

**Engine Architecture**
- **D-08:** Waveform engine state (`phase`, `jitter`, `rFired`, `lastT`) lives in a dedicated module-scoped object in `lib/waveforms/engine-state.ts`, imported by the sample function. It is **not** a field of any (future) vitals store. A Pusher diff merging `{ hr: 150 }` into vitals must not touch engine state — this is WAVE-10.
- **D-09:** Engine is `performance.now()`-delta driven, not frame-counted. Under iPhone Low Power Mode rAF throttle to 30 fps, HR period must remain clinically stable (Pitfall 5). Internal advance is `elapsedMs / msPerPixel`, never a fixed per-frame step.
- **D-10:** Waveform buffer is a single `Float32Array(sampleRate × sweepSeconds)` per channel, allocated once, written via modular index. No history array, no `.push()`, no reallocation (Pitfall 13).

**Verification**
- **D-11:** Engine-state / vitals-store merge regression is a **Vitest unit test** at `tests/waveforms/engine-state.merge.test.ts`. Shape: (1) tick the engine to a mid-beat phase (e.g., 0.4), (2) apply a partial vitals diff `{ hr: 150 }` through whatever merge primitive the scaffold uses, (3) assert `engineState.phase` is unchanged and `rFired` is unchanged.
- **D-12:** No property-based / fuzz testing at P0 (no `fast-check` dependency yet). Vitest convention established here becomes the P2 test standard.

**Pass Criteria & Evidence**
- **D-13:** Physical test device is the user's newer iPhone (13/14/15/16-class). iPhone 12 is the roadmap floor; iPhone 12 re-verification is flagged as a **Phase 5 soak item**.
- **D-14:** Phase 0 "passed" requires all of: (a) FPS overlay on `/prototype` screenshot after a continuous 60-second run showing rolling-avg and min fps in the target band (≥58 avg, ≥55 min); (b) Safari Web Inspector heap snapshot at t=0 and t=5min showing heap flat (no ArrayBuffer growth); (c) Vitest merge regression test green; (d) visual inspection on DPR=3 showing no ghosting or tearing.
- **D-15:** Evidence artifacts (screenshots + heap snapshot thumbnails) are pasted into `00-VERIFICATION.md` when `/gsd-verify-work` runs. No video recording, no metrics-JSON collector at P0.

**Deployment**
- **D-16:** Vercel preview deploy is the iPhone test target (not localhost-over-LAN). Preview URL per branch is sufficient.

### Claude's Discretion
- FPS overlay visual layout (where on screen, font, color) — follow `design/` aesthetic roughly but this is throwaway. (UI-SPEC locks this: top-right, 8px inset, 14px monospace, rgba(255,255,255,0.72) white → #f59e0b amber when avg < 55 fps.)
- Exact clear-ahead pixel width formula within the Pitfall 4 envelope.
- Whether the engine exports a pure `sampleEcg(t, state) → { v, rPeak }` function or a stateful class wrapper — pick whichever makes the Vitest merge test cleanest.
- Biome config (rule severity levels) — use the official `biome init` defaults unless they conflict with TS strict.
- Whether to wire up `pnpm dlx` vs `pnpm exec` for one-off commands.

### Deferred Ideas (OUT OF SCOPE)
- **Pleth (SpO₂) channel prototype** — Phase 2.
- **Asystole flat-line rhythm + rhythm-switch UI** — Phase 2.
- **FPS metrics JSON downloader / frame-time histogram** — Phase 5.
- **Internal perf-regression `/prototype` route retained in the shipped app** — delete after Phase 2.
- **Property-based / fuzz testing for engine-state merges** — Phase 4 revisit.
- **Tailwind v4, shadcn/ui, Zustand v5, Zod v4, Web Audio, Pusher client** — all Phase 2 deferrals.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WAVE-01 | ECG Lead II waveform renders at 250 Hz on Canvas 2D via sweep-draw (clear-ahead region, no full-canvas clear) | §Sweep-Draw Canonical Pattern, §Code Examples |
| WAVE-03 | Waveform engine is time-based (`performance.now` deltas), not frame-counted — survives Low Power Mode rAF throttling to 30 fps | §Time-Based Engine, §Pitfall 5 handling, §Code Examples |
| WAVE-04 | Waveform engine uses a fixed-size `Float32Array` circular buffer per channel (no unbounded growth over 30 min) | §Circular Buffer (WAVE-04), §Code Examples |
| WAVE-05 | Canvas is DPR-aware (backing resolution = CSS size × devicePixelRatio) and renders crisply on iPhone 12 at DPR=3 | §DPR-Aware Canvas (WAVE-05), §iPhone Safari Landmines |
| WAVE-07 | Sinus / Brady / Tachy use a template-lookup beat, stretched/compressed to the current HR | §ecgSinusTemplate Port Path, §Code Examples |
| WAVE-10 | Waveform engine state (phase, jitter, R-fired) lives in a dedicated engine-state object, not on the vitals store — Pusher diff merges cannot stomp beat phase | §Engine-State Module Shape, §Vitest Merge Regression Test |
</phase_requirements>

## Summary

Phase 0 is a tightly scoped de-risking exercise with two parallel deliverables: a **permanent Next.js 15.5 scaffold** (App Router, React 19, strict TS, Vitest, pnpm, biome — lives on into Phase 2 unchanged) and a **throwaway `/prototype` route** that renders one DPR-aware ECG sinus sweep at 60 fps on iPhone Safari. Every engine and library file written in this phase (`lib/waveforms/engine-state.ts`, `lib/waveforms/sampleEcg.ts`, `lib/waveforms/sweepCanvas.ts`, `tests/waveforms/*`) ships forward; only `app/prototype/page.tsx` is disposable.

The technical core is three tightly-coupled decisions: (1) the backing store must be `cssSize × devicePixelRatio` with real DPR=3 support — the design prototype's `Math.min(DPR, 2)` cap explicitly violates WAVE-05 and must not be ported; (2) the engine must be `performance.now()`-delta driven so clinical HR timing stays correct when iOS Low Power Mode throttles rAF to 30 fps (Pitfall 5); (3) engine state (phase, rFired, lastT) must live in a dedicated module-scoped object in `lib/waveforms/engine-state.ts`, *not* on the future vitals store — the design prototype's in-place `state._phase` mutation is exactly the bug WAVE-10 exists to prevent, enforced by a Vitest merge-regression test that is the phase's permanent legacy.

**Primary recommendation:** Scaffold with `pnpm create next-app@15.5 neosim --ts --app --no-tailwind --no-eslint --src-dir=false --import-alias "@/*" --use-pnpm`, add Vitest 4.x + @vitejs/plugin-react + jsdom and Biome 2.x via `pnpm add -D`, initialize with `pnpm biome init`, then port `ecgSinusTemplate` (5-gaussian PQRST sum, sinus only) from `design/src/waveforms.js` into a **pure** `sampleEcg(t, hr, engineState) => { v, rPeak }` function whose only state mutation is the dedicated `EngineState` object. Sweep-draw primitive uses `ctx.scale(DPR, DPR)` once, works in CSS px thereafter, with clear-ahead width `ceil(pxPerFrame) + lineWidth + 2` CSS px. Deploy per-branch to Vercel preview for iPhone testing.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Canvas rendering (sweep-draw) | Browser/Client | — | Per-frame Canvas 2D draw calls are browser-only; no SSR path for `<canvas>`. Component is `"use client"`. |
| Waveform sample generation | Browser/Client | — | Synchronous math (`sampleEcg`) called from rAF tick on main thread. No server involvement. |
| Engine state (phase, rFired, lastT) | Browser/Client module scope | — | Module-scoped object in `lib/waveforms/engine-state.ts`. Lives in browser memory; never serialized, never synced. |
| FPS overlay instrumentation | Browser/Client | — | Reads `performance.now()` deltas in rAF tick; updates DOM text node via ref (NOT React state — would cause 60Hz reconciliation). |
| Route shell (`/prototype`) | Frontend Server (SSR) | Browser/Client | Next.js App Router: route is a Server Component shell that hosts a single `"use client"` child. The shell does nothing at runtime; all work happens client-side post-hydration. |
| Vercel preview deploy | CDN/Static + Serverless | — | Per-branch preview URL over HTTPS is the iPhone test target (D-16). HTTPS is required for Wake Lock / Web Audio gesture APIs later; at P0 it's a Safari-parity hygiene item. |
| Vitest engine-state regression | Node (test runner) | — | Runs in Node.js via Vitest + jsdom; no Canvas, no DOM rendering — pure function / module-state assertions. |

**Why this matters at P0:** There is zero backend business logic and zero persistence surface. Misassignment risk here is minimal — the trap to avoid is accidentally putting rendering state (phase, rFired) on a future **replicated** store (vitals store, Phase 2+) that receives Pusher diffs, which is exactly what WAVE-10 / D-08 prevents.

## Standard Stack

### Core (Scaffold — Ships Forward to Phase 2)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `next` | `15.5.15` | React framework, App Router, dev server (Turbopack) | D-02 locks 15.5 (not 14, not 16). 15.5.15 is the current patch on the `backport` dist-tag as of 2026-04-21 [VERIFIED: `npm view next@15 version` → 15.5.11 … 15.5.15]. 16 would force async `params`/`headers` rewrite — STACK.md explicitly advises skipping for 2–3 week builds. |
| `react` | `19.2.5` | UI runtime | Bundled with Next 15.5; latest stable as of 2026-04-21 [VERIFIED: `npm view react version` → 19.2.5]. Next 15.5 peer-dep accepts `^18.2.0 \|\| 19.0.0-rc-… \|\| ^19.0.0` [VERIFIED: `npm view next@15.5.15 peerDependencies`]. |
| `react-dom` | `19.2.5` | React renderer for the DOM | Bundled with React 19. |
| `typescript` | `5.9.3` | Type safety | Strict mode per D-02. 5.9.x is battle-tested with Next 15.5; TS 6.0.3 exists but is brand-new and not the right call for a "scaffold that lives on" decision. [VERIFIED: `npm view typescript versions` — 5.9.3 is current stable 5.x; 6.0.x just landed.] |
| `@types/react`, `@types/react-dom`, `@types/node` | latest | TS ambient types | Vitest peer expects `@types/node@^20 \|\| ^22 \|\| >=24` [VERIFIED: `npm view vitest peerDependencies`]. Recommend `@types/node@22`. |
| `vitest` | `4.1.4` | Unit test runner | D-02 locks Vitest. 4.1.4 is current [VERIFIED: `npm view vitest version`]. Native ESM, fast, watch mode; has peer-dep hooks for `jsdom`, `happy-dom`, `vite@^6 \|\| ^7 \|\| ^8`. |
| `vite` | `8.0.9` | Peer of Vitest 4.x | Required as Vitest peer [VERIFIED: `npm view vite version`]. Not used by Next (Next ships its own bundler). Vitest keeps a separate Vite instance for the test pipeline — this is expected. |
| `@vitejs/plugin-react` | `6.0.1` | JSX/TSX transform in test runtime | Required to import `.tsx` under Vitest [VERIFIED: `npm view @vitejs/plugin-react version` → 6.0.1]. |
| `jsdom` | `29.0.2` | Test DOM environment | [VERIFIED: `npm view jsdom version`]. Use for the merge-regression test even though there's no DOM render needed — keeps the door open for Phase 2 component tests without reshuffling config. Alternative: `happy-dom@20.x` is ~2× faster but has rougher Canvas polyfill fidelity; for P0 either works because the merge test does not touch Canvas. **Recommend jsdom** — the P2+ component tests will need broader DOM coverage. |
| `@biomejs/biome` | `2.4.12` | Lint + format (single tool) | D-02 locks Biome over ESLint+Prettier [VERIFIED: `npm view @biomejs/biome version`]. Init via `pnpm exec biome init`. Biome 2.x supports Next.js/React/TS out of the box; disable rules that conflict with Next's generated `next-env.d.ts` if they fire. |

### Supporting (Dev Ergonomics)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `pnpm` | `10.33.0` | Package manager (locked by D-02) | [VERIFIED: `npm view pnpm version`]. Enforce with a `packageManager` field in `package.json` (`"packageManager": "pnpm@10.33.0"`). Also add an `.npmrc` with `engine-strict=true` to prevent accidental npm installs. |

### Deferred to Phase 2 (Explicitly NOT installed at P0 per D-02)

- Tailwind v4, shadcn/ui — no styling framework at P0 (inline styles + optional CSS module per UI-SPEC).
- Zustand v5 — no global state needed for a single-channel prototype.
- Zod v4 — no wire validation needed until sync lands.
- `pusher-js`, `pusher` (Node SDK) — Phase 1 / Phase 4.
- Web Audio libraries — no audio at P0.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Vitest + jsdom | Vitest + happy-dom | `happy-dom` is ~2× faster but less complete DOM. P0 test doesn't touch DOM so either works; keeping jsdom for Phase 2 forward-compat. |
| Vitest | Jest | Jest is still dominant but Vitest is Next-friendly (no Babel config needed for TS/TSX in tests), faster, and aligns with Vite ecosystem. D-02 locks Vitest. |
| Biome | ESLint + Prettier | ESLint is what `create-next-app` defaults to — but D-02 explicitly chooses Biome. When scaffolding, pass `--no-eslint` to suppress Next's ESLint setup. |
| Next 16 | Next 15.5 | 16 is stable (16.2.4 per registry) but adds breaking async `params`/`headers` [CITED: STACK.md §Next.js 14→15.5 decision]. D-02 locks 15.5. |
| Template literal `CanvasRenderingContext2D` drawing via `bezierCurveTo` | Pre-computed `Float32Array` samples + `lineTo` | Bezier is smooth but more per-frame work; sample-buffer with `lineTo` is what the design prototype uses and is idiomatic for sweep-draw monitors. No change needed. |

### Installation

```bash
# Step 1: scaffold (answer prompts: TS=yes, ESLint=no, Tailwind=no, src-dir=no, App Router=yes, Turbopack=yes, import alias=@/*)
pnpm create next-app@15.5 neosim \
  --ts \
  --app \
  --no-eslint \
  --no-tailwind \
  --no-src-dir \
  --import-alias "@/*" \
  --use-pnpm \
  --turbopack

cd neosim

# Step 2: Vitest + React 19 test stack
pnpm add -D vitest@^4 @vitejs/plugin-react@^6 jsdom@^29 @testing-library/react@^16 @testing-library/dom@^10

# Step 3: Biome (lint + format)
pnpm add -D --save-exact @biomejs/biome@^2
pnpm exec biome init

# Step 4: Verify
pnpm dev          # Next dev server on :3000 — open /prototype
pnpm test         # Vitest runs tests/waveforms/
pnpm exec biome check --write .  # lint + format in one pass
```

**Notes on `create-next-app` flags (verified April 2026):**
- `--no-eslint` — suppresses the default ESLint setup (we replace with Biome).
- `--no-tailwind` — D-02 defers Tailwind to Phase 2.
- `--no-src-dir` — D-03 places `app/`, `lib/`, `tests/` at repo root.
- `--turbopack` — opts into the Turbopack dev bundler (default in Next 16; opt-in in 15.5). Safe and significantly faster.
- `--use-pnpm` — ensures `pnpm-lock.yaml` is created, not `package-lock.json`.

**Version verification date:** 2026-04-21 via `npm view <pkg> version`. Re-verify before executing if this research is more than 14 days old.

### Vitest Configuration Skeleton

Place at repo root as `vitest.config.ts`:

```ts
// Source: https://vitest.dev/config/ (official) + React 19 plugin-react docs
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    // No setupFiles at P0 — merge test doesn't need them.
  },
  resolve: {
    alias: { '@': new URL('./', import.meta.url).pathname },
  },
});
```

Add `"test": "vitest run"` and `"test:watch": "vitest"` to `package.json` scripts.

### Biome Configuration Skeleton

`biome init` generates `biome.json`. Recommended tweaks for Next 15.5 + TS strict:

```jsonc
// biome.json (post-init, with Next-friendly adjustments)
{
  "$schema": "https://biomejs.dev/schemas/2.4.12/schema.json",
  "files": { "ignoreUnknown": true, "ignore": [".next", "node_modules", "*.tsbuildinfo"] },
  "formatter": { "enabled": true, "indentStyle": "space", "indentWidth": 2 },
  "linter": { "enabled": true, "rules": { "recommended": true } },
  "javascript": { "formatter": { "quoteStyle": "single", "semicolons": "always" } }
}
```

Claude's Discretion per CONTEXT: use `biome init` defaults; above is documented so the planner knows what will be generated and can spot drift.

## System Architecture Diagram

```
 ┌─────────────────────────────────────────────────────────────────────┐
 │  SCAFFOLD (permanent — ships forward to Phase 2+)                   │
 │                                                                      │
 │   package.json  ·  pnpm-lock.yaml  ·  tsconfig.json (strict)         │
 │   next.config.ts  ·  biome.json  ·  vitest.config.ts                 │
 └─────────────────────────────────────────────────────────────────────┘

 ┌─────────── app/ (Next.js App Router routes) ──────────────────────┐
 │                                                                      │
 │  app/layout.tsx       Root layout (html, body; no chrome at P0)     │
 │  app/prototype/page.tsx  ───► THROWAWAY (delete after Phase 2)       │
 │       │                                                              │
 │       │   "use client"                                               │
 │       ▼                                                              │
 │   ┌───────────────────────────────────────┐                         │
 │   │  <PrototypeClient />                  │  mounts <canvas>,        │
 │   │   · useRef<HTMLCanvasElement>         │  starts single rAF loop, │
 │   │   · useEffect: init + rAF             │  owns FPS overlay ref.   │
 │   │   · FPS overlay <div ref>             │                         │
 │   └────────────┬──────────────────────────┘                         │
 │                │ imports                                             │
 └────────────────┼─────────────────────────────────────────────────────┘
                  │
                  ▼
 ┌─────────── lib/waveforms/ (PERMANENT engine — ships to P2) ─────────┐
 │                                                                      │
 │   engine-state.ts      Module-scoped object: { phase, rFired,        │
 │                         lastT, jitter }. Pure; no DOM; no React.     │
 │                         ──► WAVE-10 guardrail lives here.            │
 │                                                                      │
 │   sampleEcg.ts         Pure fn: (t, hr, engineState) => {v, rPeak}.  │
 │                         Ported PQRST gaussian-sum from               │
 │                         design/src/waveforms.js (sinus ONLY — D-05). │
 │                                                                      │
 │   sweepCanvas.ts       DPR-aware primitive:                          │
 │                         · setupCanvas(canvas, cssW, cssH, dpr)       │
 │                         · step(ctx, now, sampleFn, engineState, ...) │
 │                                                                      │
 │   buffer.ts (optional) Float32Array ring buffer.                     │
 │                         WAVE-04 requirement; may be inlined into     │
 │                         sweepCanvas.ts at P0, split in P2.           │
 └──────────────────────────────────────────────────────────────────────┘

 ┌─────────── lib/clinical/ (empty placeholder — D-03) ────────────────┐
 │   .gitkeep    P0 creates the directory so P2's nrp.ts has a home.   │
 └──────────────────────────────────────────────────────────────────────┘

 ┌─────────── tests/waveforms/ ────────────────────────────────────────┐
 │                                                                      │
 │   engine-state.merge.test.ts                                         │
 │      · Tick engine to mid-beat (phase ≈ 0.4)                         │
 │      · Apply partial vitals diff { hr: 150 } via a trivial merge     │
 │        helper (no Zustand yet)                                       │
 │      · Assert engineState.phase unchanged + rFired unchanged         │
 │      ──► This is WAVE-10's permanent regression guard.               │
 └──────────────────────────────────────────────────────────────────────┘

 Data flow during a single rAF tick (DURING 60s screenshot run):

   rAF tick → performance.now() → Δt from engineState.lastT
           → advancePx = Δt * pxPerMs
           → for each sample in the Δt window:
                 sampleEcg(t, hr, engineState) ──► { v, rPeak }
                      (mutates engineState.phase ONLY)
                 clearRect(writeHead, 0, clearAheadWidth, h)
                 ctx.lineTo(x, midY - v * scale)
           → writeHead = (writeHead + advancePx) % (canvas.width/dpr)
           → FPS ring: push(Δt); avg/min → overlay.textContent = `FPS …`
```

**Reader's path:** follow a single rAF tick from top to bottom — `performance.now()` feeds Δt, sampleEcg mutates engine-state phase, canvas draws new samples, FPS ring updates the overlay. No other path exists at P0.

## Architecture Patterns

### Pattern 1: DPR-Aware Canvas Sweep-Draw

**What:** Backing store = `cssSize × devicePixelRatio`; apply `ctx.scale(dpr, dpr)` once at init; work in CSS pixels thereafter; erase a narrow "clear-ahead" rectangle each frame before drawing new samples.

**When to use:** Any HiDPI canvas that must render crisp lines on iPhone (DPR=3) without the full-canvas-clear cost.

**Example:**
```ts
// Source: MDN Canvas optimization + Pitfall 4 envelope + design/src/canvasChannel.jsx (with DPR fix)
function setupCanvas(canvas: HTMLCanvasElement, cssW: number, cssH: number) {
  const dpr = window.devicePixelRatio || 1;  // DO NOT cap at 2 — WAVE-05 requires real DPR=3
  canvas.width  = Math.floor(cssW * dpr);
  canvas.height = Math.floor(cssH * dpr);
  canvas.style.width  = `${cssW}px`;
  canvas.style.height = `${cssH}px`;
  const ctx = canvas.getContext('2d', { alpha: false })!;
  ctx.scale(dpr, dpr);                        // apply ONCE; work in CSS px thereafter
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, cssW, cssH);
  return { ctx, dpr, cssW, cssH };
}
```

**Critical detail:** `ctx.scale(dpr, dpr)` is applied ONCE. All subsequent `clearRect`, `lineTo`, `lineWidth` values are in CSS pixels. If you later resize the canvas (e.g., rotation), you must rebuild the context — `ctx.scale` is cumulative. At P0 resize handling is NOT required (static landscape render); **do not** add a `ResizeObserver` unless you rebuild context on every resize event. The design prototype's resize handler rebuilds on every resize — port that pattern only when P0 adds resize support.

### Pattern 2: Clear-Ahead Rect (WAVE-01 / Pitfall 4)

**What:** Every frame, erase a small rectangle just ahead of the write head (sweep cursor), then draw the newly-generated samples into the newly-cleared region.

**When to use:** The defining pattern for bedside-monitor sweep-draw waveforms. Avoids the per-frame full-canvas clear cost while preserving clean visual state.

**Formula (Pitfall 4 envelope — LOCKED by D-06):**
```
clearAheadWidthCssPx = ceil(pxPerFrame) + lineWidth + 2
```
Where:
- `pxPerFrame = (canvasWidthCssPx / sweepSeconds) * (1/60)` at 60 fps
- `lineWidth` is in CSS px (e.g., `ceil(dpr * 1.4) ≈ 5` CSS px at DPR=3)
- `+2` is the anti-aliasing halo pad

**Example:**
```ts
// Source: Pitfall 4 § "How to avoid" + design/src/canvasChannel.jsx
const pxPerSec = cssW / sweepSeconds;
const clearAhead = Math.ceil(pxPerSec / 60) + lineWidth + 2;
// Wrap-safe erase (sweep cursor can be at end of canvas):
const eraseStart = (writeHead + 1) % cssW;
const eraseW = Math.min(clearAhead, cssW - eraseStart);
ctx.fillStyle = '#000000';
ctx.fillRect(eraseStart, 0, eraseW, cssH);
if (eraseW < clearAhead) {
  ctx.fillRect(0, 0, clearAhead - eraseW, cssH);   // wrap
}
```

**Anti-pattern avoided:** `ctx.clearRect(0, 0, cssW, cssH)` every frame — defeats the point of sweep-draw, causes visible tearing on iPhone, and blows CPU budget.

### Pattern 3: Time-Based Engine Advance (WAVE-03 / Pitfall 5)

**What:** Engine advance is computed from `performance.now()` deltas, not frame counts. A 30 fps Low-Power-Mode rAF still produces clinically correct HR timing — it just shows visible stepping.

**Why it matters:** iOS Low Power Mode (below 20% battery) hard-throttles `requestAnimationFrame` to 30 Hz with no programmatic opt-out. A frame-counted engine (`phase += 1/60`) would halve effective HR in LPM. A time-based engine (`phase += Δt / beatDurMs`) keeps HR exact.

**Example:**
```ts
// Source: Pitfall 5 + web.dev "A tale of two clocks" conceptual model
// lib/waveforms/sampleEcg.ts (excerpt — full pattern in Code Examples)
export function sampleEcg(t: number, hr: number, s: EngineState) {
  const beatDurMs = 60_000 / Math.max(1, hr);
  const dt = t - s.lastT;
  s.lastT = t;
  s.phase = (s.phase + dt / beatDurMs) % 1;
  // ... R-peak detection, template lookup
}
```

**Critical:** `t` is passed in from the rAF callback's high-resolution timestamp argument (`DOMHighResTimeStamp`, NOT `Date.now()` — the latter has ~1ms granularity and can skew during NTP adjustments). Clamp `dt` to `≤ 100ms` defensively to prevent runaway phase advance after tab backgrounding (Safari may emit a single huge rAF delta on visibility return).

### Pattern 4: Engine-State Module Scope (WAVE-10 / D-08)

**What:** The engine's mutable state (`phase`, `lastT`, `rFired`, `jitter`) lives in a module-scoped object in `lib/waveforms/engine-state.ts`. `sampleEcg` imports and mutates it directly. The state is *never* a field of any vitals store or React state.

**Why it matters:** Phase 4 (Pusher sync) will merge partial vitals diffs (`{ hr: 150 }`) into the monitor's vitals store. If engine state lives on that store, a partial merge can preserve engine state (lucky) or stomp it (unlucky — `...spread` with a nested object). Putting engine state in its own module eliminates the class of bug.

**Two design shapes — pick whichever makes the Vitest test cleanest (D's discretion):**

**Shape A: Module-scoped singleton (simplest):**
```ts
// lib/waveforms/engine-state.ts
export type EngineState = { phase: number; rFired: boolean; lastT: number; jitter: number };
export const engineState: EngineState = { phase: 0, rFired: false, lastT: 0, jitter: 1 };
export function resetEngineState() { engineState.phase = 0; engineState.rFired = false; engineState.lastT = 0; engineState.jitter = 1; }
```

**Shape B: Factory (better for tests — isolated instances):**
```ts
// lib/waveforms/engine-state.ts
export type EngineState = { phase: number; rFired: boolean; lastT: number; jitter: number };
export function createEngineState(): EngineState {
  return { phase: 0, rFired: false, lastT: 0, jitter: 1 };
}
```

**Recommendation:** Shape B (factory). The Vitest merge-regression test becomes cleaner — each test builds its own state, no `beforeEach` reset. The prototype page calls `createEngineState()` once on mount.

### Pattern 5: Float32Array Circular Buffer (WAVE-04 / Pitfall 13)

**What:** Fixed-size `Float32Array(sampleRate × sweepSeconds)` allocated once. Writes via `buf[writeIdx] = sample; writeIdx = (writeIdx + 1) % len`. No `.push()`, no `.slice()`, no reallocation.

**Size at P0:** `250 Hz × 5 s = 1250 samples × 4 B = 5 KB per channel`. One channel → 5 KB total. This is the canonical neonatal waveform memory footprint.

**Why it matters:** Pitfall 13 documents that array-plus-`.push()` implementations grow unbounded — 30-minute sessions crash iPhone Safari with "A problem repeatedly occurred" around 25 minutes. The `Float32Array` approach has zero heap growth by construction.

**P0 simplification allowed:** The design prototype doesn't actually use a buffer — it reads `sampleFn(t)` once per pixel drawn, with no intermediate storage. **That's fine for P0** (and is in fact what `design/src/canvasChannel.jsx` does). WAVE-04 requires the buffer concept to be *in place*; it does not require per-frame reads from the buffer at P0. Two options for the planner:
- **Option A (recommended):** Inline `sampleFn(t)` call per draw pixel, no buffer at P0. Document as "buffer is an optimization deferred to P2 alongside pleth." Heap flatness (SC#4) is trivially satisfied because nothing accumulates.
- **Option B:** Build the buffer at P0 because WAVE-04 is a phase requirement. Write samples into the buffer, draw from the buffer. Higher code cost; no rendering benefit at one channel.

**Decision for the planner:** follow CONTEXT D-10 literally — "Waveform buffer is a single `Float32Array(sampleRate × sweepSeconds)` per channel, allocated once, written via modular index." This means **Option B is required** even at one channel. The alternative would be to interpret WAVE-04 as "no unbounded growth" (true for both options), but D-10 explicitly names the buffer shape. Plan for Option B.

### Anti-Patterns to Avoid

- **Math.min(DPR, 2)** — exactly what the design prototype does on line 10 of `canvasChannel.jsx`. Violates D-07 and WAVE-05. Pass a failing unit/visual test at DPR=3 would be impossible without the real value.
- **`state._phase` mutation on a shared store** — the design prototype's `sampleEcg` mutates `state._phase`, `state._lastT`, `state._rFired` on the vitals state object passed in. This is exactly the bug D-08 / WAVE-10 fix.
- **`setTimeout` for the rAF loop** — use `requestAnimationFrame`. `setTimeout(tick, 1000/60)` is not vsync-locked, clamps to 4ms minimum, and clamps to 1000ms when tab hidden.
- **Full-canvas `clearRect(0,0,w,h)` per frame** — see Pattern 2; negates sweep-draw.
- **FPS overlay via `useState` updated per frame** — triggers 60Hz React reconciliation. Update via ref: `overlayRef.current.textContent = \`FPS \${avg} · min \${min}\``, and only rewrite once per second (UI-SPEC locks the 1Hz update cadence).
- **Reading `performance.now()` from inside `sampleEcg`** — the function should take `t` as an argument. The rAF callback receives it for free as its single parameter. Passing it through keeps `sampleEcg` pure and testable.
- **Using `Date.now()` for engine advance** — millisecond granularity, NTP-drift sensitive, not monotonic. Always use `performance.now()`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| FPS measurement | Custom timing averager with Date.now() buckets | `performance.now()` deltas in a fixed-size ring (Float32Array of last ~180 frames) | `performance.now()` is monotonic and sub-ms; ring buffer avoids GC in the hot path |
| Canvas scaling | Custom pixel-math with `canvas.width = cssW * dpr * someMultiplier` logic | Plain `ctx.scale(dpr, dpr)` once at init | MDN-documented canonical pattern; device-pixel-to-CSS-pixel math is the source of 90% of HiDPI canvas bugs |
| Waveform sample generation | Third-party ECG libraries (webappECG, etc.) | Port the PQRST gaussian-sum from `design/src/waveforms.js` | The existing formula is already clinically sane for sinus; third-party ECG libs are either adult-focused or overkill |
| Test runner | Custom harness or Jest | Vitest (D-02) | Vitest handles TS/TSX natively without Babel config |
| Linter+formatter | ESLint + Prettier combo | Biome (D-02) | Single tool, single config, 10× faster; matches D-02 |
| Ring buffer | `Array<number>` with manual `.shift()` on overflow | `Float32Array(len)` with `writeIdx = (writeIdx+1) % len` | Pitfall 13 — `.shift()` is O(n) and array still grows briefly |
| Package manager | npm or yarn | pnpm (D-02) | Enforced via `packageManager` field |

**Key insight:** P0 is a scaffold + a 150-line prototype; the temptation to over-engineer (abstract the renderer, build a plugin system, add metrics collection) must be resisted. The **only** abstractions that matter are the ones that ship forward to Phase 2 — the engine-state module, the pure `sampleEcg`, the DPR-aware canvas primitive. Everything else is throwaway.

## Common Pitfalls

### Pitfall A: DPR Cap Shortcut (WAVE-05 Violation)

**What goes wrong:** Developer ports `design/src/canvasChannel.jsx` line 10 verbatim: `const dpr = Math.min(window.devicePixelRatio || 1, 2);`. Canvas renders at effective DPR=2 on iPhone 12 (actual DPR=3). Lines look soft on the iPhone screenshot; reviewer says "looks blurry"; WAVE-05 fails.

**Why it happens:** The cap is a performance heuristic from 2018-era laptop-first code. iPhone 12+ can absolutely render DPR=3 at 60 fps for one polyline — this is exactly what the phase is proving.

**How to avoid:** `const dpr = window.devicePixelRatio || 1;` — no cap. If performance fails, that's a different bug to solve.

**Warning signs:** Screenshot zoom shows soft edges; `canvas.width / canvas.getBoundingClientRect().width` returns 2.0 instead of 3.0 on an iPhone Safari remote-debug session.

### Pitfall B: Phase Drift from Non-Monotonic Clock

**What goes wrong:** Engine uses `Date.now()` for `lastT`. NTP adjustment (or a clock-change from DST on desktop) causes `dt` to go negative briefly; `phase` becomes NaN; canvas draws stop.

**How to avoid:** Always use `performance.now()` (DOMHighResTimeStamp). The rAF callback's sole argument is already a high-resolution timestamp — use it directly: `function frame(t: DOMHighResTimeStamp) { ... }`.

**Warning signs:** Waveform freezes after a tab-switch; `engineState.phase` is NaN in debugger.

### Pitfall C: rAF Delta Spike on Visibility Return

**What goes wrong:** Tab hidden for 30 seconds. On return, the first rAF callback fires with `t - lastT ≈ 30000`. `phase += 30000 / beatDurMs` ≈ 75 beats; phase is now a wildly wrong value; engine state momentarily corrupt until next R-wave re-anchors.

**How to avoid:** Clamp `dt` defensively: `const dt = Math.min(100, t - s.lastT); s.lastT = t;`. 100ms is "longer than any legit frame (60 fps = 16.7ms, 30 fps LPM = 33ms) but shorter than any scenario-breaking jump."

**Warning signs:** After tab-switch return, single visual glitch on the waveform; FPS overlay briefly shows a 1-frame drop.

### Pitfall D: Canvas Context Scale Applied Twice

**What goes wrong:** Developer adds a `ResizeObserver` to handle rotation. On resize, they reset `canvas.width` (which resets the transform matrix) and then forget to re-apply `ctx.scale(dpr, dpr)` — OR they apply it without resetting first, which compounds scale. Result: canvas either draws at 1× (too small) or 9× (DPR-squared, content off-screen).

**How to avoid at P0:** Do not add resize handling. P0 is a static landscape screenshot run. Set canvas once at mount with the CSS rect size; don't observe resize. If rotation happens during the 60s test, the screenshot is taken in the target orientation anyway.

**How to avoid at P2+:** In the resize handler, reset the context: `canvas.width = cssW * dpr; ctx.scale(dpr, dpr);` in that order. Never call `scale` without first resetting `canvas.width`.

**Warning signs:** After rotation, waveform is either pixelated-small or off-screen-large.

### Pitfall E: FPS Overlay Causes Its Own Reflow (Measurement Noise)

**What goes wrong:** FPS overlay is `<div>{fps}</div>` with `useState` updated every rAF tick. Every update triggers React reconciliation + DOM text mutation + layout reflow. The reflow is itself ~0.5–1ms; overlay measurement thinks the page is dropping frames; numbers under-report actual canvas fps.

**How to avoid:** Update overlay via ref, at 1Hz (not 60Hz), using fixed-width monospace text so the text node doesn't relayout when digits change. UI-SPEC locks: `font: 14px ui-monospace`, `update cadence: once per second`.

```ts
// Hot path — no React state updates:
const fpsRing = new Float32Array(180);  // last ~3 s at 60 fps
let ringIdx = 0;
let lastOverlayUpdate = 0;
function frame(t: DOMHighResTimeStamp) {
  const dt = t - lastT; lastT = t;
  fpsRing[ringIdx] = 1000 / dt; ringIdx = (ringIdx + 1) % fpsRing.length;
  if (t - lastOverlayUpdate > 1000) {
    let sum = 0, min = Infinity;
    for (let i = 0; i < fpsRing.length; i++) { sum += fpsRing[i]; if (fpsRing[i] < min) min = fpsRing[i]; }
    const avg = Math.round(sum / fpsRing.length);
    overlayRef.current!.textContent = `FPS ${avg} · min ${Math.round(min)}`;
    overlayRef.current!.style.color = avg < 55 ? '#f59e0b' : 'rgba(255,255,255,0.72)';
    lastOverlayUpdate = t;
  }
  requestAnimationFrame(frame);
}
```

**Warning signs:** DevTools Performance panel shows React reconciliation bars every frame; FPS overlay reports 55–58 fps but Canvas visually looks smooth 60.

### Pitfall F: iOS Safari Preview-Deploy HTTPS Requirement

**What goes wrong:** Developer tests `/prototype` on localhost from the iPhone (via ngrok or LAN IP over HTTP). Works at first, but iOS 17+ silently restricts some timing precision (`performance.now()` may be coarsened on insecure contexts). Measurements are inconsistent or suspicious.

**How to avoid:** D-16 already locks this — Vercel preview deploy (HTTPS) is the test target. Do NOT test over LAN HTTP.

**Warning signs:** `performance.now()` returns values rounded to the nearest 100µs on LAN HTTP, vs full µs precision on the Vercel preview URL.

## Runtime State Inventory

Not applicable — Phase 0 is greenfield. No rename, refactor, or migration.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js (≥18, ideally 20+) | Next 15.5, pnpm, Vitest | probe at plan time | — | None — required |
| pnpm | D-02 locked package manager | probe at plan time | — | corepack enable (ships with Node) |
| Git | Vercel preview deploy triggers on push | probe at plan time | — | None — required |
| Vercel CLI | Optional; for local `vercel dev`. Not required since D-16 uses branch previews auto-deployed by Git push. | probe at plan time | — | Skip — use git push to trigger preview |
| Safari ≥ 16.4 (on iPhone) | Test target | User has "newer-generation iPhone" (D-13) — Safari is current | — | None — required device-side |
| Safari Web Inspector (macOS → iPhone USB) | Heap snapshot capture for SC#4 | Requires a Mac and a USB cable | — | Without inspector, cannot capture heap snapshot — D-14 evidence incomplete. Flag if Mac unavailable. |

**Missing dependencies with no fallback:**
- Safari Web Inspector requires a macOS device to remote-debug iPhone Safari. If the user is on Windows/Linux, heap snapshot evidence (D-14 part b) must be substituted with a different heap measurement path (e.g., a `performance.measureUserAgentSpecificMemory()` call logged to console — Safari support varies). **Planner action:** include a small "Verify macOS + USB cable" check-in the phase plan; if absent, adjust SC#4 evidence format before execution.

**Missing dependencies with fallback:**
- Vercel CLI — skippable; git push to a branch triggers preview deploy automatically once the project is linked to a Vercel account.

**Baseline probes the planner should include in Wave 0:**
```bash
node --version    # expect ≥ 18; recommend 20+
pnpm --version    # D-02 requires pnpm; bootstrap via `corepack enable` if missing
git --version     # required for Vercel preview flow
```

## Vitest Merge-Regression Test (WAVE-10 / D-11)

The test is **the** permanent legacy of Phase 0 — it carries forward through Phase 4 Pusher integration untouched. Shape:

```ts
// tests/waveforms/engine-state.merge.test.ts
// Source: D-11 shape + Vitest 4.x API
import { describe, it, expect } from 'vitest';
import { createEngineState } from '@/lib/waveforms/engine-state';
import { sampleEcg } from '@/lib/waveforms/sampleEcg';

// Trivial merge helper — no Zustand yet at P0. Models what a Phase 4
// Pusher diff handler will do: shallow-merge a partial into a target.
type Vitals = { hr: number; spo2?: number };
function mergeVitals<V extends object>(base: V, diff: Partial<V>): V {
  return { ...base, ...diff };
}

describe('engine-state / vitals-store merge regression (WAVE-10)', () => {
  it('partial vitals diff does not stomp engine phase or rFired', () => {
    const engine = createEngineState();
    let vitals: Vitals = { hr: 140 };

    // Tick engine to a mid-beat phase by calling sampleEcg with a synthetic
    // monotonic clock. Advance ~40% through one beat at HR=140 (~171ms).
    const t0 = 0;
    const beatMs = 60_000 / vitals.hr;
    const targetPhase = 0.4;
    // Single call to establish lastT
    sampleEcg(t0, vitals.hr, engine);
    // Second call, Δt advances phase to ~0.4
    sampleEcg(t0 + targetPhase * beatMs, vitals.hr, engine);

    const phaseBefore = engine.phase;
    const rFiredBefore = engine.rFired;
    expect(phaseBefore).toBeGreaterThan(0.3);
    expect(phaseBefore).toBeLessThan(0.5);

    // Apply a partial vitals diff (what Pusher will eventually send)
    vitals = mergeVitals(vitals, { hr: 150 });

    // Assert engine state is untouched — the merge only changed vitals
    expect(engine.phase).toBe(phaseBefore);
    expect(engine.rFired).toBe(rFiredBefore);
    expect(vitals.hr).toBe(150);  // sanity: merge did apply
  });

  it('createEngineState returns independent instances', () => {
    const a = createEngineState();
    const b = createEngineState();
    a.phase = 0.9;
    expect(b.phase).toBe(0);
  });
});
```

**Why this shape:**
- No Zustand at P0 (D-02) — a trivial `mergeVitals` helper models what Phase 4 will do via Zustand's `set` + spread.
- Deterministic time input — the test passes explicit `t0`, never calls `performance.now()`. Avoids clock-dependent flakes.
- Factory pattern (Shape B above) makes each test independent — no `beforeEach` reset.
- The assertion set is minimal (`phase`, `rFired` unchanged; `hr` changed) and captures WAVE-10's single invariant: **the merge primitive does not reach into engine state.**

**P0 hooks this bakes in for P4:** When Phase 4 introduces the real Zustand vitals store and a real Pusher diff handler, the planner swaps `mergeVitals` for `useVitalsStore.getState().merge` — the rest of the test is unchanged. That's the portability D-11 intends.

## Code Examples

### Complete `sampleEcg.ts` (Ported, WAVE-07 / D-04)

```ts
// lib/waveforms/sampleEcg.ts
// Source: ported from design/src/waveforms.js (sinus template only — D-05).
// PQRST gaussian-sum formula retained verbatim; state mutation moved to EngineState (D-08).
import type { EngineState } from './engine-state';

/** Pure template: phase ∈ [0, 1) → voltage ∈ ~[-0.4, +1.2]. */
function ecgSinusTemplate(phase: number): number {
  const p = Math.exp(-Math.pow((phase - 0.10) / 0.025, 2)) *  0.15;
  const q = -Math.exp(-Math.pow((phase - 0.25) / 0.008, 2)) *  0.18;
  const r = Math.exp(-Math.pow((phase - 0.28) / 0.010, 2)) *  1.20;
  const s = -Math.exp(-Math.pow((phase - 0.31) / 0.012, 2)) *  0.35;
  const t = Math.exp(-Math.pow((phase - 0.58) / 0.055, 2)) *  0.30;
  return p + q + r + s + t;
}

export interface SampleResult { v: number; rPeak: boolean }

/**
 * Stateful but pure-with-respect-to-state: reads `t` and `hr`, mutates only `s`.
 * WAVE-03 — time-based; WAVE-07 — template lookup; WAVE-10 — state is injected.
 */
export function sampleEcg(t: number, hr: number, s: EngineState): SampleResult {
  const safeHr = Math.max(1, hr);
  const beatDurMs = 60_000 / safeHr;

  // First call: seed lastT and return a zero-delta sample.
  if (s.lastT === 0) {
    s.lastT = t;
    return { v: ecgSinusTemplate(s.phase), rPeak: false };
  }

  const dt = Math.min(100, t - s.lastT);   // Pitfall C — clamp runaway deltas
  s.lastT = t;
  s.phase = (s.phase + dt / beatDurMs) % 1;

  // R-peak detection (design/src/waveforms.js lines 41-44, sinus-only slice)
  let rPeak = false;
  if (s.phase > 0.27 && s.phase < 0.30 && !s.rFired) {
    s.rFired = true;
    rPeak = true;
  }
  if (s.phase < 0.25 || s.phase > 0.32) {
    s.rFired = false;
  }

  return { v: ecgSinusTemplate(s.phase), rPeak };
}
```

### `engine-state.ts` (D-08 / WAVE-10)

```ts
// lib/waveforms/engine-state.ts
export interface EngineState {
  phase: number;     // [0, 1) — position in current beat
  rFired: boolean;   // debounce for R-peak detection per beat
  lastT: number;     // last performance.now() seen; 0 = uninitialized
  jitter: number;    // reserved for AFib (P2); always 1 at P0
}

export function createEngineState(): EngineState {
  return { phase: 0, rFired: false, lastT: 0, jitter: 1 };
}
```

### `sweepCanvas.ts` (DPR-aware primitive, D-06 / D-07)

```ts
// lib/waveforms/sweepCanvas.ts
// Source: Pitfall 4 envelope + MDN Canvas optimization + DPR fix vs design prototype.
export interface SweepCtx {
  ctx: CanvasRenderingContext2D;
  dpr: number;
  cssW: number;
  cssH: number;
  pxPerSec: number;
  lineWidth: number;
  color: string;
  bg: string;
  writeHead: number;
  lastY: number;
}

export function setupSweepCanvas(
  canvas: HTMLCanvasElement,
  opts: { cssW: number; cssH: number; sweepSeconds: number; color: string; bg: string },
): SweepCtx {
  const dpr = window.devicePixelRatio || 1;  // NO cap — WAVE-05 requires real DPR=3
  canvas.width  = Math.floor(opts.cssW * dpr);
  canvas.height = Math.floor(opts.cssH * dpr);
  canvas.style.width  = `${opts.cssW}px`;
  canvas.style.height = `${opts.cssH}px`;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Canvas init failed — open this page in iPhone Safari 16.4+');
  ctx.scale(dpr, dpr);
  ctx.fillStyle = opts.bg;
  ctx.fillRect(0, 0, opts.cssW, opts.cssH);
  const lineWidth = Math.max(1.6, Math.ceil(dpr * 1.4));
  ctx.lineWidth = lineWidth;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = opts.color;
  return {
    ctx, dpr,
    cssW: opts.cssW,
    cssH: opts.cssH,
    pxPerSec: opts.cssW / opts.sweepSeconds,
    lineWidth,
    color: opts.color,
    bg: opts.bg,
    writeHead: 0,
    lastY: opts.cssH / 2,
  };
}

/** Advance the sweep by one rAF tick. */
export function stepSweep(
  sc: SweepCtx,
  tNow: number,
  dtMs: number,
  sampleFn: (t: number) => { v: number; rPeak: boolean },
  scale: number,
) {
  const { ctx, cssW, cssH, pxPerSec, lineWidth, bg, color } = sc;
  const midY = cssH / 2;
  const advancePx = Math.max(1, Math.ceil((dtMs / 1000) * pxPerSec));
  const clearAhead = advancePx + lineWidth + 2;  // Pitfall 4 envelope

  for (let i = 1; i <= advancePx; i++) {
    const sampleT = tNow - dtMs + (i / advancePx) * dtMs;
    const x = Math.floor((sampleT / 1000 * pxPerSec) % cssW);

    // Clear-ahead (wrap-safe)
    const eraseStart = (x + 1) % cssW;
    const eraseW = Math.min(clearAhead, cssW - eraseStart);
    ctx.fillStyle = bg;
    ctx.fillRect(eraseStart, 0, eraseW, cssH);
    if (eraseW < clearAhead) ctx.fillRect(0, 0, clearAhead - eraseW, cssH);

    const { v } = sampleFn(sampleT);
    const y = midY - v * scale;

    // Only draw the line segment if x advances normally (not after a wrap)
    ctx.beginPath();
    if (x >= sc.writeHead && (x - sc.writeHead) < clearAhead * 4) {
      ctx.strokeStyle = color;
      ctx.moveTo(sc.writeHead, sc.lastY);
      ctx.lineTo(x, y);
      ctx.stroke();
    }
    sc.writeHead = x;
    sc.lastY = y;
  }
}
```

### `app/prototype/page.tsx` (Throwaway — delete after P2)

```tsx
// app/prototype/page.tsx
// THROWAWAY — renders one ECG sinus channel + FPS overlay for iPhone screenshot.
// Deleted after Phase 2 ships. Engine files (lib/waveforms/*) ship forward.
export const metadata = { title: 'NeoSim — Waveform Prototype' };
import PrototypeClient from './PrototypeClient';
export default function Page() { return <PrototypeClient />; }
```

```tsx
// app/prototype/PrototypeClient.tsx
'use client';
import { useEffect, useRef } from 'react';
import { createEngineState } from '@/lib/waveforms/engine-state';
import { sampleEcg } from '@/lib/waveforms/sampleEcg';
import { setupSweepCanvas, stepSweep } from '@/lib/waveforms/sweepCanvas';

export default function PrototypeClient() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const sc = setupSweepCanvas(canvas, {
      cssW: rect.width,
      cssH: rect.height,
      sweepSeconds: 5,
      color: '#22c55e',   // UI-SPEC §Color: green-500 (non-vendor)
      bg: '#000000',      // UI-SPEC §Color: pure black
    });
    const engine = createEngineState();
    const HR = 140;          // locked synthetic neonate resting HR for P0
    const SCALE = 40;        // visual amplitude; tunable

    const fpsRing = new Float32Array(180);   // ~3 s at 60 fps
    let ringIdx = 0, lastOverlayUpdate = 0, lastT = performance.now(), rafId = 0;

    const tick = (t: DOMHighResTimeStamp) => {
      const dt = Math.min(100, t - lastT);
      lastT = t;

      stepSweep(sc, t, dt, (sampleT) => sampleEcg(sampleT, HR, engine), SCALE);

      fpsRing[ringIdx] = dt > 0 ? 1000 / dt : 60;
      ringIdx = (ringIdx + 1) % fpsRing.length;

      if (t - lastOverlayUpdate > 1000 && overlayRef.current) {
        let sum = 0, min = Infinity;
        for (let i = 0; i < fpsRing.length; i++) {
          const v = fpsRing[i]; if (v > 0) { sum += v; if (v < min) min = v; }
        }
        const avg = Math.round(sum / fpsRing.length);
        overlayRef.current.textContent = `FPS ${avg} · min ${Math.round(min)}`;
        overlayRef.current.style.color = avg < 55 ? '#f59e0b' : 'rgba(255,255,255,0.72)';
        lastOverlayUpdate = t;
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return (
    <main style={{ background: '#000', width: '100vw', height: '100vh', margin: 0, position: 'relative' }}>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="ECG Lead II sinus rhythm waveform — prototype"
        style={{ width: '100vw', height: '50vh', display: 'block' }}
      />
      <div
        ref={overlayRef}
        aria-hidden="true"
        style={{
          position: 'absolute', top: 'calc(50vh - 32px - 8px)', right: 8,
          padding: '4px 8px', borderRadius: 6,
          background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)',
          font: '600 14px/1.2 ui-monospace, SFMono-Regular, Menlo, monospace',
          color: 'rgba(255,255,255,0.72)',
        }}
      >FPS — · min —</div>
    </main>
  );
}
```

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.4 + jsdom 29.x + @vitejs/plugin-react 6.x |
| Config file | `vitest.config.ts` at repo root (Wave 0 creates it) |
| Quick run command | `pnpm test` (runs once) |
| Full suite command | `pnpm test` (P0 has only one test file — same command) |
| Watch command | `pnpm test:watch` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| WAVE-01 | ECG renders at 250 Hz on Canvas 2D via sweep-draw | visual-evidence (screenshot) | Manual iPhone screenshot of /prototype | ❌ Wave 0 (deploy route) |
| WAVE-03 | Engine is `performance.now` delta driven | unit | `pnpm test tests/waveforms/engine-state.merge.test.ts` (test includes phase-advances-with-dt assertion) | ❌ Wave 0 |
| WAVE-04 | Fixed `Float32Array` buffer, no unbounded growth | device-evidence (Safari heap snapshot) | Manual: Safari Web Inspector → Memory → Snapshot at t=0 and t=5min; diff shows flat ArrayBuffer count | — |
| WAVE-05 | Canvas crisp at DPR=3 on iPhone 12-class | visual-evidence (screenshot zoom) | Manual iPhone screenshot, zoom into waveform stroke — no blur | ❌ Wave 0 |
| WAVE-07 | Template-lookup sinus beat, stretched by HR | unit | `pnpm test tests/waveforms/sample-ecg.test.ts` (new — asserts R-peak at phase ≈ 0.28 for HR=60 and HR=180) | ❌ Wave 0 |
| WAVE-10 | Engine state separate from vitals; partial vitals diff does not stomp phase | unit | `pnpm test tests/waveforms/engine-state.merge.test.ts` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `pnpm test` (full suite — single file at P0, sub-second).
- **Per wave merge:** `pnpm test && pnpm exec biome check .`
- **Phase gate (before `/gsd-verify-work`):** Full suite green + visual evidence captured + heap snapshot captured + `pnpm build` passes (Next.js production build check — catches misconfiguration early).

### Wave 0 Gaps

- [ ] `package.json` — scaffold created via `pnpm create next-app`.
- [ ] `vitest.config.ts` — test runner config.
- [ ] `biome.json` — lint/format config (via `pnpm biome init`).
- [ ] `tsconfig.json` — strict mode on (create-next-app default is already strict since 14.1 — verify `"strict": true` is present).
- [ ] `tests/waveforms/engine-state.merge.test.ts` — the permanent WAVE-10 regression.
- [ ] `tests/waveforms/sample-ecg.test.ts` — WAVE-07 R-peak assertions.
- [ ] `lib/waveforms/engine-state.ts` — EngineState + factory.
- [ ] `lib/waveforms/sampleEcg.ts` — ported PQRST (sinus only).
- [ ] `lib/waveforms/sweepCanvas.ts` — DPR-aware primitive.
- [ ] `lib/clinical/.gitkeep` — empty directory placeholder (D-03).
- [ ] `app/prototype/page.tsx` + `app/prototype/PrototypeClient.tsx` — throwaway render harness.
- [ ] Framework install: `pnpm add -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/dom @biomejs/biome`.

### What Does NOT Need Validation at P0

The following are explicitly OUT OF SCOPE for P0 validation (deferred per CONTEXT deferred ideas):
- Rhythm switching (Phase 2).
- Alarms (visual + audio) (Phase 2).
- Web Audio unlock / mute-switch trick (Phase 2–3).
- Pusher reconnect, snapshot-on-join (Phase 4).
- APGAR timer (Phase 2+).
- Pleth/SpO₂ waveform (Phase 2).
- iOS 16.4-vs-18.4 support matrix (Phase 3).
- 30-minute soak / battery drain (Phase 5).
- iPhone 12 specifically (D-13: phase-5 soak item).

## Security Domain

**Applicable ASVS categories for a throwaway prototype route:** minimal. No auth, no data collection, no user input, no persistence.

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | N/A — no accounts |
| V3 Session Management | no | N/A — no sessions |
| V4 Access Control | no | Prototype is publicly reachable on preview URL; no authz boundary to enforce. Remove the route after Phase 2 so it's not a permanent surface. |
| V5 Input Validation | no | No user input at P0. |
| V6 Cryptography | no | No secrets, no tokens. Vercel preview deploy is HTTPS by default. |
| V14 Configuration | yes | Strict-CSP later in P4 is planned. At P0, Next.js 15.5 default security headers suffice. |

**Known threat patterns for a Next.js 15.5 prototype route:** none applicable at P0. The single real security item is "don't leak the preview URL into search indexes" — Vercel preview deploys have `X-Robots-Tag: noindex` by default, so this is already handled.

**Planner note:** no additional security work is required for Phase 0. Full threat modeling lands in Phase 4 (Pusher auth, channel scoping) and Phase 5 (production deploy, legal review).

## State of the Art

| Old Approach | Current Approach (April 2026) | When Changed | Impact |
|--------------|------------------------------|--------------|--------|
| `apple-mobile-web-app-capable` meta tag | `mobile-web-app-capable` + `manifest.json display: standalone` + `apple-mobile-web-app-status-bar-style: black-translucent` | Apple deprecated the former; Next.js 14+ now uses the W3C name | Not relevant at P0 (no manifest yet) — but the planner should avoid adding the deprecated tag if they scaffold extra PWA chrome. Phase 3 owns this formally. |
| `Math.min(DPR, 2)` iPhone cap (2017–2019 era) | Real DPR up to 3 | iPhone 12+ on A14/A15/A16/A17/A18 handles full DPR Canvas 2D for 1–2 polylines without frame drops | **Directly relevant at P0** — the design prototype's cap must not be ported. |
| ESLint + Prettier combo | Biome (single tool) | Biome 1.0 (2023), v2 (2025) is mature | D-02 locks this. |
| Jest | Vitest | Vitest 1.0 (2023); 4.1 current | D-02 locks this. |
| npm / yarn classic | pnpm | pnpm 10+ is the default for monorepo/strict-resolution workflows | D-02 locks this. |
| Next.js Pages Router | App Router | Next 13 (2023); Pages Router is in maintenance mode | Scaffold default. |

**Deprecated/outdated:**
- `yarn@1.x` (Yarn classic) — do not use in 2026.
- `next@14` — behind; 15.5 is the sweet spot per STACK.md.
- Pixi/Konva/Chart.js/D3 for waveforms — scene-rebuild-per-frame will not hold 60 fps on iPhone [CITED: STACK.md §What NOT to Use].

## Project Constraints (from CLAUDE.md)

Extracted directly from `/Users/onlypaul/Workspace/neosim/CLAUDE.md` — treat with the same authority as locked decisions.

- **Clinical correctness (not P0-blocking but must be preserved in scaffold shape):** alarm thresholds are neonatal; `lib/clinical/nrp.ts` will cite NRP 8th ed. P0 creates the empty `lib/clinical/` directory so P2 has a home for this. Do not add any clinical constants at P0.
- **Rhythm set is 4 only for v1:** Sinus / Sinus Brady / Sinus Tachy / Asystole. P0 renders ONLY sinus (D-04). Drop `ecgVtTemplate`, `ecgVfPoint`, `sampleCapno`, afib/vf/vt branches during the port (D-05).
- **Waveform engine state stays off the vitals store:** WAVE-10 — enforced by D-08 and the Vitest regression test.
- **Sync (instructor is single writer; waveform samples never cross the wire):** N/A at P0 (no sync), but the scaffold shape must not put sample generation on any shared-broadcast surface. Fine — `sampleEcg` is a pure function in `lib/waveforms/`.
- **`await pusher.trigger()` in every Vercel route handler:** N/A at P0 (no route handlers).
- **APGAR timer (shared-epoch):** N/A at P0.
- **iOS reality (landscape lock, fullscreen, Wake Lock):** N/A at P0 — D-13 confirms a newer iPhone is the test device; iPhone 12 re-verification is Phase 5. Do not add Wake Lock code at P0.
- **Not a medical device disclaimer:** NOT required at P0 (UI-SPEC explicitly: "Legal footer: not required at P0 — Phase 2 requirement LEGAL-02 / MON-09"). Prototype is an internal testing surface.
- **Generic brand identity:** no vendor greens/tones. UI-SPEC locks `#22c55e` (Tailwind green-500) as non-vendor.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Next.js 15.5.15 is the current 15.5 patch and the correct choice over 15.5.x-rc | Standard Stack | [VERIFIED via npm registry 2026-04-21] — LOW RISK. If a newer 15.5.x patch lands before plan execution, adopt it; scaffold uses `@15.5` range. |
| A2 | `--turbopack` flag on `create-next-app@15.5` is stable for dev in April 2026 | Installation | Turbopack is default in Next 16 and opt-in on 15.5. If dev-time hot-reload is unstable on user's iPhone preview, fall back to `next dev` without `--turbopack`. LOW risk — production build (used for Vercel preview) is unaffected either way. |
| A3 | `jsdom@29` is sufficient for the Vitest merge test at P0 and for Phase 2 component tests | Standard Stack | LOW — the P0 test doesn't touch the DOM; the assumption is about forward-compat. Can swap to happy-dom in Phase 2 if jsdom is too slow, without affecting P0 code. |
| A4 | Vercel preview deploy URLs are HTTPS and resolve to a consistent region | Environment Availability | [CITED: Vercel defaults] — HIGH confidence. Cold-start timing is Phase 1 territory. |
| A5 | iPhone 13-class and newer handle DPR=3 Canvas 2D for one sinus polyline at 60 fps | Summary | [CITED: STACK.md §Raw Canvas 2D + design prototype empirical behavior on older iPhones with DPR=2] — MEDIUM confidence. The WHOLE PHASE is the empirical test of this. If it fails, that's the phase's main signal, not a research error. |
| A6 | `ctx.scale(dpr, dpr)` applied once on an `alpha: false` context gives crisp rendering on iPhone Safari 17+ | DPR-Aware Canvas pattern | [CITED: MDN Canvas optimization] — HIGH confidence, canonical pattern. |
| A7 | `performance.now()` inside a rAF callback is monotonic and µs-precision on Vercel preview HTTPS context | Time-Based Engine | [CITED: W3C HR-Time spec] — HIGH confidence; Safari coarsens on insecure contexts only. |
| A8 | The Vitest merge test does not need `setupFiles` or a browser environment at P0 | Validation Architecture | LOW — the test is pure-function; jsdom covers any incidental browser globals. |
| A9 | Biome 2.4.12 `biome init` defaults are compatible with TS strict + Next 15.5 generated `next-env.d.ts` | Standard Stack | MEDIUM — if Biome's `noExplicitAny` or similar fires on Next's generated files, add an `ignore` entry. Trivial mitigation. |
| A10 | User has a macOS device + USB cable for Safari Web Inspector heap snapshots | Environment Availability | MEDIUM — not stated in CONTEXT. If the user is Windows/Linux-only, SC#4 evidence format needs adjustment. Planner should confirm in Wave 0. |
| A11 | The design prototype's `Math.min(DPR, 2)` was a laptop-era heuristic, not a correctness requirement | Pitfall A | [CITED: design/src/canvasChannel.jsx line 10 + STACK.md + Pitfall 4] — HIGH confidence. CONTEXT explicitly requires fixing this (D-07). |
| A12 | Creating `lib/clinical/` as an empty directory (with `.gitkeep`) is acceptable even though Biome + git may have opinions on empty dirs | Directory layout | LOW — git requires `.gitkeep`; Biome ignores the file. Standard pattern. |

**Claims tagged `[ASSUMED]` requiring user confirmation:** A10 only (macOS availability for Safari Web Inspector). All others are either verified or cited to authoritative sources.

## Open Questions

1. **Does the user have macOS + USB cable for Safari Web Inspector?**
   - What we know: D-14 requires a heap snapshot at t=0 and t=5min. Safari Web Inspector (macOS → iPhone USB) is the canonical path.
   - What's unclear: User's dev-machine OS wasn't stated in CONTEXT or STATE.
   - Recommendation: Planner adds a Wave 0 Task "Verify macOS + Safari Web Inspector reachability to iPhone." If no Mac, substitute `performance.measureUserAgentSpecificMemory()` logged to a visible `<pre>` on `/prototype`. Adjust SC#4 evidence format accordingly.

2. **Should the heap measurement happen in a separate `/prototype?probe=heap` route, or is a single `/prototype` sufficient?**
   - What we know: D-14 requires a 5-minute heap snapshot comparison. The prototype runs continuously on load.
   - What's unclear: Whether the heap snapshot is captured by letting the page run 5 minutes, or whether a short "warmup then snapshot" cycle is preferred.
   - Recommendation: Simplest — let the page run 5 minutes, snapshot at 0 and 5. No extra route.

3. **Is inline-styles-only (UI-SPEC §Design System) the best call, or should the prototype use `app/prototype/page.module.css`?**
   - What we know: UI-SPEC says both are acceptable ("All chrome is inline `style={}` or a single `app/prototype/page.module.css` at Claude's discretion").
   - What's unclear: Tradeoff is trivial but worth noting.
   - Recommendation: Inline styles. Route is throwaway; no class reuse needed.

## Sources

### Primary (HIGH confidence)
- `.planning/research/STACK.md` — stack rationale, alternatives considered, iPhone Safari 16.4+ gotchas per choice. [VERIFIED: in repo 2026-04-21]
- `.planning/research/ARCHITECTURE.md` — engine-state / vitals-store separation rationale; anti-patterns.
- `.planning/research/PITFALLS.md` — Pitfalls 4 (sweep-draw), 5 (Low Power Mode), 13 (buffer memory) — directly constrain P0.
- `.planning/research/SUMMARY.md` — integrated synthesis; Phase 0 scope confirmation.
- `design/src/waveforms.js` — canonical PQRST gaussian-sum source (port lines 4–11; drop 12–25, 49–71).
- `design/src/canvasChannel.jsx` — sweep-draw algorithm reference (fix line 10's DPR cap on port).
- `CLAUDE.md` — project non-negotiables (neonatal correctness, 4-rhythm set, engine-state guardrail).
- npm registry `view` commands executed 2026-04-21 for: `next`, `react`, `typescript`, `vitest`, `vite`, `@vitejs/plugin-react`, `jsdom`, `@biomejs/biome`, `pnpm`.
- [MDN — Optimizing Canvas](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas) — DPR scaling canonical pattern.
- [web.dev — A tale of two clocks](https://web.dev/articles/audio-scheduling) — time-based vs frame-counted scheduling (applies equally to rAF-driven waveform engines, not just audio).
- [Next.js 15 upgrade guide](https://nextjs.org/docs/app/guides/upgrading/version-15) — App Router stability at 15.5.
- [Vitest 4 docs](https://vitest.dev/) — config, React plugin, environment options.
- [Biome 2 docs](https://biomejs.dev/) — `biome init` defaults, Next.js integration.

### Secondary (MEDIUM confidence)
- Popmotion / Motion.dev blog — "When iOS throttles requestAnimationFrame to 30 fps" (Low Power Mode behavior documented).
- Prototype empirical behavior (design/ runs at 60 fps on CDN-Babel React — strong directional signal that a production Next.js build will be at least as fast).

### Tertiary (LOW confidence)
- None at P0 — the scope is narrow enough that every claim is sourced to either a verified npm view, an in-repo research file, or MDN/web.dev.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every version verified against npm registry 2026-04-21.
- Architecture patterns: HIGH — every pattern is either a Next.js canonical pattern, an MDN canonical pattern, or an in-repo ARCHITECTURE.md locked decision.
- Pitfalls: HIGH — sourced to PITFALLS.md (which was itself cross-verified against WebKit bugs).
- Code examples: HIGH — ported directly from design/ with minimal edits; merge-regression test directly encodes D-11.
- Vitest+React19+Next 15.5 interaction: MEDIUM — peer deps verified, not executed on disk. First real test is scaffold creation in Wave 0.

**Research date:** 2026-04-21.
**Valid until:** 2026-05-05 (14 days — stack versions move slowly in the 15.5.x backport line; re-verify `next@15` tail if research is older than this at plan execution time).
