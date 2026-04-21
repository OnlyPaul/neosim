// tests/waveforms/sample-ecg.test.ts
// WAVE-07 (template-lookup R-peak) + WAVE-03 (time-based engine) guard.
// Deterministic time inputs only — never calls performance.now().
import { describe, expect, it } from 'vitest';
import { createEngineState } from '@/lib/waveforms/engine-state';
import { sampleEcg } from '@/lib/waveforms/sampleEcg';

describe('sampleEcg — R-peak detection and time-based advance', () => {
  it('rPeak fires exactly once per beat at HR=60', () => {
    const engine = createEngineState();
    const hr = 60;
    const beatDurMs = 60_000 / hr; // 1000ms
    const stepMs = 4;

    let rPeakCount = 0;
    let rPeakPhase = -1;

    // First call seeds lastT; subsequent calls advance phase.
    sampleEcg(0, hr, engine);
    for (let t = stepMs; t <= beatDurMs; t += stepMs) {
      const { rPeak } = sampleEcg(t, hr, engine);
      if (rPeak) {
        rPeakCount += 1;
        rPeakPhase = engine.phase;
      }
    }

    expect(rPeakCount).toBe(1);
    expect(rPeakPhase).toBeGreaterThan(0.27);
    expect(rPeakPhase).toBeLessThan(0.3);
  });

  it('rPeak fires exactly once per beat at HR=180', () => {
    const engine = createEngineState();
    const hr = 180;
    const beatDurMs = 60_000 / hr; // ≈333.33ms
    const stepMs = 2;

    let rPeakCount = 0;
    let rPeakPhase = -1;

    sampleEcg(0, hr, engine);
    for (let t = stepMs; t <= beatDurMs; t += stepMs) {
      const { rPeak } = sampleEcg(t, hr, engine);
      if (rPeak) {
        rPeakCount += 1;
        rPeakPhase = engine.phase;
      }
    }

    expect(rPeakCount).toBe(1);
    expect(rPeakPhase).toBeGreaterThan(0.27);
    expect(rPeakPhase).toBeLessThan(0.3);
  });

  it('time-based advance is invariant to frame cadence (WAVE-03 / Pitfall 5)', () => {
    // One 33ms LPM-throttled frame should advance phase by exactly the same
    // amount as two 16.5ms 60fps frames summing to 33ms — proving the engine
    // is delta-driven, not frame-counted.
    const hr = 140;
    const a = createEngineState();
    const b = createEngineState();

    // Engine A: single 33ms step
    sampleEcg(0, hr, a);
    sampleEcg(33, hr, a);

    // Engine B: two 16.5ms steps summing to 33ms
    sampleEcg(0, hr, b);
    sampleEcg(16.5, hr, b);
    sampleEcg(33, hr, b);

    expect(Math.abs(a.phase - b.phase)).toBeLessThan(1e-9);
  });

  it('dt is clamped at 100ms on tab-visibility return (Pitfall C)', () => {
    // Simulate a 30-second tab-hidden gap. Without the clamp, phase would
    // advance by ~70 beats (=30_000 * 140 / 60_000) and modulo to an
    // essentially random value. The clamp caps advance at 100ms worth:
    //   100 / (60_000/140) = 100 * 140 / 60_000 ≈ 0.2333 beats.
    const hr = 140;
    const engine = createEngineState();

    sampleEcg(0, hr, engine); // seeds lastT = 0
    sampleEcg(30_000, hr, engine); // 30-second gap

    const expectedClampedAdvance = 100 / (60_000 / hr); // ≈0.2333
    expect(engine.phase).toBeLessThan(0.3);
    expect(Math.abs(engine.phase - expectedClampedAdvance)).toBeLessThan(1e-6);
  });
});
