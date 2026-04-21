// lib/waveforms/sweepCanvas.ts
// DPR-aware sweep-draw primitive for Canvas 2D, ported from the algorithm in
// design/src/canvasChannel.jsx (lines 7-60) with THREE mandatory fixes from
// 00-PATTERNS.md §sweepCanvas.ts PORT-PARTIAL:
//
//   1. Device-pixel-ratio cap REMOVED — WAVE-05 / D-07 require real DPR=3 on
//      iPhone 12+ for a crisp waveform. Read the real value; no upper bound.
//   2. Transform scale is applied ONCE at setup; all subsequent draw math is
//      in CSS pixels. The design kept draw math in device-px with inline dpr
//      scaling everywhere (Pitfall D: easy to double-scale). See Pattern 1.
//   3. Clear-ahead width is the Pitfall 4 envelope (pxPerFrame + lineWidth + 2)
//      in CSS pixels. The design used a 35ms-wide heuristic gap — this locks
//      the mathematical envelope and eliminates ghosting/tearing.
//
// Also removed vs the design prototype: the resize observer (Pitfall D — P0 is
// a static landscape surface; no resize path at this phase).
//
// Tests: Canvas-API mocks in jsdom are brittle; the real validation is the
// iPhone FPS screenshot captured in Plan 00-04. P0 gates for this file are
// `pnpm exec tsc --noEmit` + `pnpm exec biome check`.

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
  opts: {
    cssW: number;
    cssH: number;
    sweepSeconds: number;
    color: string;
    bg: string;
  },
): SweepCtx {
  // NO cap — WAVE-05 / D-07 require real DPR=3.
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.floor(opts.cssW * dpr);
  canvas.height = Math.floor(opts.cssH * dpr);
  canvas.style.width = `${opts.cssW}px`;
  canvas.style.height = `${opts.cssH}px`;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx)
    throw new Error(
      'Canvas init failed — open this page in iPhone Safari 16.4+',
    );
  // Apply once; all subsequent math in CSS px. Never call scale() again on this context.
  ctx.scale(dpr, dpr);
  ctx.fillStyle = opts.bg;
  ctx.fillRect(0, 0, opts.cssW, opts.cssH);
  const lineWidth = Math.max(1.6, Math.ceil(dpr * 1.4));
  ctx.lineWidth = lineWidth;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = opts.color;
  return {
    ctx,
    dpr,
    cssW: opts.cssW,
    cssH: opts.cssH,
    pxPerSec: opts.cssW / opts.sweepSeconds,
    lineWidth,
    color: opts.color,
    bg: opts.bg,
    writeHead: 0,
    lastY: opts.cssH / 2,
  };
}

/** Advance the sweep by one rAF tick. Pure-with-respect-to the SweepCtx side-effects. */
export function stepSweep(
  sc: SweepCtx,
  tNow: number,
  dtMs: number,
  sampleFn: (t: number) => { v: number; rPeak: boolean },
  scale: number,
): void {
  const { ctx, cssW, cssH, pxPerSec, lineWidth, bg, color } = sc;
  const midY = cssH / 2;
  const advancePx = Math.max(1, Math.ceil((dtMs / 1000) * pxPerSec));
  // Pitfall 4 envelope — LOCKED by D-06. Do not change this formula.
  const clearAhead = advancePx + lineWidth + 2;

  for (let i = 1; i <= advancePx; i++) {
    const sampleT = tNow - dtMs + (i / advancePx) * dtMs;
    const x = Math.floor(((sampleT / 1000) * pxPerSec) % cssW);

    // Clear-ahead (wrap-safe): erase the region just ahead of the cursor so
    // the stroke writes into a clean background and no ghost of the previous
    // sweep remains.
    const eraseStart = (x + 1) % cssW;
    const eraseW = Math.min(clearAhead, cssW - eraseStart);
    ctx.fillStyle = bg;
    ctx.fillRect(eraseStart, 0, eraseW, cssH);
    if (eraseW < clearAhead) {
      ctx.fillRect(0, 0, clearAhead - eraseW, cssH);
    }

    const { v } = sampleFn(sampleT);
    const y = midY - v * scale;

    // Only draw the line segment if x advances normally (suppress the wrap-
    // around segment that would otherwise draw a long horizontal line back to
    // the left edge).
    ctx.beginPath();
    if (x >= sc.writeHead && x - sc.writeHead < clearAhead * 4) {
      ctx.strokeStyle = color;
      ctx.moveTo(sc.writeHead, sc.lastY);
      ctx.lineTo(x, y);
      ctx.stroke();
    }
    sc.writeHead = x;
    sc.lastY = y;
  }
}
