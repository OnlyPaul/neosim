---
phase: 00-waveform-prototype
plan: 02
subsystem: waveform-engine
tags: [sampleEcg, sinus-pqrst, engine-state, vitest, tdd, wave-03, wave-07, wave-10]

requires:
  - "lib/waveforms/engine-state.ts (EngineState + createEngineState from Plan 00-01)"
  - "Vitest 4 + jsdom + @/* alias (scaffold from Plan 00-01)"
provides:
  - "lib/waveforms/sampleEcg.ts — pure sinus PQRST sampler with dt-clamped time-based advance"
  - "tests/waveforms/engine-state.merge.test.ts — permanent WAVE-10 merge-regression guard"
  - "tests/waveforms/sample-ecg.test.ts — WAVE-07 R-peak + WAVE-03 time-base invariance + Pitfall C clamp guards"
affects:
  - 00-03-sweep-canvas-and-prototype (imports sampleEcg for the sweep-draw primitive)
  - 00-04-vercel-deploy-and-evidence (ships sampleEcg to iPhone for FPS + heap measurement)
  - all Phase 2+ plans (sampleEcg ships forward unchanged; merge-regression test ports to P4 by swapping mergeVitals helper for the real Zustand merge)

tech-stack:
  added: []
  patterns:
    - "Pure-w.r.t.-state sampler: (t, hr, EngineState) → {v, rPeak}, mutates only the injected state arg"
    - "Time-based phase advance (dt/beatDurMs), never frame-counted — WAVE-03 / LPM-safe"
    - "dt clamped into [0, 100]ms — Pitfall C (tab return) + Pitfall B (non-monotonic clock)"
    - "No seed-sentinel: the clamp bounds the one-time first-frame transient; tests can pass t=0 safely"
    - "Deterministic-time Vitest pattern: tests pass explicit t values, never call performance.now()"

key-files:
  created:
    - "lib/waveforms/sampleEcg.ts"
    - "tests/waveforms/engine-state.merge.test.ts"
    - "tests/waveforms/sample-ecg.test.ts"
  modified: []

key-decisions:
  - "Removed the RESEARCH.md `if (s.lastT === 0) seed` branch — the magic-zero sentinel collided with deterministic tests using t=0. The 100ms dt clamp already bounds the first-frame transient in production, so the seed branch was load-shifting that bounded one-time jump from 100ms to 0 at the cost of breaking the test shape."
  - "Added defensive `Math.max(0, ...)` on dt — Pitfall B guard against any non-monotonic clock surprise in tests or edge cases (e.g. a Vercel edge proxy coarsening clock values in a way that produces a negative delta)."
  - "Rewrote merge-regression tick sequence to four 40ms frames (160ms total) instead of one 171ms jump — respects the 100ms clamp that is Pitfall C's non-negotiable guard. Phase lands at ~0.373, comfortably inside the (0.3, 0.5) assertion window."
  - "Kept Math.pow shape via Biome's `useExponentiationOperator` auto-fix rewrite (`-(((x-c)/w) ** 2)`) — mathematically identical to RESEARCH.md §Code Examples, satisfies oxc's parser, lints clean."

requirements-completed: [WAVE-03, WAVE-07]
# WAVE-10 was completed in Plan 00-01 (engine-state factory + Plan 00-01 tests);
# the merge-regression test shipped here is the permanent guardrail for WAVE-10.

duration: 8min
completed: 2026-04-21
---

# Phase 0 Plan 02: Engine Math and Tests Summary

**Ported the sinus PQRST gaussian-sum sampler from `design/src/waveforms.js` into pure TS (`lib/waveforms/sampleEcg.ts`), with the `EngineState` injected per-call and `dt` clamped per Pitfall C, and shipped the two permanent Vitest guards: the WAVE-10 merge-regression test and the WAVE-07 R-peak / WAVE-03 time-base invariance test.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-04-21T02:29:12Z
- **Completed:** 2026-04-21T02:37:38Z
- **Tasks:** 2 (both `tdd="true"`)
- **Files created:** 3 (71 + 55 + 91 lines = 217 total)
- **Test counts:** 9 tests across 3 files, all green, full suite runs in ~400ms

## Accomplishments

- `lib/waveforms/sampleEcg.ts` (71 lines) — pure sinus PQRST sampler. Accepts `(t: number, hr: number, s: EngineState)`, mutates only `s.phase`, `s.lastT`, `s.rFired`, returns `{ v, rPeak }`. Clamps `dt ∈ [0, 100]ms`. No vt/vf/afib/capno/pleth branches.
- `tests/waveforms/engine-state.merge.test.ts` (55 lines) — WAVE-10 permanent guard. Asserts that `mergeVitals(vitals, { hr: 150 })` does not touch `engine.phase` or `engine.rFired`. Also asserts factory independence.
- `tests/waveforms/sample-ecg.test.ts` (91 lines, 4 `it` blocks) — WAVE-07 R-peak detection at HR=60 and HR=180 (both fire once per beat with `phase ∈ (0.27, 0.30)`); WAVE-03 time-base invariance (one 33ms step equals two 16.5ms steps within 1e-9); Pitfall C dt-clamp (30-second gap produces exactly `100/(60_000/140) ≈ 0.2333` beat advance, not 70 beats).
- TDD RED→GREEN cycle observed on both tasks: failing tests committed first (`abb280d`), implementation committed second (`9f8a570`).
- All plan-level gates green: `pnpm test` 9/9, `pnpm exec tsc --noEmit` clean, `pnpm exec biome check .` clean, drop-list grep clean in `lib/waveforms/`, no `Date.now()` in `lib/waveforms/`.

## Task Commits

Each task committed atomically:

1. **Task 1 (RED): failing sampleEcg + merge-regression tests** — `abb280d` (test)
2. **Task 2 (GREEN): port sinus PQRST to sampleEcg** — `9f8a570` (feat)

Plan-level metadata commit (SUMMARY.md + STATE.md + ROADMAP.md + REQUIREMENTS.md) follows this summary.

## Files Created/Modified

- `lib/waveforms/sampleEcg.ts` — **CREATED** (71 lines)
  - `ecgSinusTemplate(phase)` — verbatim PQRST gaussian-sum coefficients from `design/src/waveforms.js` lines 4-11, rewritten with `**` operator per Biome's `useExponentiationOperator` rule.
  - `sampleEcg(t, hr, s)` — time-based advance `s.phase = (s.phase + dt / beatDurMs) % 1` with `dt = Math.min(100, Math.max(0, t - s.lastT))`. R-peak debounce at phase ∈ (0.27, 0.30) with reset outside (0.25, 0.32).
  - Exports: `sampleEcg`, `SampleResult`.
- `tests/waveforms/engine-state.merge.test.ts` — **CREATED** (55 lines)
  - Describe block: `'engine-state / vitals-store merge regression (WAVE-10)'`
  - Test 1: partial vitals diff does not stomp phase or rFired (4 × 40ms frames land phase at ~0.373, then mergeVitals({ hr: 150 }) is asserted to leave engine state untouched).
  - Test 2: createEngineState returns independent instances.
- `tests/waveforms/sample-ecg.test.ts` — **CREATED** (91 lines)
  - Describe block: `'sampleEcg — R-peak detection and time-based advance'`
  - Test 1: rPeak fires exactly once per beat at HR=60 (1000ms, 4ms step, 250 samples).
  - Test 2: rPeak fires exactly once per beat at HR=180 (~333ms, 2ms step, ~166 samples).
  - Test 3: time-base advance invariance — 1×33ms === 2×16.5ms (ε < 1e-9).
  - Test 4: dt clamp — 30-second gap → phase ≈ 0.2333 (not 70 beats).

## Decisions Made

### Factory vs singleton — CONFIRMED easier to test

Plan 00-01 chose the factory shape (`createEngineState()`) over a module-level singleton specifically so Vitest tests could assert isolation without a `beforeEach` reset. Plan 02's experience ratifies that choice:

- The merge-regression test's Test 2 (`createEngineState returns independent instances`) is a one-liner in factory mode; in singleton mode it would require a dedicated `reset()` export + a `beforeEach` hook in every test file, and the "independence" property would be non-trivial to express at all.
- The time-base invariance test (Test 3 of sample-ecg) constructs two engines `a` and `b` and compares their phases after different frame cadences. Singleton state would force serialization of these two setups or an explicit `clone()` primitive. Factory `createEngineState()` makes it one line per engine.
- The dt-clamp test constructs a fresh engine so the assertion `phase < 0.3` after a 30-second gap is not contaminated by prior test state.

**Recommendation for Phase 2:** Retain the factory shape when the Zustand vitals-store lands. The vitals-store will be a singleton slice (per Zustand convention), but `EngineState` remains factory-constructed at component mount (`useRef(createEngineState())` in `PrototypeClient.tsx` for Phase 0; similar shape in the Phase 2 monitor component).

### Merge helper stub handoff to Phase 4

The `mergeVitals<V>(base, diff) = { ...base, ...diff }` helper in `engine-state.merge.test.ts` is explicitly a stand-in for the real Zustand store merge primitive that will exist in Phase 4. The test's assertion shape is Phase-invariant:

- **Phase 0 (now):** `let vitals = { hr: 140 }; vitals = mergeVitals(vitals, { hr: 150 }); expect(engine.phase).toBe(phaseBefore);`
- **Phase 4 (Pusher diff handler lands):** `useVitalsStore.setState((v) => mergeVitals(v, diff));` where `diff` is the Pusher payload. The engine state assertion is unchanged.

When Phase 4 introduces the Zustand store and the Pusher `vitals:update` event handler, the only test edit required is to swap the local `mergeVitals` helper for a call through the real store's setter. The describe-block WAVE-10 guardrail, the tick-to-mid-beat setup, and the phase/rFired assertions all port unchanged. This is D-11's portability contract delivered.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed the RESEARCH.md `s.lastT === 0 → seed` branch**

- **Found during:** Task 2 — first `pnpm test` after writing the verbatim RESEARCH.md shape.
- **Issue:** The seed guard uses the magic-zero sentinel (`if (s.lastT === 0) { s.lastT = t; return zero-delta; }`) to detect the first call. This is fine in production (first rAF tick has `t = performance.now() ≫ 0`), but it breaks every unit test that passes a deterministic `t = 0` as its starting timestamp — the guard fires on EVERY call where `t = 0` or where `s.lastT` happens to equal zero. Result: merge-regression test 1 phase stays at 0 (fail `> 0.3`); time-base invariance test engines A and B advance different amounts (fail `ε < 1e-9`); dt-clamp test phase stays at 0 (fail `≈ 0.2333`).
- **Fix:** Removed the seed branch entirely. First call now computes `dt = Math.min(100, Math.max(0, t - s.lastT))`. In tests with `t=0, s.lastT=0` this yields `dt=0` (no advance) — the test then calls with a positive `t` and advances naturally. In production with `t ≈ 16000` on first rAF, `dt` gets clamped to 100ms — a single one-time transient that the Pitfall C clamp already bounds. Net effect: production behavior is indistinguishable (one frame of clamped advance either way), test behavior now works as authored.
- **Files modified:** `lib/waveforms/sampleEcg.ts`
- **Verification:** `pnpm test` 9/9 green; the three previously-failing cases now pass their assertions (phase ≈ 0.373 for merge, εₐ₋ᵦ < 1e-9 for invariance, phase ≈ 0.2333 for clamp).
- **Committed in:** `9f8a570`

**2. [Rule 1 - Bug] Rewrote merge-test tick sequence to four 40ms frames**

- **Found during:** Task 2 — after applying Fix 1, the merge test's single `sampleEcg(t0 + 0.4 * beatMs, ...)` call was still failing because `0.4 * (60_000/140) ≈ 171ms` exceeds the hard-locked 100ms dt clamp, so the one-jump setup under-advances.
- **Issue:** The RESEARCH.md §Vitest Merge-Regression Test shape calls `sampleEcg(t0 + 0.4 * beatMs, vitals.hr, engine)` in a single step, attempting to advance phase by 40% in one call. But the Pitfall C clamp caps `dt` at 100ms regardless. For HR=140 (beatDurMs≈428.57ms), a single 171ms step gets clamped to 100ms → phase lands at ~0.2333, failing the assertion `> 0.3 && < 0.5`. The research shape and the Pitfall C guard contradict each other; one has to give.
- **Fix:** Replaced the two-call tick (seed + single jump) with a five-call sequence: one seed at `t0=0`, then four 40ms advances at `t = 40, 80, 120, 160`. Each frame contributes `40/428.57 ≈ 0.093` phase; four frames sum to ~0.373, landing inside the (0.3, 0.5) assertion window. Chose 40ms because it's a realistic ~30fps rAF-throttle frame and stays comfortably below the 100ms clamp.
- **Files modified:** `tests/waveforms/engine-state.merge.test.ts`
- **Verification:** `pnpm test` merge test green; assertion `phaseBefore > 0.3 && < 0.5` passes.
- **Committed in:** `9f8a570`

**3. [Rule 3 - Blocking] Switched Math.pow → `**` via Biome auto-fix, added disambiguating parens**

- **Found during:** Task 2 — initial write used `Math.exp(-Math.pow(...))` verbatim; Biome's `useExponentiationOperator` rule flagged 5 infos suggesting `**`. Tried `-x ** 2` first but oxc parser rejected it as ambiguous (unary-minus vs exponentiation precedence). Applied `pnpm exec biome check --write` which generated the parenthesized shape `-(((x-c)/w) ** 2)` — unambiguous for the parser, semantically identical.
- **Issue:** Code style drift between Biome's preferred `**` operator and oxc's strict parser for unary-minus-before-`**`.
- **Fix:** Accepted Biome's safe-fix rewrite. Updated the nearby comment to describe the `useExponentiationOperator` rationale instead of the superseded `Math.pow` rationale.
- **Files modified:** `lib/waveforms/sampleEcg.ts`
- **Verification:** `pnpm exec biome check .` clean; `pnpm exec tsc --noEmit` clean; tests still pass (math unchanged).
- **Committed in:** `9f8a570`

---

**Total deviations:** 3 auto-fixed (2 Rule 1 bugs in RESEARCH.md shape, 1 Rule 3 toolchain fix).
**Impact on plan:** None on scope, on the success criteria, or on the ported math. The two Rule 1 fixes harden the implementation against the exact class of test that the plan required. The Rule 3 fix is purely mechanical lint-rule compliance.

## Issues Encountered

- **Pitfall B (non-monotonic clock) defensive `Math.max(0, ...)` added on dt** — not strictly required by the plan, but the removal of the seed branch made it essential: without it, a pathological `t < s.lastT` case would advance phase negatively and corrupt the engine. Costs nothing; one extra clamp operation per rAF tick.
- **No performance regression** — the final 9-test suite runs in ~400ms total (3× faster than the plan's <1s target).
- **No tsc strict errors** — the `EngineState` interface from Plan 00-01 is narrow enough that mutation through `s.phase = ...` etc. typechecks cleanly with no `as` casts.

## User Setup Required

None — no external service configuration required at this plan. The Vercel preview deploy hookup lands in Plan 00-04.

## Next Phase Readiness

Plan 00-03 (sweep-canvas + `/prototype` route) is unblocked:

- `import { sampleEcg, type SampleResult } from '@/lib/waveforms/sampleEcg'` resolves.
- `sampleEcg` signature is locked: `(t: number, hr: number, s: EngineState) → { v: number; rPeak: boolean }`. The sweep-draw primitive can wire `stepSweep(sc, tNow, dtMs, sampleEcg, scale)` through this without any ceremony.
- The rAF callback in `PrototypeClient.tsx` will pass the `DOMHighResTimeStamp` directly — no `/1000` conversion needed; units are already milliseconds.
- `rPeak` is available for any beep / flash UI (deferred to P2, but the data pipe exists).

No blockers. No concerns.

## TDD Gate Compliance

Both tasks observed the full RED → GREEN sequence:

- **RED gate:** `abb280d` — `test(00-02): add failing sampleEcg + merge-regression tests (RED)` — both test files import `@/lib/waveforms/sampleEcg` which does not yet exist; Vite bails on `Failed to resolve import`. All pre-existing Plan 00-01 tests still pass (3/3). Net: 2 failed test files, 3 passing tests. Expected RED.
- **GREEN gate:** `9f8a570` — `feat(00-02): port sinus PQRST to sampleEcg; tests green (WAVE-03/07/10)` — sampleEcg.ts created; two Rule 1 bug fixes applied; merge test tick sequence adjusted. Result: 3/3 test files pass, 9/9 tests green.
- **REFACTOR:** skipped — implementation is 40 lines of math plus 3 lines of clamp logic; no cleanup opportunity. The Biome `**` auto-fix could be considered a refactor, but it was applied in-band during GREEN and did not require its own commit.

## Self-Check: PASSED

**Files:**
- `lib/waveforms/sampleEcg.ts` — FOUND (71 lines)
- `tests/waveforms/engine-state.merge.test.ts` — FOUND (55 lines)
- `tests/waveforms/sample-ecg.test.ts` — FOUND (91 lines)

**Commits:**
- `abb280d` — FOUND in `git log --oneline -5`
- `9f8a570` — FOUND in `git log --oneline -5`

**Gates:**
- `pnpm test` — 9/9 green
- `pnpm exec tsc --noEmit` — clean
- `pnpm exec biome check .` — clean
- `grep -r "ecgVt\|ecgVf\|ecgAsystole\|sampleCapno\|samplePleth\|_afibJitter" lib/` — no matches
- `grep -r "Date\.now()" lib/waveforms/` — no matches

---
*Phase: 00-waveform-prototype*
*Completed: 2026-04-21*
