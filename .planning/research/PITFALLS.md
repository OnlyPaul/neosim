# Pitfalls Research

**Domain:** Neonatal bedside-monitor simulator (Next.js 14 PWA, iOS Safari, Canvas 60fps, Pusher realtime, Web Audio, NRP clinical correctness)
**Researched:** 2026-04-20
**Confidence:** HIGH (iOS/Canvas/WebAudio: verified against WebKit bugs + web.dev; Clinical: verified against NRP 8th edition + AHA algorithm)

> Roadmap phases referenced below (from PRD §12):
> - **Phase 1 — Waveform Prototype** (single-page Canvas spike)
> - **Phase 2 — Full Local Monitor** (all waveforms + numerics + alarms + audio, Zustand, no sync)
> - **Phase 3 — Split Views + Pusher Sync + Deploy** (instructor panel, realtime, Vercel)

---

## Critical Pitfalls

### Pitfall 1: Wake Lock lost on tab blur — screen sleeps mid-scenario

**Severity:** BLOCKER
**Category:** iOS Safari PWA

**What goes wrong:**
Instructor picks up the second device to adjust vitals, the monitor tab briefly loses visibility (notification, Control Center pulled down, home-indicator swipe), `WakeLockSentinel` is automatically released, screen dims, scenario illusion breaks mid-code-blue.

**Why it happens:**
Per spec, `navigator.wakeLock.request('screen')` returns a sentinel that is automatically released whenever `document.visibilityState` becomes `hidden`. iOS Safari is stricter than Chrome here — even a pull-down of Control Center can fire `visibilitychange`. Developers assume "request once = done forever."

**How to avoid:**
- Register a `visibilitychange` listener and **re-acquire** the wake lock every time the tab becomes visible again:
  ```ts
  let sentinel: WakeLockSentinel | null = null;
  const acquire = async () => { sentinel = await navigator.wakeLock.request('screen'); };
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') acquire();
  });
  acquire(); // initial
  ```
- Must be triggered inside a user gesture on first request (tap-to-start overlay covers this).
- Gate the feature on iOS 16.4+ (required) AND iOS 18.4+ for reliable installed-PWA behavior (WebKit bug 254545 prevented wake lock in Home Screen Web Apps until iOS 18.4).
- Show a visible "screen-lock active" indicator so instructor notices if it silently fails.

**Warning signs:**
- Screen dims after ~30s during testing.
- `request()` throws `NotAllowedError` after tab return.
- Console shows `WakeLockSentinel.released === true` unexpectedly.

**Phase to address:** Phase 2 (first real monitor view); verify on actual iPhone 12 in Phase 3 with installed PWA.

---

### Pitfall 2: Web Audio silenced by iOS hardware mute switch

**Severity:** BLOCKER
**Category:** Web Audio / iOS

**What goes wrong:**
Sim-lab iPhone has ringer switch flipped to silent (a very common default state). All alarms and R-wave beeps are inaudible. Instructor believes the code is working; learners never hear the high-priority alarm.

**Why it happens:**
On iOS, Web Audio `AudioBufferSourceNode` output is routed to the **ringer/alert** audio channel, not the **media** channel. The physical mute switch silences the ringer channel. HTML5 `<audio>` elements route to media and play through the mute switch; Web Audio does not. This has been tracked in WebKit for years (bug 237322) and is still current behavior.

**How to avoid:**
- On the "Tap to start" overlay, play a short silent MP3 via an `<audio>` element inside the same gesture that creates the AudioContext. This tricks iOS into routing the AudioContext to the media channel.
  ```ts
  const silentAudio = new Audio('/silent-50ms.mp3');
  await silentAudio.play(); // routes audio graph to media channel
  ctx = new AudioContext();
  await ctx.resume();
  ```
- Use a library like `unmute-ios-audio` or `swevans/unmute` as reference if hand-rolling is flaky.
- Add a visible "Audio armed ✓" indicator after unlock succeeds, and a re-test chime so instructor can hear it before the scenario starts.
- Document in onboarding: "Turn off silent mode if audio doesn't work."

**Warning signs:**
- Alarms audible in simulator but silent on real iPhone.
- Audio works in Safari tab but not in installed PWA (separate context).
- Works on Android / macOS but not iPhone.

**Phase to address:** Phase 2 (when alarm audio lands).

---

### Pitfall 3: R-wave beep drifts when scheduled with setTimeout

**Severity:** HIGH
**Category:** Web Audio timing

**What goes wrong:**
Heartbeat beep is scheduled with `setTimeout(beep, 60_000/hr)`. Under GC pressure, touch events, or React re-renders, the main thread stalls for 20–100 ms. Beeps drift audibly relative to the visible QRS spike on Canvas, destroying the "this looks like a real monitor" illusion.

**Why it happens:**
`setTimeout`/`setInterval` run on the main thread and are subject to task-queue scheduling, HTML5 spec clamping (min 4 ms, 1 s when hidden), and GC pauses. They are not monotonic and drift by tens of ms per minute.

**How to avoid:**
Use a **lookahead scheduler** pattern (web.dev "Tale of Two Clocks"):
1. Every ~25 ms via `setInterval`, look ahead 100 ms on `audioCtx.currentTime`.
2. For any beep whose scheduled time falls in the lookahead window, call `oscillator.start(scheduledTime)`.
3. Derive scheduled times from a monotonic counter (next = last + 60/hr), not from wall-clock.
4. On HR change, re-anchor the next beep time; do not re-compute all past events.

Sync the Canvas QRS render to the same monotonic tick (or tolerate ≤ 16 ms visual lag — within one frame).

**Warning signs:**
- Beeps and QRS visibly desync after ~30 s.
- Beep interval jitters audibly when user scrolls instructor panel.
- Backgrounding tab → foreground produces a burst of beeps (queued setTimeouts firing).

**Phase to address:** Phase 2 (R-wave beep implementation).

---

### Pitfall 4: Sweep-draw ghosting / tearing from wrong clear-ahead width

**Severity:** HIGH
**Category:** Canvas 60fps

**What goes wrong:**
Two visible failure modes:
(a) **Ghosting** — previous sweep's pixels remain visible underneath the new sweep because the clear-ahead region is smaller than the max line thickness + anti-aliasing halo.
(b) **Tearing** — the write head is ahead of the clear region; QRS appears drawn on top of itself before the old sample is erased.

**Why it happens:**
Sweep-draw assumes the "gap" rectangle ahead of the write head is cleared before the next sample lands there. With devicePixelRatio > 1 on iPhone (DPR=3 on iPhone 12), a 2 px line occupies ~6 device pixels plus AA. If the clear-ahead width is set in CSS pixels (e.g., 20 px) without DPR scaling, it looks fine on desktop and breaks on iPhone.

**How to avoid:**
- Set canvas backing store to `width = cssWidth * DPR`, `height = cssHeight * DPR`; apply `ctx.scale(DPR, DPR)` once at init; work in CSS pixels thereafter.
- Clear-ahead rect width = ceil(sweep_speed_px_per_frame) + line_width + 2 (AA pad). Typical: 25 mm/s at 100 px/cm scale @ 60 fps → ~4.2 px/frame → clear 10–12 CSS px ahead.
- Use `ctx.clearRect(writeHeadX, 0, clearWidth, h)` every frame before drawing new samples.
- Do NOT use full-canvas `clearRect` per frame (defeats the point of sweep-draw and kills perf).

**Warning signs:**
- Waveform looks right on laptop, "fuzzy" or double-drawn on iPhone.
- Trail of faint pixels behind the sweep cursor.
- QRS spike smears vertically when HR increases.

**Phase to address:** Phase 1 (waveform prototype — this IS the prototype's main risk).

---

### Pitfall 5: Canvas stalls to 30 fps in Low Power Mode

**Severity:** HIGH
**Category:** Canvas 60fps / iOS

**What goes wrong:**
Instructor's iPhone auto-enters Low Power Mode at 20% battery. iOS hard-throttles `requestAnimationFrame` to 30 Hz. The sweep visibly jitters, R-wave beep desyncs further, and the 30-minute session test fails. No API to detect or override.

**Why it happens:**
Documented iOS behavior: Low Power Mode throttles RAF to 30 fps system-wide. There is no programmatic opt-out or even a reliable detection API in web.

**How to avoid:**
- Design the waveform engine to be **frame-rate independent**: advance write head by `elapsed_ms / ms_per_pixel`, not by a fixed per-frame step. A 30 fps render still produces a correct waveform, just with visible stepping.
- Use `performance.now()` deltas, not frame counts, for sweep position and HR-synced beats.
- Detect throttling by measuring `rAF` interval: if > 20 ms consistently, show a subtle banner ("Low Power Mode detected — plug in for best experience").
- Document in UX: the onboarding screen should tell instructors to plug in and disable Low Power Mode before a session (PRD §9 already flags power consumption).

**Warning signs:**
- Waveform looks smooth at 100% battery, choppy at 15%.
- Same device renders correctly right after unplug, degrades after 10 min.
- `requestAnimationFrame` callback delta is ~33 ms instead of ~16 ms.

**Phase to address:** Phase 1 (make engine time-based from day 1); user-facing warning in Phase 2.

---

### Pitfall 6: Fullscreen illusion broken on iPhone (Fullscreen API unsupported)

**Severity:** HIGH
**Category:** iOS Safari PWA

**What goes wrong:**
Developer wires up `element.requestFullscreen()` based on MDN docs. On iPhone Safari it's a no-op (unsupported) — user sees Safari's URL bar and bottom tab bar over the monitor. On iPad it partially works but the UI pill remains. The illusion of "this is a real bedside monitor" fails because of browser chrome.

**Why it happens:**
Standard Fullscreen API is unsupported on iPhone Safari (only partial on iPad). The real path on iOS is **installing the site as a home-screen PWA** with `<meta name="apple-mobile-web-app-capable" content="yes">`, which hides Safari chrome when launched from the home screen.

**How to avoid:**
- Include in `<head>`:
  ```html
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="apple-mobile-web-app-title" content="NeoSim">
  <link rel="apple-touch-icon" href="/icon-180.png">
  ```
- Detect non-PWA mode (`window.navigator.standalone === false`) on `/monitor/*` and show a "Add to Home Screen for fullscreen" coach mark with Share-icon illustration.
- Do NOT rely on `display: fullscreen` in the web manifest for iOS — ignored. `display: standalone` is the effective setting.
- As of iOS 26, added-to-home sites default to web-app mode, which helps, but the meta tags are still the canonical signal.

**Warning signs:**
- Safari URL bar visible during testing.
- `document.fullscreenElement` always null on iPhone.
- `window.navigator.standalone` is false — user didn't install.

**Phase to address:** Phase 3 (deploy + PWA polish).

---

### Pitfall 7: Landscape orientation not lockable on iPhone PWA

**Severity:** HIGH
**Category:** iOS Safari PWA

**What goes wrong:**
Instructor picks up the "monitor" iPhone in portrait to show the device to a student; Canvas re-lays out; sweep position wraps weirdly; numerics break.

**Why it happens:**
The Screen Orientation API `screen.orientation.lock('landscape')` is **not supported on iOS Safari at all** (not in browser, not in installed PWA). There is no JS-driven way to force landscape. Apps in the App Store use `UIInterfaceOrientation`, which is unavailable to web.

**How to avoid:**
- CSS-only workaround: detect portrait via media query and show a full-screen "Please rotate to landscape" overlay:
  ```css
  @media (orientation: portrait) { .monitor-canvas { display: none; } .rotate-prompt { display: flex; } }
  ```
- Make the waveform engine resilient to resize (recompute pixel widths, don't hard-code viewport).
- Persist the "rotate" prompt as part of the intentional UX — don't try to fight it with JS hacks that fail on iOS.
- Document the limitation in instructor onboarding.

**Warning signs:**
- Tested in landscape on desk, broke when student picks up device.
- `screen.orientation.lock` silently rejects with `NotSupportedError` on iPhone.

**Phase to address:** Phase 2 (monitor view UX).

---

### Pitfall 8: Pusher reconnection drops mid-scenario state

**Severity:** HIGH
**Category:** Realtime sync

**What goes wrong:**
Sim-lab Wi-Fi hiccups for 5 seconds. Pusher client auto-reconnects and re-subscribes, but the 3 `vitals:update` diffs that were sent during the outage are lost forever. Monitor now shows stale HR=140 while instructor has moved to HR=60 asystole. Learner acts on wrong information.

**Why it happens:**
Pusher Channels **does not persist messages**. On reconnect, `pusher:subscription_succeeded` fires but missed messages are not replayed. Developers assume "WebSocket = ordered, durable" — it's neither for Pusher's default channels.

**How to avoid:**
- **Send full state, not diffs, on every N-th message (heartbeat).** Every 2–5 seconds, publish the full `VitalsState` as a `vitals:snapshot` event. On reconnect, the next snapshot re-syncs the monitor within one heartbeat window.
- Attach a monotonically increasing `seq` field to every message; monitor tracks `lastSeq`. On reconnect, if the first incoming `seq` is not `lastSeq + 1`, request an immediate snapshot from the instructor via a reverse channel or API call.
- On `pusher:connection:state_change` to `unavailable` or `disconnected`, show a red "RECONNECTING" banner on the monitor so the instructor sees it and can pause teaching.
- Also handle iOS Safari's backgrounded-tab WebSocket fragility: listen for `visibilitychange` → `visible` and force `pusher.connection.disconnect(); pusher.connect()` if last event was > 5 s ago.

**Warning signs:**
- Monitor HR doesn't match instructor HR after a network test.
- `pusher:error` events in console.
- Waveform keeps running on stale params during / after Wi-Fi drop.

**Phase to address:** Phase 3 (Pusher integration) — snapshot pattern must be designed before wire protocol freezes.

---

### Pitfall 9: Audio context never unlocked → alarms silent all session

**Severity:** HIGH
**Category:** Web Audio

**What goes wrong:**
Monitor route loads, instructor forgets to tap "Start scenario," Web Audio context stays in `suspended` state forever. All alarms fire visually but no sound. Instructor only notices when a high-priority alarm happens and nobody hears it.

**Why it happens:**
Per spec, AudioContext must be resumed inside a user gesture. Auto-starting the context or calling `ctx.resume()` from a `useEffect` without a prior user gesture leaves it suspended on iOS Safari and most modern browsers.

**How to avoid:**
- Make the "Tap to start" overlay **mandatory and blocking** — monitor waveforms do not render until tap registers. No way to bypass.
- After tap: `await ctx.resume()`, play an audible 50 ms test chime, assert `ctx.state === 'running'`, then enable the monitor.
- On every `visibilitychange` → visible, re-check `ctx.state` and show a "Tap to re-arm audio" micro-overlay if suspended.

**Warning signs:**
- `audioCtx.state === 'suspended'` in devtools during a live test.
- Visual alarms fire, audio silent.
- Works on refresh, breaks on resume-from-background.

**Phase to address:** Phase 2 (audio integration).

---

### Pitfall 10: Clinical inaccuracy — adult thresholds applied to neonates

**Severity:** BLOCKER (for clinical credibility)
**Category:** Clinical correctness

**What goes wrong:**
Developer hard-codes HR < 60 as the bradycardia low alarm (adult threshold). In a real NRP scenario that's the **compressions threshold**, not the alarm threshold — bradycardia in neonates is HR < 100. Sim-lab instructor dismisses the product as "not clinically usable."

**Why it happens:**
Most publicly available "patient monitor" code samples and tutorials use adult defaults because they copy from ACLS-oriented references. NRP neonatal algorithm uses different numbers that must be looked up specifically. PRD §6 already reflects the correct neonatal values, but the team must not drift to adult defaults during implementation.

**How to avoid (authoritative values from NRP 8th edition / AHA Neonatal Resuscitation Algorithm):**

| Parameter | NRP 8th Edition Value | Meaning |
|-----------|----------------------|---------|
| HR > 100 bpm | Target / "effective ventilation" threshold | Stop PPV escalation |
| HR < 100 bpm | Bradycardia — continue / escalate PPV | Low alarm |
| HR < 60 bpm | **Critical** — start chest compressions after 30 s of effective PPV | Critical alarm |
| HR < 60 bpm after 60 s of CC + PPV | Administer epinephrine | — |
| CC rate | 100–120 per minute | 3:1 compression-to-ventilation ratio |
| SpO2 targets (preductal, minutes of life) | 1 min: 60–65% / 2 min: 65–70% / 3 min: 70–75% / 4 min: 75–80% / 5 min: 80–85% / 10 min: 85–95% | Dawson curve |

Hard-code these as neonatal constants in `lib/clinical/nrp.ts`; never parameterize with adult defaults. Display the Dawson SpO2 target range on the monitor as an optional overlay tied to the APGAR timer's minute-of-life counter.

**Warning signs:**
- Low alarm fires at HR=75 (neonatal normal lower bound is ~100).
- SpO2 = 78% at 2 minutes of life triggers alarm (it's on-target for NRP).
- Code uses `const HR_LOW = 60` — that's the compressions threshold, not the low-alarm.

**Phase to address:** Phase 2 (alarm thresholds) — clinical review before scoring UX ships.

**Sources:** NRP 8th Edition (AAP/AHA, 2020); Dawson et al. 2010 reference curve as adopted by NRP.

---

### Pitfall 11: Uncanny-valley realism — mistaken for real clinical device

**Severity:** BLOCKER (legal / safety)
**Category:** Legal / safety

**What goes wrong:**
Product looks too much like Philips IntelliVue or GE Carescape. A staff nurse wanders into the sim lab mid-session, sees the "monitor," misreads it as a real patient, and acts on the false vitals. Alternatively, screenshots leak into clinical documentation. Either triggers patient-safety reporting AND trade-dress exposure.

**Why it happens:**
Medical monitor color conventions (green HR, cyan SpO2, yellow resp, red alarms, black background) are both (a) pedagogically correct and (b) visually dominant. Copying the exact tile layout, font, and logo placement of a specific vendor crosses from "convention" into "trade dress."

**How to avoid:**
- **Keep the conventions, change the identity.** Use standard color coding (required for pedagogy) but own font, own tile arrangement proportions, own brand mark ("NeoSim" visible), own logo lockup.
- **Persistent disclaimer bar** on the monitor view (not just landing): small but always-visible footer "NEOSIM — EDUCATIONAL SIMULATOR — NOT A MEDICAL DEVICE." Red accent, never hidden.
- A distinctive boot screen with "NeoSim" branding that flashes briefly on every session start.
- Do NOT clone the specific tile geometry of any real vendor (e.g., Philips's specific bottom-quad arrangement, GE's distinctive header).
- Avoid the exact IEC 60601-1-8 alarm melody tones — use "distinguishable but not identical" tones. Real hospital staff learn the IEC melodies; hearing them in a non-clinical context confuses recall. (Also the exact melodies are published for conformance, not for copying into unrelated products.)
- Landing page: mandatory acknowledgment checkbox "I understand this is not a medical device" before Create Session.

**Warning signs:**
- Screenshot side-by-side with Philips MX450 looks "basically the same."
- Reviewer says "looks just like our real monitor."
- Brand mark is not visible in any typical camera framing of the display.

**Phase to address:** Phase 2 (visual design lock) AND Phase 3 (deploy + legal review of landing copy).

---

### Pitfall 12: APGAR timer drifts between monitor and instructor clocks

**Severity:** HIGH
**Category:** State / timing

**What goes wrong:**
APGAR timer runs locally on the monitor (per design). Instructor scores at "5 minutes" on their panel; monitor shows 5:03; after 10 min of scenario the two clocks disagree by 8 seconds. Instructor scores a milestone that monitor says hasn't happened yet, and the monitor highlights the wrong window.

**Why it happens:**
Two independent clocks (monitor's `performance.now()` counter vs instructor's `Date.now()` UI timer) drift from each other. Add network jitter on Pusher (100–300 ms), pause/resume events, and the drift compounds.

**How to avoid:**
- **Single source of truth = instructor.** Instructor stores `apgar.startedAt` (epoch ms, instructor's clock), `apgar.paused: boolean`, `apgar.pausedAt`, `apgar.pausedAccumMs`. Broadcast the full APGAR state on start/pause/resume/reset and on every 5 s heartbeat.
- Monitor computes elapsed locally off its own `performance.now()` between updates, but re-anchors to the instructor's authoritative timestamp every heartbeat. Smoothly interpolate (don't jump visibly) if drift is < 500 ms; hard-snap if > 500 ms.
- On reconnect (see Pitfall 8), the first snapshot re-anchors the timer immediately.
- Milestone highlighting (1 min / 5 min / 10 min) fires off the instructor's authoritative elapsed, broadcast via explicit `apgar:milestone` event — don't let monitor and instructor each decide independently when 5:00 hit.

**Warning signs:**
- Monitor and instructor clocks visibly off by > 1 s after 10 min.
- 5-min milestone highlights on monitor before/after instructor says to score.
- Pause/resume leaves a gap or a jump.

**Phase to address:** Phase 3 (sync + APGAR wire protocol design).

---

### Pitfall 13: Memory leak from unbounded waveform buffers

**Severity:** MEDIUM
**Category:** Canvas performance

**What goes wrong:**
Circular buffer implementation accidentally uses an array and `push()` without bound. Over 30 minutes at 250 Hz × 3 channels, the JS heap grows ~1.3 M samples × 8 B = 10 MB of numbers, plus V8 overhead. iPhone Safari aborts tab with "A problem repeatedly occurred" around 25 min.

**Why it happens:**
Circular buffer is easy to get wrong in TS — devs implement `buffer.push(sample); if (buffer.length > MAX) buffer.shift()` (O(n) and still grows briefly). Or they use a `Float32Array` of fixed length but keep an auxiliary array for "debug." Or they hold onto old buffer references in a closure.

**How to avoid:**
- `Float32Array(bufferLength)` allocated once; write with `buf[writeIdx] = sample; writeIdx = (writeIdx + 1) % bufferLength`. Never reallocate.
- `bufferLength = sampleRate * secondsOnScreen` — e.g., 250 Hz × 6 s = 1500 samples. Total across 3 channels ~3 KB.
- Never retain a history array for "maybe we'll need trends" — PRD explicitly defers trends to v2.
- In Phase 2, open Safari Web Inspector → Timelines → Memory and confirm heap is flat over 10 min.

**Warning signs:**
- Heap snapshot shows growing ArrayBuffer count.
- Tab crash after 20+ min on iPhone.
- Chrome DevTools Memory tab shows sawtooth (bad) instead of flat (good).

**Phase to address:** Phase 1 (buffer design) with verification in Phase 2 endurance test.

---

### Pitfall 14: Pusher free tier exhausted mid-class

**Severity:** MEDIUM
**Category:** Realtime / capacity

**What goes wrong:**
Instructor runs a class of 20 learners who each open the monitor on personal devices. Each session = 1 instructor + 20 monitors = 21 connections. Each instructor parameter change emits ~5–10 msgs/s. Over a 30-min session: 21 connections × 30 min = well within 200 concurrent, but 20 msgs/s × 1800 s = 36k messages × 21 subscribers = **756k message-deliveries**. Pusher counts each delivery. Free tier (200k msg/day) blown in one session.

**Why it happens:**
Pusher free/sandbox tier: **200 concurrent connections**, **200k messages/day** (the 100-concurrent number in the PRD/question is stale — current sandbox is 200). Each delivered message to each subscriber counts. The 1–10 msg/s PRD number is *per channel* but is multiplied by subscriber count when billed.

**How to avoid:**
- **Coalesce sends.** Debounce instructor vitals updates to 2 Hz max (one message every 500 ms carrying the latest state). A slider drag should not emit 60 msgs/s. 2 Hz × 1800 s = 3600 msgs / scenario.
- For a full snapshot heartbeat (Pitfall 8) at 0.2 Hz: 360 msgs / 30 min. Combined: ~4k msgs per 30-min session, delivered to 21 subscribers = 84k. One session uses ~40% of daily free quota. Acceptable for small classes; monitor usage.
- Plan for the **Startup plan ($49/mo)** if sim labs onboard: 500 concurrent, 1M msgs/day.
- Surface "current session message count" in the instructor panel (dev-only) to catch regressions.
- Architect Pusher usage behind a thin adapter (`lib/sync/transport.ts`) so the team can swap for Ably or self-hosted Soketi without rewriting features.

**Warning signs:**
- Pusher dashboard shows messages climbing > 10k/hour.
- `pusher:error` code 4004 ("over quota").
- Free-tier exhaustion noticed mid-session in production.

**Phase to address:** Phase 3 (Pusher wire protocol design + debounce implementation).

---

### Pitfall 15: No auth on Pusher channels → scenario hijacking

**Severity:** MEDIUM (v1) / HIGH (v2+)
**Category:** Security

**What goes wrong:**
PRD makes channel auth optional in v1. Anyone who guesses a 6-char session code (36^6 ≈ 2.2B — large but trivially brute-forceable from client) can publish `vitals:update` to another classroom's channel. A prankster drops in asystole during a live NRP class.

**Why it happens:**
Public channels in Pusher have no publisher restriction — any client with the app key + channel name can publish. 6-char codes + no auth = trust boundary = "anyone on the internet."

**How to avoid for v1 (MVP):**
- Session codes: use a full 36-char alphabet (A–Z0–9) at 8 chars minimum, not 6 — that's 2.8 × 10^12, hard to brute force. Current PRD says 6 — upgrade before ship.
- Use **private channels** (`private-session-${id}`) with a `/api/pusher/auth/route.ts` endpoint that signs the subscription. Even a trivial HMAC with the session code as the shared secret raises the bar significantly vs public channels.
- Rate-limit the session-create endpoint to prevent code enumeration.
- Publish only from server (via Pusher REST) or from an authenticated instructor client. Do NOT let arbitrary clients publish to the channel directly from the browser.
- Document in ROADMAP: "Before public launch, upgrade to private channels."

**Warning signs:**
- Anyone can publish to any session's channel from devtools.
- 6-char session codes guessable in a weekend of brute force.
- No server-side origin check on published events.

**Phase to address:** Phase 3 (sync architecture) — design private-channel support even if v1 ships with public.

---

### Pitfall 16: PWA install flow differs between Safari tab and Home Screen app

**Severity:** MEDIUM
**Category:** iOS PWA

**What goes wrong:**
Developer tests everything in Safari tab, ships. Real users install to Home Screen (expected path). In standalone mode, audio unlock context is fresh, Wake Lock API historically broke in Home Screen apps until iOS 18.4, storage is scoped separately from Safari, and external-link behavior is different. Scenario silently breaks for installed users.

**Why it happens:**
Installed PWA on iOS is a distinct WebKit webview instance with its own storage, cookie jar, and permission state. Devs test in Safari tab because it's faster; users install because that's what PRD tells them to do.

**How to avoid:**
- During Phase 3, make "install to Home Screen + relaunch from icon" part of the smoke-test checklist on every deploy.
- Include device matrix: iPhone 12 iOS 16.4 (bare minimum), iPhone 12 iOS 17.x, iPhone 12+ iOS 18.4+ (wake lock solid), iPad 16.4+.
- Branch code on `navigator.standalone` only for the install coach mark — core functionality should work identically in both modes.
- Test: kill the app, relaunch from Home Screen, verify audio + wake lock + Pusher reconnect all still work.

**Warning signs:**
- Works in Safari tab, breaks from Home Screen (or vice versa).
- Wake Lock `NotAllowedError` only in standalone mode on iOS < 18.4.
- Different localStorage values between tab and app.

**Phase to address:** Phase 3 (deploy + iOS matrix test).

---

### Pitfall 17: Battery drain makes 30-minute session fail on portable devices

**Severity:** MEDIUM
**Category:** Power

**What goes wrong:**
60 fps Canvas + Wake Lock + Web Audio + active WebSocket + full screen brightness = real-world iPhone 12 drains 20–30% per 30-min session. Uncharged devices enter Low Power Mode (triggers Pitfall 5), can even power off if starting below 50%.

**Why it happens:**
Every one of these APIs is a known battery hog; stacked they are unforgiving. Real sim labs running 3-hour classes on a single iPhone drain battery fully.

**How to avoid (how real sim labs cope, from community usage):**
- Loud and repeated UX message: "Plug in before starting a session." Instructor-panel onboarding card + monitor first-load overlay both say it.
- Provide a "Demo / low-power mode" toggle that drops to 30 fps and dims the sweep — useful for dry runs.
- If `navigator.getBattery?.()` is available (not on iOS, but on Android + desktop), warn under 40%.
- Do not over-engineer battery detection on iOS — the signal isn't there. Rely on UX copy.
- Suggest USB-C hub / MagSafe stand in the "equipment" section of the docs.

**Warning signs:**
- Real-world testing: device goes from 80% to 50% in one session.
- Low Power Mode kicks in mid-test.
- Device thermally throttles (gets warm) after 15 min.

**Phase to address:** Phase 2 (UX copy) and Phase 3 (documentation / install guide).

---

### Pitfall 18: Asystole + compressions decision tree coded as adult (< 60 everywhere)

**Severity:** BLOCKER (clinical correctness)
**Category:** Clinical correctness

**What goes wrong:**
Quick-action preset "Arrest" drops HR from 140 → 0 instantly to simulate cardiac arrest. But in NRP neonatal, "HR < 60 bpm after effective PPV" is the *decision point for chest compressions* — not equivalent to asystole. If the sim jumps from healthy to flat-line, learners miss the most important NRP decision (start CC at HR < 60) because the sim skipped that zone.

**Why it happens:**
Adult BLS/ACLS teaches "asystole → compressions." NRP teaches a graded response based on HR bands: > 100 (continue care), 60–100 (escalate PPV), < 60 (add compressions). A preset that skips 60–100 loses pedagogical value.

**How to avoid:**
- Quick-action presets should walk HR **through the clinical bands**, not jump:
  - **Vigorous** → HR 140, SpO2 rising per Dawson, sinus.
  - **Hypoxic** → HR 100–140, SpO2 low for minute-of-life.
  - **Bradycardic** → HR 60–100, sinus brady (prompts "effective PPV" teaching).
  - **Severe bradycardia / Compressions needed** → HR 40–60, prompts CC decision.
  - **Arrest / Asystole** → HR 0, flat ECG, prompts the full epinephrine / volume / advanced arm.
- Rhythm stays `sinus` or `brady` (not `asystole`) until HR reaches 0; only then switch morphology to flat-line. Currently PRD rhythm set covers this — enforce it in preset implementation.
- Include an "escalation ladder" preset that auto-walks through the bands over 60 s so instructors can demo the full algorithm.
- Clinical review checkpoint: run all presets past a practicing NRP instructor before Phase 2 complete.

**Warning signs:**
- Presets bypass HR 60–100 band.
- Learners never practice the "HR < 60 → CC" decision in sim testing.
- Preset labels match adult code-blue vocabulary ("Code Blue") instead of NRP vocabulary ("Bradycardic / Compressions").

**Phase to address:** Phase 2 (quick-action presets) — clinical validation before ship.

---

### Pitfall 19: iOS Safari backgrounded tab kills WebSocket silently

**Severity:** MEDIUM
**Category:** iOS / Pusher

**What goes wrong:**
Instructor switches to another app (Messages, Safari tabs list) during a live session. iOS aggressively suspends the backgrounded tab's JS event loop. Pusher WebSocket is closed by iOS without firing a reliable `onclose` on resume. When instructor returns, the socket is dead but the client library thinks it's still open — calls to `.send()` throw or silently drop.

**Why it happens:**
Documented iOS WebKit behavior — backgrounded tabs lose timers, network, and eventually the socket. Reconnection logic must be gesture-tolerant, not purely event-driven.

**How to avoid:**
- On `visibilitychange` → `visible`, **force** a Pusher reconnect check: `if (pusher.connection.state !== 'connected') { pusher.disconnect(); pusher.connect(); }` plus a fresh snapshot request.
- Display a "RECONNECTING" toast on visible-return so the user understands why there may be a half-second pause.
- Don't trust `pusher.connection.state === 'connected'` alone; send a ping/pong via an app-level heartbeat and treat timeout > 5 s as "reconnect now."
- Explicitly document the behavior — instructor should keep the control panel foregrounded during a scenario.

**Warning signs:**
- Changes stop reflecting on monitor after instructor multitasks.
- No error shown, just silent failure.
- State recovers after instructor force-closes and relaunches app.

**Phase to address:** Phase 3 (Pusher + lifecycle integration).

---

### Pitfall 20: Alarm audio too similar to IEC 60601-1-8 reserved melodies

**Severity:** MEDIUM
**Category:** Legal / safety / clinical

**What goes wrong:**
Developer picks alarm tones by ear "because they sound hospital-realistic." They match or closely approximate the IEC 60601-1-8 reserved category melodies (general, cardiac, oxygenation, etc.). Clinical staff hear them and experience **reserved-melody confusion** — tones carry specific clinical meaning that may not match NeoSim's use. Also creates a conformance-ambiguity risk ("is this claiming to be a real monitor?").

**Why it happens:**
The IEC melodies are well-documented and publicly available as WAV files. Devs copy them intending realism. But the melodies are *reserved* for conformant medical equipment; using them in non-conformant educational software undermines real clinical alarm recognition and creates legal ambiguity.

**How to avoid:**
- Synthesize alarm tones that are **distinguishable by priority** (high = rapid repeating burst; medium = slower 3-pulse; low = single long tone) **but musically distinct** from the IEC melodies.
- Use fundamental frequencies outside the IEC-required 150–1000 Hz primary range (or use different harmonic structure).
- Document alarm choice in the repo with rationale: "Not IEC 60601-1-8 compliant; distinct by design to avoid reserved-melody confusion."
- Revisit if instructor feedback requests closer realism — but only with legal review.

**Warning signs:**
- Alarm sounds "exactly like the hospital one."
- Team is tempted to download the IEC reference WAVs.

**Phase to address:** Phase 2 (audio synthesis).

---

### Pitfall 21: Monitor view shows "blank" on first load — no fallback waveform

**Severity:** LOW
**Category:** UX

**What goes wrong:**
Student taps QR code → monitor route loads → Pusher hasn't delivered the initial `VitalsState` yet (200–500 ms). Canvas renders a flat line with all tiles at 0. Student thinks the device is broken or the simulated patient is dead on arrival.

**Why it happens:**
Assumption that Pusher subscription + first snapshot happens synchronously with page load. It doesn't.

**How to avoid:**
- Show a "Connecting to session …" overlay with session code echoed back, until first `VitalsState` snapshot lands.
- Default to "pre-scenario" vitals (HR 140, SpO2 95%, sinus — healthy-ish neonate) as initial local state so even without sync the monitor looks like a working device.
- On sync success, fade the overlay; on sync failure (> 5 s), show a "Re-enter session code" action.

**Warning signs:**
- Users report "it's not working" when it's just slow to connect.
- First-load Canvas shows all zeros for > 1 s.

**Phase to address:** Phase 3 (monitor initial load UX).

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|------------------|----------------|-----------------|
| Public Pusher channels (no auth) | Ship Phase 3 in days, not weeks | Scenario-hijacking risk, can't go public | v1 private beta only, with 8-char codes |
| Skip sequence IDs on wire messages | Simpler wire protocol | Silent state divergence on network blip | Never — snapshot heartbeat is mandatory |
| Fixed-frame-rate waveform engine | Simpler code | Breaks in Low Power Mode | Never — must be time-based from day 1 |
| Single-file `waveforms.ts` | Fast port from `design/` | Hard to test individual rhythms | Phase 1 prototype only; split by Phase 2 |
| Hardcoded neonatal thresholds as magic numbers | Faster initial coding | Regression risk when adult thresholds creep in during refactor | Never — extract to `lib/clinical/nrp.ts` with citations |
| Skip Web Audio unlock overlay on non-iOS | Cleaner desktop UX | Audio stays suspended on Safari desktop too | Acceptable, but still show a small "click to arm audio" button |
| Setting `width=cssWidth` without DPR | Works on desktop, ships faster | Blurry waveforms on iPhone | Never for monitor canvas |
| Sending full VitalsState on every tick | Simple sync model | Blows Pusher free-tier quota | Never at > 0.2 Hz snapshot rate |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|---------------|------------------|
| Pusher Channels | Assume messages are durable / replayed on reconnect | Snapshot heartbeat every 2–5 s; sequence IDs; re-sync on visibility change |
| Pusher Channels | Publish from browser to public channel | Private channels + signed auth endpoint, or publish via server REST only |
| Wake Lock API | Request once at page load | Re-acquire on every `visibilitychange` → `visible` |
| Web Audio | Create AudioContext in `useEffect` | Create inside a user gesture (tap overlay); call `ctx.resume()` |
| Web Audio (iOS) | Ignore hardware mute switch | Play silent `<audio>` element in same gesture to route to media channel |
| Fullscreen API | Use `element.requestFullscreen()` | Rely on `apple-mobile-web-app-capable` + install-to-home-screen |
| Screen Orientation API | `screen.orientation.lock('landscape')` on iPhone | CSS orientation media query + "rotate device" overlay |
| Canvas DPR | `canvas.width = cssWidth` | `canvas.width = cssWidth * DPR; ctx.scale(DPR, DPR)` |
| RAF scheduling | `setTimeout(tick, 1000/60)` | `requestAnimationFrame`; treat 60 fps as best-effort |
| iOS PWA | Test only in Safari tab | Test in installed PWA (Home Screen icon) as primary path |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|-----------|----------------|
| Full-canvas clear per frame | Dropped frames, thermal throttle on iPhone | Sweep-draw with `clearRect` of narrow ahead-region only | Any iPhone under sustained 60 fps |
| setTimeout-based beep scheduling | Audible drift, beep clumping after background return | AudioContext lookahead scheduler | Within seconds on any device |
| Unbounded circular buffer | Memory growth, tab crash after 20+ min | `Float32Array(fixed length)` with modular write index | 30 min PRD criterion |
| Pusher message per slider tick | Quota exhaustion, throttling | Debounce to 2 Hz | Classes > 10 students × few sessions/day |
| Re-rendering entire monitor on each VitalsState diff | React reconciliation cost per wave frame | Canvas drawing via `useRef`, not in React tree; Zustand subscriptions scoped per-tile | Any non-trivial scenario |
| Waveform engine that recomputes full template each frame | CPU spikes, fan/heat | Pre-compute template beat once per rhythm change; index into it per sample | Noticeable within seconds |
| Ignoring `performance.now()` deltas in favor of frame counts | Drift in Low Power Mode | Time-based advance always | Battery < 20% |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|-----------|
| 6-char session codes | Brute-force enumeration (PRD default — tighten) | 8+ chars from 36-char alphabet; rate-limit `/api/session` |
| Public Pusher channels with no auth | Scenario hijacking; CS students spamming others' rooms | Private channels with HMAC-signed auth endpoint |
| Publish from browser directly to Pusher | Any client can impersonate instructor | Publish via server-side Pusher REST only, or authorize publishers |
| Patient-info free-text persisted | Accidental real PHI stored | Never persist to DB; keep in local-state / session-scoped Pusher only; clear on session end |
| Exposing Pusher app secret in client | Full admin access to app | Secret is server-only (`PUSHER_SECRET`); client uses app **key** (public by design) |
| No CSP | XSS risk escalates | Strict CSP with `script-src 'self'`; Next.js 14 supports this well |
| Clickjacking on control panel | Malicious iframe changes vitals | `X-Frame-Options: DENY` on `/control/*` |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|------------|-----------------|
| No audio unlock indicator | Silent alarms, no signal to instructor | Visible "Audio armed ✓" badge + test-chime on unlock |
| No connection status on monitor | Learner reads stale vitals | Persistent connection indicator + "reconnecting" banner on disconnect |
| No "plug in" warning | Battery drains mid-class | First-load overlay + instructor-panel onboarding card |
| APGAR milestone arrives without highlight | Instructor misses scoring moment | Full-screen flash + audio chime at 1/5/10 min (but subtle enough to not disrupt) |
| Quick-action drops vitals instantly | Learners don't experience graded deterioration | Transition over 3–10 s (configurable per preset) |
| No "reset session" button | Instructor forced to refresh to re-run | Explicit "New patient" action on control panel |
| Disclaimer hidden in footer | Legal / safety gap | Persistent small banner on monitor and landing; mandatory acknowledgment checkbox |
| Portrait orientation shows broken layout | Student confused | CSS-driven "rotate device" overlay covering the whole view |

---

## "Looks Done But Isn't" Checklist

Things that appear complete in dev but fail in the real sim lab.

- [ ] **Wake Lock:** Works on first request — verify re-acquire on `visibilitychange` after 10 min backgrounded
- [ ] **Audio:** Plays in dev — verify on iPhone with **silent switch ON** (the lab default state)
- [ ] **Fullscreen:** Hides Safari chrome in Safari tab — verify installed-as-PWA launch shows NO Safari UI
- [ ] **Landscape:** Locked in dev tools — verify iPhone physical rotation to portrait shows rotate-prompt (API is no-op)
- [ ] **60 fps:** Smooth at 100% battery — verify below 20% battery (Low Power Mode → 30 fps forced)
- [ ] **30-min run:** No visible lag — verify heap is flat via Safari Web Inspector; no crash
- [ ] **Pusher reconnect:** Survives a network blip — verify state re-syncs within one heartbeat window, no missed vitals
- [ ] **Multi-device:** Works on laptop + phone — verify iPhone 12 iOS 16.4 (floor), iOS 18.4+ (current), iPad landscape
- [ ] **APGAR timer:** Starts and shows minutes — verify instructor + monitor agree within 500 ms after 10 min
- [ ] **Alarms neonatal:** Fire at right HR — verify HR=80 fires bradycardia alarm (NOT HR=50 adult threshold)
- [ ] **Quick-actions:** Transition through clinical bands — verify "Bradycardic" preset lands in 60–100 bpm zone, not < 60
- [ ] **Disclaimer:** Visible on landing — verify visible on monitor view too (required for screenshot ambiguity)
- [ ] **Session code space:** 6-char default — upgrade to 8-char minimum before public launch
- [ ] **Orientation lock:** Prompted in code — verify actual device rotation handled by CSS fallback (API doesn't work on iPhone)

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|--------------|----------------|
| Wake Lock not re-acquired | LOW | Add `visibilitychange` listener; deploy hotfix |
| Audio silenced by mute switch | LOW | Ship silent-MP3 unlock trick; retest on mute-on device |
| setTimeout beep drift | MEDIUM | Refactor to AudioContext lookahead; isolated in `lib/audio/` |
| Canvas ghosting on iPhone | LOW | Widen clear-ahead region by 4 px; verify on DPR=3 |
| Pusher state divergence | MEDIUM | Add snapshot heartbeat + seq IDs to wire protocol; migrate existing protocol |
| Adult clinical thresholds shipped | HIGH | Review `lib/clinical/nrp.ts`; fix constants; regression-test every preset; clinical sign-off |
| Trade-dress too similar to real vendor | HIGH | Rebrand: new logo, rearrange tile geometry, change alarm tones; may require re-record of marketing screenshots |
| Pusher quota exhausted | MEDIUM | Add client-side debounce; upgrade to paid plan as bridge; move to Ably/Soketi if paid doesn't suit |
| Wake lock fails on installed PWA (iOS < 18.4) | MEDIUM | Require iOS 18.4+ in install coach; fall back to `NoSleep.js` video hack for < 18.4 |
| APGAR clock drift | LOW | Instructor-authoritative timer with heartbeat re-anchor; shipped as protocol fix |
| Memory leak crash | MEDIUM | Replace array with typed `Float32Array`; verify in Safari Web Inspector |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|-----------------|--------------|
| 1. Wake Lock on tab blur | Phase 2, retest Phase 3 | 10-min backgrounded test → screen stays on |
| 2. Web Audio mute switch | Phase 2 | Physical iPhone with silent-mode ON plays alarms |
| 3. setTimeout beep drift | Phase 2 | 2-min recording shows < 20 ms jitter between beep and QRS |
| 4. Sweep-draw ghosting | Phase 1 | Screenshot on DPR=3 iPhone shows clean sweep, no trail |
| 5. Low Power Mode 30 fps | Phase 1 (engine); Phase 2 (UX) | Waveform still correct at 30 fps (time-based, not frame-based) |
| 6. iPhone Fullscreen API broken | Phase 3 | Installed PWA hides all Safari chrome |
| 7. Landscape lock unsupported | Phase 2 | Rotate iPhone to portrait → "rotate" overlay covers screen |
| 8. Pusher reconnection drops state | Phase 3 | Airplane-mode toggle mid-session → < 3 s re-sync |
| 9. Audio context never unlocked | Phase 2 | Tap-to-start overlay blocks render; audio test chime plays |
| 10. Adult clinical thresholds | Phase 2 | Alarm fires at HR=80 (neonatal brady) not HR=50 |
| 11. Trade-dress too close to real | Phase 2 (design) + Phase 3 (legal review) | Side-by-side screenshot with Philips/GE — clearly distinct |
| 12. APGAR clock drift | Phase 3 | 10-min scenario, monitor + instructor within 500 ms |
| 13. Memory leak circular buffer | Phase 1 (design) + Phase 2 (endurance) | Safari Web Inspector heap flat over 30 min |
| 14. Pusher quota exhaustion | Phase 3 | Debounce verified; dashboard shows < 5k msgs per 30-min session |
| 15. No channel auth | Phase 3 | Private channels implemented or explicitly deferred with 8+ char codes |
| 16. PWA install vs tab differs | Phase 3 | Smoke test in both modes on every deploy |
| 17. Battery drain | Phase 2 (UX copy) + Phase 3 (docs) | First-load warning visible; docs mention plug-in |
| 18. Preset skips clinical band | Phase 2 | NRP instructor review of all 5 presets before ship |
| 19. Backgrounded WebSocket killed | Phase 3 | Multitask iPhone test: switch apps, return — monitor re-syncs |
| 20. IEC-melody mimicry | Phase 2 | Alarm tones documented as non-IEC-derivative |
| 21. Blank monitor on first load | Phase 3 | Loading overlay + default vitals prevent "is it broken?" moment |

---

## Sources

- **WebKit Bug 254545** — "New Wake Lock API does not work in Home Screen Web Apps" (fixed iOS 18.4): https://bugs.webkit.org/show_bug.cgi?id=254545
- **WebKit Bug 237322** — "webaudio api is muted when the iOS ringer is muted": https://bugs.webkit.org/show_bug.cgi?id=237322
- **web.dev — A tale of two clocks** (Web Audio scheduling): https://web.dev/articles/audio-scheduling
- **web.dev — Screen Wake Lock API**: https://web.dev/blog/screen-wake-lock-supported-in-all-browsers
- **Apple — Safari 16.4 Release Notes** (Wake Lock added): https://developer.apple.com/documentation/safari-release-notes/safari-16_4-release-notes
- **caniuse — Screen Wake Lock API**: https://caniuse.com/wake-lock
- **MDN — Page Visibility API**: https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API
- **Popmotion — When iOS throttles requestAnimationFrame to 30 fps**: https://popmotion.io/blog/20180104-when-ios-throttles-requestanimationframe/
- **Motion blog — When browsers throttle requestAnimationFrame**: https://motion.dev/blog/when-browsers-throttle-requestanimationframe
- **MDN — Optimizing Canvas**: https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas
- **swevans/unmute** — iOS Web Audio ringer-switch workaround: https://github.com/swevans/unmute
- **feross/unmute-ios-audio** — same category: https://github.com/feross/unmute-ios-audio
- **firt.dev — iOS PWA Compatibility**: https://firt.dev/notes/pwa-ios/
- **Pusher docs — Missed messages after reconnecting**: https://docs.bird.com/pusher/channels/channels/events/how-can-i-get-missed-messages-after-reconnecting-to-channels
- **Pusher docs — Concurrent connections**: https://docs.bird.com/pusher/channels/channels/connecting/what-are-concurrent-channels-connections
- **Pusher Channels Pricing (sandbox = 200 concurrent, 200k msg/day)**: https://pusher.com/channels/pricing/
- **Pusher docs — Why don't events arrive in order**: https://docs.bird.com/pusher/channels/channels/events/why-dont-channels-events-arrive-in-order
- **AHA Neonatal Resuscitation Algorithm (NRP 8th edition)**: https://cpr.heart.org/-/media/CPR-Files/CPR-Guidelines-Files/Algorithms/AlgorithmNeonatal_Resuscitation_200615.pdf
- **AAP — NRP 8th Edition Busy People Update #1**: https://downloads.aap.org/AAP/PDF/NRP%208th%20Edition%20Busy%20People%20Update%20(1).pdf
- **Merck Manual — Neonatal Oxygen Saturation Targets** (Dawson curve): https://www.merckmanuals.com/professional/multimedia/table/neonatal-oxygen-saturation-targets
- **NRP flow chart with timeline (PMC)**: https://pmc.ncbi.nlm.nih.gov/articles/PMC10432944/
- **Heart Rate Assessment during Neonatal Resuscitation (PMC)**: https://pmc.ncbi.nlm.nih.gov/articles/PMC7151423/
- **IEC 60601-1-8 Guidance (Digi-Key)**: https://www.digikey.com/en/articles/iec-60601-1-8-guidance-for-designing-medical-equipment-alarms
- **AAMI — Updated IEC 60601-1-8 alarm sounds**: https://array.aami.org/content/news/updated-iec-60601-1-8-breaks-new-ground-development-alarm-sounds
- **APSF — Monitor displays: non-moving vs moving waveforms**: https://www.apsf.org/article/monitor-displays-non-moving-waveforms-may-be-superior-to-moving-waveforms/
- **magicbell — PWA iOS Limitations and Safari Support (2026)**: https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide
- **Mobile Safari WebSocket crash on return from background** (historical, indicative): https://gist.github.com/mloughran/2052006

---
*Pitfalls research for: NeoSim — Neonatal bedside monitor simulator (PWA)*
*Researched: 2026-04-20*
