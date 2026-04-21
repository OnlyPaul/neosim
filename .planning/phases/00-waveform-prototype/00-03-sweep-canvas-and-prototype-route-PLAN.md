---
phase: 00-waveform-prototype
plan: 03
type: execute
wave: 3
depends_on:
  - "00-01"
  - "00-02"
files_modified:
  - lib/waveforms/sweepCanvas.ts
  - lib/waveforms/buffer.ts
  - app/prototype/page.tsx
  - app/prototype/PrototypeClient.tsx
autonomous: true
requirements:
  - WAVE-01
  - WAVE-04
  - WAVE-05
user_setup: []

must_haves:
  truths:
    - "Canvas backing store = cssSize × window.devicePixelRatio with NO cap — DPR=3 on iPhone 12+ renders crisply (WAVE-05)"
    - "ctx.scale(dpr, dpr) applied exactly once at setup; all subsequent draw math in CSS pixels"
    - "Clear-ahead rect per frame uses the Pitfall 4 envelope `ceil(pxPerFrame) + lineWidth + 2` CSS px; no full-canvas clearRect (WAVE-01)"
    - "A single `Float32Array(250 * 5 = 1250)` ring buffer is allocated once per channel; writes use modular index (WAVE-04 / Pitfall 13)"
    - "FPS overlay updates textContent via ref at 1Hz (not per frame); React state is never touched in the rAF hot path (Pitfall E)"
    - "/prototype route renders the client component; Server Component shell does no runtime work"
  artifacts:
    - path: "lib/waveforms/sweepCanvas.ts"
      provides: "DPR-aware sweep-draw primitive; setupSweepCanvas + stepSweep pure-ish functions"
      exports: ["SweepCtx", "setupSweepCanvas", "stepSweep"]
      min_lines: 60
    - path: "lib/waveforms/buffer.ts"
      provides: "Fixed-size Float32Array ring buffer with createRingBuffer + writeSample (WAVE-04)"
      exports: ["RingBuffer", "createRingBuffer", "writeSample"]
    - path: "app/prototype/page.tsx"
      provides: "Server Component shell that renders PrototypeClient"
      contains: "PrototypeClient"
    - path: "app/prototype/PrototypeClient.tsx"
      provides: "Client component: canvas + overlay refs, rAF loop, FPS instrumentation, throwaway"
      contains: "'use client'"
      min_lines: 60
  key_links:
    - from: "app/prototype/PrototypeClient.tsx"
      to: "lib/waveforms/sweepCanvas.ts + lib/waveforms/sampleEcg.ts + lib/waveforms/engine-state.ts + lib/waveforms/buffer.ts"
      via: "@/lib/waveforms/* imports"
      pattern: "from '@/lib/waveforms/"
    - from: "lib/waveforms/sweepCanvas.ts"
      to: "window.devicePixelRatio"
      via: "DPR read without Math.min cap"
      pattern: "window\\.devicePixelRatio"
    - from: "app/prototype/page.tsx"
      to: "app/prototype/PrototypeClient.tsx"
      via: "default export of Server Component that renders <PrototypeClient />"
      pattern: "PrototypeClient"
---

<objective>
Build the DPR-aware Canvas 2D sweep-draw primitive, the Float32Array ring buffer, and the throwaway `/prototype` route that wires it all together — consuming `createEngineState` + `sampleEcg` from earlier plans and producing an iPhone-ready page whose FPS overlay is the key piece of evidence for Phase 0 sign-off.

Purpose: This plan validates the three hardest technical bets of the phase — real DPR=3 support (WAVE-05, the explicit fix over design prototype's `Math.min(DPR, 2)`), the Float32Array ring buffer (WAVE-04, prevents 25-min crash documented in Pitfall 13), and the clear-ahead sweep-draw algorithm (WAVE-01, Pitfall 4 envelope). The FPS overlay is instrumentation that Plan 04 uses to capture evidence; it must not itself cause the frame drops it's measuring (Pitfall E).

Output: `lib/waveforms/sweepCanvas.ts` (permanent, ships to Phase 2), `lib/waveforms/buffer.ts` (permanent), `app/prototype/page.tsx` + `app/prototype/PrototypeClient.tsx` (throwaway, delete after Phase 2 ships). After this plan, `pnpm dev` should render a green ECG sinus sweep on desktop Safari/Chrome; Plan 04 deploys it to Vercel and captures iPhone evidence.
</objective>

<execution_context>
@/Users/onlypaul/Workspace/neosim/.claude/get-shit-done/workflows/execute-plan.md
@/Users/onlypaul/Workspace/neosim/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@/Users/onlypaul/Workspace/neosim/CLAUDE.md
@/Users/onlypaul/Workspace/neosim/.planning/phases/00-waveform-prototype/00-CONTEXT.md
@/Users/onlypaul/Workspace/neosim/.planning/phases/00-waveform-prototype/00-RESEARCH.md
@/Users/onlypaul/Workspace/neosim/.planning/phases/00-waveform-prototype/00-PATTERNS.md
@/Users/onlypaul/Workspace/neosim/.planning/phases/00-waveform-prototype/00-UI-SPEC.md
@/Users/onlypaul/Workspace/neosim/design/src/canvasChannel.jsx
@/Users/onlypaul/Workspace/neosim/.planning/phases/00-waveform-prototype/00-01-scaffold-and-engine-state-PLAN.md
@/Users/onlypaul/Workspace/neosim/.planning/phases/00-waveform-prototype/00-02-engine-math-and-tests-PLAN.md

<interfaces>
<!-- Consumed from Plans 01/02: -->

```typescript
// from '@/lib/waveforms/engine-state'
export interface EngineState { phase: number; rFired: boolean; lastT: number; jitter: number }
export function createEngineState(): EngineState;

// from '@/lib/waveforms/sampleEcg'
export interface SampleResult { v: number; rPeak: boolean }
export function sampleEcg(t: number, hr: number, s: EngineState): SampleResult;
```

<!-- Created by this plan (authoritative shapes from RESEARCH.md lines 672–849): -->

```typescript
// lib/waveforms/sweepCanvas.ts
export interface SweepCtx {
  ctx: CanvasRenderingContext2D;
  dpr: number;
  cssW: number;
  cssH: number;
  pxPerSec: number;
  lineWidth: number;
  color: string;
  bg: string;
  writeHead: number;
  lastY: number;
}

export function setupSweepCanvas(
  canvas: HTMLCanvasElement,
  opts: { cssW: number; cssH: number; sweepSeconds: number; color: string; bg: string },
): SweepCtx;

export function stepSweep(
  sc: SweepCtx,
  tNow: number,
  dtMs: number,
  sampleFn: (t: number) => { v: number; rPeak: boolean },
  scale: number,
): void;

// lib/waveforms/buffer.ts (new; WAVE-04 literal implementation per D-10)
export interface RingBuffer {
  data: Float32Array;
  length: number;
  writeIdx: number;
  sampleRate: number;
  sweepSeconds: number;
}

export function createRingBuffer(sampleRate: number, sweepSeconds: number): RingBuffer;
export function writeSample(rb: RingBuffer, v: number): void;
```

<!-- Port-source (design/src/canvasChannel.jsx) — algorithm only, with mandatory fixes: -->

```js
// design/src/canvasChannel.jsx:10 — DO NOT PORT VERBATIM
const dpr = Math.min(window.devicePixelRatio || 1, 2);   // ← WAVE-05 VIOLATION

// Correct version (LOCKED by D-07 + Pitfall A):
const dpr = window.devicePixelRatio || 1;                // no cap

// design/src/canvasChannel.jsx:37-56 — PORT THE ALGORITHM, rewrite units to CSS px
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Write Float32Array ring buffer + DPR-aware sweep-draw primitive</name>
  <files>lib/waveforms/buffer.ts, lib/waveforms/sweepCanvas.ts, tests/waveforms/buffer.test.ts</files>
  <behavior>
    **buffer.ts (WAVE-04):**
    - `createRingBuffer(sampleRate, sweepSeconds)` returns `{ data: new Float32Array(sampleRate * sweepSeconds), length: sampleRate * sweepSeconds, writeIdx: 0, sampleRate, sweepSeconds }`. For P0: `createRingBuffer(250, 5)` → 1250-sample buffer, exactly 5 KB.
    - `writeSample(rb, v)` does `rb.data[rb.writeIdx] = v; rb.writeIdx = (rb.writeIdx + 1) % rb.length;`. No `.push`, no `.slice`, no reallocation.
    - buffer.test.ts proves: (1) creation allocates the correct length; (2) writing `length + 10` samples wraps and leaves `writeIdx = 10`; (3) `data` remains the SAME `Float32Array` reference after any number of writes (no reallocation); (4) `data.byteLength` === `length * 4` (Float32 = 4 bytes).

    **sweepCanvas.ts (WAVE-01, WAVE-05):**
    - `setupSweepCanvas(canvas, opts)` reads `window.devicePixelRatio || 1` with NO cap, sets `canvas.width = floor(cssW * dpr)` + `canvas.height = floor(cssH * dpr)` + `canvas.style.width = cssW + 'px'` + `canvas.style.height = cssH + 'px'`, gets `ctx = canvas.getContext('2d', { alpha: false })`, calls `ctx.scale(dpr, dpr)` ONCE, fills background, computes `lineWidth = Math.max(1.6, Math.ceil(dpr * 1.4))` in CSS px, configures `lineJoin='round'`, `lineCap='round'`, returns a `SweepCtx` object with `writeHead: 0` and `lastY: cssH / 2`.
    - `stepSweep(sc, tNow, dtMs, sampleFn, scale)` computes `advancePx = max(1, ceil((dtMs/1000) * pxPerSec))`, `clearAhead = advancePx + lineWidth + 2`, iterates `i = 1..advancePx` performing wrap-safe clear-ahead rect + `sampleFn(sampleT)` + `ctx.lineTo(x, y)` draw. Updates `sc.writeHead` and `sc.lastY` at end of loop.
    - NO `ResizeObserver` (Pitfall D, P0 is static landscape).
  </behavior>
  <read_first>
    - /Users/onlypaul/Workspace/neosim/.planning/phases/00-waveform-prototype/00-RESEARCH.md §sweepCanvas.ts (lines 670–759) — authoritative shape, copy-paste source
    - /Users/onlypaul/Workspace/neosim/.planning/phases/00-waveform-prototype/00-RESEARCH.md §Pattern 1 DPR-Aware Canvas (lines 291–314) + §Pattern 2 Clear-Ahead Rect (lines 316–346) + §Pattern 5 Float32Array Circular Buffer (lines 396–408)
    - /Users/onlypaul/Workspace/neosim/.planning/phases/00-waveform-prototype/00-RESEARCH.md §Pitfall A DPR Cap Shortcut (lines 436–444) + §Pitfall D Canvas Context Scale Applied Twice (lines 462–470)
    - /Users/onlypaul/Workspace/neosim/.planning/phases/00-waveform-prototype/00-PATTERNS.md §sweepCanvas.ts PORT-PARTIAL (lines 94–143) — three mandatory port fixes
    - /Users/onlypaul/Workspace/neosim/.planning/phases/00-waveform-prototype/00-UI-SPEC.md §Canvas surface (lines 124–131) + §Color (accent `#22c55e`)
    - /Users/onlypaul/Workspace/neosim/.planning/phases/00-waveform-prototype/00-CONTEXT.md D-06, D-07, D-10 — sweep color/window/DPR/buffer locks
    - /Users/onlypaul/Workspace/neosim/design/src/canvasChannel.jsx (read lines 1-65 ONLY — port source)
  </read_first>
  <action>
    Three files, TDD where cheap (buffer is easily unit-tested; sweepCanvas is a rendering side-effect and not worth mocking Canvas for P0).

    **Step A — buffer.test.ts (RED):** Write the test first:
    ```ts
    // tests/waveforms/buffer.test.ts
    import { describe, it, expect } from 'vitest';
    import { createRingBuffer, writeSample } from '@/lib/waveforms/buffer';

    describe('Float32Array ring buffer (WAVE-04)', () => {
      it('allocates sampleRate * sweepSeconds samples', () => {
        const rb = createRingBuffer(250, 5);
        expect(rb.length).toBe(1250);
        expect(rb.data).toBeInstanceOf(Float32Array);
        expect(rb.data.length).toBe(1250);
        expect(rb.data.byteLength).toBe(1250 * 4);
      });
      it('wraps writeIdx modulo length and never reallocates .data', () => {
        const rb = createRingBuffer(250, 5);
        const originalData = rb.data;
        for (let i = 0; i < rb.length + 10; i++) writeSample(rb, i);
        expect(rb.writeIdx).toBe(10);
        expect(rb.data).toBe(originalData);       // same Float32Array reference
        expect(rb.data.length).toBe(1250);        // length unchanged
      });
      it('writes sample values into the correct slot', () => {
        const rb = createRingBuffer(10, 1);
        writeSample(rb, 0.5);
        writeSample(rb, 0.25);
        expect(rb.data[0]).toBeCloseTo(0.5);
        expect(rb.data[1]).toBeCloseTo(0.25);
        expect(rb.writeIdx).toBe(2);
      });
    });
    ```

    Run `pnpm test` — expect RED on buffer tests only (other Plan 02 tests should remain green).

    **Step B — buffer.ts (GREEN):** Write the implementation:
    ```ts
    // lib/waveforms/buffer.ts
    // WAVE-04 literal implementation per D-10. Per Pitfall 13: no Array.push, no .slice, no realloc.
    export interface RingBuffer {
      data: Float32Array;
      length: number;
      writeIdx: number;
      sampleRate: number;
      sweepSeconds: number;
    }

    export function createRingBuffer(sampleRate: number, sweepSeconds: number): RingBuffer {
      const length = sampleRate * sweepSeconds;
      return {
        data: new Float32Array(length),
        length,
        writeIdx: 0,
        sampleRate,
        sweepSeconds,
      };
    }

    export function writeSample(rb: RingBuffer, v: number): void {
      rb.data[rb.writeIdx] = v;
      rb.writeIdx = (rb.writeIdx + 1) % rb.length;
    }
    ```

    `pnpm test` goes GREEN.

    **Step C — sweepCanvas.ts:** Write the file VERBATIM from RESEARCH.md §sweepCanvas.ts (lines 672–759). Critical details to preserve:
    - `const dpr = window.devicePixelRatio || 1;` — NO `Math.min(..., 2)` cap (Pitfall A / WAVE-05 — the explicit correction to `design/src/canvasChannel.jsx:10`).
    - `ctx.getContext('2d', { alpha: false })` — opaque surface is faster on iPhone.
    - `ctx.scale(dpr, dpr)` ONCE; never again. Document this in a comment: `// Apply once; all subsequent math in CSS px. Never call scale() again on this context.`
    - `lineWidth = Math.max(1.6, Math.ceil(dpr * 1.4))` — crisp at DPR 1/2/3.
    - `strokeStyle = opts.color` (passed in as `'#22c55e'` from PrototypeClient per D-06 / UI-SPEC §Color).
    - Clear-ahead width: `const clearAhead = advancePx + lineWidth + 2;` — Pitfall 4 envelope EXACTLY.
    - Wrap-safe erase: `const eraseStart = (x + 1) % cssW; const eraseW = Math.min(clearAhead, cssW - eraseStart); if (eraseW < clearAhead) ctx.fillRect(0, 0, clearAhead - eraseW, cssH);`
    - Conditional stroke to suppress the wrap-around segment: `if (x >= sc.writeHead && (x - sc.writeHead) < clearAhead * 4) { ctx.moveTo(...); ctx.lineTo(...); ctx.stroke(); }`
    - NO ResizeObserver (Pitfall D).
    - NO buffer integration in `stepSweep` — per RESEARCH.md §Pattern 5 Decision, we allocate the buffer in PrototypeClient and write to it on each sample call in Task 2, but the draw loop reads `sampleFn(sampleT)` directly. The buffer's presence satisfies WAVE-04/D-10 literally (single Float32Array allocated once, modular writes); per-frame draw does not need to read from it at one channel.

    Do not write an automated test for sweepCanvas.ts — Canvas-API mocks in jsdom are brittle and the real validation is the iPhone FPS screenshot in Plan 04. `pnpm exec tsc --noEmit` + `pnpm exec biome check` are the P0 gates for this file.

    Commit once the three files compile, lint, and `pnpm test` is fully green (Plan 02 tests + new buffer tests = 9 total).
  </action>
  <verify>
    <automated>pnpm test &amp;&amp; pnpm exec tsc --noEmit &amp;&amp; pnpm exec biome check lib/waveforms/</automated>
  </verify>
  <acceptance_criteria>
    - `test -f lib/waveforms/buffer.ts` and `test -f lib/waveforms/sweepCanvas.ts` and `test -f tests/waveforms/buffer.test.ts`
    - `grep -E "new Float32Array" lib/waveforms/buffer.ts` matches
    - `grep -E "% rb\\.length" lib/waveforms/buffer.ts` matches (modular wrap)
    - `grep -E "\\.push\\(" lib/waveforms/buffer.ts` returns NO matches (Pitfall 13 compliance)
    - `grep -E "window\\.devicePixelRatio \\|\\| 1" lib/waveforms/sweepCanvas.ts` matches (real DPR read)
    - `grep -E "Math\\.min\\(.*dpr.*,\\s*2\\)" lib/waveforms/sweepCanvas.ts` returns NO matches (WAVE-05 port-fix verified)
    - `grep -E "Math\\.min\\(.*devicePixelRatio.*,\\s*2\\)" lib/waveforms/sweepCanvas.ts` returns NO matches (same check, different variable name)
    - `grep -E "getContext\\('2d', \\{ alpha: false \\}\\)" lib/waveforms/sweepCanvas.ts` matches (opaque surface)
    - `grep -E "ctx\\.scale\\(dpr, dpr\\)" lib/waveforms/sweepCanvas.ts` matches exactly once (`grep -c` returns 1)
    - `grep -E "advancePx \\+ lineWidth \\+ 2" lib/waveforms/sweepCanvas.ts` matches (Pitfall 4 envelope LOCKED by D-06)
    - `grep -E "ResizeObserver" lib/waveforms/sweepCanvas.ts` returns NO matches (Pitfall D compliance)
    - `grep -E "export function setupSweepCanvas" lib/waveforms/sweepCanvas.ts` matches
    - `grep -E "export function stepSweep" lib/waveforms/sweepCanvas.ts` matches
    - `pnpm test` exits 0 (all 9 tests green: 2 merge + 4 sample-ecg + 3 buffer)
    - `pnpm exec tsc --noEmit` exits 0
    - `pnpm exec biome check lib/waveforms/` exits 0
  </acceptance_criteria>
  <done>
    `lib/waveforms/buffer.ts` (Float32Array ring buffer, 3 tests green), `lib/waveforms/sweepCanvas.ts` (DPR-aware primitive, no DPR cap, single `ctx.scale`, Pitfall 4 clear-ahead formula). All 9 Vitest tests green, TS strict compiles, Biome lints clean.
  </done>
</task>

<task type="auto">
  <name>Task 2: Write /prototype route — Server shell + client component with FPS overlay</name>
  <files>app/prototype/page.tsx, app/prototype/PrototypeClient.tsx</files>
  <read_first>
    - /Users/onlypaul/Workspace/neosim/.planning/phases/00-waveform-prototype/00-RESEARCH.md §app/prototype/page.tsx + PrototypeClient.tsx (lines 761–849) — authoritative shape
    - /Users/onlypaul/Workspace/neosim/.planning/phases/00-waveform-prototype/00-RESEARCH.md §Pitfall E FPS Overlay Causes Its Own Reflow (lines 472–498) — 1Hz via ref, NOT 60Hz via state
    - /Users/onlypaul/Workspace/neosim/.planning/phases/00-waveform-prototype/00-UI-SPEC.md §FPS overlay (lines 116–123) + §Canvas surface (lines 124–131) + §Copywriting Contract (lines 86–101) — visual/text locks
    - /Users/onlypaul/Workspace/neosim/.planning/phases/00-waveform-prototype/00-CONTEXT.md D-01 (/prototype throwaway), D-06 (sweep color/window), D-13 (iPhone as test target)
    - /Users/onlypaul/Workspace/neosim/lib/waveforms/sweepCanvas.ts, lib/waveforms/sampleEcg.ts, lib/waveforms/engine-state.ts, lib/waveforms/buffer.ts (all exist from prior tasks)
  </read_first>
  <action>
    Two files matching RESEARCH.md §app/prototype/page.tsx and §app/prototype/PrototypeClient.tsx (lines 761–849).

    **app/prototype/page.tsx** (Server Component shell, ~5 lines):
    ```tsx
    // app/prototype/page.tsx
    // THROWAWAY — Phase 0 waveform prototype. Deleted after Phase 2 ships per D-01.
    import PrototypeClient from './PrototypeClient';
    export const metadata = { title: 'NeoSim — Waveform Prototype' };
    export default function Page() { return <PrototypeClient />; }
    ```

    **app/prototype/PrototypeClient.tsx** — VERBATIM from RESEARCH.md lines 772–849, with the WAVE-04 buffer integrated (RESEARCH.md doesn't show buffer wiring; add it per CONTEXT D-10 literal reading):

    ```tsx
    // app/prototype/PrototypeClient.tsx
    // THROWAWAY — deleted after Phase 2 per D-01.
    'use client';
    import { useEffect, useRef } from 'react';
    import { createEngineState } from '@/lib/waveforms/engine-state';
    import { sampleEcg } from '@/lib/waveforms/sampleEcg';
    import { setupSweepCanvas, stepSweep } from '@/lib/waveforms/sweepCanvas';
    import { createRingBuffer, writeSample } from '@/lib/waveforms/buffer';

    export default function PrototypeClient() {
      const canvasRef = useRef<HTMLCanvasElement>(null);
      const overlayRef = useRef<HTMLDivElement>(null);

      useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const sc = setupSweepCanvas(canvas, {
          cssW: rect.width,
          cssH: rect.height,
          sweepSeconds: 5,          // D-06
          color: '#22c55e',         // D-06 / UI-SPEC §Color accent
          bg: '#000000',            // UI-SPEC §Color dominant
        });
        const engine = createEngineState();
        const rb = createRingBuffer(250, 5);   // WAVE-04 / D-10: allocate once, 1250 samples, 5 KB
        const HR = 140;             // synthetic neonatal resting HR for P0 (UI-SPEC §Copywriting — no slider at P0)
        const SCALE = 40;           // visual amplitude in CSS px; tunable

        const fpsRing = new Float32Array(180);   // ~3 s at 60 fps (Pitfall E)
        let ringIdx = 0;
        let lastOverlayUpdate = 0;
        let lastT = performance.now();
        let rafId = 0;

        const tick = (t: DOMHighResTimeStamp) => {
          const dt = Math.min(100, t - lastT);   // Pitfall C on the draw loop side
          lastT = t;

          // sampleFn closure — writes each sample into the ring buffer (WAVE-04 literal) AND returns it to the draw loop
          const sampleFn = (sampleT: number) => {
            const res = sampleEcg(sampleT, HR, engine);
            writeSample(rb, res.v);
            return res;
          };
          stepSweep(sc, t, dt, sampleFn, SCALE);

          fpsRing[ringIdx] = dt > 0 ? 1000 / dt : 60;
          ringIdx = (ringIdx + 1) % fpsRing.length;

          if (t - lastOverlayUpdate > 1000 && overlayRef.current) {
            let sum = 0, min = Infinity, count = 0;
            for (let i = 0; i < fpsRing.length; i++) {
              const v = fpsRing[i];
              if (v > 0) { sum += v; if (v < min) min = v; count++; }
            }
            const avg = count > 0 ? Math.round(sum / count) : 0;
            overlayRef.current.textContent = `FPS ${avg} · min ${isFinite(min) ? Math.round(min) : 0}`;
            overlayRef.current.style.color = avg < 55 ? '#f59e0b' : 'rgba(255,255,255,0.72)';
            lastOverlayUpdate = t;
          }
          rafId = requestAnimationFrame(tick);
        };
        rafId = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(rafId);
      }, []);

      return (
        <main
          style={{
            background: '#000',
            width: '100vw',
            height: '100vh',
            margin: 0,
            position: 'relative',
          }}
        >
          <canvas
            ref={canvasRef}
            role="img"
            aria-label="ECG Lead II sinus rhythm waveform — prototype"
            style={{ width: '100vw', height: '50vh', display: 'block' }}
          />
          <div
            ref={overlayRef}
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: 'calc(50vh - 32px - 8px)',
              right: 8,
              padding: '4px 8px',
              borderRadius: 6,
              background: 'rgba(0,0,0,0.55)',
              backdropFilter: 'blur(6px)',
              // @ts-expect-error — WebkitBackdropFilter is not in CSSProperties but needed for iOS Safari < 18
              WebkitBackdropFilter: 'blur(6px)',
              font: '600 14px/1.2 ui-monospace, SFMono-Regular, Menlo, monospace',
              color: 'rgba(255,255,255,0.72)',
            }}
          >FPS — · min —</div>
        </main>
      );
    }
    ```

    Notes on intentional choices:
    - FPS overlay text is updated via `overlayRef.current.textContent` (Pitfall E: never via `useState` — would cause 60Hz React reconciliation and invalidate its own measurement).
    - Overlay update cadence is 1Hz (UI-SPEC §FPS overlay — locked).
    - Color switches to `#f59e0b` amber when `avg < 55` (UI-SPEC §Color — Claude's discretion addition per CONTEXT).
    - `role="img"` + `aria-label` on canvas (UI-SPEC §Accessibility Notes).
    - `aria-hidden="true"` on overlay (it's instrumentation, not user content).
    - No orientation prompt, no tap-to-start, no legal footer — all Phase 2/3 per UI-SPEC §Phase-2 Handoff Notes.
    - `WebkitBackdropFilter` is needed for iOS Safari ≤ 17 (< 18 doesn't support unprefixed). The `@ts-expect-error` is the cheapest way to satisfy TS strict without a declaration augmentation file.

    After writing both files: run `pnpm dev` locally and visit `http://localhost:3000/prototype`. Confirm (visually) that a green sinus ECG sweeps left-to-right on desktop Chrome/Safari and the FPS overlay reads ~60 fps. This is a sanity check; real evidence (iPhone + Vercel preview) lands in Plan 04. Do not block on this check if the desktop browser shows fps 58-60 — that's healthy.

    Run `pnpm build` to confirm no SSR errors (the Server Component shell must not leak `window` references).
  </action>
  <verify>
    <automated>pnpm build &amp;&amp; pnpm test &amp;&amp; pnpm exec biome check app/ lib/ tests/</automated>
  </verify>
  <acceptance_criteria>
    - `test -f app/prototype/page.tsx` and `test -f app/prototype/PrototypeClient.tsx`
    - `grep -E "^'use client'" app/prototype/PrototypeClient.tsx` matches on line 1–5 (must be the first directive)
    - `grep -E "'use client'" app/prototype/page.tsx` returns NO matches (page must remain a Server Component shell)
    - `grep -E "from '@/lib/waveforms/engine-state'" app/prototype/PrototypeClient.tsx` matches
    - `grep -E "from '@/lib/waveforms/sampleEcg'" app/prototype/PrototypeClient.tsx` matches
    - `grep -E "from '@/lib/waveforms/sweepCanvas'" app/prototype/PrototypeClient.tsx` matches
    - `grep -E "from '@/lib/waveforms/buffer'" app/prototype/PrototypeClient.tsx` matches (WAVE-04 wired)
    - `grep -E "createRingBuffer\\(250, 5\\)" app/prototype/PrototypeClient.tsx` matches (buffer allocated at 1250 samples per D-10)
    - `grep -E "writeSample\\(rb," app/prototype/PrototypeClient.tsx` matches (every sample is written to the buffer)
    - `grep -E "useState" app/prototype/PrototypeClient.tsx` returns NO matches (Pitfall E — FPS overlay does not use React state)
    - `grep -E "requestAnimationFrame" app/prototype/PrototypeClient.tsx` matches
    - `grep -E "cancelAnimationFrame" app/prototype/PrototypeClient.tsx` matches (cleanup)
    - `grep -E "lastOverlayUpdate" app/prototype/PrototypeClient.tsx` matches (1Hz update gate)
    - `grep -E "#22c55e" app/prototype/PrototypeClient.tsx` matches (D-06 accent)
    - `grep -E "#f59e0b" app/prototype/PrototypeClient.tsx` matches (UI-SPEC amber warning)
    - `grep -E "role=\"img\"" app/prototype/PrototypeClient.tsx` matches (a11y)
    - `grep -E "aria-hidden=\"true\"" app/prototype/PrototypeClient.tsx` matches (overlay is instrumentation)
    - `pnpm build` exits 0 (no SSR errors; no `window` leaks in Server Component)
    - `pnpm test` exits 0 (all 9 tests still green)
    - `pnpm exec biome check app/ lib/ tests/` exits 0
  </acceptance_criteria>
  <done>
    `/prototype` route builds cleanly. Opening `pnpm dev` → `/prototype` in a desktop browser shows a green sinus ECG sweeping left-to-right with an FPS overlay top-right. Server shell has no `window` reference; client is `'use client'` and wires engine-state + sampleEcg + sweepCanvas + buffer. FPS overlay updates via ref (never state) at 1Hz. All 9 unit tests still green.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

N/A at P0. The `/prototype` route is static (no runtime data, no query params, no user input). Vercel preview URL is noindex by default.

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-00-03 | I (Information Disclosure) | `/prototype` route exposed on production Vercel domain post-Phase-2 | mitigate | Route is explicitly throwaway per D-01 — Plan 04 in Phase 2's planning must delete `app/prototype/*` before Phase 2 ships. Tracked as a Phase 2 transition item. |

Rationale: RESEARCH.md §Security Domain scopes security work as N/A at Phase 0. No auth, no data, no server routes. The only forward-looking risk is that the throwaway route leaks into production if forgotten — documented here and in CONTEXT D-01 so the Phase 2 planner inherits the delete-obligation.
</threat_model>

<verification>
Plan-level gates:
- `pnpm build` exits 0
- `pnpm test` exits 0 (9 tests green)
- `pnpm exec biome check .` exits 0
- `grep -r "Math.min.*devicePixelRatio.*2" lib/` returns no matches (WAVE-05 port fix verified)
- `grep -r "Math.min.*dpr.*2" lib/` returns no matches (same)
- Desktop sanity check via `pnpm dev`: loading `http://localhost:3000/prototype` shows a green sinus sweep (not required to be blocking — Plan 04's iPhone evidence is the real gate)
</verification>

<success_criteria>
- `/prototype` route compiles as Server Component shell + Client Component
- Canvas reads real DPR (window.devicePixelRatio || 1), no cap
- `ctx.scale(dpr, dpr)` is called exactly once per setup
- Clear-ahead rectangle uses `ceil(pxPerFrame) + lineWidth + 2` CSS px (Pitfall 4 envelope)
- `Float32Array(1250)` ring buffer allocated once at mount; written via modular index on every sample (WAVE-04)
- FPS overlay updates textContent via ref at 1Hz; React state never touched in rAF hot path (Pitfall E)
- All 9 Vitest tests remain green (nothing from Plans 01/02 regressed)
</success_criteria>

<output>
After completion, create `.planning/phases/00-waveform-prototype/00-03-SUMMARY.md` documenting:
- Final sweepCanvas.ts / buffer.ts line counts and any deviation from RESEARCH.md shapes
- Desktop browser sanity-check observations (Chrome and Safari macOS): FPS overlay reading, any visible tearing
- Any Biome / TS strict warnings that surfaced around `WebkitBackdropFilter` or the `@ts-expect-error` directive
- List of files slated for deletion after Phase 2 (should be exactly: `app/prototype/page.tsx` + `app/prototype/PrototypeClient.tsx`)
</output>
