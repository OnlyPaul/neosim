# NeoSim — Claude Code Project Guide

## Project
**NeoSim** — a web-delivered (PWA) neonatal monitor simulator for NRP / newborn-resuscitation training. One device shows the monitor at the warmer; a second device drives vitals and the APGAR timer live. Free, educational-only.

**Core value:** instructor drives a realistic golden-hour NRP scenario from a second device — HR, SpO₂, NIBP, rhythm, APGAR, alarms — monitor reflects changes in < 200 ms.

## Orientation
- `.planning/PROJECT.md` — core value, constraints, decisions (source of truth)
- `.planning/REQUIREMENTS.md` — 78 v1 REQs with phase traceability
- `.planning/ROADMAP.md` — 6 phases (P0 Waveform → P1 Pusher spike → P2 Local monitor → P3 iOS polish → P4 Split + Sync → P5 Hardening)
- `.planning/STATE.md` — current position, accumulated decisions, next action
- `.planning/research/` — domain research (STACK, FEATURES, ARCHITECTURE, PITFALLS, SUMMARY)
- `design/` — throwaway React-via-CDN prototype; **visual + UX lock, not the codebase**. Real build is clean Next.js 15.5 App Router.
- `patient-monitor-simulator-prd.md` — original generic PRD. Superseded by PROJECT.md on the neonatal pivot.

## GSD workflow
This project uses Get-Shit-Done methodology. Each phase: `/gsd-plan-phase N` → `/gsd-execute-phase N` → `/gsd-verify-work` → `/gsd-transition`. State lives under `.planning/`. Config in `.planning/config.json` (mode: yolo, granularity: standard, parallelization, research/plan-check/verifier all on).

## Non-negotiables (flagged across research)
- **Clinical correctness**: alarm thresholds are neonatal — HR < 100 low, HR < 60 critical, SpO₂ < 90 low, SpO₂ < 85 critical. Hard-coded in `lib/clinical/nrp.ts` with NRP 8th edition citations. Never adult defaults.
- **Rhythm set is 4 only for v1**: Sinus / Sinus Brady / Sinus Tachy / Asystole. Drop the prototype's AFib/VT/VF — clinically wrong for neonatal arrest (which is asphyxial, not dysrhythmic).
- **Waveform engine state stays off the vitals store** — Pusher diff merges must not stomp beat phase. `lib/waveforms/engine-state.ts` owns phase/jitter/rFired.
- **Sync**: instructor is single writer; monitor is a read-only replica. Waveform samples never cross the wire. `await pusher.trigger()` in every Vercel route handler.
- **APGAR timer**: shared-epoch (broadcast `startedAt`/`pausedAt`/`accumulatedMs`, derive elapsed locally) — no per-second broadcast.
- **iOS reality**: programmatic landscape lock does NOT work on iPhone; `display: fullscreen` does NOT work on iPhone PWA; Wake Lock in installed PWA works reliably only from **iOS 18.4+**. Graceful-degrade, don't fight WebKit.
- **Not a medical device** disclaimer is persistent on landing + monitor. Alarm tones deliberately NOT derived from IEC 60601-1-8.
- **Generic brand identity** — no visual echo of Philips / GE / Mindray / Masimo.

## Stack (locked)
Next.js 15.5 · React 19 · TypeScript strict · Zustand v5 · Tailwind v4 + shadcn/ui (instructor only) · raw Canvas 2D (monitor) · raw Web Audio · Pusher Channels (Sandbox tier 200/200k) · Zod v4 · Vercel hosting.

## Current position
Phase 0 — Waveform Prototype on iPhone. Ready for `/gsd-plan-phase 0`.
