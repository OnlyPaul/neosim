---
phase: 00-waveform-prototype
plan: 03
subsystem: waveform-engine
tags: [sweepCanvas, ring-buffer, prototype-route, canvas-2d, dpr, wave-01, wave-04, wave-05]

requires:
  - "lib/waveforms/engine-state.ts (EngineState + createEngineState from Plan 00-01)"
  - "lib/waveforms/sampleEcg.ts (sinus PQRST sampler from Plan 00-02)"
provides:
  - "lib/waveforms/buffer.ts — Float32Array ring buffer (WAVE-04) with createRingBuffer + writeSample"
  - "lib/waveforms/sweepCanvas.ts — DPR-aware Canvas 2D sweep-draw primitive with setupSweepCanvas + stepSweep"
  - "app/prototype/page.tsx — Server Component shell for the throwaway prototype route"
  - "app/prototype/PrototypeClient.tsx — Client component: rAF loop, FPS overlay, WAVE-04 buffer wiring"
affects:
  - 00-04-vercel-deploy-and-evidence (deploys the /prototype route and captures iPhone FPS evidence)
  - all Phase 2+ plans (buffer.ts + sweepCanvas.ts ship forward unchanged; app/prototype/* deleted)

tech-stack:
  added: []
  patterns:
    - "DPR-aware Canvas: read real window.devicePixelRatio with no cap; ctx.scale(dpr, dpr) applied once at setup; all subsequent math in CSS pixels (Pattern 1)"
    - "Clear-ahead sweep-draw: Pitfall 4 envelope = advancePx + lineWidth + 2 CSS px; wrap-safe erase with modular eraseStart (Pattern 2)"
    - "Float32Array ring buffer: single allocation per channel; modular writeIdx; no realloc ever (Pattern 5 / Pitfall 13)"
    - "FPS overlay via ref.textContent at 1 Hz: never React state; fpsRing=Float32Array(180); color switches amber when avg<55 (Pitfall E / UI-SPEC)"
    - "Server Component shell + 'use client' client component split: page.tsx imports PrototypeClient; page does no runtime work (no window refs)"

key-files:
  created:
    - "lib/waveforms/buffer.ts (34 lines)"
    - "lib/waveforms/sweepCanvas.ts (124 lines)"
    - "tests/waveforms/buffer.test.ts (40 lines)"
    - "app/prototype/page.tsx (11 lines)"
    - "app/prototype/PrototypeClient.tsx (136 lines)"
  modified: []

key-decisions:
  - "Dropped the plan's prescribed @ts-expect-error for WebkitBackdropFilter — React 19's CSSProperties already types it, so the suppression was unused and failed strict TS compilation. Removed and documented inline."
  - "Moved the 'use client' directive to line 1 of PrototypeClient.tsx — the Next.js directive must precede imports but putting it after a multi-line comment block passed Next.js but failed the plan's grep acceptance (which requires match on lines 1–5)."
  - "Rewrote header comments in sweepCanvas.ts and buffer.ts to avoid mentioning anti-pattern strings verbatim ('Math.min(dpr, 2)', 'ResizeObserver', '.push()') — plan-level negative greps (grep -r 'Math.min.*dpr.*2' lib/, etc.) fire on anti-pattern descriptions in comments. Rephrased without losing the rationale."

patterns-established:
  - "Canvas primitive split: pure functions (setupSweepCanvas + stepSweep) in lib/waveforms/; React component (PrototypeClient) owns the rAF lifecycle and ref wiring. Primitive is testable without a React tree."
  - "Ring buffer + draw-loop integration: sampleFn closure inside the rAF tick writes to the buffer AND returns the sample to the draw loop. Single-channel P0 doesn't re-read from the buffer; the buffer's presence satisfies WAVE-04 / D-10 literally."
  - "Overlay ref-update pattern: useRef<HTMLDivElement>, set textContent directly, update at 1 Hz via lastOverlayUpdate gate. Transferable to any future high-frequency readout (HR digit, SpO₂ digit) in Phase 2."

requirements-completed: [WAVE-01, WAVE-04, WAVE-05]

duration: 8min
completed: 2026-04-21
---

# Phase 0 Plan 03: Sweep Canvas + /prototype Route Summary

**Shipped the DPR-aware Canvas 2D sweep-draw primitive (`lib/waveforms/sweepCanvas.ts`) with the three mandatory port fixes over `design/src/canvasChannel.jsx` — no DPR cap, single `ctx.scale`, Pitfall 4 clear-ahead envelope — plus the WAVE-04 `Float32Array` ring buffer and the `/prototype` route that composes them into an rAF loop with a 1 Hz FPS overlay, unblocking Plan 00-04's iPhone evidence capture.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-04-21T02:43:53Z
- **Completed:** 2026-04-21T02:51:52Z
- **Tasks:** 2 (Task 1 tdd=true: RED+GREEN; Task 2 tdd=false)
- **Files created:** 5 (34 + 124 + 40 + 11 + 136 = 345 lines total)
- **Test count:** 12 tests across 4 files, all green, suite ~555 ms

## Accomplishments

- `lib/waveforms/buffer.ts` (34 lines): WAVE-04 literal — `createRingBuffer(sampleRate, sweepSeconds)` allocates exactly `sampleRate * sweepSeconds` Float32Array slots in one shot; `writeSample(rb, v)` uses `rb.writeIdx = (rb.writeIdx + 1) % rb.length` with zero reallocation. 3 Vitest tests pin the shape (allocation correctness, wraparound identity of `.data`, per-slot writes).
- `lib/waveforms/sweepCanvas.ts` (124 lines): ported verbatim from RESEARCH.md §sweepCanvas.ts with the three mandatory port fixes over `design/src/canvasChannel.jsx`:
  1. Real DPR read (`window.devicePixelRatio || 1`) with no `Math.min(..., 2)` cap — WAVE-05 / D-07.
  2. `ctx.scale(dpr, dpr)` applied exactly once at setup (grep -c returns 1); all subsequent math in CSS pixels.
  3. Clear-ahead width locked at `advancePx + lineWidth + 2` CSS px — Pitfall 4 envelope.
  Plus `getContext('2d', { alpha: false })` for opaque iPhone surface; `lineWidth = Math.max(1.6, Math.ceil(dpr * 1.4))` crisp at DPR 1/2/3; no `ResizeObserver` (Pitfall D, P0 static landscape).
- `app/prototype/page.tsx` (11 lines): Server Component shell with static metadata `'NeoSim — Waveform Prototype'`. Imports `PrototypeClient` and renders it. No `'use client'`, no runtime work, no `window` references — builds cleanly with `next build` (5 static pages, `/prototype` at 1.78 kB first-load).
- `app/prototype/PrototypeClient.tsx` (136 lines): rAF loop that composes the permanent primitives. `createRingBuffer(250, 5)` allocated once at mount (1250 samples, 5 KB). Each rAF tick calls `sampleEcg(sampleT, 140, engine)`, writes the `v` into the ring buffer, then feeds it to `stepSweep`. FPS ring is `Float32Array(180)`; overlay DOM is updated via `overlayRef.current.textContent` at 1 Hz gated by `lastOverlayUpdate`. Color switches to `#f59e0b` when `avg < 55`. Canvas has `role="img"` + `aria-label`; overlay is `aria-hidden="true"`.
- All plan-level gates green: `pnpm build` exits 0 (5 static pages), `pnpm test` 12/12, `pnpm exec biome check .` clean (17 files), `pnpm exec tsc --noEmit` clean.

## Desktop Sanity-Check Observations

Desktop verification was deferred to Plan 00-04 per the plan's own instructions — Plan 04 deploys to Vercel and captures iPhone evidence, which is the real gate. The build-time + test-time evidence listed above is the P0-03 deliverable; visual correctness on iPhone Safari DPR=3 is Plan 04's job.

## Task Commits

Each task committed atomically:

1. **Task 1 (RED): failing buffer tests** — `dfb3859` — `test(00-03): add failing ring-buffer tests (RED)` — 3 tests failing on missing `@/lib/waveforms/buffer` module; prior 9 tests still green.
2. **Task 1 (GREEN): buffer.ts + sweepCanvas.ts** — `8f61faa` — `feat(00-03): ring buffer + DPR-aware sweep canvas (GREEN)` — 12/12 tests green; tsc clean; biome clean.
3. **Task 2: /prototype route (Server shell + Client component)** — `c8c1519` — `feat(00-03): /prototype route with FPS overlay (Server shell + Client)` — pnpm build exits 0; no SSR errors.

Plan-level metadata commit (SUMMARY.md + STATE.md + ROADMAP.md + REQUIREMENTS.md) follows this summary.

## Files Created/Modified

**Permanent (ships to Phase 2+):**
- `lib/waveforms/buffer.ts` — **CREATED** (34 lines). Single `Float32Array` allocation; modular write index. Zero imports.
- `lib/waveforms/sweepCanvas.ts` — **CREATED** (124 lines). `SweepCtx` interface + `setupSweepCanvas` + `stepSweep`. Zero imports (browser-only).
- `tests/waveforms/buffer.test.ts` — **CREATED** (40 lines). 3 tests pinning WAVE-04 shape.

**Throwaway (slated for deletion after Phase 2 ships — T-00-03):**
- `app/prototype/page.tsx` — **CREATED** (11 lines). Server Component shell.
- `app/prototype/PrototypeClient.tsx` — **CREATED** (136 lines). Client-side rAF loop + FPS overlay.

**Exactly these two files are slated for deletion after Phase 2:** `app/prototype/page.tsx` and `app/prototype/PrototypeClient.tsx`. The `lib/waveforms/*` files ship forward unchanged.

## Decisions Made

### Dropped the @ts-expect-error directive (plan deviation)

The plan (action body lines 407, 425) prescribed an `@ts-expect-error` comment above `WebkitBackdropFilter: 'blur(6px)'` on the rationale that the vendor-prefixed property was not in `CSSProperties`. React 19's `@types/react@19.2.14` (locked by Plan 01) already types `WebkitBackdropFilter`, so the suppression was unused — and TypeScript strict mode (with `ts-expect-error` enforcement) flagged the unused directive as a hard build error:

```
./app/prototype/PrototypeClient.tsx:124:11
Type error: Unused '@ts-expect-error' directive.
```

Treated this as a Rule 1 bug: the directive was stale advice from the planner, applied verbatim would have failed the plan-level `pnpm build exits 0` gate. Replaced the suppression with a plain explanatory comment:

```tsx
backdropFilter: 'blur(6px)',
// iOS Safari <18 needs the vendor-prefixed property; React 19's
// CSSProperties types already include WebkitBackdropFilter, so no
// ts-expect-error suppression is required here.
WebkitBackdropFilter: 'blur(6px)',
```

Build passes, TS strict passes, iOS Safari <18 still receives the vendor-prefixed blur. No functional difference; the comment documents why a future reader should not reintroduce the suppression.

### Moved 'use client' to line 1 (plan deviation)

Plan acceptance criterion: `grep -E "^'use client'" app/prototype/PrototypeClient.tsx matches on lines 1–5`. The verbatim RESEARCH.md shape places `'use client'` on line 3 (below a two-line file header comment), and my first draft placed it on line 13 (below a 12-line header comment block). Next.js itself accepts both shapes — the directive must only precede imports, comments are allowed above it — but the plan's literal grep check would have returned failure.

Fix: moved `'use client'` to be the very first line, with the comment header block moved below it. This also aligns with the dominant Next.js 15 App Router convention where `'use client'` is file-top-most. Not a functional change.

### Comment rewording to avoid negative-grep false-positives

The plan's verification gate includes `grep -r "Math.min.*devicePixelRatio.*2" lib/` and `grep -r "Math.min.*dpr.*2" lib/` and expects zero matches. My initial header comment for `sweepCanvas.ts` explicitly named the anti-pattern in plain English ("design uses `Math.min(dpr, 2)`"), which passed human review but tripped the negative regex. Similarly, the initial `buffer.ts` comment mentioned `.push()` verbatim.

Rewrote the comments to describe the fixes in prose without embedding the forbidden token sequences (e.g., "device-pixel-ratio cap REMOVED" instead of "design uses Math.min(dpr, 2)"; "Array#push" instead of ".push()"; "the resize observer" instead of "ResizeObserver"). No information lost; regex-safe.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed stale @ts-expect-error directive for WebkitBackdropFilter**
- **Found during:** Task 2 — `pnpm build` after initial write.
- **Issue:** React 19's CSSProperties already types `WebkitBackdropFilter`. The plan-prescribed `// @ts-expect-error` suppression was unused and failed TypeScript strict build with "Unused '@ts-expect-error' directive."
- **Fix:** Replaced the suppression with a plain comment explaining why no suppression is needed. Same runtime behavior; build passes.
- **Files modified:** `app/prototype/PrototypeClient.tsx`
- **Verification:** `pnpm build` exits 0; `/prototype` lands at 1.78 kB first-load.
- **Committed in:** `c8c1519`

**2. [Rule 3 - Blocking] Moved 'use client' to line 1 to satisfy plan grep**
- **Found during:** Task 2 — initial acceptance-criteria pass.
- **Issue:** Initial draft placed the directive on line 13 below a comment header. Passes Next.js build but fails `grep -E "^'use client'" | matches on lines 1–5`.
- **Fix:** Moved the directive to the very first line, comment header to lines 2–13.
- **Files modified:** `app/prototype/PrototypeClient.tsx`
- **Verification:** `head -1 app/prototype/PrototypeClient.tsx` prints `'use client';`.
- **Committed in:** `c8c1519`

**3. [Rule 3 - Blocking] Reworded file-header comments to avoid negative-grep false-positives**
- **Found during:** Task 1 — post-GREEN acceptance-grep pass.
- **Issue:** Plan negative greps (`grep -r "Math.min.*dpr.*2" lib/`, `grep -rE "ResizeObserver" lib/waveforms/sweepCanvas.ts`, `grep -E "\.push\(" lib/waveforms/buffer.ts`) were matching anti-pattern strings inside the explanatory comment blocks. The grep rules don't distinguish code from comments; the intent is that forbidden patterns should not appear in the file at all to prevent accidental resurrection.
- **Fix:** Rewrote the comments in prose ("device-pixel-ratio cap REMOVED"; "Array#push"; "the resize observer"; "horizontal transform scale applied ONCE") while preserving all rationale. No information lost, no functional change.
- **Files modified:** `lib/waveforms/sweepCanvas.ts`, `lib/waveforms/buffer.ts`
- **Verification:** All 13 plan acceptance greps pass (see grep output in task commit messages).
- **Committed in:** `8f61faa` (via inline edit before commit)

**4. [Rule 3 - Formatting] Biome auto-format wrapped long parameter lists**
- **Found during:** Task 1 — post-write `pnpm exec biome check lib/waveforms/`.
- **Issue:** Biome's 80-column format wanted `createRingBuffer(...)` signature on three lines, `setupSweepCanvas(canvas, opts)` with opts as an expanded inline type on multiple lines, and the `if (!ctx) throw new Error(...)` on a block shape. Purely formatter-wants-multiline.
- **Fix:** `pnpm exec biome check --write lib/waveforms/`.
- **Files modified:** `lib/waveforms/buffer.ts`, `lib/waveforms/sweepCanvas.ts`
- **Verification:** `pnpm exec biome check .` exits 0.
- **Committed in:** `8f61faa`

---

**Total deviations:** 4 auto-fixed (1 Rule 1 bug in plan-prescribed shape, 2 Rule 3 blocking, 1 Rule 3 formatting).
**Impact on plan:** None on scope, acceptance criteria, or the ported algorithms. Deviations 1 and 2 were plan-prescribed shapes that didn't survive contact with React 19's type definitions and Biome's formatter; deviation 3 was a surface rewording to satisfy a blanket regex; deviation 4 was Biome formatter output. No architectural change.

## Issues Encountered

- **No SSR/window leaks** — `app/prototype/page.tsx` is a pure Server Component (no `'use client'`, no hooks, no browser refs). `app/prototype/PrototypeClient.tsx` accesses `window.devicePixelRatio` through `setupSweepCanvas` but that code lives inside `useEffect`, which never runs on the server. `next build` generated 5 static pages including `/prototype` without any SSR warnings.
- **No Biome/TS warnings around WebkitBackdropFilter** — after removing the stale `@ts-expect-error`, zero diagnostics on the overlay style block.
- **Bundle impact** — `/prototype` adds exactly 1.78 kB over the shared 102 kB first-load JS. The 5 KB ring buffer is allocated at runtime (not in the bundle); the primitive functions are tree-shakeable.

## User Setup Required

None — no external service configuration required at this plan. Vercel preview hookup lands in Plan 00-04. Desktop and iPhone evidence capture is Plan 00-04's responsibility.

## Next Phase Readiness

Plan 00-04 (Vercel deploy + iPhone FPS evidence) is unblocked:
- `/prototype` route builds and renders cleanly on `pnpm dev` / `pnpm build` / `pnpm start`.
- FPS overlay is instrumented and ready for screenshot capture; rolling-avg + min over ~3 s at 60 fps.
- All three hardest technical bets of Phase 0 are in code: real DPR=3 (WAVE-05), Float32Array ring buffer (WAVE-04, Pitfall 13), Pitfall 4 clear-ahead envelope (WAVE-01).
- WAVE-04 requirement is validated by unit tests (literal shape from D-10).
- WAVE-01 and WAVE-05 are code-validated only; Plan 04's iPhone screenshot is the device-validation gate.

No blockers. No concerns.

## TDD Gate Compliance

Task 1 (`tdd="true"`) observed the full RED → GREEN sequence:
- **RED gate:** `dfb3859` — `test(00-03): add failing ring-buffer tests (RED)` — buffer.test.ts imports from `@/lib/waveforms/buffer` which does not yet exist; Vitest fails import resolution. Prior 9 tests still green.
- **GREEN gate:** `8f61faa` — `feat(00-03): ring buffer + DPR-aware sweep canvas (GREEN)` — buffer.ts + sweepCanvas.ts created; 12/12 tests green.
- **REFACTOR:** skipped — both files are ~40 and ~124 lines of verbatim research-shape code with no cleanup opportunity. Biome formatter fixes were applied in-band during GREEN.

Task 2 (`tdd="false"`) — no TDD gate required (rendering side-effects; real validation is the iPhone screenshot in Plan 04).

## Self-Check: PASSED

**Files:**
- `lib/waveforms/buffer.ts` — FOUND (34 lines)
- `lib/waveforms/sweepCanvas.ts` — FOUND (124 lines)
- `tests/waveforms/buffer.test.ts` — FOUND (40 lines)
- `app/prototype/page.tsx` — FOUND (11 lines)
- `app/prototype/PrototypeClient.tsx` — FOUND (136 lines)

**Commits (on branch `phase-0-waveform-prototype`):**
- `dfb3859` — FOUND (RED)
- `8f61faa` — FOUND (Task 1 GREEN)
- `c8c1519` — FOUND (Task 2)

**Gates:**
- `pnpm build` — exits 0, 5 static pages including `/prototype`
- `pnpm test` — 12/12 green (3 engine-state + 2 merge + 4 sample-ecg + 3 buffer)
- `pnpm exec tsc --noEmit` — clean
- `pnpm exec biome check .` — clean (17 files checked)
- Negative greps in `lib/waveforms/`: zero matches on `Math.min.*dpr.*2`, `Math.min.*devicePixelRatio.*2`, `ResizeObserver`, `.push(`
- Positive greps in `lib/waveforms/sweepCanvas.ts`: exactly 1 match on `ctx.scale(dpr, dpr)`; `advancePx + lineWidth + 2` present; `getContext('2d', { alpha: false })` present
- Positive greps in `app/prototype/PrototypeClient.tsx`: `createRingBuffer(250, 5)` present; `writeSample(rb,` present; `#22c55e` + `#f59e0b` present; `role="img"` + `aria-hidden="true"` present; zero matches on `useState`
- Negative grep in `app/prototype/page.tsx`: zero matches on `'use client'`

---
*Phase: 00-waveform-prototype*
*Completed: 2026-04-21*
