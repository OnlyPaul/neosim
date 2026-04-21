# State: NeoSim — Neonatal Monitor Simulator

**Last updated:** 2026-04-21

## Project Reference

**Core value:** An instructor can run a realistic golden-hour NRP scenario — driving HR, SpO₂, NIBP, cardiac rhythm, the APGAR timer, and alarms live from a second device — while learners see a responsive, full-screen neonatal monitor at the simulated warmer with latency under 200 ms.

**Current focus:** Phase 0 — Waveform Prototype on iPhone (validate Canvas 60 fps + DPR=3 + time-based engine on real iPhone 12 Safari).

## Current Position

- **Phase:** 0 — Waveform Prototype on iPhone
- **Plan:** 4 plans created; Plan 00-01 complete. Next up: 00-02 engine math+tests → 00-03 sweep-canvas+/prototype → 00-04 Vercel deploy+iPhone evidence
- **Status:** Executing — Wave 1 of 4 complete (branch `phase-0-waveform-prototype`)
- **Progress:** 25% of Phase 0 (1 of 4 plans complete) · 1 / 78 v1 requirements validated (~1% overall)

```
[>                   ] 1 / 78 v1 requirements validated
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

**Next action:** Execute Plan 00-02 (engine math + Vitest merge-regression test) on branch `phase-0-waveform-prototype`.

**Last activity:** 2026-04-21 02:25 UTC — Plan 00-01 (scaffold + engine-state) complete. 4 commits on `phase-0-waveform-prototype`. Next.js 15.5 + Vitest 4 + Biome 2 toolchain green; `lib/waveforms/engine-state.ts` shipped with 3/3 passing tests. WAVE-10 requirement validated.

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
