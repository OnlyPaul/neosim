# Architecture Research — NeoSim

**Domain:** Two-device realtime-synced neonatal monitor simulator (PWA, instructor + display)
**Researched:** 2026-04-20
**Confidence:** HIGH for stack-level patterns (Next.js App Router, Pusher sync, Canvas sweep-draw — verified against official docs and prior art); MEDIUM for APGAR-timer ownership (no existing domain prior art — design is derived from PRD + distributed-system reasoning); MEDIUM for iOS PWA Wake Lock / fullscreen edge cases (historically buggy on installed PWAs, only reliably fixed in iOS 18.4 per WebKit bug #254545).

---

## Standard Architecture

### System Overview

NeoSim is a **two-client, one-broker** realtime topology. There is no application database and no server-authoritative game loop. Each client runs a local simulation at a different cadence (60 Hz render loop on the monitor, user-driven event stream on the control). They synchronize through a single Pusher channel per session.

```
┌───────────────────────────────────────────────────────────────────────────┐
│                         INSTRUCTOR DEVICE (control)                        │
│                                                                            │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                 │
│  │  Controls    │───▶│  VitalsStore │───▶│ Pusher diff  │                 │
│  │ (sliders,    │    │  (Zustand,   │    │  publisher   │                 │
│  │  presets,    │    │   SOURCE OF  │    │ (trigger on  │                 │
│  │  APGAR score │    │    TRUTH)    │    │  debounce)   │                 │
│  │  entry)      │    └──────┬───────┘    └──────┬───────┘                 │
│  └──────────────┘           │                    │                         │
│                             │ subscribes         │                         │
│                             ▼                    │                         │
│                      ┌──────────────┐            │                         │
│                      │APGAR score   │            │                         │
│                      │panel (writes │            │                         │
│                      │back to store)│            │                         │
│                      └──────────────┘            │                         │
└──────────────────────────────────────────────────┼─────────────────────────┘
                                                   │
                          POST /api/session/[id]/publish (auth + fan-out)
                                                   │
                                                   ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                       VERCEL EDGE / SERVERLESS                             │
│                                                                            │
│  ┌────────────────────┐   ┌──────────────────┐   ┌───────────────────┐    │
│  │ POST /api/session  │   │ POST /api/pusher │   │ POST /api/session │    │
│  │  mints session id  │   │ /auth (private-  │   │ /[id]/publish     │    │
│  │  + 6-char code     │   │  encrypted auth) │   │ (server trigger)  │    │
│  └────────────────────┘   └──────────────────┘   └─────────┬─────────┘    │
└──────────────────────────────────────────────────────────────┼────────────┘
                                                               │
                                                               ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                     PUSHER CHANNELS (broker, not state)                    │
│                                                                            │
│   private-encrypted-session-{id}                                           │
│     events: vitals:update, vitals:snapshot, apgar:score, nibp:trigger,     │
│             session:end, monitor:heartbeat (optional presence)             │
└───────────────────────┬───────────────────────────────────────────────────┘
                        │ subscribes (client-side WSS)
                        ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                         MONITOR DEVICE (display)                           │
│                                                                            │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────────────────────┐   │
│  │ Pusher       │──▶│  VitalsStore │──▶│   Waveform Engine            │   │
│  │ subscriber   │   │  (Zustand,   │   │  (RAF loop @ 60fps)          │   │
│  │ (merges      │   │   REPLICA    │   │   ┌──────┐  ┌─────────────┐  │   │
│  │  diffs)      │   │ — read-only  │   │   │Sample│─▶│Circular buf │  │   │
│  └──────────────┘   │  for render) │   │   │ fns  │  │(per channel)│  │   │
│                     └──────┬───────┘   │   └──────┘  └──────┬──────┘  │   │
│                            │           │                     │         │   │
│                            │           │                     ▼         │   │
│                            ▼           │             ┌─────────────┐   │   │
│                     ┌──────────────┐   │             │ Canvas      │   │   │
│                     │ APGAR timer  │───┼────────────▶│ sweep-draw  │   │   │
│                     │ (RAF-derived │   │             │ renderer    │   │   │
│                     │  from start- │   │             └─────────────┘   │   │
│                     │  epoch, local│   └──────────────────────────────┘   │
│                     │  tick only)  │                                      │
│                     └──────────────┘   ┌──────────────────────────────┐   │
│                                        │ Web Audio: alarm synth +     │   │
│                                        │ R-wave beep (gated by        │   │
│                                        │ "tap to start" user gesture) │   │
│                                        └──────────────────────────────┘   │
└───────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Implementation |
|-----------|----------------|----------------|
| **Landing page** (`app/page.tsx`) | Mint session, show 6-char code + QR, route-split to `/control/[id]` on the creating device | Server Component + small `"use client"` island for "create session" button. |
| **Control page** (`app/control/[id]/page.tsx`) | Owns authoritative `VitalsState`; sliders, rhythm picker, preset buttons, alarm-threshold editor, APGAR score panel, NIBP controls | Client Component tree; Zustand store; every mutation debounced (50–100 ms) then POSTed to `/api/session/[id]/publish`. |
| **Monitor page** (`app/monitor/[id]/page.tsx`) | Full-screen Canvas, APGAR timer tick, alarm evaluation, audio engine | Client Component. Single `<MonitorScreen>` child. Wake Lock + fullscreen request on first user tap. |
| **VitalsStore (instructor)** | Source of truth for `VitalsState`. All mutations flow through typed actions (`setHr`, `applyPreset`, `recordApgarMark`). | Zustand with middleware: (a) `persist` to `sessionStorage` for page-reload resilience, (b) custom publisher middleware that POSTs diffs. |
| **VitalsStore (monitor)** | Replica. Merges diffs received from Pusher. Never mutated by local UI. | Zustand, same schema (shared `lib/state/vitals-schema.ts`), `merge()` reducer consumes Zod-validated messages. |
| **Waveform engine** (`lib/waveforms/`) | Pure `(t, state) => sample` functions. No DOM, no React. Testable in isolation. | Per-rhythm template tables (`rhythms.ts`) + runtime synthesis branches (VFib noise, asystole drift). |
| **Circular buffer** (`lib/waveforms/buffer.ts`) | Owns the last N samples per channel. Decouples sample rate (250/100 Hz) from render rate (60 Hz). | Plain `Float32Array` with write-head index; RAF loop advances head, draws delta segment. |
| **Canvas renderer** (`components/monitor/WaveformChannel.tsx`) | Sweep-draw: advance, erase forward gap, stroke new segment. DPR-aware. | Single `<canvas>` per channel; one RAF loop driving all channels (not per-component). |
| **Audio engine** (`lib/audio/`) | R-wave-synced beep (consumes `rPeak` callback from waveform engine), alarm tones per priority (IEC-inspired patterns, not standard-certified). | `AudioContext` created lazily on first user gesture. Pre-built `AudioBuffer`s for tones; `OscillatorNode` for beep. |
| **Pusher client wrapper** (`lib/sync/pusher-client.ts`) | Connect, subscribe to private-encrypted channel, expose typed `subscribe(event, handler)` + reconnection state. | `pusher-js` v8; auto-reconnect is built in. Wrapper surfaces connection state to a `useConnectionStatus` hook. |
| **Session API** (`app/api/session/route.ts`) | Mint session id + 6-char code; return Pusher channel name + client auth metadata. Stateless (no DB) — the code IS the state. | Node runtime route; in-memory code dedup is unnecessary because sessions aren't persisted; collision probability with 32^6 alphabet is negligible for this scale. |
| **Pusher auth API** (`app/api/pusher/auth/route.ts`) | Sign channel subscription for private-encrypted channels. | Pusher server SDK, `authorizeChannel()`. No identity check in v1 (session code acts as shared secret). |
| **Publish API** (`app/api/session/[id]/publish/route.ts`) | Server-triggered fan-out. Accepts diff from instructor, forwards to Pusher channel. **Must await the trigger** or Vercel may cut the function before the message ships. | Node runtime route; Zod-validates payload before forwarding. |

---

## Answers to the Six Architecture Questions

### 1. Sync topology — yes, instructor-as-source-of-truth is correct, but with ONE subtle exception

**Verdict:** Keep "instructor broadcasts diffs" as the core model. It's the right pattern for this domain (distributed monitors, CRDT-lite, ~1–10 msg/s).

**Confidence:** HIGH — this mirrors how real bedside-monitor central-station systems work and how existing WebSocket-sync patterns (Ably, Liveblocks, Firebase RTDB) all structure multi-client scenes with one designated author.

**Subtle exception — monitor-originated events:** Two things can legitimately originate on the monitor:
- **NIBP cuff-cycle completion** (the animation is a 2.8 s local visual — the *completed timestamp* `lastCycleAt` can be set locally on the monitor, or equivalently set on instructor and broadcast). Prefer: instructor triggers (`nibp:trigger`), monitor runs animation locally, instructor sets `lastCycleAt` when its local preview finishes; monitor reads from state. Keeps single-writer rule.
- **APGAR wall-clock tick** — see question 2. The right answer is: *nobody broadcasts the tick*; both sides derive it from a shared `startedAt` epoch.

**Rule:** The only thing that flows monitor → instructor should be a presence/heartbeat ping (optional v1). No vitals mutations originate on the monitor.

### 2. APGAR timer ownership — "shared epoch, local tick, instructor writes marks"

This is the most architecturally interesting question. Three naive designs and why they fail:

| Design | Fails because |
|--------|---------------|
| (a) Timer ticks on monitor via `setInterval`, broadcasts every second | Pusher message rate explodes (60× the budget); monitor→instructor writes break single-writer invariant. |
| (b) Timer ticks on instructor, broadcasts elapsed seconds | 1 msg/s of pure redundancy; drift if network blips; monitor display flickers 1 Hz instead of smooth. |
| (c) Each side runs its own `setInterval`, drifts independently | Instructor marks a 1-minute score, monitor shows 0:58. Clinically embarrassing. |

**Recommended design — shared epoch, no tick broadcast:**

```ts
type ApgarState = {
  startedAt: number | null;   // epoch ms, set when instructor taps Start
  pausedAt: number | null;    // epoch ms, set when paused (null = running or not started)
  accumulatedMs: number;      // total elapsed before current run segment
  marks: {
    m1?:  { score: number; at: number; breakdown: {...} };
    m5?:  { score: number; at: number; breakdown: {...} };
    m10?: { score: number; at: number; breakdown: {...} };
  };
};
```

- **Who owns it:** Lives in the instructor's `VitalsStore`, broadcast on changes (start/pause/reset/mark) — so ~5 msg per APGAR lifecycle, not per second.
- **Who ticks:** Both monitor and instructor derive `elapsedMs = accumulatedMs + (Date.now() - startedAt)` inside their own RAF loop (monitor) / setInterval (instructor) purely for display. No one broadcasts the tick.
- **Who scores:** Instructor writes the `breakdown` (0/1/2 per criterion) and total `score`. The mark event carries a snapshot `at` value so both sides agree on the moment.
- **Clock truth:** `Date.now()` on each device. iPhone 12 and a laptop are both clock-synced via NTP within ~10–50 ms, which is inside the 200 ms latency budget — acceptable for a visual timer. If drift ever becomes an issue, the publish API can echo a server timestamp for the instructor to anchor against, but v1 doesn't need it.

**Design-prototype alignment:** `design/src/app.jsx` lines 53–63 already derive elapsed from `startedAt` + `baseElapsed`. That's exactly the pattern above, just renamed. Port it verbatim.

**Milestone-window highlighting** (1/5/10 min prompts on the monitor): derived locally from `elapsedMs`, no sync needed. Monitor computes "am I within ±5 s of 60 s / 300 s / 600 s?" every RAF frame.

### 3. Waveform engine boundary — clean, with one caveat

**Verdict:** `lib/waveforms/*` as `(t, state) => sample` pure functions is correct. Separate the engine from the renderer. The existing prototype (`design/src/waveforms.js` + `design/src/canvasChannel.jsx`) already demonstrates this separation works — the Canvas channel is agnostic to which `sampleFn` it's handed.

**Caveat — the functions aren't actually pure in the prototype.** The existing `sampleEcg` mutates `state._phase`, `state._lastT`, `state._rFired`, `state._afibJitter` on the vitals state object. In the Next.js port, **do not carry this pattern over unchanged** — it couples the waveform engine to the replicated vitals store and breaks when the store is replaced by a diff merge. Two fixes, pick one:

- **Preferred:** Move phase state into a dedicated `WaveformEngineState` object owned by the renderer (`Map<channelId, { phase, lastT, rFired, afibJitter }>`). Signature becomes `sampleEcg(t, vitals, engineState) => { v, rPeak }`. Engine state is write-only from inside the RAF loop.
- **Alternative:** Keep internal mutation but put it on a scratch object created inside `WaveformChannel`, not on the shared store.

**Template lookup vs runtime synthesis split:**

| Rhythm | Source | Rationale |
|--------|--------|-----------|
| Sinus, brady, tachy | `rhythms.ts` lookup table — ~200 samples of a normalized P-QRS-T beat, stretched to fit `60/HR` | Stable, predictable; table is hand-tuned to look right. |
| Asystole | Runtime: near-zero baseline + tiny noise | No beat shape to table. Trivially cheap. |
| (v2) AFib | Same sinus template, but with per-beat RR jitter (`0.7 + rand*0.6` multiplier on beat duration) | Morphology is normal, only timing changes. Out of v1 scope per PROJECT.md. |
| (v2) VFib | Runtime: band-filtered noise (3–6 Hz) via sum of detuned sines | No beat structure at all. Table would be wrong. |

**Rule:** Table-driven when the shape is deterministic and bounded (one beat). Runtime synthesis when the signal is inherently stochastic or non-periodic. For v1, only **sinus template + flat-line with drift** are needed — drop the VFib / VT branches from the prototype port.

### 4. Session lifecycle without a database

**Minimum viable flow:**

```
[Instructor taps "New session"]
         │
         ▼
POST /api/session
  → server generates { sessionId: nanoid(10), code: 6-char alphanum }
  → returns { sessionId, code, channelName: `private-encrypted-session-${sessionId}` }
         │
         ▼
Instructor device:
  - Stores { sessionId, code } in sessionStorage
  - Subscribes to channel (auth via /api/pusher/auth; session code is the "secret")
  - Displays code + QR (QR encodes https://neosim.app/monitor/${sessionId})
         │
         ▼
Monitor device scans QR or enters code:
  GET /monitor/[sessionId]  (hydrated client)
  - Subscribes to same channel
  - Emits `client-monitor:joined` (client event, free on private channels)
         │
         ▼
Instructor receives `client-monitor:joined` → immediately publishes full `vitals:snapshot`
  (This is the "catch-up" message — new subscribers need the current state, not a diff.)
         │
         ▼
Normal operation: instructor mutations → debounced diff → channel → monitor merge.
```

**Reconnection-after-network-blip:**
- `pusher-js` auto-reconnects on its own and auto-resubscribes. On `pusher:subscription_succeeded` (either side), re-emit logic runs:
  - **Instructor** re-publishes a `vitals:snapshot` on every resubscribe (cheap, idempotent, one message).
  - **Monitor** discards its replica state and waits for the snapshot (or optimistically keeps rendering last-known state — both acceptable; render-last is better UX).
- **Pusher cache channels** (prefix `private-encrypted-cache-`) store the last triggered event and replay it to new subscribers — an alternative to the snapshot protocol above. Promising, but adds "what event counts as the last?" ambiguity for a multi-event protocol. **Recommendation: stick with explicit snapshot-on-join; simpler and version-able.**

**Session expiry:**
- No server state means no expiry to manage. The session "exists" as long as at least one device has the code cached.
- Recommended: instructor device writes `{ sessionId, code, createdAt }` to `localStorage`; on landing page re-entry, offer "Resume session" for 24 h. After 24 h, hide the option (code still technically works if re-entered manually; there's no lockout).
- Pusher channel itself has no TTL for free-tier private channels; it simply has no subscribers when everyone disconnects, and gets rehydrated when someone re-subscribes.

**Edge cases to flag in phase planning:**
- What if monitor joins while instructor is backgrounded (iOS tab throttled)? The `client-monitor:joined` event arrives but the instructor's JS isn't running to respond. **Mitigation:** on `visibilitychange → visible`, instructor republishes snapshot. Low priority for v1; flag for v1.1.
- What if two people scan the same QR? Both monitors subscribe. Both receive the same diffs. This is *desirable* (two learners at one warmer). No collision handling needed.

### 5. Build order — reorder the PRD's Step 1

The PRD proposes: (a) waveform prototype → (b) full local monitor → (c) split + Pusher + deploy. That order de-risks render performance first, which is sensible. **Recommend a small amendment:** insert a Pusher round-trip latency spike *before* the full local monitor.

**Why:** Render is already de-risked. The existing `design/src/canvasChannel.jsx` sweep-draw runs on CDN-loaded React and still hits 60 fps visually in the design prototype. The riskier-and-unknown item is end-to-end Pusher latency from instructor → Vercel edge → Pusher → monitor on iPhone Safari. 200 ms is the hard budget; free-tier Pusher + Vercel cold-start can blow this.

**Recommended build order (de-risking by unknown, not by surface area):**

| Phase | Goal | De-risks |
|-------|------|----------|
| **P0 — Waveform on iPhone** (1 evening) | Port `sampleEcg` + `WaveformChannel` into a Next.js client component; deploy one page to Vercel; open on iPhone 12 home-screen PWA. Measure actual FPS with `performance.now()`. | 60 fps on iOS Safari Canvas 2D (the PRD's stated top risk). Validates DPR handling, RAF throttling when Safari backgrounds tab. |
| **P1 — Pusher latency spike** (1 evening) | Two pages (`/a`, `/b`), no routing, no UI polish, just a number input on A and a number display on B, wired through Pusher. Measure `publishedAt → receivedAt` on a real iPhone on cellular and wifi. | The 200 ms budget. If median latency is >150 ms we need to know before building the control panel. **This is the highest-unknown item** — render perf is knowable from the prototype; Pusher real-world latency on iOS isn't. |
| **P2 — Local full monitor** | All vitals tiles + waveforms + alarms + APGAR timer driven by a single local Zustand store. No sync. Mirrors the PRD's Step 2. | State shape; alarm evaluation logic; audio-unlock gesture; Wake Lock + fullscreen request plumbing. |
| **P3 — iOS polish** | Wake Lock, manifest, landscape lock, `apple-mobile-web-app-capable`, fullscreen, "tap to start" overlay. | Installed-PWA Wake Lock bug (historically broken on iOS <18.4 per WebKit bug #254545). **Test on oldest target device (iPhone 12 on iOS 16.4+)** — may require UI fallback messaging. |
| **P4 — Split + sync** | Split `/monitor/[id]` and `/control/[id]`, wire Pusher, implement diff protocol + snapshot-on-join, build instructor panel UI. | The full two-device flow. |
| **P5 — Scenario-day hardening** | 30-minute soak test on iPhone, network-blip recovery, reconnection UX, edge cases (backgrounded instructor, two monitors). | Production readiness. |

**Rationale for moving iOS polish (P3) before sync (P4):** Wake Lock, fullscreen, and audio-unlock are all **browser-level gestures and APIs that are easier to debug on a single-page local app**. Adding them after sync means you're debugging two moving parts at once. Also, the installed-PWA Wake Lock bug only manifests once the app is home-screened — catching that before sync work lets us fall back to a UI hint ("keep screen tapped") without the added complication of Pusher-induced timing issues.

### 6. File structure — PRD §7.5 is correct, with two additions

PRD §7.5 is idiomatic Next.js 14 App Router and matches the community-recommended split (lib / components / hooks at root, co-located API routes under `app/api/`). **Keep it.** Two small additions:

```diff
  app/
    page.tsx
    control/[sessionId]/page.tsx
    monitor/[sessionId]/page.tsx
    api/
      session/route.ts
+     session/[sessionId]/publish/route.ts   # server-side Pusher trigger; must `await`
      pusher/auth/route.ts

  lib/
    waveforms/
      ecg.ts, pleth.ts
      buffer.ts
      rhythms.ts
+     engine-state.ts                        # phase/jitter/rFired state (NOT on vitals store)
    audio/
      alarms.ts
      beep.ts
    sync/
      pusher-client.ts
      messages.ts                            # Zod schemas for wire events
+     protocol.ts                            # event names + snapshot/diff helpers
    state/
      vitals-store.ts
      alarm-store.ts
+     apgar-store.ts                         # separable — different lifecycle, no numeric vitals coupling
+     vitals-schema.ts                       # Zod schema shared by control + monitor

  components/
    monitor/
      MonitorScreen.tsx
      WaveformChannel.tsx
      NumericTile.tsx
      NIBPTile.tsx
      AlarmBanner.tsx
      PatientHeader.tsx
+     ApgarTimerCard.tsx
+     DisclaimerStrip.tsx
    control/
      VitalsControls.tsx
      RhythmPicker.tsx
      AlarmThresholds.tsx
      QuickActions.tsx
+     ApgarScorePanel.tsx
+     ConnectionStatus.tsx
+     SessionCodeDisplay.tsx

  hooks/
    useWakeLock.ts
    useFullscreen.ts
    useOrientationLock.ts
    usePusher.ts
+   useConnectionStatus.ts                   # wraps Pusher connection state for UI
+   useApgarElapsed.ts                       # RAF-driven elapsed-ms derivation

+ public/
+   manifest.webmanifest
+   icons/                                   # iOS home-screen icon set

+ types/
+   vitals.ts                                # TS types inferred from Zod schemas
```

**Small-scale rule-of-thumb honoured:** Don't create a `types/` directory if Zod `z.infer` covers everything; only add it if non-schema-derived types accumulate. Kept above as optional.

---

## Architectural Patterns

### Pattern 1: Single-writer diff propagation

**What:** One designated client (instructor) mutates state; all other clients are read-only replicas that merge diffs.
**When to use:** Realtime apps with a clear owner (teacher/student, presenter/viewer, DM/player). Fails for peer-to-peer collaborative state (use CRDT / OT there).
**Trade-offs:** Simple, auditable, no merge conflicts. Cost: single point of failure (if instructor disconnects, state freezes — but that's clinically correct behaviour; the warmer-side display should freeze, not guess).

```ts
// lib/state/vitals-store.ts (instructor build)
export const useVitalsStore = create<VitalsStore>()((set, get) => ({
  vitals: defaultVitals(),
  setHr: (hr) => {
    set((s) => ({ vitals: { ...s.vitals, hr } }));
    publishDiff({ hr }); // debounced inside publisher
  },
  // ...
}));

// lib/state/vitals-store.ts (monitor build, same file, different path import)
export const useVitalsStore = create<VitalsStore>()((set) => ({
  vitals: defaultVitals(),
  mergeDiff: (diff) => set((s) => ({ vitals: { ...s.vitals, ...diff } })),
}));
```

Use the same `VitalsSchema` Zod object on both sides; control and monitor imports differ by which helpers are bundled.

### Pattern 2: Decouple sample rate from render rate via circular buffer

**What:** Waveform engine produces samples at 250 Hz (ECG) / 100 Hz (pleth). RAF loop runs at 60 Hz. Per frame, render pulls the delta of samples since last frame, not the latest N.
**When to use:** Any realtime signal where sample rate ≠ render rate. Avoids aliasing artefacts and keeps math-to-pixel conversion clean.
**Trade-offs:** More code than "just sample at 60 Hz and draw." But: lets the simulation stay accurate if the tab is briefly backgrounded (catch-up on resume), and matches how real DSP waveforms are specified.

```ts
class CircularBuffer {
  constructor(capacity: number) { /* Float32Array(capacity) */ }
  write(sample: number) { /* advance head */ }
  readSince(timestamp: number): Float32Array { /* delta slice */ }
}
```

**v1 simplification:** the prototype's approach (sample-per-pixel-advance, no buffer) is acceptable if benchmark P0 proves 60 fps is stable. Buffer can be added in v1.1 if catch-up-on-resume becomes a problem. Document this as a deferred optimization.

### Pattern 3: Shared-epoch timer (no tick broadcast)

**What:** Broadcast `startedAt` once. Every device derives `elapsed` locally from `Date.now() - startedAt`.
**When to use:** Any timer whose precision requirement is coarser than wall-clock drift between devices (~50 ms on modern NTP-synced phones). Fails for sub-10-ms coordination needs.
**Trade-offs:** Five messages per timer lifecycle (start/pause/resume/reset/mark) instead of one per second. Tradeoff is drift-for-bandwidth, which in our case is the right trade.

### Pattern 4: Snapshot-on-join, diff-on-update

**What:** Full state is sent on subscribe (snapshot). Subsequent mutations are diffs.
**When to use:** When late-join must see current state. Universal for realtime apps.
**Trade-offs:** Two code paths (snapshot consumer + diff merger). Pusher's *cache channels* feature is an alternative, but less explicit and harder to version.

### Pattern 5: RAF-driven derived state for UI animation

**What:** Don't store "seconds elapsed" in React state — it causes 60 re-renders per second. Instead, read from a ref inside a RAF loop that updates only the DOM nodes that need it.
**When to use:** Animations where the value changes every frame but most of the tree doesn't care. APGAR timer, clock, waveform cursor.
**Trade-offs:** Breaks React's mental model; imperative escape hatch. Justified for 60 Hz UI.

---

## Data Flow

### Instructor mutation → monitor render (happy path)

```
[Instructor drags HR slider from 140 → 130]
    │
    ▼
VitalsStore.setHr(130)        ← synchronous state update, instructor UI repaints
    │
    ▼
publisher middleware (debounce 50ms)
    │
    ▼
POST /api/session/abc/publish { hr: 130 }
    │
    ▼
[Vercel edge runtime]
  await pusher.trigger('private-encrypted-session-abc', 'vitals:update', { hr: 130 })
    │                                    ← MUST await — Vercel closes fn after 200 OK
    ▼
[Pusher broker fans out over WSS]
    │
    ▼
Monitor: pusher.bind('vitals:update', handler)
    │
    ▼
VitalsSchema.partial().parse({ hr: 130 })   ← Zod validates
    │
    ▼
useVitalsStore.getState().mergeDiff({ hr: 130 })
    │
    ▼
Waveform engine reads new HR on next RAF tick
    │
    ▼
Canvas repaints with new beat period (visible at next sweep)
```

**Budget:** slider → monitor paint in <200 ms. Break down: slider debounce 50 ms, POST round-trip to Vercel 40–80 ms (depends on region/edge), Pusher broker fan-out 20–60 ms, WSS to monitor 20–50 ms, merge + next RAF tick up to 16.7 ms. Tight on cellular; comfortable on wifi. **P1 spike exists to validate this.**

### APGAR mark → both devices consistent

```
[Instructor taps "Score 1-min" with breakdown {A:2, P:2, G:1, A:2, R:1}]
    │
    ▼
ApgarStore.recordMark('m1', { total: 8, breakdown: {...}, at: elapsedMs })
    │
    ▼
Publish apgar:mark event (full ApgarState snapshot, small)
    │
    ▼
Monitor receives, updates local ApgarState, renders mark on timeline
```

No tick events. Both monitor and instructor derive `elapsedMs` locally from `startedAt`.

### NIBP cycle → cuff animation on monitor

```
[Instructor taps "Cycle NIBP now"]
    │
    ▼
Publish nibp:trigger (no payload, just the event)
    │
    ▼
Monitor: starts 2.8s cuff-inflating animation, disables NIBP tile readout
    │
    ▼
[2.8s later, on monitor]
    │ (This is the one case where the monitor originates an update — the
    │  "cycle-complete at local time T" fact. Publish this back? NO — let
    │  instructor be authoritative: instructor *also* runs a local 2.8s
    │  timer on trigger, sets lastCycleAt and publishes; monitor's animation
    │  is purely visual.)
    ▼
Monitor reads updated nibp.lastCycleAt from next vitals:update, resumes tile readout.
```

Single-writer invariant preserved.

### Connection flow

```
Load /monitor/abc
  │
  ▼
Call /api/pusher/auth with channel name + socket id
  │
  ▼
Subscribe to private-encrypted-session-abc
  │
  ▼
On subscription_succeeded:
  - Emit client-monitor:joined (client event, private-channel built-in)
  - Wait for vitals:snapshot
  │
  ▼
Instructor side: on client-monitor:joined → publish current full VitalsState as vitals:snapshot
  │
  ▼
Monitor: merge snapshot → render
```

---

## iOS PWA Platform Placement (by Phase)

Per PROJECT.md constraints (iOS 16.4+ Safari required), these APIs are first-class risks, not polish:

| Concern | Phase | Notes |
|---------|-------|-------|
| **Canvas 2D 60 fps on iPhone 12** | P0 | Validate with `performance.now()` ring buffer over 60s. Fail = rewrite to OffscreenCanvas or reduce sample rate. |
| **Pusher latency iPhone-real-world** | P1 | Median <150ms; p95 <250ms. Fail = consider Ably or lower-latency alternative. |
| **Web Audio unlock gesture** | P2 | "Tap to start" overlay is mandatory — audio context must be created inside the gesture handler, not later. |
| **Wake Lock API** | P3 | iOS 16.4+; broken in installed-PWA mode until iOS 18.4 per WebKit bug #254545. Provide fallback: show a "keep tapping to prevent sleep" banner if `navigator.wakeLock` throws. |
| **Fullscreen on iOS PWA** | P3 | Standard Fullscreen API is not supported for PWAs on iOS Safari. Use `apple-mobile-web-app-capable: yes` + home-screen install to hide Safari chrome. Full-screen-from-browser is **not achievable** on iOS — document this and instruct users to install to home screen. |
| **Landscape orientation lock** | P3 | `screen.orientation.lock('landscape')` requires fullscreen context, which iOS PWA does not fully provide. Fallback: CSS-based rotation hint ("please rotate device") when `window.orientation` indicates portrait. |
| **Wake Lock + backgrounding** | P5 | Any tab switch / navigation releases the lock. Must re-acquire on `visibilitychange → visible`. |
| **30-minute soak test on battery** | P5 | Acceptance criterion from PROJECT.md. Plug-in recommendation in onboarding. |

**Key insight:** several PRD-listed "polish" items (`display: fullscreen`, orientation lock) **are not fully achievable on iOS** per current WebKit reality. The right posture for v1 is graceful degradation + clear user instructions ("install to home screen and rotate device"), not fighting WebKit.

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| **1 session** (dev + demo) | Current design — Pusher free tier, no DB, in-memory-only. |
| **10 concurrent sessions** (early use) | Current design still works — Pusher free tier covers 100 concurrent connections and 200k msg/day. At 10 msg/s × 2 clients × 10 sessions = 200 msg/s = ~17M msg/day. **Exceeds free tier.** Upgrade Pusher at this point. |
| **100+ concurrent sessions** (growth) | Move to a usage-based realtime provider (Ably, Liveblocks) or self-hosted Soketi. Add a minimal session registry (SQLite on Vercel KV) to allow session listing, resume, and basic analytics. |
| **Regional latency tuning** | Pusher cluster selection matters; free tier uses one cluster. Multi-region needs paid plan + clients pick nearest cluster. |

**First bottleneck is almost certainly Pusher message budget, not compute.** 60 fps Canvas on the monitor is CPU-local and doesn't scale with sessions. Serverless API routes for publish scale per Vercel's limits (generous). Message-fan-out is the bill.

---

## Anti-Patterns

### Anti-Pattern 1: Broadcasting the APGAR tick

**What people do:** `setInterval(() => publish('apgar:tick', elapsedSec), 1000)`.
**Why wrong:** 1 msg/s × N sessions destroys Pusher budget, introduces drift, and re-renders React state every second.
**Do instead:** Shared-epoch pattern. Broadcast only state transitions (start/pause/mark).

### Anti-Pattern 2: Putting waveform phase state on the vitals store

**What people do:** Stash `_phase`, `_rFired`, `_afibJitter` on the same object that gets merged from Pusher diffs.
**Why wrong:** Every diff merge risks stomping internal engine state. The prototype does this; it's fine for a single-page spike but will break when the monitor replaces its store from a snapshot mid-beat.
**Do instead:** `lib/waveforms/engine-state.ts` owns phase. The vitals store is pure user-facing state.

### Anti-Pattern 3: Publishing from the Vercel handler without `await`

**What people do:** `pusher.trigger(...); return new Response('ok');`
**Why wrong:** Vercel closes the serverless function when the response is returned. The trigger fetch may not complete. This is a known Pusher+Vercel gotcha (referenced in vercel/next.js discussion #48433).
**Do instead:** `await pusher.trigger(...); return new Response('ok');`

### Anti-Pattern 4: Sending waveform samples over the wire

**What people do:** Generate ECG on the instructor, stream samples to the monitor.
**Why wrong:** 250 Hz × bytes × N clients destroys budget and introduces jitter. Real clinical distributed monitors don't do this either.
**Do instead:** Sync parameters (HR, rhythm), synthesize on each monitor.

### Anti-Pattern 5: Per-component RAF loops

**What people do:** Each `<WaveformChannel>` starts its own `requestAnimationFrame` loop.
**Why wrong:** Three RAF loops competing for the same 16.7 ms frame budget; harder to coordinate pauses on backgrounding. The prototype does this — it works at small scale but doesn't compose.
**Do instead:** One RAF loop at the `<MonitorScreen>` level, dispatching `render(t)` to each channel component via ref.

### Anti-Pattern 6: Storing session state in Vercel KV / Redis "because we might need it"

**What people do:** Add persistence "just in case."
**Why wrong:** PROJECT.md explicitly scopes out persistence. Adds cost, attack surface, and PHI-adjacent compliance questions for zero v1 benefit.
**Do instead:** Session = the 6-char code. If it's not in a browser cache, it doesn't exist. Re-create is free.

### Anti-Pattern 7: Trying to achieve true fullscreen on iOS Safari

**What people do:** Call `element.requestFullscreen()` on monitor page load.
**Why wrong:** Not supported on iOS Safari PWAs. Will either throw or silently no-op.
**Do instead:** Ship as installable PWA with `apple-mobile-web-app-capable`. Document "install to home screen" as the path to fullscreen in the onboarding UI.

---

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| **Pusher Channels** | Private-encrypted channel per session; server-side `trigger` via Node SDK in `/api/session/[id]/publish`; client-side `pusher-js` with auth endpoint. | Must `await` server triggers. Use `private-encrypted-` prefix to encrypt payloads at rest in broker. |
| **Vercel** | Default Next.js 14 App Router deploy. Node runtime for API routes (Pusher Node SDK is Node-only, not Edge-compatible as of early 2026). | Cold starts add ~100–300 ms to first publish — pre-warm by pinging `/api/session` on landing page load. |
| **QR generation** | `qrcode` npm package, client-side, generates DataURL for session-code display. | No server round-trip needed. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| **Instructor UI ↔ VitalsStore** | Direct Zustand selectors + actions | In-process. |
| **VitalsStore ↔ Publisher middleware** | Zustand subscribe | Debounced (50–100 ms) to collapse slider scrubs into one publish. |
| **Publisher ↔ /api/publish** | `fetch` POST with JSON body | Await the fetch to detect errors; show connection-degraded banner on failure. |
| **/api/publish ↔ Pusher** | Node SDK `pusher.trigger` | Must await. |
| **Pusher ↔ Monitor** | `pusher-js` WSS; `bind` event handlers | Reconnection automatic. Track `connection.state` for UI. |
| **Monitor VitalsStore ↔ Waveform engine** | Refs read on each RAF tick | Never through React state — would cause 60 Hz re-render storm. Components read via `useRef` + `subscribe`. |
| **Waveform engine ↔ Canvas renderer** | Direct function call inside RAF loop | Engine returns `{ v, rPeak }`; renderer handles pixel math; rPeak callback fires audio beep. |
| **Monitor ↔ Audio engine** | `rPeak` callback from ECG engine + alarm evaluator watching VitalsStore | Audio context created once on first user gesture ("tap to start"). |

---

## Phase-to-Component Mapping (for roadmap consumption)

| Phase | Components owned by this phase |
|-------|-------------------------------|
| **P0 — Waveform on iPhone** | `lib/waveforms/ecg.ts` (sinus only), `lib/waveforms/engine-state.ts`, `components/monitor/WaveformChannel.tsx`, `app/prototype/page.tsx` (throwaway) |
| **P1 — Pusher latency spike** | `lib/sync/pusher-client.ts`, `lib/sync/messages.ts` (minimal), `app/api/pusher/auth/route.ts`, `app/api/session/[id]/publish/route.ts`, two throwaway pages under `app/spike/` |
| **P2 — Local full monitor** | `lib/waveforms/pleth.ts`, `lib/waveforms/buffer.ts`, `lib/waveforms/rhythms.ts` (sinus/brady/tachy/asystole), `lib/audio/*`, `lib/state/vitals-store.ts`, `lib/state/alarm-store.ts`, `lib/state/apgar-store.ts`, `components/monitor/*` (full set), `hooks/useApgarElapsed.ts`, `app/monitor/[sessionId]/page.tsx` (local-only variant) |
| **P3 — iOS polish** | `hooks/useWakeLock.ts`, `hooks/useFullscreen.ts`, `hooks/useOrientationLock.ts`, `public/manifest.webmanifest`, `public/icons/*`, `components/monitor/DisclaimerStrip.tsx`, "tap to start" overlay |
| **P4 — Split + sync** | `app/page.tsx` (landing), `app/control/[sessionId]/page.tsx`, `app/api/session/route.ts`, `components/control/*` (full set), `lib/sync/protocol.ts`, `lib/state/vitals-schema.ts`, `hooks/usePusher.ts`, `hooks/useConnectionStatus.ts`. Rework `app/monitor/[sessionId]/page.tsx` to consume replica store instead of local. |
| **P5 — Scenario-day hardening** | Reconnection UX polish, snapshot-on-join robustness, `visibilitychange` handlers, 30-min soak instrumentation. No new files typically; edits across `lib/sync/` and `hooks/`. |

---

## Sources

- [Next.js — Getting Started: Project Structure](https://nextjs.org/docs/app/getting-started/project-structure) — HIGH confidence, official
- [Pusher Channels Docs — What is a connection? (reconnection behavior)](https://pusher.com/docs/channels/using_channels/connection/) — HIGH confidence, official
- [Pusher Channels Docs — Cache channels](https://pusher.com/docs/channels/using_channels/cache-channels/) — HIGH confidence, official
- [Pusher Channels Docs — Presence channels (debounce, rejoin semantics)](https://pusher.com/docs/channels/using_channels/presence-channels/) — HIGH confidence, official
- [Vercel Knowledge Base — Deploying Pusher Channels with Vercel (await trigger requirement)](https://vercel.com/kb/guide/deploying-pusher-channels-with-vercel) — HIGH confidence, official
- [vercel/next.js Discussion #48433 — Pusher not working on production Vercel](https://github.com/vercel/next.js/discussions/48433) — MEDIUM confidence, community-verified solution (`await` the trigger)
- [How to use Pusher in Next.js (App Router) — Selcuk Guler, Medium](https://selcuk00.medium.com/how-to-use-pusher-in-next-js-app-router-1132b8ddf3b5) — MEDIUM confidence, pattern reference
- [WebKit Bug #254545 — Wake Lock API broken in installed Home Screen Web Apps (fixed iOS 18.4)](https://bugs.webkit.org/show_bug.cgi?id=254545) — HIGH confidence, authoritative
- [MagicBell — PWA iOS Limitations and Safari Support (2026)](https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide) — MEDIUM confidence, recent survey
- [Can I Use — Screen Wake Lock API](https://caniuse.com/wake-lock) — HIGH confidence
- [MDN — Optimizing Canvas](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas) — HIGH confidence, authoritative
- [web.dev — Improving HTML5 Canvas performance](https://web.dev/articles/canvas-performance) — HIGH confidence
- Existing prototype: `/Users/onlypaul/Workspace/neosim/design/src/app.jsx`, `design/src/waveforms.js`, `design/src/canvasChannel.jsx` — HIGH confidence, visual/UX lock per PROJECT.md

---
*Architecture research for: NeoSim — two-device neonatal monitor simulator*
*Researched: 2026-04-20*
