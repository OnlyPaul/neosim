// lib/waveforms/sampleEcg.ts
// Sinus ECG sampler ported from design/src/waveforms.js lines 4-11 (ecgSinusTemplate).
// Per D-05: all non-sinus rhythm branches and the non-ECG samplers from the
// design prototype are DROPPED (dysrhythmias are clinically wrong for neonatal
// arrest, which is asphyxial; the non-ECG channels are deferred to Phase 2
// under clinical sign-off). See PATTERNS.md §PORT-PARTIAL for the drop list.
// Per D-08 / WAVE-10: state mutation moved to injected EngineState (factory from
// engine-state.ts) — never a field of the vitals store.
// Per D-09 / WAVE-03: time-based advance via DOMHighResTimeStamp deltas in
// milliseconds, not frame counts; `t` is passed through from rAF directly.
// Per Pitfall C: dt clamped to ≤ 100ms to survive tab-visibility-return runaway
// deltas (longer than any legit frame, shorter than any scenario-breaking jump).
// The clamp also bounds the first-frame transient: with factory `lastT=0`, the
// first real rAF call (t = performance.now() ≫ 0) produces dt=100ms worth of
// clamped advance — one frame's worth, visually imperceptible. We therefore
// omit the RESEARCH.md "seed lastT on first call" branch: that guard used the
// magic value `lastT===0` as "uninitialized", which breaks deterministic unit
// tests that legitimately pass `t=0` as a starting timestamp.
import type { EngineState } from './engine-state';

/** Pure template: phase ∈ [0, 1) → voltage ∈ ~[-0.4, +1.2]. */
function ecgSinusTemplate(phase: number): number {
  // PQRST gaussian-sum coefficients ported verbatim from
  // design/src/waveforms.js lines 4-11. Outer parens on the `** 2` expressions
  // disambiguate unary-minus precedence for the oxc parser (Biome 2's
  // `useExponentiationOperator` auto-fix applied this shape).
  const p = Math.exp(-(((phase - 0.1) / 0.025) ** 2)) * 0.15;
  const q = -Math.exp(-(((phase - 0.25) / 0.008) ** 2)) * 0.18;
  const r = Math.exp(-(((phase - 0.28) / 0.01) ** 2)) * 1.2;
  const s = -Math.exp(-(((phase - 0.31) / 0.012) ** 2)) * 0.35;
  const t = Math.exp(-(((phase - 0.58) / 0.055) ** 2)) * 0.3;
  return p + q + r + s + t;
}

export interface SampleResult {
  v: number;
  rPeak: boolean;
}

/**
 * Stateful but pure-with-respect-to-state: reads `t` (ms) and `hr` (bpm),
 * mutates only `s.phase`, `s.lastT`, `s.rFired`.
 * WAVE-03 — time-based; WAVE-07 — template lookup; WAVE-10 — state injected.
 */
export function sampleEcg(t: number, hr: number, s: EngineState): SampleResult {
  const safeHr = Math.max(1, hr);
  const beatDurMs = 60_000 / safeHr;

  // dt = (t - lastT), clamped into [0, 100] ms:
  //   - max 100ms: Pitfall C — runaway delta on tab-visibility return.
  //   - min 0: defensive against a non-monotonic clock (Pitfall B).
  // On the very first call after createEngineState(), lastT=0 so dt = min(100, t).
  // In tests with deterministic t=0 this yields dt=0 (no advance); in production
  // with t=performance.now()≫0 this yields dt=100 (one clamped frame advance).
  const dt = Math.min(100, Math.max(0, t - s.lastT));
  s.lastT = t;
  s.phase = (s.phase + dt / beatDurMs) % 1;

  // R-peak detection (design/src/waveforms.js lines 41-45, sinus-only slice):
  // fire once when phase enters (0.27, 0.30); clear debounce outside (0.25, 0.32).
  let rPeak = false;
  if (s.phase > 0.27 && s.phase < 0.3 && !s.rFired) {
    s.rFired = true;
    rPeak = true;
  }
  if (s.phase < 0.25 || s.phase > 0.32) {
    s.rFired = false;
  }

  return { v: ecgSinusTemplate(s.phase), rPeak };
}
