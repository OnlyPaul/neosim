// lib/waveforms/engine-state.ts
export interface EngineState {
  phase: number; // [0, 1) — position in current beat
  rFired: boolean; // debounce for R-peak detection per beat
  lastT: number; // last performance.now() seen; 0 = uninitialized
  jitter: number; // reserved for AFib (P2); always 1 at P0
}

export function createEngineState(): EngineState {
  return { phase: 0, rFired: false, lastT: 0, jitter: 1 };
}
