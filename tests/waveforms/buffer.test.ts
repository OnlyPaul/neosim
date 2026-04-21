// tests/waveforms/buffer.test.ts
// WAVE-04 (Float32Array ring buffer) regression guards — see PLAN 00-03 Task 1.
// Pitfall 13: the buffer must be allocated once, written via modular index,
// and NEVER reallocated (no Array.push, no Array.slice, no new Float32Array
// after the first call). These tests pin that shape.
import { describe, expect, it } from 'vitest';
import { createRingBuffer, writeSample } from '@/lib/waveforms/buffer';

describe('Float32Array ring buffer (WAVE-04)', () => {
  it('allocates sampleRate * sweepSeconds samples as Float32Array', () => {
    const rb = createRingBuffer(250, 5);
    expect(rb.length).toBe(1250);
    expect(rb.data).toBeInstanceOf(Float32Array);
    expect(rb.data.length).toBe(1250);
    expect(rb.data.byteLength).toBe(1250 * 4);
    expect(rb.writeIdx).toBe(0);
    expect(rb.sampleRate).toBe(250);
    expect(rb.sweepSeconds).toBe(5);
  });

  it('wraps writeIdx modulo length and never reallocates .data', () => {
    const rb = createRingBuffer(250, 5);
    const originalData = rb.data;
    for (let i = 0; i < rb.length + 10; i++) {
      writeSample(rb, i);
    }
    expect(rb.writeIdx).toBe(10);
    expect(rb.data).toBe(originalData); // same Float32Array reference
    expect(rb.data.length).toBe(1250); // length unchanged
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
