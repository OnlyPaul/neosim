# Phase 0: Waveform Prototype on iPhone - Pattern Map

**Mapped:** 2026-04-21
**Files analyzed:** 12 (all new)
**Analogs found:** 2 / 12 — **greenfield phase**

## Headline

This phase writes the **first production TS/Next.js code** in the repo. There are no established in-repo patterns to copy from. The only pre-existing code anywhere in the tree is the throwaway React-via-CDN design prototype at `/Users/onlypaul/Workspace/neosim/design/`, which is a **visual + UX lock, not a codebase to mimic**.

Two files in `design/` are partial **port analogs** (port the math/algorithm, rewrite the shape):
- `design/src/waveforms.js` → port sinus PQRST into `lib/waveforms/sampleEcg.ts`
- `design/src/canvasChannel.jsx` → port sweep-draw algorithm into `lib/waveforms/sweepCanvas.ts`

Everything else is net-new and establishes patterns for Phase 2+. The planner should treat the Code Examples in `00-RESEARCH.md` (§Code Examples, lines 600–849) as the authoritative shape; `design/` is reference only for the ported math and the clear-ahead algorithm.

**Mandatory port fixes** (do NOT copy verbatim from `design/`):
- `Math.min(window.devicePixelRatio || 1, 2)` (design/src/canvasChannel.jsx:10) → `window.devicePixelRatio || 1` (no cap — WAVE-05 / D-07)
- In-place `state._phase`, `state._lastT`, `state._rFired` mutation on a shared state object (design/src/waveforms.js:34–44) → dedicated `EngineState` module injected as a parameter (D-08 / WAVE-10)
- `ecgVtTemplate`, `ecgVfPoint`, `ecgAsystolePoint`, `samplePleth`, `sampleCapno`, afib/vt/vf branches (design/src/waveforms.js:12–25, 49–71) → **drop entirely** (D-05; clinically wrong for neonates)

## File Classification

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `package.json` | config | N/A | none — greenfield | none; use `pnpm create next-app@15.5` + `RESEARCH.md §Installation` lines 136–161 |
| `tsconfig.json` | config | N/A | none — greenfield | none; `create-next-app` default (verify `strict: true`) |
| `vitest.config.ts` | config | N/A | none — greenfield | none; use `RESEARCH.md §Vitest Configuration Skeleton` lines 176–193 verbatim |
| `biome.json` | config | N/A | none — greenfield | none; `pnpm exec biome init` defaults + `RESEARCH.md` lines 202–209 |
| `lib/waveforms/engine-state.ts` | utility (pure module) | module-scoped state | none — greenfield | none; use `RESEARCH.md §engine-state.ts` lines 658–668 verbatim |
| `lib/waveforms/sampleEcg.ts` | utility (pure fn) | transform (t, hr, state) → {v, rPeak} | `design/src/waveforms.js` | **port-partial** (sinus only; reshape state) |
| `lib/waveforms/sweepCanvas.ts` | utility (Canvas primitive) | per-frame render | `design/src/canvasChannel.jsx` | **port-partial** (fix DPR cap; extract from React component into plain functions) |
| `lib/clinical/.gitkeep` | placeholder | N/A | none — greenfield | none; empty file; directory exists for P2's `nrp.ts` |
| `app/prototype/page.tsx` | route (Server Component shell) | request-response (static) | none — greenfield | none; use `RESEARCH.md` lines 764–770 verbatim |
| `app/prototype/PrototypeClient.tsx` | component (client) | event-driven (rAF loop) | `design/src/canvasChannel.jsx` (component shape only) | role-match but rewrite; use `RESEARCH.md` lines 772–849 verbatim |
| `tests/waveforms/engine-state.merge.test.ts` | test (unit) | assertion | none — greenfield | none; use `RESEARCH.md §Vitest Merge-Regression Test` lines 540–590 verbatim |
| `tests/waveforms/sample-ecg.test.ts` | test (unit) | assertion | none — greenfield | none; new test — assert R-peak fires at phase ≈ 0.28 for HR=60 and HR=180 (WAVE-07) |

## Pattern Assignments

### `lib/waveforms/sampleEcg.ts` (utility, transform) — PORT-PARTIAL

**Analog:** `/Users/onlypaul/Workspace/neosim/design/src/waveforms.js`

**What to port verbatim (the math):** `ecgSinusTemplate` gaussian-sum formula, lines 4–11:

```js
// design/src/waveforms.js:4-11 — PORT VERBATIM (retype in TS, same numbers)
function ecgSinusTemplate(phase) {
  const p = Math.exp(-Math.pow((phase - 0.10) / 0.025, 2)) * 0.15;
  const q = -Math.exp(-Math.pow((phase - 0.25) / 0.008, 2)) * 0.18;
  const r = Math.exp(-Math.pow((phase - 0.28) / 0.010, 2)) * 1.20;
  const s = -Math.exp(-Math.pow((phase - 0.31) / 0.012, 2)) * 0.35;
  const t = Math.exp(-Math.pow((phase - 0.58) / 0.055, 2)) * 0.30;
  return p + q + r + s + t;
}
```

**What to reshape (the state mutation):** The design prototype mutates fields on a shared `state` object that is also the rhythm/hr store. P0 must pass an injected `EngineState` instead.

BEFORE (design/src/waveforms.js:26–48 — **anti-pattern, do not port**):
```js
function sampleEcg(t, state) {
  // ...
  state._phase = (state._phase || 0) + dt / beatDur;  // mutates shared store
  if (state._phase >= 1) { state._phase -= 1; /* ... */ }
  if (phase > 0.27 && phase < 0.30 && !state._rFired) { state._rFired = true; rPeak = true; }
}
```

AFTER (shape locked by `RESEARCH.md §Complete sampleEcg.ts` lines 604–652):
```ts
import type { EngineState } from './engine-state';
export function sampleEcg(t: number, hr: number, s: EngineState): SampleResult {
  const safeHr = Math.max(1, hr);
  const beatDurMs = 60_000 / safeHr;
  if (s.lastT === 0) { s.lastT = t; return { v: ecgSinusTemplate(s.phase), rPeak: false }; }
  const dt = Math.min(100, t - s.lastT);   // Pitfall C — clamp runaway deltas
  s.lastT = t;
  s.phase = (s.phase + dt / beatDurMs) % 1;
  let rPeak = false;
  if (s.phase > 0.27 && s.phase < 0.30 && !s.rFired) { s.rFired = true; rPeak = true; }
  if (s.phase < 0.25 || s.phase > 0.32) s.rFired = false;
  return { v: ecgSinusTemplate(s.phase), rPeak };
}
```

**What to drop entirely** (design/src/waveforms.js lines 12–25, 49–71 — `ecgVtTemplate`, `ecgVfPoint`, `ecgAsystolePoint`, `samplePleth`, `sampleCapno`, and the `rhythm === 'asystole' | 'vf' | 'afib' | 'vt'` branches in `sampleEcg`). These are either clinically wrong for neonates (dysrhythmias) or deferred to Phase 2 (pleth, asystole).

**Units change:** Design uses seconds for `t` (`performance.now() / 1000`). P0 passes `t` in **milliseconds** (DOMHighResTimeStamp direct from rAF callback); `beatDurMs = 60_000 / hr`. Keeps the rAF arg pass-through clean and avoids a `/1000` in the hot path.

---

### `lib/waveforms/sweepCanvas.ts` (utility, per-frame render) — PORT-PARTIAL

**Analog:** `/Users/onlypaul/Workspace/neosim/design/src/canvasChannel.jsx`

**What to port (the algorithm):** The clear-ahead rectangle + wrap-safe erase + segment draw pattern, lines 37–56:

```js
// design/src/canvasChannel.jsx:37-56 — PORT THE ALGORITHM
for (let i = 1; i <= advance; i++) {
  const sampleTime = now - dt + (i / advance) * dt;
  const x = Math.floor((sampleTime * pxPerSec) % w);
  ctx.fillStyle = bg;
  const eraseStart = (x + 1) % w;
  const eraseW = Math.min(gap, w - eraseStart);
  ctx.fillRect(eraseStart, 0, eraseW, h);
  if (eraseW < gap) ctx.fillRect(0, 0, gap - eraseW, h);  // wrap-safe erase
  // ... sample + draw segment from (lastX, lastY) to (x, y)
  if (x >= lastX && (x - lastX) < gap * 4) {
    ctx.moveTo(lastX, lastY); ctx.lineTo(x, y); ctx.stroke();
  }
  lastX = x; lastY = y;
}
```

**Mandatory fixes on port:**

1. **DPR cap — REMOVE.** Design line 10:
   ```js
   const dpr = Math.min(window.devicePixelRatio || 1, 2);  // ← WAVE-05 violation
   ```
   Replace with:
   ```ts
   const dpr = window.devicePixelRatio || 1;  // no cap; real DPR=3 on iPhone 12+
   ```

2. **Apply `ctx.scale(dpr, dpr)` once at init; work in CSS px thereafter.** Design keeps canvas math in device pixels (`canvas.width` = device px, all draw coords scaled by `dpr` inline, e.g. line 33: `ctx.lineWidth = Math.max(1.6, dpr * 1.4)`). Cleaner pattern is `ctx.scale(dpr, dpr)` once and then all `lineWidth`, `clearRect`, `lineTo` in CSS px. See `RESEARCH.md §Pattern 1` lines 298–312 and the reference implementation at `RESEARCH.md §sweepCanvas.ts` lines 672–759.

3. **Clear-ahead width formula is LOCKED** by Pitfall 4 / D-06:
   ```ts
   const clearAhead = Math.ceil(pxPerFrame) + lineWidth + 2;
   ```
   Design uses `gap = Math.max(6, Math.floor(pxPerSec * 0.035))` — a ~35ms-wide gap heuristic. Replace with the Pitfall 4 envelope.

4. **Extract from React component.** The design bundles the whole render loop inside a `WaveformChannel` functional component with `useEffect`. P0 splits this into plain functions:
   - `setupSweepCanvas(canvas, opts) → SweepCtx` — called once from `PrototypeClient` `useEffect`.
   - `stepSweep(sc, tNow, dtMs, sampleFn, scale)` — called per rAF tick from `PrototypeClient`.

   The component-side rAF loop lives in `PrototypeClient.tsx`, not in `sweepCanvas.ts`. This keeps the primitive testable in Node (Vitest can construct a `SweepCtx` with a jsdom `<canvas>` or a mock 2D context).

5. **No `ResizeObserver` at P0.** Design observes resize (lines 20–21) and rebuilds the context on every resize. P0 is a static landscape screenshot run — do not port the resize path (see `RESEARCH.md §Pitfall D` lines 462–470).

---

### `app/prototype/PrototypeClient.tsx` (component, event-driven) — REWRITE

**Analog:** `/Users/onlypaul/Workspace/neosim/design/src/canvasChannel.jsx` (component shape only — the React-via-CDN ref pattern is the only transferable bit)

**What the design demonstrates well:** Two refs — one for the canvas, one for the rAF handle — initialized in `useEffect`, cleaned up on unmount.

**What to rewrite:**
- React 19 idioms (proper `useRef<HTMLCanvasElement>(null)` TS generics, not `useRefW`).
- FPS overlay via `Float32Array` ring + `textContent` ref updates at 1Hz (`RESEARCH.md §Pitfall E` lines 478–496) — design has no FPS overlay; this is net-new.
- Inline-style chrome per UI-SPEC (monospace 14px, rgba(255,255,255,0.72) → #f59e0b when avg < 55 fps).
- Amber/white color switch based on `avg` — new; not in design.

**Reference implementation:** Use `RESEARCH.md §app/prototype/PrototypeClient.tsx` lines 772–849 verbatim. No design-prototype patterns other than "canvas ref + useEffect + rAF + cleanup" survive.

---

### `lib/waveforms/engine-state.ts`, `tests/waveforms/*`, all config files

**Analog:** none — greenfield.

**Source of truth:** `RESEARCH.md §Code Examples` (engine-state.ts: lines 656–668; merge test: lines 540–590; sweep + client + prototype page: lines 670–849). All of these are authoritative shapes; the planner should reference them directly in the plan's action steps. No prior in-repo analog exists to diff against.

## Shared Patterns

Because this phase **establishes** the patterns P2+ will inherit, "shared patterns" here are forward-looking conventions the planner should bake in once and reuse:

### Directory layout (D-03 — locked)
```
app/prototype/page.tsx           ← throwaway (delete after P2)
app/prototype/PrototypeClient.tsx ← throwaway
lib/waveforms/engine-state.ts    ← permanent
lib/waveforms/sampleEcg.ts       ← permanent
lib/waveforms/sweepCanvas.ts     ← permanent
lib/clinical/.gitkeep            ← permanent (empty directory for P2)
tests/waveforms/*.test.ts        ← permanent
```
Flat repo root; `--no-src-dir` per `RESEARCH.md §Installation` line 144.

### Import alias
`@/*` maps to repo root (`create-next-app --import-alias "@/*"`). Tests import via `@/lib/waveforms/...` so paths survive the move; see `tests/waveforms/engine-state.merge.test.ts` example at `RESEARCH.md` lines 544–545.

### Engine-state separation (WAVE-10 non-negotiable)
Mutable rAF-hot-path state (`phase`, `rFired`, `lastT`, `jitter`) lives **only** in `lib/waveforms/engine-state.ts`. It is:
- Never a field of any future vitals store / Zustand slice / React state.
- Never serialized to the wire (Pusher).
- Always injected into `sampleEcg` as the third argument.
- Factory-shape (`createEngineState()`), not singleton, so tests get isolated instances.

The merge-regression test at `tests/waveforms/engine-state.merge.test.ts` is the **permanent guardrail** — it ships forward through P2/P3/P4 unchanged except for swapping the trivial `mergeVitals` helper for the real Zustand store's merge primitive.

### Time-base convention
- Engine advance driven by `performance.now()` / DOMHighResTimeStamp (never `Date.now()`).
- `t` is **milliseconds**, not seconds (divergence from design prototype).
- Clamp `dt` to `≤ 100ms` in every `sampleEcg` call (Pitfall C — backgrounded-tab guard).
- rAF callback's single argument is the timestamp; pass it through to `sampleEcg` and `stepSweep`; never call `performance.now()` from inside pure functions.

### Canvas / DPR convention
- `const dpr = window.devicePixelRatio || 1;` — **no cap**.
- `ctx.scale(dpr, dpr)` applied **once** at `setupSweepCanvas`; CSS px thereafter.
- `ctx.getContext('2d', { alpha: false })` — opaque surface is faster on iPhone.
- Clear-ahead width is the Pitfall 4 envelope: `Math.ceil(pxPerFrame) + lineWidth + 2`.
- Line width is `Math.max(1.6, Math.ceil(dpr * 1.4))` in CSS px — crisp at DPR=1, DPR=2, DPR=3.

### FPS overlay convention
Hot-path updates via `ref.textContent` (never React state). Ring-buffered via `Float32Array(180)`. DOM-updated at 1Hz. Monospace font so digit changes don't reflow. Color switches to amber `#f59e0b` when `avg < 55`. Reference: `RESEARCH.md §Pitfall E` lines 478–496.

### Test convention
- Vitest + jsdom + `@vitejs/plugin-react`; `include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx']`.
- Factory-style fixtures (no `beforeEach` global reset).
- Deterministic time inputs — tests pass explicit `t` values, never call `performance.now()`.
- Path aliases via `@/...` match the Next config.

## No Analog Found

Every file in this phase except the two ports below has no in-repo analog (greenfield).

The two partial-port files are documented in detail above:

| File | Role | Partial Analog | Notes |
|------|------|----------------|-------|
| `lib/waveforms/sampleEcg.ts` | pure transform | `design/src/waveforms.js:4-11,26-48` | Port the PQRST math verbatim; reshape the state-mutation pattern; drop every non-sinus branch. |
| `lib/waveforms/sweepCanvas.ts` | Canvas primitive | `design/src/canvasChannel.jsx:7-61` | Port the clear-ahead + wrap-safe erase algorithm; fix the DPR cap; split out of the React component into plain functions. |

## Metadata

**Analog search scope:** entire repo — specifically `/Users/onlypaul/Workspace/neosim/design/src/` (React-via-CDN prototype, visual + UX lock per CLAUDE.md), `.planning/` (docs only, not code), and repo root (8-byte `README.md`, generic PRD file). No `app/`, `lib/`, `src/`, `tests/`, `pages/`, `components/`, `services/`, or `middleware/` directories exist yet.
**Files scanned:** 2 code files (`design/src/waveforms.js`, `design/src/canvasChannel.jsx`).
**Pattern extraction date:** 2026-04-21.
**Authoritative reference for all new-file shapes:** `.planning/phases/00-waveform-prototype/00-RESEARCH.md` §Code Examples (lines 600–849) and §Vitest Merge-Regression Test (lines 540–590). These are the concrete shapes the planner should reference in PLAN action steps, *not* the `design/` files (except for the two partial ports above).
