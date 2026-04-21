# State: NeoSim — Neonatal Monitor Simulator

**Last updated:** 2026-04-21

## Project Reference

**Core value:** An instructor can run a realistic golden-hour NRP scenario — driving HR, SpO₂, NIBP, cardiac rhythm, the APGAR timer, and alarms live from a second device — while learners see a responsive, full-screen neonatal monitor at the simulated warmer with latency under 200 ms.

**Current focus:** Phase 0 — Waveform Prototype on iPhone (validate Canvas 60 fps + DPR=3 + time-based engine on real iPhone 12 Safari).

## Current Position

- **Phase:** 0 — Waveform Prototype on iPhone
- **Plan:** 4 plans created; Plans 00-01 and 00-02 complete. Next up: 00-03 sweep-canvas+/prototype → 00-04 Vercel deploy+iPhone evidence
- **Status:** Executing — Wave 2 of 4 complete (branch `phase-0-waveform-prototype`)
- **Progress:** 50% of Phase 0 (2 of 4 plans complete) · 3 / 78 v1 requirements validated (~4% overall)

```
[=>                  ] 3 / 78 v1 requirements validated
```

## Performance Metrics

| Metric | Target | Current | Notes |
|--------|--------|---------|-------|
| Monitor fps (iPhone 12 Safari) | 60 fps sustained 30 min | — | Measured in P0 (short) and P5 (30-min soak) |
| Instructor → monitor p95 (wifi) | < 200 ms | — | Measured in P1 spike, re-verified in P5 |
| Instructor → monitor p95 (LTE) | < 400 ms | — | Measured in P1 spike, re-verified in P5 |
| Heap growth over 30 min | ~flat | — | Verified in P5 soak |
| Wake Lock hold | full session | — | P3 builds, P5 verifies |

### Plan Execution Metrics

| Phase-Plan | Duration | Tasks | Files | Commits |
|------------|----------|-------|-------|---------|
| 00-01 (scaffold + engine-state) | 6 min | 2 | 13 | 4 (206c16f, 15a3689, 14c5866, dc5c957) |
| 00-02 (engine math + tests) | 8 min | 2 | 3 | 2 (abb280d, 9f8a570) |

## Accumulated Context

### Decisions

| Decision | Rationale | Phase |
|----------|-----------|-------|
| Next.js 15.5 (not 14, not 16) | Stable April 2026 sweet spot; avoid 16's async `params`/`headers` churn | P0 |
| Raw Canvas 2D, no chart library | Pixi/Konva/D3 rebuild scenes per frame — will thrash iPhone GC | P0 |
| Raw Web Audio, no Howler/Tone | Need `AudioContext.currentTime` lookahead scheduler directly | P2 |
| Engine state separate from vitals store | Prototype mutates store in-place; that breaks on Pusher diff merge (WAVE-10) | P0 |
| iOS 18.4+ as "full support," 16.4–18.3 graceful degradation | WebKit Bug #254545: Wake Lock in installed PWA broken before 18.4 | P3 |
| P3 (iOS polish) before P4 (sync) | Platform bugs easier to debug without Pusher timing in the picture | P3/P4 |
| Abstract transport behind `lib/sync/transport.ts` | If P1 latency spike fails, swap Pusher → Ably in one file | P1 |
| Clinical sign-off is a hard gate before P2 closes | Neonatal thresholds + presets + Dawson targets must be NRP-instructor-reviewed | P2 |
| Alarm tones NOT derived from IEC 60601-1-8 melodies | Legal clarity — educational simulator, not a clinical device | P2 |
| Manual scaffold instead of `create-next-app` | Repo root was non-empty (.planning/, design/, CLAUDE.md); create-next-app refuses non-empty dirs | P0-01 |
| Biome 2.4.12 pinned exact; `files.includes` scoped to app/lib/tests/ | Lint rule drift between patches; default config linted .planning/ and design/ flooding 1500+ diagnostics | P0-01 |
| Vitest `passWithNoTests: true` | Vitest 4 default exits 1 on empty discovery; breaks gate when scaffold ships before tests | P0-01 |
| Factory (`createEngineState()`) over singleton engine state | Vitest merge-regression test needs isolated instances per test; singleton would require `beforeEach` reset | P0-01 |
| Removed the RESEARCH.md `lastT===0 → seed` branch in sampleEcg | Magic-zero sentinel collided with deterministic t=0 unit tests; 100ms dt clamp already bounds the first-frame transient in production (one-time 100ms advance vs zero — visually indistinguishable) | P0-02 |
| Added `Math.max(0, ...)` on dt in addition to the 100ms clamp | Pitfall B (non-monotonic clock) defensive guard; required because removing the seed branch made negative-dt edge cases reachable | P0-02 |
| Merge-regression test advances via 4×40ms frames (160ms total) not 1×171ms jump | Respects the hard-locked Pitfall C clamp (100ms); single-jump shape from RESEARCH.md would have been silently clamped and under-advanced | P0-02 |

### Open Questions

- iOS 16.4 vs 18.4 support-matrix call — what fraction of NRP-instructor iPhones in Q2 2026 are on 18.4+? (Resolve in P3 planning.)
- Vercel cold-start latency in April 2026 — prior estimate was 40–80 ms for POST round-trip; re-measure in P1 spike.
- Pusher cache channels vs explicit snapshot protocol — leans explicit snapshot; small research pass before P4 wire-protocol freeze.

### Todos (deferred)

- Upgrade 6-char session code to 8-char with 36-char alphabet before public launch (tracked in `V2-UX-03`).
- Consider NoSleep.js video-hack fallback for iOS 16.4–18.3 installed PWAs if graceful-degradation banner is insufficient UX.

### Blockers

None currently. Ready to start Phase 0.

## Session Continuity

**Next action:** Execute Plan 00-03 (DPR-aware sweepCanvas + Float32Array ring buffer + `/prototype` route with FPS overlay) on branch `phase-0-waveform-prototype`.

**Last activity:** 2026-04-21 02:37 UTC — Plan 00-02 (engine math + tests) complete. 2 new commits on `phase-0-waveform-prototype` (abb280d RED, 9f8a570 GREEN). `lib/waveforms/sampleEcg.ts` shipped with WAVE-10 merge-regression + WAVE-07 R-peak + WAVE-03 time-base invariance + Pitfall C dt-clamp tests all green (9/9 total). WAVE-03 and WAVE-07 requirements validated; WAVE-10 permanent regression guard is now live and ships forward through P2/P3/P4 unchanged (only the `mergeVitals` helper swaps for the real Zustand merge in P4).

**Reference documents:**
- `.planning/PROJECT.md` — core value, constraints, decisions
- `.planning/REQUIREMENTS.md` — 78 v1 requirements with phase traceability
- `.planning/ROADMAP.md` — 6-phase plan with success criteria
- `.planning/research/SUMMARY.md` — research synthesis
- `.planning/research/STACK.md` / `FEATURES.md` / `ARCHITECTURE.md` / `PITFALLS.md` — deep research
- `design/` — visual + UX reference prototype (NOT the code base)
- `patient-monitor-simulator-prd.md` — original PRD (superseded by PROJECT.md on pivot points)

**Design prototype lock:** Visual language, APGAR UX, quick-action set, color palette are locked by `design/`. Trim the 7-rhythm set down to 4 (Sinus / Brady / Tachy / Asystole) during the port — VT/VF/AFib are clinically wrong for neonates and must not ship.

---
*State initialized: 2026-04-20 at roadmap creation*
*Last updated: 2026-04-21 after Plan 00-02 completion*
