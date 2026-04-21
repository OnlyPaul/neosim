'use client';
// app/prototype/PrototypeClient.tsx
// THROWAWAY — deleted after Phase 2 per D-01 / T-00-03.
// Renders one ECG Lead II sinus channel + an FPS overlay for iPhone screenshot
// capture in Plan 00-04. Composes the permanent lib/waveforms/* primitives:
//   - createEngineState (WAVE-10 factory, Plan 00-01)
//   - sampleEcg (sinus PQRST, Plan 00-02)
//   - setupSweepCanvas / stepSweep (DPR-aware sweep-draw, Plan 00-03)
//   - createRingBuffer / writeSample (WAVE-04 buffer, Plan 00-03)
//
// FPS overlay is updated via ref.textContent at 1 Hz (Pitfall E — React
// state in the rAF hot path would cause 60 Hz reconciliation and invalidate
// its own measurement). See 00-UI-SPEC.md §FPS overlay.
import { useEffect, useRef } from 'react';
import { createRingBuffer, writeSample } from '@/lib/waveforms/buffer';
import { createEngineState } from '@/lib/waveforms/engine-state';
import { sampleEcg } from '@/lib/waveforms/sampleEcg';
import { setupSweepCanvas, stepSweep } from '@/lib/waveforms/sweepCanvas';

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
      sweepSeconds: 5, // D-06
      color: '#22c55e', // D-06 / UI-SPEC §Color accent (green-500, non-vendor)
      bg: '#000000', // UI-SPEC §Color dominant
    });
    const engine = createEngineState();
    // WAVE-04 / D-10: allocate the ring buffer ONCE at mount. 250 Hz × 5 s =
    // 1250 samples = 5 KB. Written to on every sample call; never realloc'd.
    const rb = createRingBuffer(250, 5);
    const HR = 140; // synthetic neonatal resting HR for P0
    const SCALE = 40; // visual amplitude in CSS px; tunable

    // Pitfall E: FPS is sampled into a Float32Array ring and the overlay DOM
    // is updated at 1 Hz via textContent. Never touch React state in the hot
    // path — that would cause 60 Hz reconciliation and invalidate this
    // measurement.
    const fpsRing = new Float32Array(180); // ~3 s at 60 fps
    let ringIdx = 0;
    let lastOverlayUpdate = 0;
    let lastT = performance.now();
    let rafId = 0;

    const tick = (t: DOMHighResTimeStamp) => {
      // Pitfall C on the draw-loop side: bound runaway deltas to 100 ms.
      const dt = Math.min(100, t - lastT);
      lastT = t;

      // sampleFn closure: writes each sample into the WAVE-04 ring buffer AND
      // returns it to the draw loop. The buffer's presence satisfies D-10
      // literally (allocated once, modular writes); per-frame draw reads the
      // returned value directly — one channel doesn't need to re-read the
      // buffer.
      const sampleFn = (sampleT: number) => {
        const res = sampleEcg(sampleT, HR, engine);
        writeSample(rb, res.v);
        return res;
      };
      stepSweep(sc, t, dt, sampleFn, SCALE);

      fpsRing[ringIdx] = dt > 0 ? 1000 / dt : 60;
      ringIdx = (ringIdx + 1) % fpsRing.length;

      if (t - lastOverlayUpdate > 1000 && overlayRef.current) {
        let sum = 0;
        let min = Number.POSITIVE_INFINITY;
        let count = 0;
        for (let i = 0; i < fpsRing.length; i++) {
          const v = fpsRing[i];
          if (v > 0) {
            sum += v;
            if (v < min) min = v;
            count++;
          }
        }
        const avg = count > 0 ? Math.round(sum / count) : 0;
        const minOut = Number.isFinite(min) ? Math.round(min) : 0;
        overlayRef.current.textContent = `FPS ${avg} · min ${minOut}`;
        overlayRef.current.style.color =
          avg < 55 ? '#f59e0b' : 'rgba(255,255,255,0.72)';
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
          // iOS Safari <18 needs the vendor-prefixed property; React 19's
          // CSSProperties types already include WebkitBackdropFilter, so no
          // ts-expect-error suppression is required here.
          WebkitBackdropFilter: 'blur(6px)',
          font: '600 14px/1.2 ui-monospace, SFMono-Regular, Menlo, monospace',
          color: 'rgba(255,255,255,0.72)',
        }}
      >
        FPS — · min —
      </div>
    </main>
  );
}
