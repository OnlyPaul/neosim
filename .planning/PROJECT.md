# NeoSim — Neonatal Monitor Simulator

## What This Is

A web-delivered (PWA) neonatal bedside-monitor simulator for NRP (Neonatal Resuscitation Program) and newborn-resuscitation training. One device displays the monitor at a simulated warmer; a second device held by the instructor drives vitals and the APGAR timer live. Free, no signup, educational only — never for clinical use.

## Core Value

An instructor can run a realistic golden-hour NRP scenario — driving HR, SpO₂, NIBP, cardiac rhythm, the APGAR timer, and alarms live from a second device — while learners see a responsive, full-screen neonatal monitor at the simulated warmer with latency under 200 ms.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

(None yet — ship to validate)

### Active

<!-- Current scope. Building toward these. -->

- [ ] Instructor creates a session in one tap and shares a 6-char join code + QR
- [ ] Monitor (`/monitor/[sessionId]`) renders ECG (Lead II) and SpO₂ pleth waveforms at 60 fps on Canvas 2D via sweep-draw
- [ ] Numeric tiles: HR (green), SpO₂ (cyan), NIBP sys/dia + MAP (white)
- [ ] APGAR timer on the monitor with 1 / 5 / 10-min scoring windows, pause/resume, reset
- [ ] APGAR scoring panel on instructor (Appearance, Pulse, Grimace, Activity, Respiration — 0/1/2 each)
- [ ] Neonatal cardiac rhythm set: sinus, sinus brady, sinus tachy, asystole
- [ ] Instructor panel (`/control/[sessionId]`) adjusts HR, SpO₂, NIBP sys/dia live; changes reflect on display in < 200 ms end-to-end
- [ ] Alarms: flashing tile + banner (visual), distinct tones per priority (audio via Web Audio), neonatal thresholds (HR < 100 low / < 60 critical; SpO₂ < 90 low / < 85 critical)
- [ ] NIBP cycle control: trigger now + auto-cycle off / 3 / 5 / 10 min; cuff-inflating animation on display
- [ ] Neonatal quick-action presets: Vigorous, Hypoxic, Bradycardic, Meconium, Arrest
- [ ] iOS PWA polish: home-screen install manifest, landscape-lock on monitor view, Wake Lock API, full-screen (Safari chrome hidden), "tap to start" overlay to unlock Web Audio
- [ ] Generic brand identity (NeoSim) visually distinct from any real monitor vendor
- [ ] Prominent "Not a medical device / educational only" disclaimer on landing and monitor views
- [ ] Stable 60 fps + no crash on iPhone 12+ for a 30-minute session

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- Capnography (EtCO₂) — not used in neonatal golden-hour assessment; drop for v1
- Temperature tile — simplify display; reconsider for v2 if instructors request it
- Respiratory rate numeric tile — APGAR respiration is scored clinically by observation; RR display not central to NRP
- Adult arrhythmias (AFib, VT, VF, PVCs, AV blocks, ST changes) — clinically rare in neonates; no NRP teaching value for v1
- User accounts / signup / auth — intentionally frictionless; session codes only
- Pacer / defibrillator simulation — outside NRP scope
- Scenario scripting, trends graph, event log, post-scenario debrief — v2
- Native iOS/Android apps — web PWA only
- Class / cohort management, analytics, scenario marketplace, multi-language — v3+
- Imitation of any real monitor brand (Philips, GE, Mindray) — trade-dress risk; generic visual identity required
- Persisted patient data — free-text "patient info" is fictional and not stored
- Monetization — free-for-education stance in v1

## Context

- **Design prototype exists** at `design/` — single-HTML React-via-Babel-CDN spike with three files (`monitorView.jsx`, `controlView.jsx`, `landingView.jsx`, `waveforms.js`). It locks the visual language, APGAR UX, quick-action set, and color palette. Treat as visual/UX reference, not production code. Real build is Next.js 14 App Router.
- **Waveform math is already spiked** in `design/src/waveforms.js` — port the shapes (ECG template-based, pleth double-exponential, cuff-inflating) into `lib/waveforms/` for the Next.js app.
- **Sync model** (from PRD): instructor is source of truth; only `VitalsState` diffs flow over Pusher at ~1–10 msgs/s. Waveform samples are generated locally on the monitor at 60 fps — never wired.
- **APGAR UX** (from design): timer runs on the monitor; scoring is done on the instructor panel. Milestone windows (1m / 5m / 10m) highlight on the monitor to prompt scoring.
- **Primary device target**: iPhone 12+ and iPad in landscape Safari (at warmer side); instructor on any device (phone or laptop).
- **Power + wake**: Wake Lock API + 60 fps Canvas + Web Audio is power-heavy; instructors should plug in for long sessions.

## Constraints

- **Tech stack**: Next.js 14 (App Router), Vercel hosting, Pusher Channels (sync), Zustand (local state), Tailwind + shadcn/ui (instructor UI), raw Canvas 2D (monitor waveforms — no chart library), Web Audio API (raw, for alarm timing), Zod (wire-message validation), TypeScript strict mode
- **Timeline**: MVP target 4–6 weeks evening/weekend; compressed ~2–3 weeks calendar if focused
- **Platform compatibility**: iOS 16.4+ Safari required (Wake Lock API + PWA fullscreen meta tags); modern desktop Chrome/Safari/Firefox for instructor
- **Latency**: parameter change on instructor → visible on monitor in < 200 ms end-to-end
- **Legal**: not a medical device; generic visual identity (no brand imitation); free/educational scope only. Revisit regulatory posture before any paid/institutional track.
- **Render budget**: stable 60 fps on iPhone 12; no crash / lag / screen sleep through 30-minute sessions

## Key Decisions

<!-- Decisions that constrain future work. Add throughout project lifecycle. -->

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Pivot to neonatal-only for v1 (NeoSim) | Focused audience (NRP instructors), tighter scope, de-risks MVP | — Pending |
| Drop Capno / EtCO₂ / Temp / Resp-rate tiles | Not used in neonatal golden-hour assessment; simplifies display + engine | — Pending |
| APGAR timer + scoring is required centerpiece | Differentiator vs generic sims; unique to neonatal training | — Pending |
| Rhythm set: sinus / brady / tachy / asystole only | Clinical relevance; adult arrhythmias have no NRP teaching value | — Pending |
| Web PWA, free, no auth | Distribution simplicity, legal safety, no storage surface | — Pending |
| Split routes `/monitor/[id]` + `/control/[id]` with Pusher | Mirrors real distributed monitors; decouples render from control | — Pending |
| Waveform samples generated locally on monitor | Keeps message rate to 1–10 msg/s; matches real clinical systems | — Pending |
| Use `design/` as visual + UX lock, not code base | Prototype is CDN-Babel and won't ship; real build is clean Next.js | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-20 after initialization*
