# Stack Research

**Domain:** Web-delivered neonatal monitor simulator (PWA, realtime, canvas-heavy, iOS-first)
**Researched:** 2026-04-20
**Overall confidence:** HIGH

---

## TL;DR — PRD Validation

The PRD's proposed stack is **broadly correct for 2026** with four corrections worth surfacing before you write code:

1. **Next.js 14 → Next.js 15.5 (not 16).** 14 is behind. 16 (Oct 2025) makes Turbopack default and removes synchronous `params`/`headers` APIs — fine to adopt but adds breakage surface for a 2–3 week build. 15 is the production sweet spot in April 2026.
2. **iOS Safari does NOT support programmatic orientation lock on iPhone.** Wake Lock works in installed PWAs *only since iOS 18.4*. Plan CSS-based landscape prompt + instructional overlay; don't rely on `screen.orientation.lock('landscape')` — it will silently fail on iPhone PWA.
3. **`apple-mobile-web-app-capable` is deprecated.** Use `mobile-web-app-capable` + `display: standalone` in `manifest.json` + `apple-mobile-web-app-status-bar-style: black-translucent` for the "hide chrome" effect. `display: fullscreen` is not honored on iPhone (iPad only).
4. **Pusher free tier is enough — but just barely.** 100 concurrent / 200k msg/day is sufficient for a single-instructor-to-~10-learners pattern at ≤10 msg/s. Worth scoping a kill-switch for runaway message loops. Ably's free tier (6M msg/month) is more generous if you later open the app publicly; PartyKit/Liveblocks are not better fits for this use case.

Everything else in the PRD (Zustand, Tailwind+shadcn, raw Canvas 2D, raw Web Audio, Zod, TypeScript strict) is correct and current. Raw Canvas 2D is emphatically the right call — don't let anyone sell you Pixi/Konva for three scrolling line charts.

---

## Recommended Stack

### Core Technologies

| Technology | Version (April 2026) | Purpose | Why Recommended | Confidence |
|------------|----------------------|---------|-----------------|------------|
| **Next.js** | `15.5.x` (App Router) | Framework, routing, SSR for landing, client routes for monitor/control | Stable, Vercel-native, App Router is now the default and Pages Router is in maintenance. 15 avoids the breaking `params`/`headers` async-only change in 16 while still being current. Ship on 15, upgrade to 16 after MVP. | HIGH |
| **React** | `19.x` | UI runtime | Comes with Next 15. `useSyncExternalStore` is native (Zustand v5 relies on it). Concurrent rendering is safe for our Canvas workload because we render via `requestAnimationFrame` outside React's commit phase anyway. | HIGH |
| **TypeScript** | `5.6.x+` with `strict: true` | Type safety | Table-stakes. Strict mode plus Zod at the wire boundary gives us end-to-end typed messages without runtime surprises. | HIGH |
| **Vercel** | Hobby (free) tier | Hosting | HTTPS by default (required for Wake Lock, Web Audio autoplay gesture, installable PWA). Zero-config Next.js deploys. Bandwidth free tier is plenty for a session-based app with no media. | HIGH |
| **Pusher Channels** | `pusher-js@8.x`, server SDK `pusher@5.x` | Realtime instructor → monitor sync | Sandbox tier: 100 concurrent / 200k msg/day / 100 channels. Simple WebSocket-over-pub/sub model fits the one-way `VitalsState` diff pattern perfectly. Works well with Next.js route handlers (serverless trigger on instructor side, client-side subscribe on monitor side). | HIGH |
| **Zustand** | `5.0.x` | Local state (vitals store + alarm store) | v5 dropped React <18 support and uses native `useSyncExternalStore`. Minimal boilerplate, precise selector subscriptions (critical for numeric tiles re-rendering independently of waveform frames). Perfect for two parallel stores (one per route). | HIGH |
| **Tailwind CSS** | `4.2.x` | Utility CSS for instructor panel | v4 is ~5× faster full build, 100× faster incremental. CSS-first config via `@theme`. No PostCSS wiring needed. | HIGH |
| **shadcn/ui** | latest CLI, generated 2026-Q2 | Instructor-panel components (Slider, Button, Dialog, Sheet, Toggle, Tabs) | Copy-paste components, not a runtime dependency. Latest components target Tailwind v4 + React 19. Zero lock-in; modify freely. | HIGH |
| **Canvas 2D API** | Browser-native, no library | Waveform rendering (ECG, Pleth) | The existing `design/src/waveforms.js` already uses sweep-draw Canvas 2D. Two waveform channels at 250 Hz/100 Hz sampling, drawing ~4–8 px per frame on a `requestAnimationFrame` tick, is nowhere near the performance envelope that would justify a library. See "What NOT to Use" below. | HIGH |
| **Web Audio API** | Browser-native, no library | Alarm tones, R-wave heartbeat beep | Alarm timing precision (priority tone cadence per IEC 60601-1-8 patterns if you choose to match them) requires `AudioContext.currentTime` scheduling. Any library (Howler, Tone) would either obscure this timing or add bundle weight for no gain. | HIGH |
| **Zod** | `4.x` | Runtime validation of Pusher wire messages | v4 is ~6.5× faster parse, 57% smaller bundle vs v3. Single source of truth — infer TS types from schemas in `lib/sync/messages.ts`. | HIGH |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `pusher-js` | `^8.4` | Client-side Pusher subscribe (both `/monitor` and `/control` need it — monitor subscribes to vitals diffs; control may receive acks) | Always |
| `pusher` (Node) | `^5.2` | Server-side trigger from Next.js route handlers (`app/api/publish/route.ts`) | Instructor → channel publish flows through a route handler to keep APP_SECRET server-side |
| `nanoid` | `^5.0` | 6-char session code generator (URL-safe alphabet) | Session mint endpoint. 6 chars over ~30-char alphabet ≈ 7×10⁸ space; collisions are effectively zero for our scale. |
| `qrcode` | `^1.5` | QR code rendering on instructor panel for the join URL | Instructor panel session-info card |
| `clsx` or `tailwind-merge` | latest | Conditional Tailwind class composition | shadcn generates `cn()` helper that uses both — keep as-is |
| `class-variance-authority` | `^0.7` | Variant-driven component styling (shadcn uses it) | Comes with shadcn; don't add separately |
| `lucide-react` | `^0.460+` | Icon set (shadcn default) | Instructor panel controls; keep monitor-view icon-free to preserve aesthetic |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| **pnpm** or **npm** | Package manager | pnpm recommended for faster installs and strict dep resolution; npm fine if you prefer. Do not use yarn classic in 2026. |
| **Biome** or **ESLint + Prettier** | Lint + format | Biome is single-tool, fast, zero-config. ESLint is the Next.js default and plays better with `next/core-web-vitals`. Either is fine — pick one, don't run both. Recommendation: stick with Next.js default (ESLint) to avoid toolchain config bikeshedding. |
| **Turbopack** | Dev bundler | Enabled by default on Next 15 with `next dev --turbo`. Default in Next 16. Use it — Webpack builds on this project would be needlessly slow. |
| **Vercel CLI** | `vercel deploy --prod` | Link project once, redeploy is one command |

---

## Installation

```bash
# Scaffold (use the create-next-app defaults, choose App Router + TS + Tailwind)
npx create-next-app@latest neosim --typescript --tailwind --app --src-dir=false --import-alias="@/*"

cd neosim

# Core runtime
npm install zustand@^5 zod@^4 pusher-js@^8 pusher@^5 nanoid@^5 qrcode@^1.5

# shadcn/ui (interactive — pick the components you need)
npx shadcn@latest init
npx shadcn@latest add button slider input label dialog sheet tabs toggle separator card

# Dev / types
npm install -D @types/qrcode
```

**Pusher env vars** (add to `.env.local` and Vercel project settings):

```bash
NEXT_PUBLIC_PUSHER_KEY=...
NEXT_PUBLIC_PUSHER_CLUSTER=...   # e.g. us2, eu, ap1
PUSHER_APP_ID=...
PUSHER_SECRET=...
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| **Next.js 15** | Next.js 16 | If you want Turbopack production builds stable by default and are OK rewriting `params`/`headers` as async. For a 2–3 week hobby build, the delta is not worth the breakage. Upgrade after MVP. |
| **Pusher Channels** | **Ably Realtime** | If you outgrow 200k msg/day (unlikely for v1), or need message history/replay for debugging sessions. Ably's free tier is 6M msg/month. Bundle is ~2× larger (50–80 KB vs Pusher's ~35 KB). Drop-in conceptually similar. |
| **Pusher Channels** | **PartyKit** (Cloudflare Durable Objects) | If you want server-authoritative session state (e.g. APGAR timer ticks from the server, not the monitor). Tempting, but adds a Cloudflare dep and PartyKit rooms struggle above ~40 connections. For our "1 instructor + 1–2 learners" pattern it's over-engineered. |
| **Pusher Channels** | **Liveblocks** | Only if you later need CRDT-style collab (multiple instructors editing state). We have a strict single-writer model; CRDTs add unnecessary complexity. |
| **Pusher Channels** | **Supabase Realtime / Postgres CDC** | If you add persistence (scenario save/load in v2) you already have a DB; broadcasting over Postgres channels becomes reasonable. Not for v1 — you'd be adding a DB just to get realtime. |
| **Pusher Channels** | **Native WebSocket on Vercel** | Vercel Serverless does not support long-lived WebSockets on hobby tier. Only viable via Vercel Functions with `fluid` / edge streaming, which is still awkward. Skip. |
| **Raw Canvas 2D** | **PixiJS** | Hundreds+ of concurrent sprites with transforms/filters. We have 2 lines. Skip. |
| **Raw Canvas 2D** | **Konva** | Scene-graph with hit testing. We have no interactive canvas elements. Skip. |
| **Raw Canvas 2D** | **D3 / Observable Plot / Recharts / Chart.js** | Historical/statistical visualizations. All rebuild the entire chart on update — fatal at 60 fps on mobile. Do NOT use. |
| **Raw Web Audio API** | **Howler.js** | Playing sampled sound files (music, voice). We synthesize tones; Howler adds ~7 KB and hides the timing primitives we need. |
| **Raw Web Audio API** | **Tone.js** | Music/sequencer workloads. Over-engineered for 3 alarm tones and a beep. |
| **Zustand** | **Jotai** / **Valtio** / **Redux Toolkit** | Atom-granular state (Jotai) or proxy-based (Valtio) are fine but don't improve our pattern. Redux adds ceremony for no gain. |
| **Zustand** | **React Context + useReducer** | Viable for the instructor panel only, but two stores (vitals + alarms) with selector-based subscriptions are far cleaner in Zustand, and selectors prevent full-subtree re-renders — important for the monitor where numeric tiles shouldn't re-render when unrelated vitals change. |
| **Tailwind v4 + shadcn** | **Tailwind v3** | No reason to start on v3 in 2026. v4 is stable and materially faster. |
| **Tailwind v4 + shadcn** | **Plain CSS / CSS Modules** | Instructor panel has ~15+ controls; utility-first plus shadcn primitives is dramatically faster to build than hand-rolled CSS. Monitor view uses inline styles already in the prototype — keep that pattern (no Tailwind needed for monitor waveform surface). |
| **Zod** | **Valibot** / **ArkType** | Smaller bundles, but Zod v4 closed most of the gap (~57% smaller than v3) and has the widest ecosystem. Stick with Zod. |
| **Vercel** | **Cloudflare Pages + Workers** | Would unlock native WebSockets via Durable Objects but breaks Next.js App Router's Node APIs unless you use the Cloudflare adapter. Adds friction for zero MVP benefit. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **Chart.js / Recharts / Victory / Nivo / D3 line charts for waveforms** | All designed for static-or-paginated data series; internally rebuild scales + redraw the full path on each update. A sweep-draw ECG at 60 fps with 250 Hz samples would thrash GC and miss frames on iPhone 12. | Raw `CanvasRenderingContext2D.lineTo()` with a circular buffer, writing only new samples and a clear gap each frame. |
| **PixiJS / Konva** | WebGL/scene-graph overhead is pure waste for 2 thin polylines. Pixi on iOS Safari also has occasional context-loss bugs when backgrounded. | Raw Canvas 2D. |
| **Howler.js / Tone.js for alarms** | Hide `AudioContext.currentTime` scheduling — exactly the thing we need for accurate alarm cadence and R-wave-synced beep. Also introduce an extra user-gesture-unlock ceremony that duplicates what we already have to do. | `new AudioContext()`, scheduled `OscillatorNode` + `GainNode` envelopes. |
| **`apple-mobile-web-app-capable` meta tag** | Deprecated per Apple; may produce a degraded install experience. Next.js issue #70272 tracks its removal from defaults. | `<meta name="mobile-web-app-capable" content="yes">` + `manifest.json` with `"display": "standalone"`. Also set `apple-mobile-web-app-status-bar-style: black-translucent` to visually hide the iOS status-bar background on a black monitor. |
| **`screen.orientation.lock('landscape')` on iPhone PWA** | iPhone Safari silently ignores programmatic orientation lock (as of iOS 26). iPad fullscreen honors it; iPhone does not. Will fail with no error. | CSS-only approach: `@media (orientation: portrait) { .monitor { display: hidden } .please-rotate { display: flex } }` plus a "Rotate your device" overlay with an icon. Document the limitation. |
| **`display: fullscreen` in manifest (iPhone)** | Only honored on iPad. On iPhone, only `standalone` is supported. | `"display": "standalone"`, acknowledge the status-bar area exists on iPhone, use `black-translucent` styling. |
| **Next.js Pages Router** | Maintenance mode in 2026. App Router has been the default for 2+ years. | App Router (PRD already specifies this). |
| **Redux / Redux Toolkit** | Action/reducer boilerplate is not worth it for ~15 atomic state fields. | Zustand. |
| **Socket.IO / self-hosted WebSocket** | Vercel hobby tier cannot host persistent WebSocket servers. Socket.IO also forces a heavier protocol. | Pusher Channels (managed WebSocket). |
| **`useState` for the 60 fps frame loop** | Setting state at 60 fps triggers React reconciliation per frame — unnecessary cost. | `useRef` + `requestAnimationFrame` + imperative canvas draw; only `setState` on discrete events (alarm fires, R-peak pulse indicator, vitals diff arrives). |
| **Generating waveform samples on instructor and sending over the wire** | PRD correctly rules this out; documenting here so no one accidentally does it during refactor. Would blow the 200k msg/day budget in ~20 seconds. | Monitor generates samples locally from shared parameters. |

---

## Stack Patterns by Variant

**If instructor turnout outgrows Pusher free tier (>100 concurrent sessions live at once):**
- Swap to Ably (6M msg/month free, 200 peak connections free).
- Wire code is near-identical — abstract the publish/subscribe in `lib/sync/transport.ts` behind an interface so swapping is a one-file change.
- Because: we have no lock-in to Pusher features; both are pub/sub channels.

**If you later add scenario persistence (v2):**
- Add Supabase (Postgres + Realtime, Auth, Storage) — single-vendor, generous free tier.
- Keep Pusher for the session-level realtime; Supabase Realtime is Postgres-change-based and less suited to ephemeral 1–10 msg/s.
- Because: the sync pattern is different (ephemeral command stream vs. persistent document diff).

**If iPhone 12 performance testing reveals frame drops on 2-waveform monitor:**
- First resort: reduce render rate to 30 fps on battery (`OffscreenCanvas` not needed). Sweep-draw at 30 fps looks identical to most observers for ECG.
- Second resort: move waveform generation into a Web Worker, transfer samples via `postMessage` with `SharedArrayBuffer`. Canvas must still draw on main thread (Safari doesn't support `OffscreenCanvas` transfer reliably on iOS as of 2026).
- Do NOT jump to Pixi/WebGL — frame drops at this workload indicate a different bug (allocations in the hot loop, wrong canvas sizing, DPR mismatch), not a renderer-capability issue.

**If you need server-authoritative APGAR timer (v2):**
- Migrate timer tick source-of-truth to a Durable Object (PartyKit) or a Supabase edge function with a scheduled broadcast.
- For v1, monitor generates tick locally; instructor sees acknowledgements via Pusher — acceptable drift of <1s.

---

## iOS Safari 16.4+ Gotchas (Per-Choice)

| Choice | iOS-Specific Gotcha | Mitigation |
|--------|---------------------|------------|
| **Wake Lock API** | Only works in installed PWAs since iOS 18.4. Earlier PWAs silently fail. In-browser Safari works since 16.6. | Feature-detect (`'wakeLock' in navigator`). Show a "Add to Home Screen for full experience" hint on first load if not installed. Target audience (sim-lab instructors) can install once. |
| **Web Audio API** | `AudioContext` starts in `suspended` state until a user gesture. `<button>` click handlers on iOS must call `audioContext.resume()` synchronously — no `await` before it. | "Tap to start" overlay on `/monitor/[id]` that calls `ctx.resume()` inside the click handler. Also pre-arm one silent buffer to warm the output path (avoids first-alarm delay). |
| **Screen orientation lock** | iPhone PWA does NOT honor `screen.orientation.lock()`. iPad does (in fullscreen). | CSS media query + "Please rotate" overlay, as above. Document the limitation in docs/build-notes; it's an iOS platform constraint, not something we can fix. |
| **PWA fullscreen** | `display: fullscreen` ignored on iPhone. `standalone` hides Safari address bar but keeps status bar. | `display: standalone` + `apple-mobile-web-app-status-bar-style: black-translucent` + monitor background `#000` gives the hospital-monitor look. Acknowledge the 44pt notch area in layout. |
| **Pusher WebSocket** | Safari aggressively suspends background tabs; WS connection may drop when monitor backgrounds. | Handle Pusher `disconnected` event; auto-reconnect is on by default. On reconnect, instructor re-broadcasts full state so monitor resyncs. Also use Wake Lock + keep monitor foregrounded. |
| **Canvas 2D DPR** | iPhone 12 has `devicePixelRatio: 3`. Not scaling leads to blur; over-scaling destroys perf. | `canvas.width = cssWidth * dpr; canvas.height = cssHeight * dpr; ctx.scale(dpr, dpr);` on mount and on `resize`. Cap at `dpr = 2` for performance headroom if needed. |
| **Zustand** | None. Pure JS, no iOS-specific considerations. | — |
| **shadcn/ui** | Radix primitives use `pointer-events`; all fine on iOS. Portals + dialogs work. | — |
| **Tailwind v4** | Uses modern CSS (container queries, `@property`). Baseline Safari 16.4 supports all of this. | — |
| **Next.js 15 App Router** | `viewport` export must set `maximum-scale=1, user-scalable=no` only on monitor route, not landing — don't block pinch-zoom on marketing copy. | Per-route `viewport` export in the `monitor/[id]` layout. |

---

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `next@15.5` | `react@19`, `react-dom@19` | Bundled; do not mix React 18 and Next 15 on new projects. |
| `zustand@5` | `react@>=18` | Drops React 16/17. Uses native `useSyncExternalStore`. |
| `zod@4` | `typescript@>=5.0` | `z.infer` relies on recent TS features. |
| `tailwindcss@4` | Node `>=18`, modern browsers only | Safari 16.4+ is baseline — matches our target. No IE / legacy fallbacks. |
| `pusher-js@8` | Any modern browser | Auto-reconnect, connection pooling baked in. |
| `shadcn` components (latest) | `tailwindcss@4`, `react@19`, `radix-ui` latest | When running `npx shadcn add`, components are generated for your Tailwind version — keep CLI on latest. |

---

## Build Order Implications for Roadmap

Research suggests the three-phase plan in PRD §12 is correct. Stack-specific notes:

- **Phase 1 (waveform prototype):** No Pusher, no Zustand, no shadcn. Just a Next.js 15 app with one client route, raw Canvas, hardcoded state. Validates raw Canvas 2D + DPR handling on iPhone 12 **before** any architectural bets. Do this first.
- **Phase 2 (full local monitor):** Add Zustand (vitals + alarms), Web Audio alarm synth, APGAR timer, all numeric tiles. Still no sync. Validates the render budget with all three subsystems live.
- **Phase 3 (split + sync + deploy):** Add `/control` route, shadcn components for instructor UI, Pusher, Zod schemas, Vercel deploy, PWA manifest + Wake Lock + iOS polish. Biggest phase — most PRD-noted risk lives here (iOS PWA quirks).

Leave Next.js 16 upgrade and any realtime-provider swap (Ably) as post-MVP.

---

## Sources

- [Next.js 16 release notes](https://nextjs.org/blog/next-16) — confirmed 16 GA, Turbopack default, breaking `params`/`headers` change
- [Next.js v15 upgrade guide](https://nextjs.org/docs/app/guides/upgrading/version-15) — stable baseline
- [Pusher Channels Pricing](https://pusher.com/channels/pricing/) — Sandbox: 100 concurrent, 200k msg/day, 100 channels
- [Ably vs Pusher comparison (2026)](https://ably.com/compare/ably-vs-pusher) — free-tier and bundle-size numbers verified
- [Zustand v5 announcement](https://pmnd.rs/blog/announcing-zustand-v5/) — React 18+ requirement, native `useSyncExternalStore`
- [Tailwind v4 blog](https://tailwindcss.com/blog/tailwindcss-v4) + [InfoQ v4.2 release](https://www.infoq.com/news/2026/04/tailwind-css-4-2-webpack/) — v4.2 is current April 2026
- [shadcn/ui Tailwind v4 docs](https://ui.shadcn.com/docs/tailwind-v4) — current components target Tailwind v4 + React 19
- [Zod v4 release notes](https://zod.dev/v4) + [migration guide](https://zod.dev/v4/changelog) — 6.5× faster parse, 57% smaller bundle
- [Wake Lock caniuse](https://caniuse.com/wake-lock) + [web.dev: Wake Lock supported in all browsers](https://web.dev/blog/screen-wake-lock-supported-in-all-browsers) + [WebKit bug 254545](https://bugs.webkit.org/show_bug.cgi?id=254545) — iOS 18.4 fix for PWA Wake Lock confirmed
- [MDN: Autoplay Guide](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay) + [Web Audio best practices](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices) — user-gesture unlock requirement
- [PWA iOS Limitations 2026](https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide) + [Next.js issue #70272](https://github.com/vercel/next.js/issues/70272) — `apple-mobile-web-app-capable` deprecation, orientation lock limitation
- [Canvas engines comparison](https://benchmarks.slaylines.io/) — native Canvas 2D sufficient for chart-rate rendering
- [Vercel: Deploying Pusher with Vercel KB](https://vercel.com/kb/guide/deploying-pusher-channels-with-vercel) — recommended integration path

---
*Stack research for: web-delivered neonatal monitor PWA*
*Researched: 2026-04-20*
