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
    // monotonic clock. Advance ~40% through one beat at HR=140 (~171ms).
    const t0 = 0;
    const beatMs = 60_000 / vitals.hr;
    const targetPhase = 0.4;
    // Single call to establish lastT
    sampleEcg(t0, vitals.hr, engine);
    // Second call, Δt advances phase to ~0.4
    sampleEcg(t0 + targetPhase * beatMs, vitals.hr, engine);

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
