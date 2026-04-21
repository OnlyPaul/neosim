# Phase 0: Waveform Prototype on iPhone - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-21
**Phase:** 00-waveform-prototype
**Areas discussed:** Scaffold disposability, Prototype scope, Engine-state merge verification, Pass criteria & iPhone loop

---

## Gray Area Selection

| Option | Description | Selected |
|--------|-------------|----------|
| Prototype scope | ECG-only vs ECG+pleth vs ECG+asystole vs all three | ✓ |
| Scaffold disposability | Real codebase vs fully throwaway vs real + route stays | ✓ |
| Engine-state merge verification | Vitest spec vs Vitest+fuzz vs inline console assertion | ✓ |
| Pass criteria & iPhone loop | Physical device, proxy device, simulator, or remote tester | ✓ |

**User choice:** All four areas

---

## Scaffold Disposability

| Option | Description | Selected |
|--------|-------------|----------|
| Real scaffold, throwaway route (Recommended) | Production Next.js project; only `app/prototype/page.tsx` is deleted after P2 | ✓ |
| Fully throwaway spike | Separate minimal project/branch, deleted entirely before P2 starts | |
| Real scaffold + FPS route stays | Same as recommended, but keep the prototype route as a dev-only perf-regression harness | |

**User's choice:** Real scaffold, throwaway route
**Notes:** Engine code produced at P0 (`lib/waveforms/engine-state.ts`, `sampleEcg.ts`) ships unchanged into P2 — no rewrite. Only the harness page at `app/prototype/page.tsx` is the throwaway artifact.

---

## Scaffold Kit (follow-up)

| Option | Description | Selected |
|--------|-------------|----------|
| Minimum to validate (Recommended) | Next.js 15.5, React 19, TS strict, Vitest, ESLint/Prettier, lib/waveforms/, lib/clinical/ | ✓ |
| Full stack installed, unused | Tailwind/shadcn/Zustand/Zod/Pusher all installed at P0 even though unused | |
| Minimum + Tailwind v4 | Minimum plus Tailwind for FPS overlay styling beyond inline styles | |

**User's choice:** Minimum to validate
**Notes:** User added a freeform amendment after the initial recommendation was accepted: **"Use pnpm and biome for TS project."** The scaffold kit is therefore: Next.js 15.5 · React 19 · TypeScript strict · Vitest · pnpm (package manager) · biome (lint+format, replaces ESLint+Prettier). Tailwind v4 / shadcn / Zustand v5 / Zod v4 / Web Audio / Pusher all deferred to Phase 2.

---

## Prototype Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Sinus ECG only (Recommended) | One channel, one rhythm. Matches SC#1 literally. | ✓ |
| ECG sinus + SpO₂ pleth | Two channels to derisk WAVE-02 early | |
| ECG sinus + asystole toggle | One channel + rhythm-switch UI to validate WAVE-08/WAVE-09 | |
| ECG sinus + pleth + asystole toggle | Broadest derisk, ~30% more P0 scope | |

**User's choice:** Sinus ECG only
**Notes:** Narrowest scope that proves the rendering primitive. Pleth and additional rhythms belong under Phase 2's clinical sign-off.

---

## Engine-State Merge Verification

| Option | Description | Selected |
|--------|-------------|----------|
| Vitest unit test, dedicated spec (Recommended) | `tests/waveforms/engine-state.merge.test.ts` — tick, diff, assert phase/rFired preserved | ✓ |
| Vitest + fuzz variant | Same spec plus `fast-check` property-based test | |
| Inline console assertion in prototype page | Button on harness page logs pass/fail; Vitest deferred to P2 | |

**User's choice:** Vitest unit test, dedicated spec
**Notes:** Test convention established here becomes the P2 standard. No `fast-check` dep added yet.

---

## Pass Criteria & iPhone Loop

| Option | Description | Selected |
|--------|-------------|----------|
| I have physical access | iPhone 12 in hand | |
| I have a newer iPhone (13/14/15/16) | Close-enough proxy; iPhone 12 becomes P5 re-verification item | ✓ |
| No physical iPhone — simulator only | iOS Simulator only; weak GPU/thermal signal | |
| No physical iPhone — I'll recruit a tester | Vercel preview + remote tester with iPhone 12+ | |

**User's choice:** Newer iPhone (13/14/15/16-class)
**Notes:** A15+/A16+/A17+ are monotonically faster than iPhone 12's A14 for GPU + thermal budget — newer-device passing is a valid-but-proxy signal. iPhone 12 re-verification is flagged as a Phase 5 soak item.

---

## Evidence Artifact (follow-up)

| Option | Description | Selected |
|--------|-------------|----------|
| Screenshot of FPS overlay after 60s (Recommended) | One screenshot + Safari Web Inspector heap snapshot at t=0 and t=5min | ✓ |
| Screenshot + video recording | Same plus 30s screen recording | |
| Instrumented metrics JSON download | Frame-timing histogram export (avg/p50/p95/p99/min/max fps) | |

**User's choice:** Screenshot of FPS overlay after 60s
**Notes:** Lightweight evidence strategy. Metrics JSON deferred to Phase 5 soak where 30-min histograms matter.

---

## Claude's Discretion

- FPS overlay visual layout (position, font, color) on the throwaway harness page.
- Exact clear-ahead pixel width formula within the Pitfall 4 envelope.
- Whether `sampleEcg` is a pure function or a stateful class wrapper — pick whichever makes the Vitest merge test cleanest.
- Biome config rule severity — use `biome init` defaults unless they conflict with TS strict.

---

## Deferred Ideas

- Pleth (SpO₂) channel prototype — considered; deferred to Phase 2.
- Asystole flat-line rhythm + rhythm-switch UI — considered; deferred to Phase 2.
- FPS metrics JSON downloader / frame-time histogram — considered; deferred to Phase 5.
- Internal perf-regression `/prototype` route retained — considered; deferred / rejected (delete after P2; reintroduce as `/dev/*` in P5 if needed).
- Property-based / fuzz engine-state merge testing — considered; deferred to Phase 4.
- Tailwind v4, shadcn/ui, Zustand v5, Zod v4, Web Audio, Pusher client — all explicit P0 deferrals.
