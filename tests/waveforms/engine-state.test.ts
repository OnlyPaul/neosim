// Source: PLAN 00-01 Task 2 <behavior> contract (D-08 / WAVE-10)
import { describe, expect, it } from 'vitest';
import {
  createEngineState,
  type EngineState,
} from '@/lib/waveforms/engine-state';

describe('createEngineState (WAVE-10 factory shape)', () => {
  it('returns factory defaults { phase: 0, rFired: false, lastT: 0, jitter: 1 }', () => {
    const s = createEngineState();
    expect(s.phase).toBe(0);
    expect(s.rFired).toBe(false);
    expect(s.lastT).toBe(0);
    expect(s.jitter).toBe(1);
  });

  it('returns independent instances (mutating a does not affect b)', () => {
    const a = createEngineState();
    const b = createEngineState();
    a.phase = 0.42;
    a.rFired = true;
    a.lastT = 12345;
    a.jitter = 1.05;
    expect(b.phase).toBe(0);
    expect(b.rFired).toBe(false);
    expect(b.lastT).toBe(0);
    expect(b.jitter).toBe(1);
  });

  it('EngineState type is exported (structural typing check)', () => {
    // Compile-time: if EngineState is not exported as a type, this file
    // would not typecheck under `pnpm exec tsc --noEmit`.
    const s: EngineState = createEngineState();
    expect(s).toBeDefined();
  });
});
