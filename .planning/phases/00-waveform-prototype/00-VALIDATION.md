---
phase: 0
slug: waveform-prototype
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-21
---

# Phase 0 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Sourced from `00-RESEARCH.md` §Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.x + jsdom 29.x + @vitejs/plugin-react 6.x |
| **Config file** | `vitest.config.ts` at repo root (Wave 0 creates it) |
| **Quick run command** | `pnpm test` |
| **Full suite command** | `pnpm test && pnpm exec biome check .` |
| **Estimated runtime** | < 5 seconds (one test file, pure logic, no DOM) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm test`
- **After every plan wave:** Run `pnpm test && pnpm exec biome check .`
- **Before `/gsd-verify-work`:** Full suite green + `pnpm build` passes + visual/device evidence captured (FPS overlay screenshot + Safari heap snapshot t=0 and t=5min)
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD-01 | scaffold | 1 | (infra) | — | N/A | build | `pnpm build` | ❌ W0 | ⬜ pending |
| TBD-02 | engine-state | 2 | WAVE-10 | — | N/A | unit | `pnpm test tests/waveforms/engine-state.merge.test.ts` | ❌ W0 | ⬜ pending |
| TBD-03 | sample-ecg | 2 | WAVE-07, WAVE-03 | — | N/A | unit | `pnpm test tests/waveforms/sample-ecg.test.ts` | ❌ W0 | ⬜ pending |
| TBD-04 | sweep-canvas | 2 | WAVE-05 | — | N/A | visual-evidence | Manual iPhone screenshot zoom (crisp at DPR=3) | ❌ W0 | ⬜ pending |
| TBD-05 | buffer | 2 | WAVE-04 | — | N/A | device-evidence | Safari Web Inspector heap snapshot at t=0 and t=5min (ArrayBuffer flat) | — | ⬜ pending |
| TBD-06 | prototype-route | 3 | WAVE-01 | — | N/A | visual-evidence | FPS overlay screenshot on /prototype, rolling avg ≥58 / min ≥55 for 60s | ❌ W0 | ⬜ pending |

*Task IDs get finalized once PLAN.md files exist; row skeleton reserved. Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `package.json` — scaffold created via `pnpm create next-app@15.5 --ts --app --no-eslint --no-tailwind --no-src-dir --use-pnpm`
- [ ] `vitest.config.ts` — test runner config (jsdom environment, @vitejs/plugin-react)
- [ ] `biome.json` — lint/format config (`pnpm biome init`)
- [ ] `tsconfig.json` — verify `"strict": true`
- [ ] `tests/waveforms/engine-state.merge.test.ts` — permanent WAVE-10 regression (phase unchanged after partial vitals diff)
- [ ] `tests/waveforms/sample-ecg.test.ts` — WAVE-07 R-peak assertions (R-peak phase ≈ 0.28 at HR=60 and HR=180)
- [ ] `lib/waveforms/engine-state.ts` — `EngineState` + `createEngineState()` factory
- [ ] `lib/waveforms/sampleEcg.ts` — ported sinus PQRST (drop vt/vf/afib/capno)
- [ ] `lib/waveforms/sweepCanvas.ts` — DPR-aware sweep-draw primitive (real DPR=3, not `Math.min(DPR, 2)`)
- [ ] `lib/clinical/.gitkeep` — empty placeholder directory (D-03)
- [ ] `app/prototype/page.tsx` + `app/prototype/PrototypeClient.tsx` — throwaway render harness with FPS overlay
- [ ] Framework install: `pnpm add -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/dom @biomejs/biome`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| ECG sweep holds ≥58 avg / ≥55 min fps on iPhone Safari for 60s continuous | WAVE-01 | Requires physical iPhone; no CI browser can measure real A-series GPU rAF cadence | Deploy to Vercel preview → open `/prototype` on newer-gen iPhone Safari (landscape) → watch FPS overlay for 60s → screenshot |
| Canvas renders crisply at DPR=3, no ghosting or subpixel blur | WAVE-05 | Physical display + human visual judgment | Same screenshot — zoom into ECG stroke; confirm no blur, no tear artifact at sweep boundary |
| Heap flat over 5-minute run (Float32Array buffer does not grow) | WAVE-04 | Safari Web Inspector memory snapshot requires macOS + USB tether | Mac + Safari Web Inspector → Memory tab → snapshot at t=0 and t=5min → diff shows stable ArrayBuffer count. If macOS unavailable, substitute `performance.measureUserAgentSpecificMemory()` logged on-page (see RESEARCH.md assumption A10) |
| Engine survives iPhone Low Power Mode rAF throttle to 30 fps without HR drift | WAVE-03 | Real power state needed | Enable Low Power Mode on iPhone (Settings → Battery) → observe HR period remains clinically stable for 60s (period × fps = constant beats/min) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
