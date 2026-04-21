// tests/waveforms/engine-state.merge.test.ts
// Permanent WAVE-10 regression guard.
// Ships forward unchanged through P2/P3/P4; in P4 the local `mergeVitals`
// helper is swapped for the real Zustand vitals-store merge primitive.
import { describe, expect, it } from 'vitest';
import { createEngineState } from '@/lib/waveforms/engine-state';
import { sampleEcg } from '@/lib/waveforms/sampleEcg';

// Trivial merge helper — no Zustand yet at P0. Models what a Phase 4
// Pusher diff handler will do: shallow-merge a partial into a target.
type Vitals = { hr: number; spo2?: number };
function mergeVitals<V extends object>(base: V, diff: Partial<V>): V {
  return { ...base, ...diff };
}

describe('engine-state / vitals-store merge regression (WAVE-10)', () => {
  it('partial vitals diff does not stomp engine phase or rFired', () => {
    const engine = createEngineState();
    let vitals: Vitals = { hr: 140 };

    // Tick engine to a mid-beat phase by calling sampleEcg with a synthetic
    // monotonic clock. Advance ~40% through one beat at HR=140 (beatDurMs≈428.6).
    // Must step in ≤100ms frames to respect the Pitfall C dt clamp — a single
    // 171ms jump would get clamped to 100ms and under-advance. Four 40ms frames
    // (~160ms total) put phase at ~0.373, comfortably inside (0.3, 0.5).
    const t0 = 0;
    const frameMs = 40;
    const frames = 4;
    // First call seeds dt=0 against factory lastT=0
    sampleEcg(t0, vitals.hr, engine);
    for (let i = 1; i <= frames; i++) {
      sampleEcg(t0 + i * frameMs, vitals.hr, engine);
    }

    const phaseBefore = engine.phase;
    const rFiredBefore = engine.rFired;
    expect(phaseBefore).toBeGreaterThan(0.3);
    expect(phaseBefore).toBeLessThan(0.5);

    // Apply a partial vitals diff (what Pusher will eventually send)
    vitals = mergeVitals(vitals, { hr: 150 });

    // Assert engine state is untouched — the merge only changed vitals
    expect(engine.phase).toBe(phaseBefore);
    expect(engine.rFired).toBe(rFiredBefore);
    expect(vitals.hr).toBe(150); // sanity: merge did apply
  });

  it('createEngineState returns independent instances', () => {
    const a = createEngineState();
    const b = createEngineState();
    a.phase = 0.9;
    expect(b.phase).toBe(0);
  });
});
