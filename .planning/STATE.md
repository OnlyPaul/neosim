# State: NeoSim — Neonatal Monitor Simulator

**Last updated:** 2026-04-21

## Project Reference

**Core value:** An instructor can run a realistic golden-hour NRP scenario — driving HR, SpO₂, NIBP, cardiac rhythm, the APGAR timer, and alarms live from a second device — while learners see a responsive, full-screen neonatal monitor at the simulated warmer with latency under 200 ms.

**Current focus:** Phase 0 — Waveform Prototype on iPhone (validate Canvas 60 fps + DPR=3 + time-based engine on real iPhone 12 Safari).

## Current Position

- **Phase:** 0 — Waveform Prototype on iPhone
- **Plan:** 4 plans created (00-01 scaffold+engine-state → 00-02 engine math+tests → 00-03 sweep-canvas+/prototype → 00-04 Vercel deploy+iPhone evidence)
- **Status:** Ready to execute — all 6 REQ-IDs (WAVE-01/03/04/05/07/10) covered, plan-checker PASSED, RESEARCH open questions resolved
- **Progress:** 0% of Phase 0 (planning complete, execution pending) · 0% of overall roadmap

```
[                    ] 0 / 78 v1 requirements validated
```

## Performance Metrics

| Metric | Target | Current | Notes |
|--------|--------|---------|-------|
| Monitor fps (iPhone 12 Safari) | 60 fps sustained 30 min | — | Measured in P0 (short) and P5 (30-min soak) |
| Instructor → monitor p95 (wifi) | < 200 ms | — | Measured in P1 spike, re-verified in P5 |
| Instructor → monitor p95 (LTE) | < 400 ms | — | Measured in P1 spike, re-verified in P5 |
| Heap growth over 30 min | ~flat | — | Verified in P5 soak |
| Wake Lock hold | full session | — | P3 builds, P5 verifies |

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

**Next action:** Run `/gsd-execute-phase 0` to execute all 4 Phase 0 plans (scaffold, engine, render, evidence).

**Last activity:** 2026-04-21 — Phase 0 planning complete. 4 plans in 4 sequential waves; plan-checker PASSED after resolving RESEARCH.md open questions (user confirmed macOS + USB available for Safari Web Inspector heap evidence).

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
