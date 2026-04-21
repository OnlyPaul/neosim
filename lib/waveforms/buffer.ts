// lib/waveforms/buffer.ts
// WAVE-04 literal implementation per D-10:
//   "Waveform buffer is a single Float32Array(sampleRate * sweepSeconds) per
//    channel, allocated once, written via modular index. No history array, no
//    Array#push, no reallocation (Pitfall 13)."
// P0 usage: createRingBuffer(250, 5) → 1250 samples, 5 KB, one allocation for
// the life of the /prototype route.

export interface RingBuffer {
  data: Float32Array;
  length: number;
  writeIdx: number;
  sampleRate: number;
  sweepSeconds: number;
}

export function createRingBuffer(
  sampleRate: number,
  sweepSeconds: number,
): RingBuffer {
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
