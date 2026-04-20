# Project Research Summary

**Project:** NeoSim — Neonatal Monitor Simulator (PWA)
**Domain:** Web-delivered, two-device realtime-synced clinical-training simulator (iOS-first PWA, Canvas 60 fps, Web Audio, Pusher realtime, neonatal/NRP clinical correctness)
**Researched:** 2026-04-20
**Confidence:** HIGH

## Executive Summary

NeoSim is a *monitor-only* neonatal simulator in a crowded-but-mis-targeted market. Hardware mannequins (Laerdal, Gaumard) solve airway/compressions; mobile apps (SimPL, R-Sim) solve recognition-of-numbers but are adult-first, paid, and App-Store-gated. NeoSim wins by being **neonatal-correct** (curated rhythm set — sinus/brady/tachy/asystole only — NRP-specific alarm thresholds, Dawson-curve SpO₂ targets, APGAR as a first-class workflow), **free and web-delivered** (PWA, no signup), and **two-device by default** (instructor → monitor over Pusher, < 200 ms). The design prototype in `design/` already locks the visual and UX language; the real build is a clean Next.js App Router port.

The recommended implementation is Next.js **15.5** (not 14 as PRD states; not 16 which adds async `params`/`headers` breakage), React 19, Zustand v5, raw Canvas 2D (no chart library), raw Web Audio (no Howler/Tone), Tailwind v4 + shadcn/ui for the instructor panel, Pusher Channels (Sandbox tier = **200 concurrent / 200k msg/day** — PRD's "100/200k" is stale) for sync, Zod v4 at the wire boundary, Vercel for hosting. The architecture is single-writer diff propagation (instructor owns state, monitor is a read-only replica) with a shared-epoch APGAR timer (no tick broadcast — both sides derive from `startedAt`). All three research files converge on this shape.

The three concentrated risk areas are **iOS platform reality**, **clinical correctness**, and **realtime-sync robustness**. iOS Safari does not support programmatic orientation lock on iPhone, `display: fullscreen` is not honored on iPhone PWA, Wake Lock in installed Home-Screen apps only works reliably from **iOS 18.4+** (per WebKit #254545 — earlier installed PWAs silently fail), Web Audio is muted by the hardware silent switch unless unlocked with the `<audio>` element trick, and backgrounded tabs silently kill WebSockets. Clinical correctness requires neonatal thresholds (HR < 100 low, < 60 critical — not adult HR < 60 low) hard-coded as cited constants in `lib/clinical/nrp.ts`, plus Dawson-curve preductal SpO₂ targets, plus quick-action presets that walk through the HR bands rather than jumping. Realtime sync must use snapshot-on-join + periodic snapshot heartbeats + monotonic seq IDs (Pusher does not replay missed messages), instructor-authoritative APGAR state, and re-anchor timers on `visibilitychange → visible`. All three risk areas are manageable but demand dedicated phases — they cannot be retrofitted as "polish."

## Key Findings

### Recommended Stack

Next.js 15.5 on Vercel, with Pusher Channels for realtime sync and a raw Canvas 2D / raw Web Audio rendering stack on the monitor. PRD is broadly correct; four corrections are locked below.

**Core technologies:**
- **Next.js 15.5** (App Router, Turbopack) — stable production sweet spot April 2026. Upgrade to 16 after MVP. (PRD said 14 — too old. 16 forces `params`/`headers` async rewrite — not worth the churn for a 2–3 week build.)
- **React 19 + TypeScript 5.6 strict** — bundled with Next 15; `useSyncExternalStore` native for Zustand v5.
- **Zustand v5** — two local stores (vitals + alarms) with selector subscriptions; critical so numeric tiles don't re-render on unrelated vitals changes.
- **Raw Canvas 2D (no library)** — sweep-draw ECG / pleth via `Float32Array` circular buffer; Pixi/Konva/D3/Recharts all rebuild scenes per frame and will thrash iPhone GC.
- **Raw Web Audio API (no library)** — `AudioContext.currentTime` lookahead scheduler for R-wave beep and IEC-inspired-but-distinct alarm tones. Howler/Tone hide the timing primitives we need.
- **Pusher Channels (Sandbox tier)** — 200 concurrent / **200k msg/day** (not 100 — PRD figure is out of date), ~35 KB client bundle, managed WSS, zero Vercel WebSocket limitation. Abstract behind `lib/sync/transport.ts` so swap to Ably is one file.
- **Tailwind v4 + shadcn/ui** — instructor panel only; monitor stays in inline styles matching the design prototype.
- **Zod v4** — wire-message validation; 6.5× faster parse vs v3; single source of truth for wire types via `z.infer`.

**Four PRD corrections locked:**
1. Next.js: ship on **15.5**, not 14, not 16.
2. Pusher free tier: **200 concurrent / 200k msg/day**, not 100/200k.
3. `apple-mobile-web-app-capable` is deprecated — use `mobile-web-app-capable` + `manifest.json display: standalone` + `apple-mobile-web-app-status-bar-style: black-translucent`.
4. Wake Lock in installed iOS PWA only works from **iOS 18.4+** — this is a v1 support-matrix decision: either raise the floor to iOS 18.4, or ship a UI fallback ("keep screen tapped") for iOS 16.4–18.3 installed PWAs.

See `.planning/research/STACK.md` for full detail, alternatives considered, and iOS-gotcha table per choice.

### Expected Features

**Must have (table stakes — absence = instructor rejects the product):**
- HR (green), SpO₂ (cyan), NIBP sys/dia/MAP (white) numeric tiles — standard monitor grammar
- ECG Lead II waveform (250 Hz) + SpO₂ pleth (100 Hz), sweep-draw 60 fps
- Cardiac rhythm picker — **4 rhythms: Sinus / Sinus Brady / Sinus Tachy / Asystole** (PRD, FEATURES, ARCHITECTURE all agree; design prototype's 7 rhythms must be trimmed — VT/VF/AFib explicitly dropped)
- Neonatal alarm thresholds (HR < 100 low, HR < 60 critical) — NOT adult defaults
- Alarm audio (3 priorities, Web Audio synthesized, distinct-from-IEC melodies)
- R-wave-synced heartbeat beep with pitch-drops-with-SpO₂
- NIBP cuff-inflating animation + manual/auto-cycle (3/5/10 min)
- Session join code (6-char — upgrade to 8-char with 36-char alphabet pre-public-launch) + QR
- Fullscreen landscape monitor + Wake Lock + PWA install + "tap to start" audio unlock
- "Not a medical device" disclaimer (landing + monitor chrome + footer)
- < 200 ms instructor-to-monitor latency

**Should have (differentiators vs SimPL / R-Sim):**
- APGAR timer + 5-criterion scoring panel with 1/5/10 min milestone windows — centerpiece, no competitor has this
- Dawson-curve-aware SpO₂ minute-of-life target display (e.g., "Target 3m: 70–75%") driven off APGAR elapsed
- Neonatal quick-action presets (Vigorous / Hypoxic / Bradycardic / Meconium / Arrest) that walk through HR bands, not jump
- Instructor-as-second-device by default (not a bolt-on)
- Free, web PWA, no App Store, no signup

**Defer (v1.x fast-follow):**
- Adaptive SpO₂ alarm threshold tied to minute-of-life (high correctness win, couples to APGAR state)
- Instructor-editable alarm thresholds, artifact toggles (lead-off, low-perfusion)
- Demo mode (self-driving monitor for marketing)

**Defer (v2+):**
- Scenario scripting, trends graph, event log / debrief export, pediatric mode, temperature tile, capnography, multi-language, institutional/paid tier

**Explicitly not building (legal/clinical reasons, listed to prevent re-adding):**
- Defibrillator / pacer (not part of NRP algorithm)
- 12-lead ECG (irrelevant to golden-hour)
- Adult arrhythmias (AFib/VT/VF/Torsades/PVCs — clinically wrong for neonatal)
- Imitation of Philips / GE / Mindray trade dress
- Persisted patient data (PHI-adjacent)
- User accounts (kills distribution wedge)

See `.planning/research/FEATURES.md` for full matrix, competitor analysis, and clinical-correctness risk register.

### Architecture Approach

Two-client, one-broker topology. **Instructor is the source of truth** — mutations flow through Zustand → debounced POST → `/api/session/[id]/publish` → Pusher private-encrypted channel → monitor's replica Zustand store. Monitor never writes vitals state. The one nuance is the **APGAR timer**: broadcast `startedAt` / `pausedAt` / `marks` (5 messages per lifecycle, not 1/second), derive `elapsedMs` locally on both sides from `Date.now() - startedAt`. Waveform samples are synthesized locally on the monitor from parameters — never over the wire.

**Major components:**
1. **Waveform engine** (`lib/waveforms/*.ts`) — pure `(t, state, engineState) => {v, rPeak}` functions. Template-driven for sinus/brady/tachy, runtime for asystole. Phase/jitter state lives in `engine-state.ts`, NOT on the vitals store (prototype mutates the store in-place — do not carry that pattern over; it breaks on diff merge).
2. **Canvas renderer** (`components/monitor/WaveformChannel.tsx`) — DPR-aware (`canvas.width = cssW * dpr; ctx.scale(dpr, dpr)`), sweep-draw with `clearRect` of a narrow ahead-region. **One** RAF loop at `<MonitorScreen>` level dispatching to all channels, not per-component loops.
3. **Audio engine** (`lib/audio/*.ts`) — lazy `AudioContext` created on first user gesture, lookahead scheduler (not `setTimeout`), silent-MP3 trick to route past iOS mute switch.
4. **Sync layer** (`lib/sync/*.ts`) — `pusher-client.ts` wrapper, `messages.ts` Zod schemas, `protocol.ts` event names + snapshot/diff helpers. **Must `await` `pusher.trigger()` in Vercel route handlers** or the function closes before the message ships.
5. **Session API** (`app/api/session/*.ts`) — stateless; session = 6-char code + Pusher channel name; no DB.
6. **Stores** (`lib/state/*.ts`) — `vitals-store.ts`, `alarm-store.ts`, `apgar-store.ts` (separable lifecycle), `vitals-schema.ts` shared between control + monitor.

See `.planning/research/ARCHITECTURE.md` for full ASCII topology, data-flow diagrams, and anti-patterns.

### Critical Pitfalls

Ranked by severity and earliest blocking phase:

1. **Adult clinical thresholds applied to neonates (BLOCKER — clinical credibility).** Hard-code HR < 100 low, HR < 60 critical as neonatal constants in `lib/clinical/nrp.ts` with NRP 8th ed citations. `const HR_LOW = 60` would destroy the product. Quick-action presets must walk through the 60–100 band, not skip to zero.
2. **Wake Lock lost on tab blur / broken in installed PWA on iOS < 18.4 (BLOCKER — UX).** Re-acquire on `visibilitychange → visible`. Gate on iOS 18.4+ for installed PWA, or fall back to `NoSleep.js` video trick.
3. **Web Audio silenced by hardware mute switch (BLOCKER — sim lab default).** Play silent `<audio>` element inside the same user gesture that creates the `AudioContext`. Sim-lab iPhones are muted by default.
4. **Pusher does not replay missed messages on reconnect (HIGH — state divergence).** Every diff carries a monotonic `seq`; send full snapshot every 2–5 s; monitor re-requests snapshot if seq gap detected. On `visibilitychange → visible`, force reconnect check.
5. **R-wave beep drift via `setTimeout` (HIGH — realism).** Use web.dev "Tale of Two Clocks" lookahead scheduler on `AudioContext.currentTime`.
6. **Canvas sweep-draw ghosting at DPR=3 on iPhone 12 (HIGH — first-phase-blocker).** Clear-ahead width must be `ceil(sweep_px_per_frame) + line_width + 2` in CSS pixels AFTER DPR scale. Full-canvas clear defeats sweep-draw.
7. **Uncanny-valley trade-dress vs real monitors (BLOCKER — legal/safety).** Keep clinical color conventions (green/cyan/white/red); diverge on typography, tile geometry, alarm tones (not IEC-derivative), and keep a persistent "NEOSIM — EDUCATIONAL SIMULATOR — NOT A MEDICAL DEVICE" footer.
8. **Fullscreen / orientation lock not supported on iPhone PWA (HIGH — reality check).** Don't fight WebKit; use CSS "please rotate" overlay + `mobile-web-app-capable` install path + document the limitation.
9. **Pusher free-tier quota exhaustion at class scale (MEDIUM).** Debounce instructor mutations to 2 Hz max; snapshot heartbeat at 0.2 Hz. A 30-min session × 21 subscribers ≈ 84k deliveries (~40% of daily free quota).

See `.planning/research/PITFALLS.md` for all 21 pitfalls, recovery strategies, and per-phase prevention/verification matrix.

## Implications for Roadmap

Three research files converged on a six-phase structure with subtle differences in ordering. This synthesis resolves the disagreement in favor of **ARCHITECTURE's ordering** (iOS polish *before* sync), for the reasons given below.

### Phase 0 — Waveform Prototype on iPhone

**Rationale:** Highest-confidence-low-unknown de-risking move. The design prototype already demonstrates sweep-draw works; we need to prove it at DPR=3, 60 fps, sustained for a minute on iPhone 12 Safari. If it doesn't, everything downstream is wrong.
**Delivers:** One Next.js 15 client route with a DPR-aware `WaveformChannel` rendering sinus-only ECG, deployed to Vercel, opened on a real iPhone 12 home-screen PWA, with `performance.now()` FPS instrumentation.
**Addresses:** Table-stakes ECG waveform (FEATURES P1).
**Avoids:** Pitfall 4 (sweep-draw ghosting at DPR=3), Pitfall 5 (Low-Power-Mode → 30 fps — must be time-based not frame-based from day 1), Pitfall 13 (unbounded buffer).
**Components built:** `lib/waveforms/ecg.ts` (sinus template), `lib/waveforms/engine-state.ts`, `lib/waveforms/buffer.ts` (circular `Float32Array`), `components/monitor/WaveformChannel.tsx`, throwaway `app/prototype/page.tsx`.

### Phase 1 — Pusher Latency Spike

**Rationale:** Highest-*unknown*-risk item. Render perf is knowable from the prototype; real-world Pusher latency from iPhone Safari on cellular + Vercel cold start is not. The 200 ms hard budget can be blown by cold-starts alone. Better to fail fast on a two-page spike than to discover it after building the full instructor panel.
**Delivers:** Two throwaway pages (`/spike/a` and `/spike/b`) with a number input on A, number display on B, wired through Pusher. Measure `publishedAt → receivedAt` on real iPhone (wifi + cellular). Document median and p95.
**Addresses:** Latency constraint (< 200 ms end-to-end, from PROJECT.md).
**Avoids:** Discovering in phase 4 that cellular + free-tier Pusher + cold-start exceeds budget.
**Components built:** `lib/sync/pusher-client.ts`, `lib/sync/messages.ts` (minimal), `app/api/pusher/auth/route.ts`, `app/api/session/[id]/publish/route.ts` (with `await pusher.trigger()` — not optional).

### Phase 2 — Local Full Monitor

**Rationale:** With render and latency de-risked, this phase owns **clinical correctness** — neonatal thresholds, APGAR, presets, alarm audio. Per PITFALLS, this phase must walk through a clinical review before ship.
**Delivers:** Fully working monitor view at `/monitor/[sessionId]` backed by a local Zustand store (no sync yet). All tiles (HR, SpO₂, NIBP), both waveforms (ECG + pleth), four-rhythm picker, alarm system (visual + audio), R-wave beep, APGAR timer + milestone highlighting, NIBP cuff animation. Quick-action presets walk through clinical bands.
**Uses:** Zustand v5, Web Audio, raw Canvas 2D.
**Implements:** Waveform engine, canvas renderer, audio engine, vitals/alarm/APGAR stores.
**Addresses:** FEATURES table stakes + APGAR differentiator + Dawson-target display.
**Avoids:** Pitfall 1 (wake-lock re-acquire), Pitfall 2 (mute-switch silent-MP3 trick), Pitfall 3 (lookahead scheduler for beep), Pitfall 7 (CSS rotate overlay), Pitfall 9 (mandatory tap-to-start overlay), Pitfall 10 (neonatal thresholds hard-coded), Pitfall 18 (presets walk bands), Pitfall 20 (non-IEC alarm tones).

### Phase 3 — iOS Polish (before sync — see ordering rationale below)

**Rationale:** Wake Lock + manifest + standalone PWA + landscape-hint + audio-unlock + status-bar styling are **browser-platform-level** concerns easier to debug against a single-page local app than while simultaneously debugging Pusher timing. Also: the installed-PWA Wake Lock bug only manifests once home-screened; catching it here prevents tangling it up with sync bugs in phase 4. If we must raise the iOS floor to 18.4, better to know before building the landing + auth flow. FEATURES suggested polish *after* sync; ARCHITECTURE suggested *before*. **We take ARCHITECTURE's call** — it's load-bearing for debugging discipline.
**Delivers:** `public/manifest.webmanifest`, `public/icons/*`, `mobile-web-app-capable` + `apple-mobile-web-app-status-bar-style: black-translucent` meta tags, `useWakeLock` / `useFullscreen` / `useOrientationLock` hooks with visibility-change re-acquire, "tap to start" overlay that does audio unlock + silent-MP3 mute-switch trick + fullscreen + wake-lock + orientation-lock in one gesture. Persistent disclaimer strip.
**Addresses:** iOS PWA table stakes (FEATURES); support-matrix decision on iOS 16.4 floor vs 18.4 floor.
**Avoids:** Pitfall 1 (Wake Lock), Pitfall 6 (Fullscreen API unsupported — use install path), Pitfall 11 (persistent disclaimer), Pitfall 16 (install-vs-tab drift), Pitfall 17 (battery-drain UX copy).

### Phase 4 — Split + Sync

**Rationale:** With the monitor view validated locally, split into `/monitor/[id]` + `/control/[id]`, introduce the landing page, wire Pusher. This phase owns the **4 high-complexity items** that PITFALLS flagged as concentrated here: reconnection robustness, snapshot-on-join, channel auth (private channels), and instructor-authoritative APGAR timer with re-anchor.
**Delivers:** Landing page (session mint + join-by-code + QR), `/control/[sessionId]` instructor panel with shadcn components (sliders, rhythm picker, quick-action grid, APGAR scoring panel, connection-status indicator), full two-device flow, Pusher private-encrypted channels + Zod-validated wire protocol + snapshot-on-join + seq IDs + 2–5 s snapshot heartbeat. Rework monitor store to be a replica (not authoritative).
**Uses:** Pusher Channels, Zod, shadcn/ui, Tailwind v4, nanoid.
**Implements:** Publisher middleware, replica store, sync protocol, APGAR shared-epoch pattern.
**Addresses:** Two-device differentiator (FEATURES), latency constraint (PROJECT.md), APGAR two-device consistency.
**Avoids:** Pitfall 8 (reconnection drops), Pitfall 12 (APGAR clock drift), Pitfall 14 (quota — debounce to 2 Hz), Pitfall 15 (no channel auth — use private-encrypted), Pitfall 19 (backgrounded WebSocket), Pitfall 21 (blank-monitor-on-first-load — default vitals + "Connecting…" overlay).

### Phase 5 — Scenario-Day Hardening & Deploy

**Rationale:** Production-readiness work that can only be validated by running a full 30-minute scenario end-to-end on real devices. Catches emergent issues that short testing misses.
**Delivers:** 30-minute soak test on iPhone 12 (heap flat, no crash, Wake Lock holds, Pusher reconnects from forced airplane-mode toggle), iOS device matrix test (iPhone 12 iOS 16.4 / 17.x / 18.4+ / iPad landscape), clinical-correctness sign-off from an NRP instructor on all presets and alarm thresholds, battery-drain UX copy + install-guide docs, final landing copy + disclaimer legal review. Deploy to production Vercel domain.
**Addresses:** 30-min stability constraint (PROJECT.md); legal surface.
**Avoids:** Pitfall 11 (legal review), Pitfall 13 (memory leak verification), Pitfall 16 (install-vs-tab smoke test).

### Phase Ordering Rationale

- **Why P0 (waveform) first:** Render at 60 fps on DPR=3 iPhone is the most foundational assumption. Cheap to validate (one page, one evening); everything else depends on it.
- **Why P1 (Pusher spike) before P2 (local monitor):** PRD proposed local-monitor-then-sync. We move Pusher spike earlier because latency is the biggest *unknown*-risk item and needs a go/no-go before we commit to Pusher for phase 4. If spike fails, we swap to Ably in phase 4 without rework.
- **Why P3 (iOS polish) before P4 (sync) — the contested question:** ARCHITECTURE and PITFALLS both suggest platform work should land before sync, because (a) Wake Lock / fullscreen / audio-unlock are single-page concerns easier to debug without Pusher timing in the picture, (b) the installed-PWA Wake Lock bug only manifests once home-screened — catching it early prevents confusion with sync bugs, (c) the iOS 16.4 vs 18.4 support-matrix decision informs the landing-page "install to home screen" coach-mark copy that phase 4 writes anyway. FEATURES's implied "polish last" ordering is a common instinct but wrong for a hardware-platform-heavy app. **We take ARCHITECTURE's ordering.**
- **Why hardening (P5) is its own phase:** 30-minute soak tests, device-matrix coverage, and clinical sign-off are not marginal polish — they are the product. PROJECT.md's "stable 60 fps + no crash on iPhone 12+ for 30-min session" is a named acceptance criterion that requires instrumented verification.
- **Why these groupings (per PITFALLS' center-of-gravity framing):** P0 owns *engine shape* (waveform math + buffer + DPR). P2 owns *clinical correctness* (thresholds + presets + APGAR + audio). P4 owns *two-device distributed state* (snapshot + diff + reconnect + auth). Each phase has one conceptual center of gravity, making review focused.

### Research Flags

**Phases likely needing `/gsd-research-phase` during planning:**
- **Phase 1 (Pusher latency spike):** Pusher + Vercel + iOS Safari + free-tier cold-start interaction is sparsely documented. Worth a short research pass on current Vercel cold-start numbers (April 2026) and whether route-handler pre-warming tactics (edge runtime? keep-alive ping?) help.
- **Phase 3 (iOS polish):** The iOS 16.4 vs 18.4 installed-PWA support-matrix decision needs dedicated research — specifically, what fraction of NRP-instructor iPhones in Q2 2026 are on 18.4+, and whether the NoSleep.js video-hack fallback is acceptable UX for the remainder. The silent-MP3-unlock trick also deserves a spike against iOS 26 to confirm it still works.
- **Phase 4 (split + sync):** Pusher cache channels vs explicit snapshot protocol is a design decision that wasn't fully resolved (leans toward explicit snapshot). Small research pass before wire-protocol freeze.

**Phases with standard patterns (skip research-phase):**
- **Phase 0 (waveform prototype):** Sweep-draw Canvas + circular buffer is well-documented; prototype already exists to port from.
- **Phase 2 (local monitor):** Zustand patterns are canonical; clinical constants are already sourced to NRP 8th edition in FEATURES.md and PITFALLS.md. No more research needed, but a **clinical sign-off review** is required before phase 2 ships.
- **Phase 5 (hardening):** No new technical research; smoke-test checklist is already documented in PITFALLS "Looks Done But Isn't" section.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All sources cross-verified against official docs (Next.js, Pusher, Zustand, Tailwind, Zod). Four PRD corrections firmly sourced. Only real unknown is whether Pusher free-tier latency meets 200 ms budget in the wild — that's what phase 1 exists for. |
| Features | HIGH | Clinical parameters sourced to NRP 8th edition (AAP/AHA 2020), APGAR to ACOG Committee Opinion 644, competitor landscape to vendor docs. Rhythm trim (Sinus/Brady/Tachy/Asystole only) confirmed across all three research files. |
| Architecture | MEDIUM–HIGH | HIGH for stack-level patterns (App Router, Pusher, single-writer, sweep-draw) — verified against official docs. MEDIUM for APGAR shared-epoch design (no existing domain prior art; derived from PRD + distributed-system reasoning, but the math is straightforward and the design-prototype already demonstrates it). MEDIUM for iOS PWA edge cases (WebKit is a moving target). |
| Pitfalls | HIGH | iOS pitfalls cross-verified against WebKit bugs #254545 (Wake Lock) and #237322 (mute-switch). Clinical pitfalls sourced to NRP 8th ed. Pusher behavior sourced to official docs. |

**Overall confidence:** HIGH on recommended approach and feature scope. MEDIUM on specific phase 1 outcome (Pusher latency is empirically testable, not predictable).

### Gaps to Address

- **iOS 16.4 vs 18.4 support-matrix decision** — not research-resolvable; requires a product call. Flag for phase 3 planning with an NRP-instructor-install-base inquiry if possible. Default recommendation: target iOS 18.4+ as "fully supported," show a graceful-degradation hint on 16.4–18.3 installed PWAs ("Wake Lock may not hold — keep tapping").
- **Pusher free-tier latency on cellular from iPhone Safari** — empirical; resolved by phase 1 spike. If > 200 ms p95, swap to Ably before phase 4; the `lib/sync/transport.ts` abstraction makes this a one-file change.
- **Clinical sign-off** — none of the research substitutes for a practicing NRP instructor reviewing alarm thresholds, quick-action preset values, and the Dawson-curve display before phase 2 ships. Named acceptance gate.
- **Session-code space** — PRD says 6-char; PITFALLS flags that pre-public-launch it should be 8-char with 36-char alphabet. v1 beta is fine at 6-char if auth is via private-encrypted channels (phase 4); upgrade before public launch.
- **Vercel cold-start in April 2026** — the 40–80 ms POST round-trip estimate is a 2023–2024 number; worth a phase 1 re-measurement.
- **Waveform engine state decoupling** — design prototype mutates vitals state in-place for phase/jitter; decision logged (engine state lives in `lib/waveforms/engine-state.ts`, not the vitals store) but needs enforcement during phase 0 port.

## Sources

### Primary (HIGH confidence)
- Next.js official docs (v15 upgrade guide, v16 release notes, App Router project structure)
- Pusher Channels official docs (pricing, reconnection, cache channels, presence)
- Vercel KB (Pusher + Vercel integration, `await trigger` requirement)
- WebKit Bug #254545 (Wake Lock in installed PWA, fixed iOS 18.4) — authoritative
- WebKit Bug #237322 (Web Audio muted by silent switch) — authoritative
- Apple Safari 16.4 release notes (Wake Lock API added)
- Zustand v5 / Zod v4 / Tailwind v4 official release notes
- MDN — Canvas optimization, Page Visibility API, Autoplay guide
- web.dev — "A tale of two clocks" (Web Audio scheduling), Wake Lock, Canvas performance
- NRP 8th edition / AHA Neonatal Resuscitation Algorithm (thresholds, algorithm bands)
- AAP Pediatrics — APGAR Score; ACOG Committee Opinion 644 (APGAR rubric)
- Dawson et al. / Merck Manual neonatal SpO₂ target table (Dawson curve)

### Secondary (MEDIUM confidence)
- MagicBell — PWA iOS Limitations and Safari Support (2026 survey)
- firt.dev — iOS PWA compatibility notes
- vercel/next.js discussion #48433 — Pusher + Vercel `await` community solution
- Selcuk Guler (Medium) — Pusher + Next.js App Router pattern reference
- Competitor vendor sites (Laerdal SimNewB, Gaumard Super Tory, SimPL, R-Sim)
- IEC 60601-1-8 guidance (Digi-Key, Same Sky, AAMI)

### Tertiary (LOW confidence)
- Historical Mobile Safari WebSocket-on-background gist (indicative only; behavior may have evolved)
- Popmotion / Motion.dev blog posts on rAF throttling (broadly corroborated but not authoritative spec)
- Canvas engine benchmarks at benchmarks.slaylines.io (useful directionally)

### Project artifacts
- `/Users/onlypaul/Workspace/neosim/.planning/PROJECT.md`
- `/Users/onlypaul/Workspace/neosim/patient-monitor-simulator-prd.md`
- `/Users/onlypaul/Workspace/neosim/design/src/app.jsx`, `monitorView.jsx`, `controlView.jsx`, `waveforms.js`, `canvasChannel.jsx`
- `/Users/onlypaul/Workspace/neosim/.planning/research/STACK.md`
- `/Users/onlypaul/Workspace/neosim/.planning/research/FEATURES.md`
- `/Users/onlypaul/Workspace/neosim/.planning/research/ARCHITECTURE.md`
- `/Users/onlypaul/Workspace/neosim/.planning/research/PITFALLS.md`

---
*Research completed: 2026-04-20*
*Ready for roadmap: yes*
