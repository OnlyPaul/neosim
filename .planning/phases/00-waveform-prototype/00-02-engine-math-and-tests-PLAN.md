---
phase: 00-waveform-prototype
plan: 02
type: execute
wave: 2
depends_on:
  - "00-01"
files_modified:
  - lib/waveforms/sampleEcg.ts
  - tests/waveforms/engine-state.merge.test.ts
  - tests/waveforms/sample-ecg.test.ts
autonomous: true
requirements:
  - WAVE-03
  - WAVE-07
  - WAVE-10
user_setup: []

must_haves:
  truths:
    - "sampleEcg is a pure function w.r.t. its state arg: (t, hr, engineState) → {v, rPeak}, reading engineState.lastT/phase/rFired and mutating only those fields"
    - "sampleEcg is time-based: advance is `dt / beatDurMs`, never a per-frame constant — a single call with a 33ms delta (LPM 30fps) advances phase by exactly the same amount as two calls with 16.5ms deltas totaling 33ms"
    - "sampleEcg clamps dt to ≤ 100ms defensively (Pitfall C — tab-visibility return)"
    - "PQRST template is sinus-only; vt/vf/afib/asystole branches are not present in the ported code (D-05)"
    - "Vitest merge-regression test proves a partial vitals diff `{ hr: 150 }` does NOT mutate engineState.phase or engineState.rFired (WAVE-10 permanent guardrail)"
    - "R-peak detection test asserts rPeak=true occurs exactly once per beat at phase window 0.27 < phase < 0.30, for both HR=60 and HR=180 (WAVE-07)"
  artifacts:
    - path: "lib/waveforms/sampleEcg.ts"
      provides: "Pure sinus-template ECG sampler; mutates only EngineState"
      exports: ["sampleEcg", "SampleResult"]
      min_lines: 30
    - path: "tests/waveforms/engine-state.merge.test.ts"
      provides: "Permanent WAVE-10 regression guard; ships forward through P2/P3/P4 unchanged except for swapping mergeVitals helper for the real Zustand merge in P4"
      contains: "engine-state / vitals-store merge regression"
    - path: "tests/waveforms/sample-ecg.test.ts"
      provides: "WAVE-07 R-peak assertions; proves time-based advance at two HRs"
      contains: "rPeak"
  key_links:
    - from: "lib/waveforms/sampleEcg.ts"
      to: "lib/waveforms/engine-state.ts"
      via: "import type { EngineState } from './engine-state'"
      pattern: "from '\\./engine-state'"
    - from: "tests/waveforms/engine-state.merge.test.ts"
      to: "lib/waveforms/engine-state.ts + lib/waveforms/sampleEcg.ts"
      via: "imports via @/lib/waveforms/... alias"
      pattern: "from '@/lib/waveforms/"
---

<objective>
Port the clinically-sane sinus PQRST math from `design/src/waveforms.js` into a pure TypeScript `sampleEcg(t, hr, engineState) → { v, rPeak }` function whose only state mutation is the injected `EngineState`, and write the two Vitest files that lock the two highest-value invariants: (1) partial vitals diffs cannot stomp engine phase (WAVE-10), (2) R-peak detection fires at the correct beat phase for HR=60 and HR=180 (WAVE-07). Plan 03 then consumes `sampleEcg` from the sweep-draw primitive.

Purpose: This is the Phase 0 permanent engine — every line of code written here ships forward into Phase 2 unchanged. The merge-regression test is the **single most important artifact of the phase** because it becomes a continuous guardrail through Phase 4's Pusher integration (D-11). The port must match RESEARCH.md §Code Examples shape verbatim, apply the three mandatory port fixes (drop vt/vf/afib/capno, inject EngineState, clamp dt), and be provable with two deterministic unit tests.

Output: `lib/waveforms/sampleEcg.ts` (permanent) + two Vitest files under `tests/waveforms/` (permanent). Plan 03 imports `sampleEcg` from here.
</objective>

<execution_context>
@/Users/onlypaul/Workspace/neosim/.claude/get-shit-done/workflows/execute-plan.md
@/Users/onlypaul/Workspace/neosim/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@/Users/onlypaul/Workspace/neosim/CLAUDE.md
@/Users/onlypaul/Workspace/neosim/.planning/phases/00-waveform-prototype/00-CONTEXT.md
@/Users/onlypaul/Workspace/neosim/.planning/phases/00-waveform-prototype/00-RESEARCH.md
@/Users/onlypaul/Workspace/neosim/.planning/phases/00-waveform-prototype/00-PATTERNS.md
@/Users/onlypaul/Workspace/neosim/.planning/phases/00-waveform-prototype/00-VALIDATION.md
@/Users/onlypaul/Workspace/neosim/design/src/waveforms.js
@/Users/onlypaul/Workspace/neosim/.planning/phases/00-waveform-prototype/00-01-scaffold-and-engine-state-PLAN.md

<interfaces>
<!-- Consumed from Plan 01 (lib/waveforms/engine-state.ts): -->

```typescript
export interface EngineState {
  phase: number;     // [0, 1)
  rFired: boolean;
  lastT: number;     // ms; 0 = uninitialized
  jitter: number;    // reserved; always 1 at P0
}
export function createEngineState(): EngineState;
```

<!-- Created by this plan (lib/waveforms/sampleEcg.ts); Plan 03 imports sampleEcg: -->

```typescript
import type { EngineState } from './engine-state';
export interface SampleResult { v: number; rPeak: boolean }
export function sampleEcg(t: number, hr: number, s: EngineState): SampleResult;
```

<!-- Port-source snippet from design/src/waveforms.js lines 4-11 (the ONLY math to port): -->

```js
function ecgSinusTemplate(phase) {
  const p = Math.exp(-Math.pow((phase - 0.10) / 0.025, 2)) * 0.15;
  const q = -Math.exp(-Math.pow((phase - 0.25) / 0.008, 2)) * 0.18;
  const r = Math.exp(-Math.pow((phase - 0.28) / 0.010, 2)) * 1.20;
  const s = -Math.exp(-Math.pow((phase - 0.31) / 0.012, 2)) * 0.35;
  const t = Math.exp(-Math.pow((phase - 0.58) / 0.055, 2)) * 0.30;
  return p + q + r + s + t;
}
```

<!-- DROP entirely during port (D-05, clinically wrong for neonates or P2-deferred): -->
<!-- design/src/waveforms.js lines 12-25: ecgVtTemplate, ecgVfPoint, ecgAsystolePoint -->
<!-- design/src/waveforms.js lines 26-48: rhythm==='asystole'/'vf'/'afib' branches, state._afibJitter mutation -->
<!-- design/src/waveforms.js lines 49-71: samplePleth, sampleCapno -->
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Write Vitest merge-regression + R-peak tests (RED)</name>
  <files>tests/waveforms/engine-state.merge.test.ts, tests/waveforms/sample-ecg.test.ts</files>
  <behavior>
    **engine-state.merge.test.ts** (WAVE-10):
    - Test 1: "partial vitals diff does not stomp engine phase or rFired" — `createEngineState()`; call `sampleEcg` twice with a deterministic monotonic clock to land phase in [0.3, 0.5); snapshot `phase` + `rFired`; apply `mergeVitals(vitals, { hr: 150 })`; assert `engine.phase === snapshot.phase` AND `engine.rFired === snapshot.rFired` AND `vitals.hr === 150` (sanity: merge did apply).
    - Test 2: "createEngineState returns independent instances" — mutate `a.phase = 0.9`; assert `b.phase === 0`.

    **sample-ecg.test.ts** (WAVE-07 / WAVE-03):
    - Test 1 "R-peak fires exactly once per beat at HR=60" — over a 1000ms span (one beat at HR=60, beatDurMs=1000), step in 4ms increments calling `sampleEcg(t, 60, engine)`; count samples with `rPeak === true`; assert count === 1; assert the single rPeak sample fires at a `phase` in [0.27, 0.30).
    - Test 2 "R-peak fires exactly once per beat at HR=180" — same loop shape, beatDurMs = 60000/180 ≈ 333.33ms, 2ms step; assert count === 1; assert phase at rPeak ∈ [0.27, 0.30).
    - Test 3 "time-based advance is invariant to frame cadence (WAVE-03)" — two engines A and B. Call `sampleEcg(0, 140, A); sampleEcg(33, 140, A);` (one 33ms LPM-throttled frame). Call `sampleEcg(0, 140, B); sampleEcg(16.5, 140, B); sampleEcg(33, 140, B);` (two 60fps frames summing to 33ms). Assert `A.phase` equals `B.phase` within an epsilon of 1e-9 — proves the engine is delta-driven, not frame-counted.
    - Test 4 "dt clamp at 100ms (Pitfall C)" — call `sampleEcg(0, 140, engine)` then `sampleEcg(30_000, 140, engine)` (30-second tab-hidden gap); assert `engine.phase` advanced by no more than `100 / (60_000/140)` — i.e., the clamp capped the advance at what a 100ms delta produces, not a 30s delta.
  </behavior>
  <read_first>
    - /Users/onlypaul/Workspace/neosim/.planning/phases/00-waveform-prototype/00-RESEARCH.md §Vitest Merge-Regression Test (lines 540–598) — the authoritative test shape
    - /Users/onlypaul/Workspace/neosim/.planning/phases/00-waveform-prototype/00-RESEARCH.md §Complete sampleEcg.ts (lines 604–652) — the function signature these tests call
    - /Users/onlypaul/Workspace/neosim/.planning/phases/00-waveform-prototype/00-RESEARCH.md §Pitfall C (lines 454–460) — 100ms dt clamp rationale
    - /Users/onlypaul/Workspace/neosim/.planning/phases/00-waveform-prototype/00-VALIDATION.md §Wave 0 Requirements + §Per-Task Verification Map — what tests are expected
    - /Users/onlypaul/Workspace/neosim/lib/waveforms/engine-state.ts (exists after Plan 01)
  </read_first>
  <action>
    TDD RED step: write both test files such that `pnpm test` reports FAIL because `sampleEcg` does not yet exist. Then Task 2 (GREEN) will make them pass.

    **tests/waveforms/engine-state.merge.test.ts** — use the shape from RESEARCH.md §Vitest Merge-Regression Test (lines 540–590) verbatim. Key details:
    - Import from `@/lib/waveforms/engine-state` and `@/lib/waveforms/sampleEcg`.
    - Local `mergeVitals<V>(base: V, diff: Partial<V>): V = { ...base, ...diff }` helper — models what Phase 4 Pusher diff handler will do.
    - Time input is deterministic — pass explicit `t0 = 0` and `t0 + 0.4 * beatMs`. Never call `performance.now()` in the test.
    - Two `it` blocks per RESEARCH.md lines 554–588.

    **tests/waveforms/sample-ecg.test.ts** — four `it` blocks matching the behavior list above. Key details:
    - For R-peak counting tests, step `t` in fine enough increments (4ms @ HR=60, 2ms @ HR=180) that `phase` lands within [0.27, 0.30) at least once — easily satisfied by these step sizes.
    - For the time-base invariance test, use HR=140 and integer deltas so epsilon comparison is clean. Assert `Math.abs(A.phase - B.phase) < 1e-9`.
    - For the dt-clamp test, after the 30-second gap, expected advance is exactly `100 / (60_000/140) = 100 * 140 / 60_000 ≈ 0.2333` beats — assert `engine.phase` is close to `0.2333` (within 1e-6), NOT close to `30_000 * 140 / 60_000 = 70` beats (which modulo 1 would land anywhere). The cheaper and equivalent assertion: `engine.phase < 0.3` (if unclamped, phase would be advanced by 70 beats which modulos to essentially any value; the clamp guarantees phase stays < 0.3 here because we seeded with `phase=0` then did one clamped advance).
    - All tests import from `@/lib/waveforms/...` to exercise the `@/*` alias wired in Plan 01.

    Do NOT create `sampleEcg.ts` in this task — that is Task 2. Run `pnpm test` at end of task; expect RED output with a clear "module not found: @/lib/waveforms/sampleEcg" error. That's correct TDD RED state.
  </action>
  <verify>
    <automated>pnpm test 2>&amp;1 | grep -E "(Cannot find module|FAIL|sampleEcg)" &amp;&amp; test -f tests/waveforms/engine-state.merge.test.ts &amp;&amp; test -f tests/waveforms/sample-ecg.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `test -f tests/waveforms/engine-state.merge.test.ts` succeeds
    - `test -f tests/waveforms/sample-ecg.test.ts` succeeds
    - `grep "engine-state / vitals-store merge regression" tests/waveforms/engine-state.merge.test.ts` matches (WAVE-10 describe block)
    - `grep -E "from '@/lib/waveforms/engine-state'" tests/waveforms/engine-state.merge.test.ts` matches (alias is exercised)
    - `grep -E "from '@/lib/waveforms/sampleEcg'" tests/waveforms/engine-state.merge.test.ts` matches
    - `grep -E "mergeVitals" tests/waveforms/engine-state.merge.test.ts` matches
    - `grep -c "^  it(" tests/waveforms/sample-ecg.test.ts` ≥ 4 (at least four `it` blocks)
    - `grep -E "rPeak" tests/waveforms/sample-ecg.test.ts` matches in multiple lines
    - `grep -E "180" tests/waveforms/sample-ecg.test.ts` matches (HR=180 test)
    - `grep -E "1e-9" tests/waveforms/sample-ecg.test.ts` matches (time-base epsilon)
    - `pnpm test` EXITS NON-ZERO (RED state because sampleEcg doesn't exist yet — this is correct TDD) — commit this RED commit before starting Task 2
  </acceptance_criteria>
  <done>
    Two Vitest files exist with the behaviors described. `pnpm test` fails with a module-resolution error for `@/lib/waveforms/sampleEcg` (TDD RED). Tests are committed before the implementation.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Port sinus PQRST into lib/waveforms/sampleEcg.ts (GREEN)</name>
  <files>lib/waveforms/sampleEcg.ts</files>
  <behavior>
    Same as Task 1 tests — after this task, `pnpm test` must go GREEN.
  </behavior>
  <read_first>
    - /Users/onlypaul/Workspace/neosim/.planning/phases/00-waveform-prototype/00-RESEARCH.md §Complete sampleEcg.ts (lines 602–652) — VERBATIM source shape
    - /Users/onlypaul/Workspace/neosim/.planning/phases/00-waveform-prototype/00-PATTERNS.md §sampleEcg.ts PORT-PARTIAL (lines 41–90) — what to port, what to reshape, what to drop
    - /Users/onlypaul/Workspace/neosim/design/src/waveforms.js (lines 4–11 = port source for ecgSinusTemplate; lines 12–48 = DO NOT PORT; lines 49–71 = DO NOT PORT)
    - /Users/onlypaul/Workspace/neosim/.planning/phases/00-waveform-prototype/00-CONTEXT.md D-04, D-05, D-08, D-09 — scope/drop/engine architecture locks
  </read_first>
  <action>
    Write `lib/waveforms/sampleEcg.ts` VERBATIM from RESEARCH.md §Complete sampleEcg.ts (lines 604–652). Concrete content (not paraphrased):

    ```ts
    // lib/waveforms/sampleEcg.ts
    // Sinus ECG sampler ported from design/src/waveforms.js lines 4-11 (ecgSinusTemplate).
    // Per D-05: vt/vf/afib/asystole/pleth/capno branches DROPPED.
    // Per D-08/WAVE-10: state mutation moved to injected EngineState (factory from engine-state.ts).
    // Per D-09/WAVE-03: time-based advance via performance.now() deltas, not frame counts.
    // Per Pitfall C: dt clamped to ≤ 100ms to survive tab-visibility-return runaway deltas.
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

    export function sampleEcg(t: number, hr: number, s: EngineState): SampleResult {
      const safeHr = Math.max(1, hr);
      const beatDurMs = 60_000 / safeHr;

      if (s.lastT === 0) {
        s.lastT = t;
        return { v: ecgSinusTemplate(s.phase), rPeak: false };
      }

      const dt = Math.min(100, t - s.lastT);
      s.lastT = t;
      s.phase = (s.phase + dt / beatDurMs) % 1;

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

    Items to KEEP from design/src/waveforms.js (port verbatim):
    - `ecgSinusTemplate(phase)` PQRST gaussian-sum from lines 4–11 (exact coefficients).
    - R-peak detection window (phase ∈ (0.27, 0.30) with rFired debounce cleared on phase < 0.25 or > 0.32) from lines 42–45.

    Items to DROP entirely (D-05):
    - `ecgVtTemplate` (design lines 12–16) — VT is clinically wrong for neonatal arrest.
    - `ecgVfPoint` (design lines 17–22) — VF, same reason.
    - `ecgAsystolePoint` (design lines 23–25) — deferred to Phase 2.
    - `samplePleth` (design lines 49–59) — P2 under clinical sign-off.
    - `sampleCapno` (design lines 60–71) — out of scope (PROJECT.md §Out of Scope).
    - `rhythm === 'asystole' | 'vf' | 'afib' | 'vt'` branches (design lines 27–32, 39, 46) — P0 renders sinus only (D-04).
    - `state._afibJitter` mutation (design line 39) — AFib deferred.

    Items to RESHAPE (port fixes):
    - State shape: design mutates `state._phase`, `state._lastT`, `state._rFired` directly on the passed-in state arg which is the vitals store itself. P0 injects a dedicated `EngineState` and mutates only its fields (`s.phase`, `s.lastT`, `s.rFired`). This IS the WAVE-10 fix.
    - Units: design uses seconds for `t` (lines 33–34 compute dt in seconds). P0 uses milliseconds (`beatDurMs = 60_000 / hr`) so the rAF DOMHighResTimeStamp can pass through without a `/1000`.
    - dt clamp: `const dt = Math.min(100, t - s.lastT);` — Pitfall C guard. Design has no clamp and would NaN on a 30-second tab-hidden return.
    - First-call seed: if `s.lastT === 0`, seed it and return a zero-delta sample (prevents a giant phase jump on first frame when `t` is `performance.now()`'s uptime-since-navigation value).

    After writing the file, run `pnpm test`. All tests from Task 1 must pass. If any test is red, DO NOT modify the test — the research-locked shape is the contract. Debug the sampleEcg implementation until all four behaviors in sample-ecg.test.ts and both in engine-state.merge.test.ts pass.

    TDD GREEN commit message: "feat(00-02): port sinus PQRST to sampleEcg; tests green (WAVE-03, WAVE-07, WAVE-10)".
  </action>
  <verify>
    <automated>pnpm test &amp;&amp; pnpm exec tsc --noEmit &amp;&amp; pnpm exec biome check lib/waveforms/sampleEcg.ts tests/waveforms/</automated>
  </verify>
  <acceptance_criteria>
    - `test -f lib/waveforms/sampleEcg.ts` succeeds
    - `grep -E "import type \\{ EngineState \\} from './engine-state'" lib/waveforms/sampleEcg.ts` matches
    - `grep -E "export function sampleEcg" lib/waveforms/sampleEcg.ts` matches
    - `grep -E "Math\\.min\\(100," lib/waveforms/sampleEcg.ts` matches (Pitfall C clamp)
    - `grep -E "60_000" lib/waveforms/sampleEcg.ts` matches (milliseconds, not seconds — divergence from design prototype)
    - `grep -E "ecgSinusTemplate" lib/waveforms/sampleEcg.ts` matches
    - `grep -E "(ecgVt|ecgVf|ecgAsystole|sampleCapno|samplePleth|afib|_afibJitter)" lib/waveforms/sampleEcg.ts` returns NO matches (D-05 drop list confirmed)
    - `grep -E "state\\._phase|state\\._lastT|state\\._rFired" lib/waveforms/sampleEcg.ts` returns NO matches (design anti-pattern not ported)
    - `pnpm test` exits 0 (all 6 test cases green — 2 merge + 4 sample-ecg)
    - `pnpm exec tsc --noEmit` exits 0
    - `pnpm exec biome check lib/waveforms/sampleEcg.ts tests/waveforms/` exits 0
  </acceptance_criteria>
  <done>
    `lib/waveforms/sampleEcg.ts` exports `sampleEcg` + `SampleResult`. All Vitest tests from Task 1 pass green. No dropped-symbol (vt/vf/afib/capno/pleth) text remains. TypeScript strict compiles. Biome lints clean. The WAVE-10 permanent regression guard is live.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

N/A at P0. `sampleEcg` is a pure function with no I/O, no network, no DOM access, no eval, no user-controlled input at runtime (only HR/t come from the rAF loop, both numeric). No threat surface beyond "does the math compile and advance correctly."

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-00-02 | T (Tampering) | Phase 4 Pusher diff could stomp engine-state if merged naively into vitals store | mitigate | WAVE-10 architectural separation: engine-state lives in its own module; Vitest merge-regression test (created in this plan) is the permanent guardrail that fails CI if a future change accidentally puts engine fields on the vitals store. |

This is a forward-looking STRIDE entry — the threat does not exist at P0 (no Pusher, no vitals store). The mitigation (the regression test) is what this plan ships.
</threat_model>

<verification>
Plan-level gates:
- `pnpm test` passes with 6/6 green (2 merge + 4 sample-ecg)
- `pnpm exec tsc --noEmit` exits 0
- `pnpm exec biome check .` exits 0
- `grep -r "ecgVt\|ecgVf\|ecgAsystole\|sampleCapno\|samplePleth\|_afibJitter" lib/` returns no matches (D-05 compliance)
- `grep -r "Date\\.now()" lib/waveforms/` returns no matches (WAVE-03 / Pitfall B — monotonic clock only)
</verification>

<success_criteria>
- `sampleEcg(t, hr, engineState)` returns `{ v, rPeak }` and mutates only `engineState.phase`, `engineState.lastT`, `engineState.rFired`
- R-peak fires exactly once per beat for HR=60 and HR=180
- Time-base invariance holds: 1× 33ms delta produces the same phase advance as 2× 16.5ms deltas (WAVE-03 LPM-safe)
- dt clamp of 100ms prevents Pitfall C runaway on tab return
- The merge-regression test proves a partial vitals diff does not alter engine state (WAVE-10)
- All vt/vf/afib/capno/pleth branches are dropped per D-05
</success_criteria>

<output>
After completion, create `.planning/phases/00-waveform-prototype/00-02-SUMMARY.md` documenting:
- Final `sampleEcg.ts` line count and any deviation from RESEARCH.md shape
- Test counts and runtimes (all 6 tests should run in < 1 second)
- Whether the factory shape (Shape B) was confirmed easier to test than singleton (Shape A)
- Any follow-up for Phase 2: specifically, what the merge helper will become when Zustand lands (the `mergeVitals` stub is the handoff point)
</output>
