# Feature Research

**Domain:** Neonatal resuscitation monitor simulator (web PWA, NRP training)
**Researched:** 2026-04-20
**Confidence:** HIGH (clinical parameters sourced to NRP 8th edition / AAP / AHA; competitor features sourced to vendor docs)

---

## Executive Summary

NeoSim is a *monitor simulator*, not a *mannequin simulator*. The competitive set splits cleanly into two camps:

1. **Hardware mannequins** (Laerdal SimNewB, Gaumard Super Tory) — $30k–$75k, physical neonatal dolls with servo-driven movement, ventilator response, and a separate "monitor view" app. They solve the *airway/chest-compression* half of NRP.
2. **Software-only monitor apps** (R-Sim Premium, SimPL, SimMon, SimVitals, ResusMonitor) — $0–$30 one-time, phone/tablet apps that render vitals. They solve the *recognition/response-to-numbers* half of NRP.

**NeoSim sits in camp 2, narrowed to neonatal-only.** That choice produces the differentiators:

- **APGAR as the centerpiece** — no competitor in camp 2 makes APGAR a first-class timer+scoring workflow. The hardware sims don't either (instructor eyeballs the mannequin and writes on paper). This is our wedge.
- **Dawson-curve-aware SpO₂ coaching** — preductal SpO₂ targets ramp from 60% at 1 min to 95% at 10 min. Generic monitor apps use a fixed alarm line (e.g., <90 = low), which is clinically *wrong* for a 90-second-old newborn. Teaching instructors/learners to read the minute-of-life context is a correctness differentiator.
- **Neonatal-correct rhythm trim** — dropping AFib/VT/VF/PVCs isn't a limitation, it's a feature. Neonatal arrest is almost always asphyxial bradycardia → asystole; adult dysrhythmias have zero NRP teaching value and clutter the rhythm picker.
- **Two-device web PWA, free, no signup** — beats camp 2 on distribution (no App Store friction, works on any phone/tablet/laptop, instructor on separate device is the default not an upgrade).

**Table-stakes risk:** We must not ship something that *feels* less capable than SimPL on the things sim-lab instructors expect to see (rhythm picker, alarm thresholds, NIBP cycle, preset scenarios). The design prototype already hits that bar — keep it there.

**Anti-feature discipline:** Defibrillator/pacer, 12-lead, scenario scripting, event log, trends graph, and user accounts are explicitly out. They're either clinically inappropriate (defib on a neonate in NRP is wrong — NRP does not use defibrillation as a standard intervention; bradycardia is resolved with ventilation and compressions), out of scope for "golden hour" recognition training, or regulatory/legal hazards (persisted patient data → PHI-adjacent surface).

---

## Feature Landscape

### Table Stakes (Users Expect These)

Missing any of these = sim-lab instructor rejects the product within 30 seconds.

| Feature | Why Expected | Complexity | Clinical-correctness flag | Notes |
|---------|--------------|------------|---------------------------|-------|
| **HR numeric tile (green)** | Universal monitor convention; #1 vital in NRP algorithm | S | — | Large, monospace, green, with rhythm sub-label. Must show `--` on asystole. |
| **SpO₂ numeric tile (cyan)** | Universal; second most-driven vital in NRP | S | ⚠ Targets are *minute-of-life dependent* (see Dawson curve below) | Label as "Preductal · RIGHT HAND" — clinically correct placement. |
| **ECG Lead II waveform (green)** | Learners need a *moving line* to feel like a real monitor. Numbers alone won't pass the smell test. | M | — | 250 Hz sample, 25 mm/s sweep speed (standard clinical paper speed). Sweep-draw on Canvas. |
| **SpO₂ plethysmograph waveform (cyan)** | Same — amplitude cues perfusion quality | M | — | 100 Hz sample. Amplitude should drop visibly at low SpO₂ (teaches "poor perfusion" recognition). |
| **NIBP tile (sys/dia/MAP, white)** | Standard neonatal monitor layout | S | — | MAP in parentheses. Cuff-inflating animation + dash display during cycle is a realism must. |
| **Cardiac rhythm picker** | Every competitor has one; absence = toy | S (for 4 rhythms) | ⚠ Rhythm set must be *neonatal-appropriate* | See "Neonatal rhythm trim" below. Sinus / Brady / Tachy / Asystole only. |
| **Neonatal-threshold alarms (visual)** | Flashing tile + banner is the universal alarm grammar | S | ⚠ Thresholds must be neonatal, not adult | HR < 100 = LOW (medium priority); HR < 60 = CRITICAL (high priority). See "Alarm thresholds" below. |
| **Alarm audio (synthesized)** | Silent monitor is immersion-breaking | M | Advisory — see IEC 60601-1-8 note | Three distinct tones (high/med/low). Web Audio raw for timing precision. |
| **Heartbeat beep synced to R-wave** | Iconic monitor sound; absent = doesn't feel real | M | — | Tone pitch optionally shifts with SpO₂ (low-sat = lower pitch) — standard clinical convention. |
| **NIBP manual + auto-cycle (3/5/10 min)** | Real monitors always offer this | S | — | 15-min option can be dropped (less relevant in acute resuscitation). |
| **Session join code + QR** | "No signup" promise requires *something* to pair on | S | — | 6-char alphanumeric, case-insensitive. QR on instructor view → camera on monitor view, or vice versa. |
| **Fullscreen landscape monitor view** | Phone/tablet at warmer must *look like a monitor*, not a web page | M | — | PWA manifest, `apple-mobile-web-app-capable`, Screen Orientation API. iOS is the hard case. |
| **Wake Lock (no screen sleep)** | 30-min scenario with a black screen at minute 4 = unusable | S | — | iOS 16.4+ only; desktop has it; test on target iPhone 12. |
| **"Not a medical device" disclaimer** | Not technically table-stakes for users, but *absolutely* table-stakes for legal sanity | S | — | Landing + monitor chrome + footer. |
| **< 200 ms instructor-to-monitor latency** | Anything slower breaks "instructor drives scenario" flow | M | — | Pusher Channels + local waveform gen. Measure end-to-end. |
| **Patient info header (name, bed/warmer, MRN)** | Monitors always show this; absence feels like a demo | S | — | Free-text, fictional, not persisted. |

### Differentiators (Competitive Advantage)

Where NeoSim beats the field.

| Feature | Value Proposition | Complexity | Clinical-correctness flag | Notes |
|---------|-------------------|------------|---------------------------|-------|
| **APGAR timer + scoring workflow** | No competing *monitor app* makes APGAR a centerpiece. Hardware sims leave it to paper. This is the NRP-specific wedge. | M | ⚠ Timer must be honest (real wall-clock), windows at 60 s / 300 s / 600 s | Timer lives on monitor view (visible to whole team at warmer); scoring panel lives on instructor (private). Windows flash/pulse at minute boundaries to prompt the team. Score log persists for session lifetime only. |
| **Timer windows as visual prompts** | Reinforces the *rhythm* of NRP assessment (score at 1, 5, 10 min). Teaching-by-design. | S | — | Minute-boundary pulse for ~15 s on both sides of the 1/5/10 mark. Window "open" state in design prototype already defines this. |
| **5-criterion APGAR panel (Appearance, Pulse, Grimace, Activity, Respiration)** | Forces learners through the mnemonic. Generic sims don't have this. | S | ⚠ Options must match AAP rubric (0 = blue/limp/absent/etc.) | Design prototype already has correct 0/1/2 × 5 grid. Port as-is. |
| **Dawson-curve-aware SpO₂ targets by minute** | Clinically *correct* preductal targets ramp (60/65/70/75/80/85/90 across minutes 1–10). Generic apps use a fixed low-alarm line and are wrong for early newborn transition. | M | ⚠⚠ **High clinical-correctness weight.** Must cite NRP source. | **v1 scope decision:** Display the target on the SpO₂ tile as contextual sub-text ("Target 1m: 60–65 %") driven by APGAR timer elapsed seconds. Defer *adaptive alarm threshold* (i.e., alarm only fires when SpO₂ < the minute-of-life target) to v1.x — it's a high-correctness feature but adds control-panel complexity. |
| **Neonatal quick-action presets** | One-tap "Vigorous / Hypoxic / Bradycardic / Meconium / Arrest" bundles HR+SpO₂+rhythm+NIBP. Generic "Stable / Code Blue" presets from adult sims don't map to NRP teaching. | S | ⚠ Preset values must be clinically plausible for each scenario | See "Quick-action presets" table below for exact starting values. |
| **Instructor-as-second-device by default** | SimPL offers it as "connect multiple devices"; NeoSim *designs around it*. Landing page sends instructor to `/control` and student to `/monitor` from the first tap. | M | — | Same session, two routes. Core architectural choice — don't let "single-device demo mode" erode this. |
| **Free, web-delivered, no signup, no install (optional PWA)** | R-Sim + SimPL cost $15–30 one-time, require App Store account, iOS-only. NeoSim works on any browser, instant. | M | — | Distribution wedge. Must be defended — no paywall in v1, no email capture, no analytics that look like tracking. |
| **Neonatal-correct rhythm set (4 rhythms, not 15)** | SimPL has 15 rhythms including VT/VF/Torsades; 12 of those are irrelevant to NRP and mislead students. Ours is *curated*, not *limited*. | S | ⚠ Justify publicly — "we removed adult arrhythmias because NRP arrest is bradycardic" | Communicate the curation: sub-label the rhythm picker "Neonatal set · per NRP 8th ed." |
| **R-wave-synced beep with pitch-drops-with-SpO₂** | Clinical-monitor convention; teaches auditory recognition of desaturation. | M | — | Optional toggle; on by default. |
| **Cuff-inflating animation during NIBP cycle** | Micro-realism detail most apps skip (just shows dashes). | S | — | Design prototype already specs this; port the animation. |

### Anti-Features (Explicitly NOT Building)

Features that look good on a feature-comparison spreadsheet but create problems.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Defibrillator / shock button** | Adult simulators have it; "complete monitor" expectation | **Clinically wrong for NRP.** NRP does not use defibrillation as part of the standard algorithm — neonatal arrest is resolved with ventilation and chest compressions, not shocks. Including a shock button invites incorrect practice. | If v1.x adds pediatric, reconsider there. For neonatal: omit entirely and explain. |
| **Pacer** | Same as above | Same — not part of NRP | Omit. |
| **12-lead ECG view** | "More data = better" instinct | Irrelevant to golden-hour neonatal care; adds a large UI surface; misleads learners into thinking 12-lead is part of NRP | Lead II only. |
| **Adult arrhythmias (AFib, VT, VF, Torsades, PVCs, AV blocks, ST changes)** | SimPL has 15 rhythms — feature-parity instinct | Clinically noise. Neonatal arrest mechanism is asphyxial (bradycardia → asystole), not dysrhythmic. Showing VT/VF on a neonate teaches wrong pattern recognition. | 4-rhythm curated set. Explain the curation prominently. |
| **Capnography (EtCO₂) tile + waveform** | Adult sims have it; "modern monitors show it" | Not part of the NRP golden-hour numeric assessment. A CO₂ *detector* (colorimetric) is used to confirm ET tube placement but is not a continuous display value. | Omit for v1. Revisit for v2 if instructors ask. |
| **Temperature tile** | Standard on clinical monitors | Temperature management in the delivery room is managed by warmer/swaddle/bag, not by reading a number. Simplifies tile grid significantly. | Omit. Reconsider for v2. |
| **Respiratory rate numeric tile** | Standard on clinical monitors | Respiratory effort in NRP is scored *clinically* (APGAR "Respiration" = observation of cry/effort), not read off a number. Displaying an RR value misdirects learners. | Omit numeric tile. APGAR respiration scoring on instructor panel covers it. |
| **User accounts / signup / email capture** | "How will you track users / build business?" | Friction kills "instant demo" use case; introduces auth surface; creates data-handling questions. | Session codes only. Measure usage via anonymous page events if anything. |
| **Scenario scripting (timed JSON scenarios that auto-progress)** | "Instructors want pre-built scenarios" | Large feature surface (editor, scheduler, pause/resume, scrub). Breaks "unscripted, instructor-driven" core value. Locks in a scenario-data schema that v2 will want to rethink. | Quick-action presets cover 80% of the need at 5% of the cost. Defer to v2. |
| **Trends graph / event log / post-scenario debrief export** | "Debrief is important in simulation" | Persistence surface → privacy questions. Large UI work. Debrief is typically done verbally at the warmer; the monitor doesn't need to replay. | Out of scope for v1. If added later, keep session-lifetime-only with no export. |
| **Multi-scenario / multi-student per instructor** | Sim lab with several warmers | Complex UI, complex session model, low-frequency use case | Instructor opens multiple browser tabs with different session codes. |
| **Imitation of a real monitor brand (Philips IntelliVue, GE CARESCAPE, Mindray)** | "Looks more real" | Trade-dress / design-patent risk. Confusion with real clinical devices. Legal exposure disproportionate to realism gain. | Generic NeoSim visual identity with same *conventions* (color coding, layout grammar, 25 mm/s sweep) but distinct typography/marks. |
| **Persisted patient data / "save patient"** | "Reuse patients across sessions" | PHI-adjacent. Requires a database. Undermines "no signup" stance. | Session-scoped only. Free-text, fictional, evaporates at session close. |
| **Monetization / paywall / "pro" features in v1** | Revenue instinct | Kills distribution wedge. NeoSim's differentiator is *free and web*. Monetize v2+ (institutional support, scenario packs) after adoption proven. | Free forever for v1. Document this publicly. |
| **Native iOS/Android apps** | "Apps feel better than web" | App Store review latency + $99/yr + duplicate build. PWA on iOS 16.4+ reaches 99% of the need. | Web PWA with home-screen install. |

---

## Neonatal Clinical Parameters (Correctness Reference)

These are the numbers that *must* be correct. Getting them wrong = the product is clinically misleading.

### Preductal SpO₂ Targets by Minute of Life (Dawson Curve, per NRP 8th ed / AHA 2020 Guidelines)

Target values displayed on the SpO₂ tile should be sourced from the APGAR timer's elapsed seconds.

| Minute of life | Target preductal SpO₂ |
|----------------|-----------------------|
| 1 min | 60–65 % |
| 2 min | 65–70 % |
| 3 min | 70–75 % |
| 4 min | 75–80 % |
| 5 min | 80–85 % |
| 10 min | 85–95 % |

**Implementation note:** v1 should *display* the current-minute target as sub-text on the SpO₂ tile (e.g., "Target 3m: 70–75 %"). v1.x can optionally *adapt the low-alarm threshold* to the current target. The latter is a correctness win but adds control-panel complexity and may confuse instructors who want to set fixed thresholds for teaching — so keep it configurable.

### Neonatal Heart-Rate Thresholds (NRP 8th ed)

| HR | NRP action | UI treatment |
|----|-----------|--------------|
| ≥ 100 bpm | Normal — continue routine care | No alarm |
| < 100 bpm | Start PPV within 60 s of birth | **Medium-priority alarm** (yellow flash, "HR LOW") |
| < 60 bpm after 30 s effective PPV | Start chest compressions (3:1 with PPV, 100–120 /min) | **High-priority alarm** (red flash, "HR CRITICAL") |
| Asystole | Continue resuscitation; consider termination at 10 min of no HR | **High-priority** (`--` display, "ASYSTOLE" banner) |

**Implementation note:** Thresholds match what the design prototype already implements in `monitorView.jsx` (`hr < 100` = low, `hr < 60` = critical). Confirm the default values in alarm config match NRP exactly. Do *not* default to adult thresholds (HR < 60 low / < 40 critical) — that's the most common mistake in generic monitor sims when adapted for peds/neo.

### Neonatal Cardiac Rhythm Trim (v1)

| Rhythm | NRP relevance | Include? |
|--------|---------------|----------|
| Normal Sinus | Baseline | ✅ |
| Sinus Bradycardia | Primary deterioration pattern in neonates (asphyxial) | ✅ |
| Sinus Tachycardia | Post-resuscitation, fever, pain, hypovolemia | ✅ |
| Asystole | End-stage NRP outcome; needed for 10-minute termination decision | ✅ |
| Atrial Fibrillation | Vanishingly rare in neonates | ❌ |
| Ventricular Tachycardia | Vanishingly rare; not an NRP teaching target | ❌ |
| Ventricular Fibrillation | Vanishingly rare; not defibrillated in NRP algorithm | ❌ |
| AV blocks / PVCs / ST changes | Not teaching targets for NRP | ❌ |

**Design prototype has 7 rhythms** including adult ones — **trim to 4 for v1**. The design file `controlView.jsx` lists AFib/VT/VF in `RHYTHMS` array; these must be removed or hidden before shipping. Keep the ECG template math generalized (so v2 pediatric mode can re-add them), but don't surface them in the neonatal picker.

### Alarm Priorities (IEC 60601-1-8 advisory, not binding)

NeoSim is not a medical device and is not required to comply with IEC 60601-1-8. However, adopting *close-but-distinct* tones has educational value (learners hear in training what they'll hear in clinical).

**Recommended stance for v1:** Three distinguishable tones (high/med/low), synthesized via Web Audio, *not* exact copies of IEC melody tones. Explicitly note in code comments that tones are "clinically-inspired, not IEC-compliant, for educational use only" to pre-empt any regulatory ambiguity. Frequency range and priority grammar (high = fast repeating, medium = slower, low = single advisory) should follow IEC conventions so learners' ears are tuned correctly.

---

## Quick-Action Presets (Neonatal Scenarios)

These are the scenario bundles from the design prototype. Each applies a set of vital changes in one tap. Confirmed clinically plausible for NRP teaching.

| Preset | Scenario | HR | SpO₂ | Rhythm | NIBP | Notes |
|--------|----------|----|------|--------|------|-------|
| **Vigorous** | Term newborn, good tone, strong cry | 140 | 92 (climbing) | Sinus | 70/40 | Scenario endpoint; use to reset after deterioration |
| **Hypoxic** | Central cyanosis, poor transition | 110 | 70 | Sinus | 65/38 | Teaches SpO₂ interpretation in context of minute-of-life |
| **Bradycardic** | HR < 100 — PPV indication | 80 | 65 | Sinus Brady | 55/30 | The primary NRP teaching moment |
| **Meconium** | Non-vigorous meconium-stained newborn | 95 | 72 | Sinus Brady | 60/35 | AAP 2022 update: no routine intubation/suction — PPV instead |
| **Arrest** | HR < 60 — compressions indication | 40 | 55 | Sinus Brady → Asystole | 40/20 | Highest-acuity teaching endpoint |

**Implementation note:** Presets should apply *transitionally* (smooth over 2–3 s) rather than jumping instantly, to avoid breaking the waveform illusion. Instructor can layer manual adjustments on top of a preset — presets are starting points, not locks.

---

## Session Pairing UX

Table-stakes bar: pairing must take < 10 seconds from tap-to-live.

**Recommended flow (v1):**

1. Instructor opens landing → taps "Start session" → lands on `/control/[abc123]`. Session code (`ABC123`) displayed prominently with QR.
2. Monitor device either:
   - Scans QR → camera → `/monitor/abc123`
   - Or: lands on landing → taps "Join" → types 6-char code → `/monitor/abc123`
3. Both devices connect to Pusher channel `session-abc123`. Handshake broadcasts presence so each side knows the other is connected.

**UX details:**
- Code is **6 characters, uppercase, unambiguous alphabet** (no O/0, no I/1/L) — Crockford base32 style.
- Code is **case-insensitive on entry**.
- Code display uses monospace, letter-spaced, *loudly* (18–24 px) — instructors read it aloud across a sim lab.
- QR encodes the full URL (`https://neosim.app/monitor/abc123`) — one-scan connect, no typing.
- **No device handoff or role swap in v1.** Instructor-is-instructor, monitor-is-monitor. If the instructor wants to see the monitor, they open it in a new tab — don't build a "switch role" button.

---

## Visual & Audio Conventions

### Visual (locked by design prototype; don't relitigate)

- **Background:** pure black (`#0a0a0c`) on monitor; light (`#f7f6f3`) on instructor
- **Color coding** (clinical convention, intentionally mirrors real monitors):
  - HR / ECG: green (`#3ee08f`)
  - SpO₂ / Pleth: cyan (`#4fd6e8`)
  - NIBP: white
  - APGAR: amber/yellow (`#f5d74a` on monitor, `#b7881a` on instructor) — intentionally distinct from alarm yellow
  - Alarms: red (high, `#ff4d5e`), orange (medium, `#ffb347`), cyan (low/advisory, `#4fd6e8`)
- **Typography:** JetBrains Mono for all numerics (tabular figures, sharp, technical), Inter for labels
- **Waveform sweep speed:** 25 mm/s equivalent (standard clinical paper speed)
- **Sample rates:** ECG 250 Hz, Pleth 100 Hz — enough fidelity for 60 fps render at common display densities without aliasing
- **Alarm visual grammar:** tile border + background flash at ~1 Hz for medium, ~2 Hz for high; banner pill at top of monitor with priority label

### Audio

- **Heartbeat beep:** 150–200 ms blip, pitch 800 Hz default, shifts down 50 Hz per 5 % SpO₂ drop below 95 % (clinical convention), triggered on R-peak detection from waveform gen
- **Alarm tones:** 3 priorities, synthesized via Web Audio `OscillatorNode` + envelope
  - High: repeating burst (5 pulses), ~440 Hz fundamental, fast repeat (~0.5 s gap)
  - Medium: 3-pulse burst, ~330 Hz, slower repeat (~2.5 s gap)
  - Low: single chirp, ~261 Hz, ~10 s repeat
- **"Tap to start" overlay** on monitor first load is mandatory for iOS Safari — Web Audio refuses to start without a user gesture

---

## Feature Dependencies

```
Session pairing (code + QR + Pusher channel)
    ├──required by──> Instructor panel ──drives──> Monitor display
    └──required by──> Monitor display

HR numeric tile
    ├──depends on──> Rhythm picker (HR may be forced to 0 by asystole)
    └──required by──> Heartbeat beep (needs R-peak events)

ECG waveform
    ├──depends on──> Rhythm set (template per rhythm)
    └──required by──> Heartbeat beep (R-peak detection source)

SpO₂ tile
    └──enhanced by──> APGAR timer (minute-of-life → target sub-text)

Alarm system
    ├──depends on──> Threshold config (neonatal defaults)
    ├──depends on──> Web Audio unlock ("tap to start")
    └──visualizes via──> Alarm banner + tile flash

APGAR timer (monitor)
    ├──required by──> APGAR scoring panel (instructor) — window prompts
    └──enhances──> SpO₂ tile (minute-of-life target display)

Quick-action presets
    └──composes──> HR + SpO₂ + Rhythm + NIBP (atomic state transition)

PWA install + Wake Lock + Fullscreen + Orientation lock
    └──collectively required for──> "Feels like a real monitor at the warmer"
       (missing any one = illusion breaks)

Disclaimer
    └──required everywhere──> Landing + monitor chrome + control chrome
       (legal, not user-facing polish)
```

---

## MVP Definition

### Launch With (v1 — what the first milestone ships)

**Monitor (`/monitor/[sessionId]`):**
- [x] Three-tile numeric grid: HR, SpO₂, NIBP
- [x] Two waveforms: ECG Lead II, SpO₂ pleth (sweep-draw Canvas 2D, 60 fps)
- [x] APGAR timer (start / pause / resume / reset) with 1/5/10-min window highlights
- [x] Alarm banner + tile flashing at neonatal thresholds
- [x] Audio: R-wave beep + 3-priority alarm tones
- [x] Patient info header, session ID footer, clock, "not a medical device" disclaimer
- [x] NIBP cuff-inflating animation on cycle
- [x] Fullscreen, landscape-lock, Wake Lock, PWA install, "tap to start" audio unlock

**Instructor (`/control/[sessionId]`):**
- [x] Session code display + QR
- [x] HR slider, SpO₂ slider, NIBP sys/dia sliders (auto-compute MAP)
- [x] Rhythm picker (4 neonatal rhythms)
- [x] 5 quick-action presets (Vigorous / Hypoxic / Bradycardic / Meconium / Arrest)
- [x] NIBP cycle controls (now + auto-cycle off/3/5/10 min)
- [x] APGAR scoring panel (5 criteria × 0/1/2, sum to window)
- [x] Connection status indicator

**Infrastructure:**
- [x] Pusher Channels wire sync, < 200 ms p95 latency
- [x] Deployed to Vercel with HTTPS (Wake Lock prerequisite)
- [x] Landing page with create-session + join-by-code + disclaimer

### Add After Validation (v1.x — fast-follows if instructor feedback asks)

- [ ] **Adaptive SpO₂ alarm threshold** driven by APGAR minute-of-life — high clinical-correctness win, but deferred because it couples alarm logic to APGAR timer state (non-trivial)
- [ ] **Alarm threshold editor on instructor panel** — defaults are neonatal, but let instructors override for special teaching cases
- [ ] **Artifact toggles** (lead-off, low-perfusion) — useful teaching, low implementation cost
- [ ] **Respiratory effort indicator** (non-numeric — e.g., "Apneic / Weak / Good cry" dropdown that shows as chest-rise-rate animation) — bridge between "no RR tile" and "APGAR respiration is important"
- [ ] **Instructor preview of monitor** (live thumbnail on control panel) — reduces instructor context-switching
- [ ] **Demo mode** (self-driving monitor with no session) — marketing/landing-page value

### Future Consideration (v2+)

- [ ] Scenario scripting (JSON-defined, timed, pause/scrub)
- [ ] Trends graph (last 30 min)
- [ ] Event log + exportable debrief (requires persistence decision first)
- [ ] Pediatric mode (re-introduce adult arrhythmias behind a mode switch)
- [ ] Temperature tile (if instructor demand materializes)
- [ ] Capnography / CO₂ detector animation (for intubation confirmation teaching)
- [ ] Multi-language (Thai, Spanish — large NRP markets outside US)
- [ ] Institutional tier (paid, scenario packs, cohort tracking) — revisit *only* after v1 adoption is proven

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority | Rationale |
|---------|------------|---------------------|----------|-----------|
| ECG + SpO₂ waveforms at 60 fps | HIGH | HIGH | P1 | Core realism; product fails without this |
| Neonatal rhythm set (4 rhythms) | HIGH | LOW | P1 | Cheap; differentiator |
| HR / SpO₂ / NIBP tiles | HIGH | LOW | P1 | Table stakes |
| APGAR timer + scoring | HIGH | MEDIUM | P1 | Core differentiator |
| Neonatal alarm thresholds | HIGH | LOW | P1 | Correctness |
| Alarm audio (3 priorities) | MEDIUM | MEDIUM | P1 | Immersion |
| R-wave beep | MEDIUM | MEDIUM | P1 | Immersion |
| Quick-action presets | HIGH | LOW | P1 | Instructor efficiency; differentiator |
| Session code + QR | HIGH | LOW | P1 | Table stakes for two-device |
| Pusher sync < 200 ms | HIGH | MEDIUM | P1 | Core value |
| Fullscreen / Wake Lock / PWA | HIGH | MEDIUM | P1 | Table stakes for iOS-at-warmer |
| NIBP cuff animation | MEDIUM | LOW | P1 | Cheap realism win |
| Disclaimer surfaces | HIGH (legal) | LOW | P1 | Non-negotiable |
| SpO₂ minute-of-life target display | HIGH | MEDIUM | P1 | Differentiator; clinical correctness |
| Adaptive SpO₂ alarm threshold | MEDIUM | MEDIUM | P2 | Couples to APGAR timer; v1.x |
| Instructor alarm threshold editor | MEDIUM | LOW | P2 | Defaults are good; editor is a nice-to-have |
| Artifact toggles (lead-off, low-perf) | MEDIUM | MEDIUM | P2 | Teaching value; defer |
| Demo mode (self-driving) | LOW (for users) / HIGH (for marketing) | LOW | P2 | Marketing, not a training feature |
| Scenario scripting | MEDIUM | HIGH | P3 | Big surface, low-frequency need |
| Trends graph | LOW | MEDIUM | P3 | Debrief happens verbally |
| Event log / export | LOW | MEDIUM | P3 | Persistence trigger |
| 12-lead, defib, pacer | NEGATIVE | HIGH | ❌ | Clinically wrong for NRP |
| Adult arrhythmias | NEGATIVE | LOW | ❌ | Clinically noise |
| Capno / Temp / RR tiles | LOW | LOW | ❌ | Not NRP golden-hour |
| User accounts | NEGATIVE | HIGH | ❌ | Kills distribution wedge |

**Priority key:**
- **P1** — Ship in v1 (milestone 1). Absence blocks launch.
- **P2** — Fast-follow in v1.x. Absence is a known gap, not a blocker.
- **P3** — v2+. Requires a new decision, not just more work.
- **❌** — Deliberately not building. Listed to prevent re-adding.

---

## Competitor Feature Analysis

| Feature | SimPL (iOS/Android, paid) | R-Sim Premium (iOS, paid) | Laerdal SimNewB (hardware, $30k+) | Gaumard Super Tory (hardware, $75k+) | NeoSim (v1) |
|---------|---------------------------|---------------------------|-----------------------------------|---------------------------------------|-------------|
| Rhythm set | 15 (adult + peds mix) | 10+ (adult-focused) | Instructor-driven, scenario-based | Instructor-driven, scenario-based | **4 (neonatal-curated)** |
| APGAR timer | ❌ | ❌ | Paper/external | Paper/external | **✅ Centerpiece** |
| APGAR scoring panel | ❌ | ❌ | ❌ | ❌ | **✅ 5-criterion on instructor** |
| Preductal SpO₂ minute-of-life targets | ❌ (fixed alarms) | ❌ | N/A (mannequin has pre/postductal sensors) | ✅ (pre/postductal SpO₂ sites) | **✅ Display on tile** |
| Neonatal alarm thresholds | ❌ (user must configure) | ❌ | ✅ | ✅ | **✅ Default neonatal** |
| Two-device (control + monitor) | ✅ (optional "connect device") | ✅ | ✅ (SimPad + monitor app) | ✅ (UNI 3 interface + monitor) | **✅ Default** |
| Web-delivered | ❌ (App Store) | ❌ (App Store) | ❌ (hardware) | ❌ (hardware) | **✅ PWA** |
| Free | ❌ ($15–30) | ❌ | ❌ ($30k+) | ❌ ($75k+) | **✅** |
| No signup | N/A (App Store account) | N/A | Vendor account | Vendor account | **✅** |
| Quick-action neonatal presets | Generic (Stable/Code Blue) | Generic | Scenario library | Scenario library | **✅ NRP-specific** |
| Waveforms | ECG + SpO₂ + capno + art line | ECG + SpO₂ + capno | ECG via external monitor | ECG via external monitor | ECG + SpO₂ |
| Scenario scripting | ❌ | Limited | ✅ (SimCapture debriefing) | ✅ (UNI 3 + SLE scenarios) | ❌ (v2) |
| Physical airway / PPV / compressions | N/A | N/A | ✅ | ✅ | N/A (scope: monitor only) |
| IEC 60601-1-8 alarm compliance | Unclear | Unclear | N/A (not a medical device) | N/A (not a medical device) | Educational-inspired, not compliant |

**Key takeaway:** NeoSim doesn't compete with hardware mannequins — they solve a different problem (airway/compressions on a physical doll). It competes with SimPL/R-Sim, and wins on:
1. Neonatal specificity (curated rhythms, APGAR, preductal SpO₂)
2. Distribution (free, web, no App Store)
3. Pedagogy (APGAR workflow as first-class, not a footnote)

Where we *don't* compete: scenario scripting (deferred to v2) and the breadth of rhythms (we're intentionally narrower).

---

## Clinical-Correctness Risk Register

Features where getting the numbers wrong = the product is clinically *misleading*. Each needs a code-level constant + a test + a source comment.

| Feature | Correct value | Source | Risk if wrong |
|---------|---------------|--------|---------------|
| HR low-alarm threshold | < 100 bpm | NRP 8th ed (AAP 2021) | Adult default (< 60) teaches wrong recognition |
| HR critical-alarm threshold | < 60 bpm | NRP 8th ed | Adult default (< 40) → compressions delayed |
| Preductal SpO₂ 1 min target | 60–65 % | NRP / Dawson et al. | Default < 90 alarm at 1 min → learner over-oxygenates |
| Preductal SpO₂ 5 min target | 80–85 % | NRP / Dawson | Same risk, mid-transition |
| Preductal SpO₂ 10 min target | 85–95 % | NRP / Dawson | Same risk, late transition |
| APGAR scoring options | 0/1/2 per criterion, 5 criteria | AAP Committee Opinion 644 / ACOG | Wrong rubric mislearns the mnemonic |
| APGAR windows | 60 s / 300 s / 600 s | AAP | Wrong windows break learner habituation |
| Rhythm set for NRP | Sinus / Brady / Tachy / Asystole | NRP 8th ed (arrest is asphyxial) | Including VT/VF teaches wrong arrest mechanism |
| NIBP ranges | Neonatal typical: sys 50–75, dia 30–50 | NRP / AAP neonatal reference | Adult ranges (120/80) teach wrong normal |
| Alarm priority grammar | High = continuous urgent, Medium = 3-burst, Low = single | IEC 60601-1-8 (advisory) | Wrong grammar → learners misprioritize in real clinical |

All of these must be **code constants with source-cited comments**, not magic numbers inline.

---

## Sources

**NRP / clinical:**
- [Part 5: Neonatal Resuscitation — AHA](https://cpr.heart.org/en/resuscitation-science/cpr-and-ecc-guidelines/neonatal-resuscitation)
- [NRP Algorithm: Neonatal Resuscitation Guide](https://aclscertification.org/neonatal-resuscitation-algorithm/)
- [NRP algorithm with timeline (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC10432944/)
- [Heart Rate Assessment during Neonatal Resuscitation (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC7151423/)
- [Neonatal Resuscitation Program 8th edition updates (SlideShare)](https://www.slideshare.net/slideshow/neonatal-resuscitation-program-8-th-edition-updates/250215872)
- [2026 Neonatal Study Guide — National CPR Association](https://www.nationalcprassociation.com/neonatal-resuscitation-study-guide/)
- [AHA/AAP Neonatal Resuscitation Algorithm PDF](https://cpr.heart.org/-/media/CPR-Files/CPR-Guidelines-Files/Algorithms/AlgorithmNeonatal_Resuscitation_200615.pdf?sc_lang=en)

**APGAR:**
- [The Apgar Score — ACOG](https://www.acog.org/clinical/clinical-guidance/committee-opinion/articles/2015/10/the-apgar-score)
- [The Apgar Score — AAP Pediatrics](https://publications.aap.org/pediatrics/article/136/4/819/73821/The-Apgar-Score)
- [APGAR Score — StatPearls / NCBI](https://www.ncbi.nlm.nih.gov/books/NBK470569/)
- [Apgar score — Wikipedia (corroboration only)](https://en.wikipedia.org/wiki/Apgar_score)

**Meconium / non-vigorous newborn:**
- [Management of non-vigorous newborns — AAP SONPM](https://www.aap.org/en/get-involved/aap-sections/sonpm/management-of-non-vigorous-newborns-born-through-meconium-stained-amniotic-fluid/)
- [NICU Admissions for MAS pre/post NRP guideline change (MDPI)](https://www.mdpi.com/2227-9067/6/5/68)

**Alarm standards:**
- [IEC 60601-1-8 AMD2:2020 medical alarms — GlobalSpec](https://insights.globalspec.com/article/20598/iec-60601-1-8-amd2-2020-medical-alarms-and-faqs)
- [IEC 60601-1-8 Guidance — DigiKey](https://www.digikey.com/en/articles/iec-60601-1-8-guidance-for-designing-medical-equipment-alarms)
- [A Guide to IEC 60601-1-8 — Same Sky](https://www.sameskydevices.com/blog/a-guide-to-iec-60601-1-8-and-medical-alarm-systems)

**Competitor products:**
- [Laerdal SimNewB](https://laerdal.com/us/products/simulation-training/obstetrics-pediatrics/simnewb)
- [Gaumard Super TORY S2220](https://www.gaumard.com/supertory)
- [SimPL Patient Monitor — App Store](https://apps.apple.com/us/app/simpl-patient-monitor/id1444987255)
- [SimPL official site](https://www.simplmonitor.com/)
- [R-Sim Premium — App Store](https://apps.apple.com/th/app/r-sim-premium/id1265823798)
- [SimMon / ResusMonitor / SimVitals (secondary competitors)](https://simmon-app.com/)

**SpO₂ / Dawson curve:**
- [MyEMCert NRP Clinical Policy Alert (ABEM, 2025)](https://www.abem.org/wp-content/uploads/2024/07/key-advances_-nrp_clinical-policy-alert.pdf)
- [Neonatal resuscitation adhering to SpO₂ guidelines (Nature Pediatric Research)](https://www.nature.com/articles/pr2015259)
- [Oxygen saturations in premature infants at resuscitation (OAText)](https://www.oatext.com/Oxygen-saturations-in-premature-infants-at-resuscitation-Where-is-the-evidence.php)
- [Nellcor NICU Guidelines — Medtronic](https://www.medtronicsolutions.com/nellcornicuguidelines)

**Project artifacts read:**
- `/Users/onlypaul/Workspace/neosim/.planning/PROJECT.md`
- `/Users/onlypaul/Workspace/neosim/patient-monitor-simulator-prd.md` (§6 Feature scope)
- `/Users/onlypaul/Workspace/neosim/design/src/controlView.jsx` (APGAR + quick-action shape, rhythm picker — note: currently includes 7 rhythms, must trim to 4 for v1)
- `/Users/onlypaul/Workspace/neosim/design/src/monitorView.jsx` (tile grid, alarm rules — thresholds already neonatal-correct: HR<100 low / HR<60 critical, SpO₂<90 low / SpO₂<85 critical)

---

*Feature research for: neonatal monitor simulator (NeoSim v1)*
*Researched: 2026-04-20*
*Confidence: HIGH on clinical parameters, HIGH on competitor set, MEDIUM on specific alarm-tone implementation choices (IEC is advisory for educational use)*
