# Roadmap: NeoSim — Neonatal Monitor Simulator

**Created:** 2026-04-20
**Granularity:** standard (5–8 phases, 3–5 plans each)
**Phases:** 6 (Phase 0 through Phase 5)
**Coverage:** 78 / 78 v1 requirements mapped (100%)

## Core Value

An instructor can run a realistic golden-hour NRP scenario — driving HR, SpO₂, NIBP, cardiac rhythm, the APGAR timer, and alarms live from a second device — while learners see a responsive, full-screen neonatal monitor at the simulated warmer with latency under 200 ms.

## Phases

- [ ] **Phase 0: Waveform Prototype on iPhone** — Prove DPR-aware Canvas sweep-draw holds 60 fps on iPhone 12 Safari at DPR=3 with a time-based engine
- [ ] **Phase 1: Pusher Latency Spike** — Measure real-world p95 instructor-to-monitor latency from iPhone Safari over wifi + LTE; go/no-go on Pusher for v1 (throwaway spike, no direct v1 REQ ownership)
- [ ] **Phase 2: Local Full Monitor (Clinical Correctness)** — All tiles, both waveforms, four rhythms, alarm system, R-wave beep, APGAR timer, NIBP cycles, presets — driven by a local Zustand store, clinically signed off
- [ ] **Phase 3: iOS Polish** — PWA manifest, Wake Lock, fullscreen, tap-to-start overlay, landscape hint, status-bar styling; iOS 18.4 support-matrix decision
- [ ] **Phase 4: Split + Sync** — Landing page, instructor panel at `/control/[id]`, monitor at `/monitor/[id]`, Pusher private-encrypted channels, snapshot + diff + seq protocol, APGAR shared-epoch sync
- [ ] **Phase 5: Scenario-Day Hardening & Deploy** — 30-minute soak, reconnect-under-airplane-mode, iOS device matrix, clinical sign-off on the full flow, landing-page legal review, Vercel production deploy

## Phase Details

### Phase 0: Waveform Prototype on iPhone

**Goal**: Validate that a DPR-aware Canvas 2D sweep-draw with a time-based waveform engine holds 60 fps on iPhone 12 Safari before any further build work commits to this rendering strategy.

**Depends on**: Nothing (first phase)

**Requirements**: WAVE-01, WAVE-03, WAVE-04, WAVE-05, WAVE-07, WAVE-10

**Success Criteria** (what must be TRUE):
  1. A throwaway `app/prototype/page.tsx` route deployed to Vercel renders a sinus-rhythm ECG sweep-draw at 60 fps on iPhone 12 Safari for at least 60 seconds (measured by `performance.now()` FPS counter overlay)
  2. The waveform renders crisply at DPR=3 on iPhone (backing resolution = CSS size × devicePixelRatio) with no ghosting from the sweep-draw clear-ahead region
  3. When iPhone enters Low Power Mode and rAF throttles to 30 fps, the waveform keeps clinical-correct timing (HR period stable) because the engine is `performance.now`-delta driven, not frame-counted
  4. Fixed-size `Float32Array` circular buffer holds 1 full sweep per channel with heap flat over 5+ minutes (no unbounded growth)
  5. Engine state (phase, jitter, R-fired) lives in a separate `engine-state.ts` object, not on the vitals store — verified by a test that merges a partial vitals diff without stomping beat phase

**Plans:** 4 plans

Plans:
- [x] 00-01-scaffold-and-engine-state-PLAN.md — Next.js 15.5 + Vitest + Biome scaffold + lib/waveforms/engine-state.ts factory (WAVE-10 module) [SUMMARY](./phases/00-waveform-prototype/00-01-SUMMARY.md)
- [x] 00-02-engine-math-and-tests-PLAN.md — Port sinus PQRST to sampleEcg.ts (drop vt/vf/afib/capno); Vitest merge-regression + R-peak + time-base tests (WAVE-03, WAVE-07, WAVE-10) [SUMMARY](./phases/00-waveform-prototype/00-02-SUMMARY.md)
- [ ] 00-03-sweep-canvas-and-prototype-route-PLAN.md — DPR-aware sweepCanvas.ts (no cap) + Float32Array ring buffer + /prototype route with FPS overlay (WAVE-01, WAVE-04, WAVE-05)
- [ ] 00-04-vercel-deploy-and-iphone-evidence-PLAN.md — Vercel preview deploy + iPhone checkpoint for FPS screenshot, heap snapshots, DPR check, LPM sanity (WAVE-01, WAVE-03, WAVE-04, WAVE-05)

### Phase 1: Pusher Latency Spike

**Goal**: Measure real-world p95 instructor-to-monitor latency on Pusher Channels (free tier) from iPhone Safari on wifi and LTE, through a Vercel route handler cold-start, to confirm the < 200 ms end-to-end budget is achievable before committing Phase 4.

**Depends on**: Phase 0

**Requirements**: None directly owned (throwaway spike; SYNC-07 is formally verified in Phase 5 after the real wire protocol is in place)

**Success Criteria** (what must be TRUE):
  1. Two throwaway pages (`/spike/a`, `/spike/b`) wired through Pusher demonstrate that a number typed on device A appears on device B on a real iPhone over wifi, with measured `publishedAt → receivedAt` latency
  2. Measured p95 latency on wifi is documented in `.planning/research/spike-results.md`; if wifi p95 ≤ 200 ms and LTE p95 ≤ 400 ms, Pusher is confirmed for Phase 4
  3. If Pusher misses budget, the `lib/sync/transport.ts` abstraction boundary is in place so Phase 4 can swap to Ably with a one-file change (go/no-go decision recorded)
  4. Every Vercel route handler in the spike uses `await pusher.trigger()` (non-await is known to drop messages) — pattern is documented for Phase 4 to inherit

**Plans**: TBD

### Phase 2: Local Full Monitor (Clinical Correctness)

**Goal**: A learner using a single device can open `/monitor/[sessionId]` and see a clinically correct, visually complete neonatal monitor — all tiles, both waveforms, four rhythms, neonatal alarms with audio, R-wave-synced beep, APGAR timer with milestone windows, NIBP cycle animation, quick-action presets that walk bands — all driven by a local Zustand store (no sync yet) and signed off by a practicing NRP instructor.

**Depends on**: Phase 0 (Phase 1 runs in parallel but is not a hard blocker)

**Requirements**:
MON-01, MON-02, MON-03, MON-04, MON-05, MON-06, MON-07, MON-09,
WAVE-02, WAVE-06, WAVE-08, WAVE-09,
ALRM-01, ALRM-02, ALRM-03, ALRM-04, ALRM-05, ALRM-06, ALRM-07, ALRM-08, ALRM-09, ALRM-10, ALRM-11,
APG-01, APG-02, APG-07,
NIBP-03, NIBP-04,
PRST-03, PRST-04,
LEGAL-02, LEGAL-03, LEGAL-04, LEGAL-05

**Success Criteria** (what must be TRUE):
  1. A user opens `/monitor/[sessionId]` on iPhone 12 landscape Safari and sees a complete neonatal monitor: HR (green), SpO₂ (cyan), NIBP sys/dia/MAP (white), ECG Lead II sweep, SpO₂ pleth sweep, APGAR timer, patient header, persistent "NOT A MEDICAL DEVICE · EDUCATIONAL" footer
  2. A user changing HR, SpO₂, rhythm, or NIBP in a local debug control (pre-split) sees the monitor respond within one frame: tiles pulse on R-wave, tiles flash and alarm audio plays when thresholds (HR < 100 / < 60, SpO₂ < 90 / < 85, sys < 60, asystole) are crossed, R-wave beep pitch drops with SpO₂
  3. A user triggers an NIBP cycle (manual or auto 3/5/10 min) and sees the ~2.8 s cuff-inflating animation with "---/---" placeholder before the reading snaps in; MAP = (sys + 2·dia)/3 is computed correctly
  4. The APGAR timer runs MM:SS elapsed; the 1 / 5 / 10-minute windows (±15 s) highlight with a golden pulse; the SpO₂ tile sub-text shows the Dawson-curve preductal target for the current minute-of-life (e.g., "Target 3m: 70–75%")
  5. A practicing NRP instructor reviews all alarm thresholds (cited in `lib/clinical/nrp.ts`), all 5 preset band-walks (cited in `lib/clinical/presets.ts`), and the Dawson-target display, and signs off in writing that the clinical behavior is correct per NRP 8th edition — the phase does not close without this sign-off

**Plans**: TBD

**UI hint**: yes

### Phase 3: iOS Polish

**Goal**: The monitor view behaves correctly as an installed iOS PWA: launches from the home screen in landscape fullscreen, holds the screen awake through a 30-minute session, plays alarm audio past the iPhone hardware silent switch, and re-acquires platform capabilities after tab-switch or background. Phase 3 also finalizes the iOS 16.4 vs 18.4 support-matrix decision.

**Depends on**: Phase 2

**Requirements**:
MON-10,
ALRM-12,
APG-06,
PWA-01, PWA-02, PWA-03, PWA-04, PWA-05, PWA-06, PWA-07

**Success Criteria** (what must be TRUE):
  1. A user taps the NeoSim icon on an iOS 18.4+ home screen and the monitor opens in landscape fullscreen with the Safari chrome hidden, black-translucent status bar, and the "NOT A MEDICAL DEVICE" footer visible
  2. The first-load "tap to start" overlay performs — inside a single user gesture — Web Audio unlock, silent-MP3 mute-switch unlock (alarm tones play even with the hardware switch muted), Wake Lock acquire, and a fullscreen request; Wake Lock is re-acquired automatically on every `visibilitychange → visible`
  3. A user on iPhone in portrait sees a "please rotate to landscape" overlay (programmatic orientation lock is not available on iPhone); rotating to landscape dismisses it
  4. A user on an installed PWA running iOS 16.4–18.3 sees a graceful-degradation banner ("Wake Lock may not hold — keep tapping"); a user on in-browser Safari (not standalone) sees an "Add to Home Screen" coach-mark
  5. After a user backgrounds the tab for 30 seconds and returns, the APGAR timer re-anchors `startedAt` on `visibilitychange → visible` and reads the correct elapsed time (no drift or pause artifact)

**Plans**: TBD

**UI hint**: yes

### Phase 4: Split + Sync

**Goal**: A user lands on `/`, creates a session in one tap, and sees a 6-char code + QR on the instructor panel at `/control/[sessionId]`. A second device opens `/monitor/[sessionId]` (by QR scan or code entry) and becomes a read-only replica driven by the instructor over Pusher private-encrypted channels with < 200 ms end-to-end latency. APGAR timer and scoring are synchronized via a shared-epoch broadcast. All instructor controls — HR/SpO₂ sliders, rhythm picker, NIBP manual/auto cycles, 5 quick-action presets, APGAR scoring panel — drive the monitor live.

**Depends on**: Phase 3 (iOS polish lands before sync so platform bugs don't tangle with sync bugs); Phase 1 latency spike outcome (Pusher vs Ably decision made)

**Requirements**:
SESS-01, SESS-02, SESS-03, SESS-04, SESS-05, SESS-06,
APG-03, APG-04, APG-05,
NIBP-01, NIBP-02,
CTRL-01, CTRL-02, CTRL-03, CTRL-04, CTRL-05, CTRL-06,
PRST-01, PRST-02,
SYNC-01, SYNC-02, SYNC-03, SYNC-04, SYNC-05, SYNC-06,
LEGAL-01

**Success Criteria** (what must be TRUE):
  1. A user lands on `/`, taps "Create session," sees a 6-char code + QR + "Monitor →" link on `/control/[sessionId]` with an above-the-fold "For educational use only. Not a medical device." disclaimer on the landing page; a second device that scans the QR or types the code opens `/monitor/[sessionId]` and receives the current vitals snapshot within 1 s (no blank screen; a "Connecting…" state shows until snapshot arrives)
  2. An instructor moves the HR slider (20–220), SpO₂ slider (40–100), rhythm picker (4 rhythms), or triggers a quick-action preset or NIBP cycle (manual, or auto 3/5/10 min) and the monitor reflects the change within 200 ms p95 on wifi (mutations debounced to ≤ 2 Hz per parameter); quick-action presets animate through clinical bands over ~1.5 s rather than snapping
  3. The APGAR timer is driven by the instructor via shared-epoch broadcast (`startedAt` / `pausedAt` / `accumulatedMs` sent as discrete events, not per-tick); both monitor and instructor derive elapsed from `Date.now()`; the instructor scores the next pending milestone (m1 → m5 → m10) on 5 criteria (Appearance, Pulse, Grimace, Activity, Respiration; 0/1/2 each) and the logged score appears on both devices
  4. The instructor panel works responsively on phone (single column) and desktop (multi-column) — not locked to one form factor — and shows session code, QR, connection status, and a "Monitor →" link at all times
  5. After a network blip of up to 30 s (e.g., instructor device sleep or WiFi toggle), the monitor reconnects automatically without manual refresh; every diff carries a monotonic `seq` and the monitor re-requests a snapshot if a `seq` gap is detected; the instructor also broadcasts a full snapshot every 2–5 s as a safety net; every Vercel route handler uses `await pusher.trigger()`; all wire messages are Zod-validated at both publish and receive; waveform sample values are never sent over the wire

**Plans**: TBD

**UI hint**: yes

### Phase 5: Scenario-Day Hardening & Deploy

**Goal**: NeoSim is production-ready for an actual NRP scenario day: a 30-minute session holds 60 fps on iPhone 12 without crash, memory leak, or Wake Lock loss; Pusher reconnects cleanly under forced airplane-mode toggles; the iOS device matrix (16.4 / 17.x / 18.4+ iPhone + iPad landscape) is all verified; a practicing NRP instructor runs a full scripted scenario end-to-end and signs off; the landing page legal copy is reviewed; and the app is deployed to a production Vercel domain.

**Depends on**: Phase 4

**Requirements**:
MON-08,
SYNC-07

**Success Criteria** (what must be TRUE):
  1. A 30-minute soak test on iPhone 12 with the instructor panel actively changing vitals shows: stable 60 fps throughout (measured via `performance.now` instrumentation), heap flat (no unbounded buffer growth), Wake Lock still held at end, no crash or visual degradation — MON-08 formally verified here
  2. During the soak, a forced airplane-mode toggle on the monitor device disconnects and reconnects cleanly within 30 s; the monitor re-receives a fresh snapshot and catches back up; no stale alarm state persists across the reconnect
  3. Instructor-to-monitor p95 latency is re-measured on the production deploy and is < 200 ms on wifi and < 400 ms on LTE — SYNC-07 formally verified here
  4. The iOS device matrix (iPhone 12 on iOS 16.4 graceful-degradation path, iPhone on iOS 17.x, iPhone on iOS 18.4+ full-support path, iPad landscape Safari) all complete a 10-minute scripted scenario without unrecoverable issues; an NRP instructor runs a full golden-hour scenario end-to-end and signs off
  5. The landing page and monitor-chrome disclaimer copy are legally reviewed; the Vercel production domain is live; an install/usage guide (including the silent-switch and battery-drain UX notes) is published; first public beta link can be shared

**Plans**: TBD

**UI hint**: yes

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 0. Waveform Prototype on iPhone | 2/4 | In progress | — |
| 1. Pusher Latency Spike | 0/TBD | Not started | — |
| 2. Local Full Monitor (Clinical Correctness) | 0/TBD | Not started | — |
| 3. iOS Polish | 0/TBD | Not started | — |
| 4. Split + Sync | 0/TBD | Not started | — |
| 5. Scenario-Day Hardening & Deploy | 0/TBD | Not started | — |

## Coverage Summary

All 78 v1 requirements mapped to exactly one phase. No orphans.

| Category | Total | P0 | P1 | P2 | P3 | P4 | P5 |
|----------|-------|----|----|----|----|----|-----|
| SESS (6) | 6 | — | — | — | — | 6 | — |
| MON (10) | 10 | — | — | 8 | 1 | — | 1 |
| WAVE (10) | 10 | 6 | — | 4 | — | — | — |
| ALRM (12) | 12 | — | — | 11 | 1 | — | — |
| APG (7) | 7 | — | — | 3 | 1 | 3 | — |
| NIBP (4) | 4 | — | — | 2 | — | 2 | — |
| CTRL (6) | 6 | — | — | — | — | 6 | — |
| PRST (4) | 4 | — | — | 2 | — | 2 | — |
| PWA (7) | 7 | — | — | — | 7 | — | — |
| SYNC (7) | 7 | — | — | — | — | 6 | 1 |
| LEGAL (5) | 5 | — | — | 4 | — | 1 | — |
| **Total** | **78** | **6** | **0** | **34** | **10** | **26** | **2** |

**Note:** Phase 1 is a throwaway latency spike — it validates SYNC-07 empirically and produces artifacts (`lib/sync/pusher-client.ts`, `lib/sync/messages.ts`, publish route, auth route) that Phase 4 inherits and productizes. To avoid double-mapping, SYNC-01 through SYNC-07 are all formally owned by Phase 4 (SYNC-01..06) and Phase 5 (SYNC-07 re-measured under soak). Phase 1 owns zero v1 requirements by design.

## Dependencies

```
P0 (prototype) ──► P2 (local monitor) ──► P3 (iOS polish) ──► P4 (sync) ──► P5 (hardening)
                                                                   ▲
P1 (Pusher spike — parallel after P0) ─────────────────────────────┘
  (informs Pusher-vs-Ably go/no-go for P4)
```

- P0 unblocks everything (render primitive must hold).
- P1 can run in parallel with P2; its outcome feeds P4.
- P3 lands before P4 (platform debugging without sync noise).
- P5 depends on a working two-device system from P4.

---
*Last updated: 2026-04-21 after Plan 00-02 completion (sampleEcg + WAVE-10 merge test)*
