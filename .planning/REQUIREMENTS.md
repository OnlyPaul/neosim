# Requirements: NeoSim — Neonatal Monitor Simulator

**Defined:** 2026-04-20
**Core Value:** An instructor can run a realistic golden-hour NRP scenario — driving HR, SpO₂, NIBP, cardiac rhythm, the APGAR timer, and alarms live from a second device — while learners see a responsive, full-screen neonatal monitor at the simulated warmer with latency under 200 ms.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Session (SESS)

- [ ] **SESS-01**: User can create a new session in one tap from the landing page and see a 6-character join code
- [ ] **SESS-02**: User can scan a QR code on the instructor panel to open the monitor view on a second device
- [ ] **SESS-03**: User can type the 6-character code on the landing page to open the monitor view
- [ ] **SESS-04**: Monitor view receives the current vitals snapshot within 1 s of joining (no blank screen)
- [ ] **SESS-05**: Monitor view shows a "Connecting…" state when the session channel has not yet delivered a snapshot
- [ ] **SESS-06**: Monitor reconnects automatically after a network blip of up to 30 s without manual refresh

### Monitor Display (MON)

- [ ] **MON-01**: Monitor view (`/monitor/[sessionId]`) renders on a full-black background with NeoSim chrome
- [ ] **MON-02**: Monitor header shows patient info (fictional name, MRN, warmer/bed, age in minutes, sex) and live clock
- [ ] **MON-03**: HR numeric tile displays in green with unit "bpm", rhythm label sub-text, ECG corner tag
- [ ] **MON-04**: SpO₂ numeric tile displays in cyan with unit "%", preductal source label
- [ ] **MON-05**: NIBP tile displays sys/dia in white with MAP in parentheses and cycle-mode indicator (manual / auto N min)
- [ ] **MON-06**: NIBP tile shows a cuff-inflating animation and "---/---" placeholders during a cycle
- [ ] **MON-07**: Numeric tiles pulse-animate on each R-wave detection (subtle scale nudge, 80 ms)
- [ ] **MON-08**: Monitor view runs at stable 60 fps on iPhone 12+ Safari (measured via `performance.now` instrumentation)
- [ ] **MON-09**: Monitor chrome shows a persistent "NOT A MEDICAL DEVICE · EDUCATIONAL" footer strip
- [ ] **MON-10**: A portrait-orientation overlay prompts the user to rotate when the monitor is in portrait mode on iPhone

### Waveforms & Rhythms (WAVE)

- [ ] **WAVE-01**: ECG Lead II waveform renders at 250 Hz on Canvas 2D via sweep-draw (clear-ahead region, no full-canvas clear)
- [ ] **WAVE-02**: SpO₂ plethysmograph renders at 100 Hz on Canvas 2D, amplitude scales with SpO₂ perfusion quality
- [x] **WAVE-03**: Waveform engine is time-based (`performance.now` deltas), not frame-counted — survives Low Power Mode rAF throttling to 30 fps (Phase 0 Plan 02; `lib/waveforms/sampleEcg.ts` uses `dt/beatDurMs`; `tests/waveforms/sample-ecg.test.ts` asserts 1×33ms === 2×16.5ms within 1e-9)
- [ ] **WAVE-04**: Waveform engine uses a fixed-size `Float32Array` circular buffer per channel (no unbounded growth over 30 min)
- [ ] **WAVE-05**: Canvas is DPR-aware (backing resolution = CSS size × devicePixelRatio) and renders crisply on iPhone 12 at DPR=3
- [ ] **WAVE-06**: Rhythm picker offers exactly 4 options in v1: Normal Sinus, Sinus Bradycardia, Sinus Tachycardia, Asystole
- [x] **WAVE-07**: Sinus / Brady / Tachy use a template-lookup beat, stretched/compressed to the current HR (Phase 0 Plan 02; `lib/waveforms/sampleEcg.ts` ecgSinusTemplate gaussian-sum + R-peak detection at phase ∈ (0.27, 0.30); validated at HR=60 and HR=180)
- [ ] **WAVE-08**: Asystole draws a flat line with small baseline drift (no QRS complexes)
- [ ] **WAVE-09**: Rhythm changes smoothly transition in < 500 ms (no visual snap/tear)
- [x] **WAVE-10**: Waveform engine state (phase, jitter, R-fired) lives in a dedicated engine-state object, not on the vitals store — Pusher diff merges cannot stomp beat phase (Phase 0 Plan 01; `lib/waveforms/engine-state.ts` factory)

### Alarms (ALRM)

- [ ] **ALRM-01**: HR < 100 triggers a LOW-priority HR alarm (neonatal bradycardia); HR < 60 triggers a HIGH-priority HR alarm
- [ ] **ALRM-02**: HR > 180 triggers a MEDIUM-priority HR alarm (neonatal tachycardia)
- [ ] **ALRM-03**: SpO₂ < 90 triggers a LOW-priority SpO₂ alarm; SpO₂ < 85 triggers a HIGH-priority SpO₂ alarm
- [ ] **ALRM-04**: NIBP sys < 60 mmHg triggers a MEDIUM-priority NIBP alarm
- [ ] **ALRM-05**: Asystole rhythm always triggers a HIGH-priority ECG alarm "ASYSTOLE"
- [ ] **ALRM-06**: Neonatal alarm thresholds are hard-coded in `lib/clinical/nrp.ts` with NRP 8th edition citation comments (no magic numbers in UI code)
- [ ] **ALRM-07**: Active alarm causes the corresponding numeric tile to flash (opacity pulse, 0.9 s period) and its border to turn priority-red
- [ ] **ALRM-08**: Top-of-screen alarm banner shows active alarms, color-coded by highest priority present
- [ ] **ALRM-09**: Alarm audio plays via Web Audio API with three distinct priority tones (HIGH / MEDIUM / LOW), scheduled on `AudioContext.currentTime`
- [ ] **ALRM-10**: R-wave-synced heartbeat beep plays on each detected R peak (pitch drops with SpO₂ for realism)
- [ ] **ALRM-11**: Alarm tones are deliberately NOT derived from IEC 60601-1-8 melodies (distinct from real clinical devices, for legal clarity)
- [ ] **ALRM-12**: Web Audio unlocks via a "tap to start" overlay on first load; audio routes past the iOS hardware silent switch via a silent-MP3 element trick

### APGAR (APG)

- [ ] **APG-01**: APGAR timer on the monitor shows MM:SS elapsed from start, with pause/resume/reset controls
- [ ] **APG-02**: Timer highlights the 1-minute, 5-minute, and 10-minute scoring windows (15 s before/after each milestone) with a golden accent and pulse animation
- [ ] **APG-03**: Instructor panel has an APGAR scoring section with 5 criteria (Appearance, Pulse, Grimace, Activity, Respiration), each scored 0 / 1 / 2
- [ ] **APG-04**: Instructor can log a score for the next pending milestone (m1 → m5 → m10); logged scores show on both monitor and instructor
- [ ] **APG-05**: APGAR timer uses shared-epoch sync (instructor broadcasts `startedAt`/`pausedAt`/`accumulatedMs`, both sides derive elapsed from `Date.now()`) — no per-tick broadcast
- [ ] **APG-06**: APGAR timer re-anchors `startedAt` on `visibilitychange → visible` to recover from backgrounded-tab drift
- [ ] **APG-07**: SpO₂ tile sub-text displays the Dawson-curve preductal target for the current minute-of-life from the APGAR timer (e.g., "Target 3m: 70–75%")

### NIBP (NIBP)

- [ ] **NIBP-01**: Instructor can trigger a manual NIBP cycle from the control panel
- [ ] **NIBP-02**: Instructor can set NIBP auto-cycle interval: off / 3 / 5 / 10 minutes
- [ ] **NIBP-03**: NIBP cycle animates on the monitor for ~2.8 s (cuff inflating indicator, numeric placeholder), then snaps to the current sys/dia/MAP value
- [ ] **NIBP-04**: NIBP sys and dia are adjustable via sliders on the instructor panel (sys 30–140, dia 15–100); MAP is computed as (sys + 2 × dia) / 3

### Instructor Control (CTRL)

- [ ] **CTRL-01**: Instructor panel at `/control/[sessionId]` shows session code, QR, connection status, and a "Monitor →" link
- [ ] **CTRL-02**: HR slider (20–220 bpm) updates the monitor in < 200 ms end-to-end (p95)
- [ ] **CTRL-03**: SpO₂ slider (40–100%) updates the monitor in < 200 ms end-to-end (p95)
- [ ] **CTRL-04**: Rhythm picker (4 rhythms) updates the monitor in < 200 ms end-to-end (p95)
- [ ] **CTRL-05**: Instructor mutations are debounced to max 2 Hz per parameter to stay within Pusher free-tier quota
- [ ] **CTRL-06**: Instructor panel works on phone (single column) and desktop (responsive) — instructor is not locked to a single form factor

### Quick-Action Presets (PRST)

- [ ] **PRST-01**: Quick-action grid on instructor has exactly 5 neonatal presets: Vigorous, Hypoxic, Bradycardic, Meconium, Arrest
- [ ] **PRST-02**: Selecting a preset bundles changes to HR, SpO₂, NIBP, rhythm in one action
- [ ] **PRST-03**: Presets animate through clinical bands over ~1.5 s (walk HR 140 → 80 for Bradycardic), not instant jump
- [ ] **PRST-04**: Preset values are clinically plausible and documented with source citations in `lib/clinical/presets.ts`

### iOS PWA Polish (PWA)

- [ ] **PWA-01**: `public/manifest.webmanifest` declares `display: standalone` with NeoSim icons (192/512 PNG + maskable)
- [ ] **PWA-02**: Monitor page uses `mobile-web-app-capable` + `apple-mobile-web-app-status-bar-style: black-translucent` meta tags (not the deprecated `apple-mobile-web-app-capable`)
- [ ] **PWA-03**: "Tap to start" overlay on the monitor's first load performs audio unlock, silent-MP3 mute-switch unlock, Wake Lock acquire, and fullscreen request in a single user gesture
- [ ] **PWA-04**: Wake Lock is re-acquired on every `visibilitychange → visible` event
- [ ] **PWA-05**: Monitor shows an "Add to Home Screen" coach-mark when opened in in-browser Safari (not standalone mode)
- [ ] **PWA-06**: Monitor displays a graceful-degradation banner on iOS 16.4–18.3 installed PWAs ("Wake Lock may not hold — keep tapping")
- [ ] **PWA-07**: Portrait-mode overlay on iPhone prompts landscape rotation (programmatic orientation lock is not available on iPhone)

### Realtime Sync (SYNC)

- [ ] **SYNC-01**: Vitals updates flow: instructor Zustand → debounced POST to `/api/session/[id]/publish` → Pusher private-encrypted channel → monitor replica Zustand
- [ ] **SYNC-02**: Wire messages are Zod-validated at both publish and receive boundaries
- [ ] **SYNC-03**: Every diff carries a monotonic `seq` ID; monitor requests a fresh snapshot if it detects a `seq` gap
- [ ] **SYNC-04**: Instructor broadcasts a full vitals snapshot every 2–5 s as a reconnection safety net
- [ ] **SYNC-05**: `await pusher.trigger()` is used in every Vercel route handler (non-await shipping has shipped production bugs)
- [ ] **SYNC-06**: Waveform sample values are never sent over the wire — only parameters (HR, rhythm, SpO₂, etc.) propagate
- [ ] **SYNC-07**: Instructor-to-monitor p95 latency is < 200 ms on wifi, < 400 ms on LTE (measured during phase 1 spike + phase 5 soak)

### Legal & Branding (LEGAL)

- [ ] **LEGAL-01**: Landing page carries a prominent "For educational use only. Not a medical device. Not for clinical use." disclaimer above the fold
- [ ] **LEGAL-02**: Monitor view carries the same disclaimer as a persistent footer strip
- [ ] **LEGAL-03**: Visual identity is generic NeoSim branding (own wordmark, own icon, own tile geometry) — no visual echo of Philips / GE / Mindray / Masimo / Nihon Kohden
- [ ] **LEGAL-04**: Alarm tones are NOT derived from IEC 60601-1-8 melodies (see ALRM-11)
- [ ] **LEGAL-05**: No patient data is persisted; "patient info" fields are free-text and clearly fictional

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Clinical & Scenario

- **V2-CLIN-01**: Adaptive SpO₂ alarm threshold tracking the Dawson curve by minute-of-life
- **V2-CLIN-02**: Instructor-editable alarm thresholds per parameter
- **V2-CLIN-03**: Artifact toggles (lead-off, low-perfusion, motion, 60 Hz interference)
- **V2-SCEN-01**: Scenario scripting — JSON-defined cases that auto-progress on a timeline
- **V2-SCEN-02**: Scenario pause/resume/scrub controls
- **V2-SCEN-03**: Event log (all parameter changes and alarms with timestamps)
- **V2-SCEN-04**: Trends graph (last 30 min of each parameter)
- **V2-SCEN-05**: Printable post-scenario debrief

### UX

- **V2-UX-01**: Demo mode on the monitor route (self-drives, no session required, marketing landing)
- **V2-UX-02**: Respiratory-effort indicator (qualitative "Apneic/Weak/Good cry" → chest-rise animation)
- **V2-UX-03**: 8-character session codes with 36-char alphabet (pre-public-launch upgrade from 6-char)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Capnography / EtCO₂ tile | Not used in neonatal golden-hour assessment |
| Temperature tile | Not central to NRP; simplify v1 display |
| Respiratory-rate numeric tile | RR is scored clinically via APGAR respiration criterion, not displayed |
| Adult arrhythmias (AFib, VT, VF, PVCs, AV blocks, ST changes) | Clinically wrong for neonatal arrest (asphyxial → brady → asystole, not dysrhythmic) |
| 12-lead ECG | Irrelevant to NRP golden-hour workflow |
| Defibrillator / pacer | Not part of NRP algorithm |
| User accounts / auth / signup | Kills distribution wedge; educational/free posture |
| Native iOS / Android apps | Web PWA only |
| Scenario marketplace, class management, analytics | v3+ — out of MVP scope |
| Imitation of real monitor brands (Philips / GE / Mindray / Masimo) | Trade-dress risk; visual identity must be distinct |
| Persisted patient data | No PHI surface; patient info is free-text and fictional |
| Monetization | Free-for-education in v1 |
| IEC 60601-1-8 alarm tone conformance | Educational simulator, not a medical device — deliberately distinct tones |
| Pediatric / adult mode | v1 is neonatal-only by design |

## Traceability

Which phases cover which requirements. Updated at roadmap creation (2026-04-20).

| Requirement | Phase | Status |
|-------------|-------|--------|
| SESS-01 | Phase 4 | Pending |
| SESS-02 | Phase 4 | Pending |
| SESS-03 | Phase 4 | Pending |
| SESS-04 | Phase 4 | Pending |
| SESS-05 | Phase 4 | Pending |
| SESS-06 | Phase 4 | Pending |
| MON-01 | Phase 2 | Pending |
| MON-02 | Phase 2 | Pending |
| MON-03 | Phase 2 | Pending |
| MON-04 | Phase 2 | Pending |
| MON-05 | Phase 2 | Pending |
| MON-06 | Phase 2 | Pending |
| MON-07 | Phase 2 | Pending |
| MON-08 | Phase 5 | Pending |
| MON-09 | Phase 2 | Pending |
| MON-10 | Phase 3 | Pending |
| WAVE-01 | Phase 0 | Pending |
| WAVE-02 | Phase 2 | Pending |
| WAVE-03 | Phase 0 | Completed (Plan 00-02) |
| WAVE-04 | Phase 0 | Pending |
| WAVE-05 | Phase 0 | Pending |
| WAVE-06 | Phase 2 | Pending |
| WAVE-07 | Phase 0 | Completed (Plan 00-02) |
| WAVE-08 | Phase 2 | Pending |
| WAVE-09 | Phase 2 | Pending |
| WAVE-10 | Phase 0 | Completed (Plan 00-01) |
| ALRM-01 | Phase 2 | Pending |
| ALRM-02 | Phase 2 | Pending |
| ALRM-03 | Phase 2 | Pending |
| ALRM-04 | Phase 2 | Pending |
| ALRM-05 | Phase 2 | Pending |
| ALRM-06 | Phase 2 | Pending |
| ALRM-07 | Phase 2 | Pending |
| ALRM-08 | Phase 2 | Pending |
| ALRM-09 | Phase 2 | Pending |
| ALRM-10 | Phase 2 | Pending |
| ALRM-11 | Phase 2 | Pending |
| ALRM-12 | Phase 3 | Pending |
| APG-01 | Phase 2 | Pending |
| APG-02 | Phase 2 | Pending |
| APG-03 | Phase 4 | Pending |
| APG-04 | Phase 4 | Pending |
| APG-05 | Phase 4 | Pending |
| APG-06 | Phase 3 | Pending |
| APG-07 | Phase 2 | Pending |
| NIBP-01 | Phase 4 | Pending |
| NIBP-02 | Phase 4 | Pending |
| NIBP-03 | Phase 2 | Pending |
| NIBP-04 | Phase 2 | Pending |
| CTRL-01 | Phase 4 | Pending |
| CTRL-02 | Phase 4 | Pending |
| CTRL-03 | Phase 4 | Pending |
| CTRL-04 | Phase 4 | Pending |
| CTRL-05 | Phase 4 | Pending |
| CTRL-06 | Phase 4 | Pending |
| PRST-01 | Phase 4 | Pending |
| PRST-02 | Phase 4 | Pending |
| PRST-03 | Phase 2 | Pending |
| PRST-04 | Phase 2 | Pending |
| PWA-01 | Phase 3 | Pending |
| PWA-02 | Phase 3 | Pending |
| PWA-03 | Phase 3 | Pending |
| PWA-04 | Phase 3 | Pending |
| PWA-05 | Phase 3 | Pending |
| PWA-06 | Phase 3 | Pending |
| PWA-07 | Phase 3 | Pending |
| SYNC-01 | Phase 4 | Pending |
| SYNC-02 | Phase 4 | Pending |
| SYNC-03 | Phase 4 | Pending |
| SYNC-04 | Phase 4 | Pending |
| SYNC-05 | Phase 4 | Pending |
| SYNC-06 | Phase 4 | Pending |
| SYNC-07 | Phase 5 | Pending |
| LEGAL-01 | Phase 4 | Pending |
| LEGAL-02 | Phase 2 | Pending |
| LEGAL-03 | Phase 2 | Pending |
| LEGAL-04 | Phase 2 | Pending |
| LEGAL-05 | Phase 2 | Pending |

**Phase 1 note:** The Pusher Latency Spike is a throwaway de-risking phase and owns zero v1 requirements by design. Its artifacts (`lib/sync/pusher-client.ts`, `lib/sync/messages.ts`, publish + auth routes) are inherited and productized by Phase 4. SYNC-07's latency budget is empirically validated during Phase 1 but formally verified under 30-min soak in Phase 5.

**Coverage:**
- v1 requirements: 78 total
- Mapped to phases: 78 (100%)
- Unmapped: 0

| Phase | Count |
|-------|-------|
| Phase 0 — Waveform Prototype on iPhone | 6 |
| Phase 1 — Pusher Latency Spike | 0 (throwaway spike) |
| Phase 2 — Local Full Monitor (Clinical Correctness) | 34 |
| Phase 3 — iOS Polish | 10 |
| Phase 4 — Split + Sync | 26 |
| Phase 5 — Scenario-Day Hardening & Deploy | 2 |
| **Total** | **78** |

---
*Requirements defined: 2026-04-20*
*Last updated: 2026-04-20 after roadmap creation*
