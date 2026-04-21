# Phase 0: Waveform Prototype on iPhone - Context

**Gathered:** 2026-04-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Prove that a DPR-aware Canvas 2D sweep-draw with a time-based waveform engine holds 60 fps on iPhone Safari at DPR=3 before Phase 2 commits to the rendering strategy. Throwaway prototype route backed by a real Next.js scaffold that lives on into Phase 2.

Within scope: a single ECG-sinus channel rendered through the permanent engine code, a Vitest regression guard for engine-state/vitals-store separation, and an iPhone screenshot + heap snapshot that closes Phase 0.

Out of scope: pleth, additional rhythms, rhythm-switch UX, alarms, audio, Zustand, Pusher, Tailwind, shadcn — all deferred to Phase 2+.

</domain>

<decisions>
## Implementation Decisions

### Scaffold

- **D-01:** Real Next.js 15.5 project scaffold is created in Phase 0 and lives on into Phase 2. Only `app/prototype/page.tsx` is the throwaway artifact; `lib/waveforms/engine-state.ts`, `lib/waveforms/sampleEcg.ts`, `lib/clinical/`, and all TS/test/lint config ship forward unchanged.
- **D-02:** Minimum scaffold kit at P0: Next.js 15.5 (App Router) · React 19 · TypeScript strict · Vitest · **pnpm** (package manager) · **biome** (single tool for lint + format, replaces ESLint + Prettier). Deferred to Phase 2: Tailwind v4, shadcn/ui, Zustand v5, Zod v4, Web Audio, Pusher client.
- **D-03:** Directory layout at P0: `app/prototype/page.tsx` (throwaway render harness) · `lib/waveforms/engine-state.ts` (phase, jitter, rFired — WAVE-10) · `lib/waveforms/sampleEcg.ts` (ported sinus template from `design/src/waveforms.js`) · `lib/waveforms/sweepCanvas.ts` (DPR-aware sweep-draw primitive) · `lib/clinical/` (empty placeholder so P2 has a home for `nrp.ts`) · `tests/waveforms/`.

### Prototype Scope

- **D-04:** Render exactly one channel: ECG Lead II sinus rhythm, template-lookup beat (WAVE-07) at 250 Hz (WAVE-01). No pleth, no rhythm switch, no asystole at P0. Pleth + 4-rhythm set land under Phase 2 clinical sign-off.
- **D-05:** Drop the design prototype's `ecgVtTemplate`, `ecgVfPoint`, `sampleCapno`, and any afib/vf/vt branches during the port — these are clinically wrong for neonates and must never ship.
- **D-06:** Sweep window 5 seconds, sweep direction left-to-right with clear-ahead region, line color green (#22c55e-ish, not a vendor-specific green), line width scaled with DPR per Pitfall 4 (`ceil(pxPerFrame) + lineWidth + 2` clear-ahead). Clinical 25 mm/s paper speed is the target mental model; exact px/sec Claude's discretion during implementation.
- **D-07:** Canvas backing store is `cssSize × devicePixelRatio` with real `DPR=3` support (not the design prototype's `Math.min(DPR, 2)` shortcut — WAVE-05 explicitly requires DPR=3 crisp).

### Engine Architecture

- **D-08:** Waveform engine state (`phase`, `jitter`, `rFired`, `lastT`) lives in a dedicated module-scoped object in `lib/waveforms/engine-state.ts`, imported by the sample function. It is **not** a field of any (future) vitals store. A Pusher diff merging `{ hr: 150 }` into vitals must not touch engine state — this is WAVE-10 and is the architectural fix for the design prototype's in-place `state._phase` mutation.
- **D-09:** Engine is `performance.now()`-delta driven, not frame-counted. Under iPhone Low Power Mode rAF throttle to 30 fps, HR period must remain clinically stable (Pitfall 5). Internal advance is `elapsedMs / msPerPixel`, never a fixed per-frame step.
- **D-10:** Waveform buffer is a single `Float32Array(sampleRate × sweepSeconds)` per channel, allocated once, written via modular index (`buf[writeIdx] = sample; writeIdx = (writeIdx + 1) % bufferLength`). No history array, no `.push()`, no reallocation (Pitfall 13).

### Verification

- **D-11:** Engine-state / vitals-store merge regression is a **Vitest unit test** at `tests/waveforms/engine-state.merge.test.ts`. Shape: (1) tick the engine to a mid-beat phase (e.g., 0.4), (2) apply a partial vitals diff `{ hr: 150 }` through whatever merge primitive the scaffold uses, (3) assert `engineState.phase` is unchanged and `rFired` is unchanged. This is the permanent regression guard referenced by SC#5 and carries forward untouched through Phase 4 Pusher integration.
- **D-12:** No property-based / fuzz testing at P0 (no `fast-check` dependency yet). Vitest convention established here becomes the P2 test standard.

### Pass Criteria & Evidence

- **D-13:** Physical test device is the user's newer iPhone (13/14/15/16-class). iPhone 12 is the roadmap floor; newer-generation passing is a valid-but-proxy signal since A15/A16/A17 are monotonically faster than A14 (GPU + thermal). iPhone 12-specific re-verification is flagged as a **Phase 5 soak item**.
- **D-14:** Phase 0 "passed" requires all of: (a) FPS overlay on `/prototype` screenshot after a continuous 60-second run showing rolling-avg and min fps in the target band (≥58 avg, ≥55 min acceptable given iOS rAF variance); (b) Safari Web Inspector heap snapshot at t=0 and t=5min showing heap flat (no ArrayBuffer growth) for SC#4; (c) Vitest merge regression test green (SC#5); (d) visual inspection on DPR=3 showing no ghosting or tearing (SC#2).
- **D-15:** Evidence artifacts (screenshots + heap snapshot thumbnails) are pasted into `00-VERIFICATION.md` when `/gsd-verify-work` runs. No video recording, no metrics-JSON collector at P0 — overhead deferred until P5 soak needs frame-time histograms.

### Deployment

- **D-16:** Vercel preview deploy is the iPhone test target (not localhost-over-LAN) — this also de-risks Phase 1 Vercel cold-start dependency early. Preview URL per branch is sufficient; no dedicated staging domain needed at P0.

### Claude's Discretion

- FPS overlay visual layout (where on screen, font, color) — follow `design/` aesthetic roughly but this is throwaway.
- Exact clear-ahead pixel width formula within the Pitfall 4 envelope.
- Whether the engine exports a pure `sampleEcg(t, state) → { v, rPeak }` function or a stateful class wrapper — pick whichever makes the Vitest merge test cleanest.
- Biome config (rule severity levels) — use the official `biome init` defaults unless they conflict with TS strict.
- Whether to wire up `pnpm dlx` vs `pnpm exec` for one-off commands — doesn't matter for downstream.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase goal & success criteria
- `.planning/ROADMAP.md` §Phase 0 — Goal, Requirements, and 5 success criteria (the scope anchor)
- `.planning/REQUIREMENTS.md` §WAVE — WAVE-01 (250 Hz ECG sweep-draw), WAVE-03 (time-based), WAVE-04 (Float32Array buffer), WAVE-05 (DPR=3 crisp), WAVE-07 (template-lookup sinus beat), WAVE-10 (engine state separation)

### Project non-negotiables
- `.planning/PROJECT.md` §Core Value, §Constraints, §Key Decisions — stack lock, latency budget, 60 fps requirement
- `CLAUDE.md` — clinical correctness non-negotiables, waveform engine state guardrail

### Pitfalls that directly constrain Phase 0 implementation
- `.planning/research/PITFALLS.md` §Pitfall 4 — Sweep-draw ghosting/tearing: clear-ahead rect = `ceil(pxPerFrame) + lineWidth + 2`, DPR-scaled
- `.planning/research/PITFALLS.md` §Pitfall 5 — Low Power Mode 30 fps throttle: engine must be time-delta driven, not frame-counted
- `.planning/research/PITFALLS.md` §Pitfall 13 — Unbounded waveform buffer memory leak: `Float32Array` fixed-length, modular write index, no `.push()` / no history arrays

### Stack research
- `.planning/research/STACK.md` — Next.js 15.5 + React 19 rationale, Canvas vs chart-lib decision
- `.planning/research/ARCHITECTURE.md` — engine-state / vitals-store separation rationale
- `.planning/research/SUMMARY.md` — integrated research synthesis

### Port source (visual + math, not code style)
- `design/src/waveforms.js` — `ecgSinusTemplate(phase)` source for sinus PQRST. Port the sinus math; drop vt/vf/afib/capno branches.
- `design/src/canvasChannel.jsx` — sweep-draw pattern reference. Port the algorithm; rewrite DPR handling (design uses `Math.min(DPR, 2)` — P0 requires real DPR=3 per WAVE-05) and use React 19 idioms.

### Clinical corpus (indirectly relevant to P0; directly relevant to P2)
- `.planning/research/FEATURES.md` — full neonatal feature set reasoning

</canonical_refs>

<code_context>
## Existing Code Insights

This is a greenfield project — Phase 0 writes the first production code.

### Reusable Assets (to port, not reuse verbatim)
- `design/src/waveforms.js` — `ecgSinusTemplate(phase)` PQRST gaussian-sum formula is clinically sane for sinus. Port into `lib/waveforms/sampleEcg.ts` as a pure TS function. Drop `ecgVtTemplate`, `ecgVfPoint`, `sampleCapno` entirely.
- `design/src/canvasChannel.jsx` — sweep-draw with clear-ahead rectangle algorithm is the right approach. Port into `lib/waveforms/sweepCanvas.ts`. **Must fix on port:** (a) `Math.min(DPR, 2)` caps DPR at 2 — P0 requires real DPR=3; (b) engine state lives on the sampleFn's `state` arg closure in the design — P0 moves it to a dedicated `engine-state.ts` module (WAVE-10).

### Established Patterns
- None — no existing TS/Next.js code in repo. Phase 0 *establishes* the patterns (directory layout, Vitest convention, biome config, pnpm workspace shape) that P2+ inherits.

### Integration Points
- `.planning/` directory stays as-is (docs-only).
- `design/` directory is reference-only; no imports from it in production code.
- Root `README.md` is currently 8 bytes — P0 can leave it alone or expand at Claude's discretion.
- Root `patient-monitor-simulator-prd.md` is the pre-pivot generic PRD, superseded by `.planning/PROJECT.md` — do not read as authoritative.

</code_context>

<specifics>
## Specific Ideas

- User preference: **pnpm** package manager and **biome** for lint+format — established at P0 as the repo standard for the remainder of the project.
- User has access to a newer-generation iPhone (13/14/15/16-class) for the Phase 0 FPS measurement. iPhone 12 itself is the declared roadmap floor; physical iPhone 12 re-verification is a Phase 5 soak item, not a P0 blocker.
- Evidence style is screenshot-first (not video, not metrics JSON) — pasted into the verification artifact. Lightweight but defensible.

</specifics>

<deferred>
## Deferred Ideas

- **Pleth (SpO₂) channel prototype** — considered for P0 to derisk WAVE-02. Deferred to Phase 2 where it lands under clinical sign-off alongside the real Zustand-driven monitor.
- **Asystole flat-line rhythm + rhythm-switch UI** — considered for P0 to derisk WAVE-08/WAVE-09 cheaply. Deferred to Phase 2. Keeps the Phase 0 question "is the primitive fast enough?" crisp.
- **FPS metrics JSON downloader / frame-time histogram** — considered for richer P0 evidence. Deferred to Phase 5 soak where 30-min heap + fps instrumentation matters more.
- **Internal perf-regression `/prototype` route retained in the shipped app** — considered. Deferred; decided to delete it after Phase 2. If P5 wants a regression harness it can be reintroduced then as a `/dev/*` dev-only route.
- **Property-based / fuzz testing for engine-state merges** — considered. Deferred; revisit in Phase 4 when real Pusher diff shapes exist.
- **Tailwind v4, shadcn/ui, Zustand v5, Zod v4, Web Audio, Pusher client** — all explicit P0 deferrals. These are stack-locked in PROJECT.md but not needed to validate the rendering primitive.

</deferred>

---

*Phase: 00-waveform-prototype*
*Context gathered: 2026-04-21*
