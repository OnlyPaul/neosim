---
phase: 00-waveform-prototype
plan: 01
subsystem: infra
tags: [nextjs-15.5, react-19, typescript-strict, vitest-4, biome-2, pnpm, scaffold]

requires: []
provides:
  - "Next.js 15.5 App Router scaffold at repo root (App Router, Turbopack, no src-dir, @/* alias)"
  - "pnpm 10.33.0 lockfile + packageManager pin"
  - "TypeScript 5.9 strict mode + bundler module resolution"
  - "Vitest 4 + jsdom + @vitejs/plugin-react test runner with @/* alias"
  - "Biome 2.4.12 single-tool lint+format config (replaces ESLint+Prettier)"
  - "lib/waveforms/engine-state.ts — EngineState interface + createEngineState() factory (WAVE-10 guardrail)"
  - "lib/clinical/ directory placeholder for Phase 2 nrp.ts landing"
affects:
  - 00-02-engine-math-and-tests (consumes createEngineState + EngineState type in sampleEcg + merge test)
  - 00-03-sweep-canvas-and-prototype (consumes EngineState through sampleEcg)
  - 00-04-vercel-deploy-and-evidence
  - all Phase 2+ plans (scaffold ships forward unchanged)

tech-stack:
  added:
    - "next@15.5.15"
    - "react@19.2.5 + react-dom@19.2.5"
    - "typescript@5.9.3 (strict)"
    - "vitest@4.1.4"
    - "@vitejs/plugin-react@6.0.1"
    - "jsdom@29.0.2"
    - "@testing-library/react@16.3.2 + @testing-library/dom@10.4.1"
    - "@biomejs/biome@2.4.12 (exact pin)"
    - "@types/node@22.19.17, @types/react@19.2.14, @types/react-dom@19.2.3"
  patterns:
    - "Manual scaffold (not create-next-app) when repo root is non-empty"
    - "Factory-shape engine state (createEngineState()) — not singleton — for test isolation"
    - "Scoped Biome includes (app/ lib/ tests/ + named configs) instead of blanket project-root lint"
    - "Vitest passWithNoTests:true as standard — zero-test config still exits 0"
    - "Import alias @/* resolves to repo root for both Next and Vitest"

key-files:
  created:
    - "package.json"
    - "pnpm-lock.yaml"
    - ".npmrc"
    - "tsconfig.json"
    - "next.config.ts"
    - "biome.json"
    - "vitest.config.ts"
    - ".gitignore"
    - "app/layout.tsx"
    - "app/page.tsx"
    - "lib/waveforms/engine-state.ts"
    - "lib/clinical/.gitkeep"
    - "tests/waveforms/engine-state.test.ts"
  modified: []

key-decisions:
  - "Manual scaffold instead of `pnpm create next-app` — repo root is non-empty (.planning/, design/, CLAUDE.md already present) and create-next-app refuses to write into non-empty dirs"
  - "Biome `files.includes` scoped explicitly to app/ lib/ tests/ + named config files — default (everything minus .next/node_modules) sweeps in .planning/ design/ .claude/ .codex/ .cursor/ and floods lint output with 1500+ diagnostics on non-code docs"
  - "Vitest passWithNoTests:true added — Vitest 4 default exits 1 on empty test discovery; Task 1 verify requires test gate to pass before Task 2 ships any tests"
  - "Biome 2.4.12 pinned exact (no caret) per RESEARCH.md §Installation step 3 — lint rules are the kind of dep where patch bumps can change error counts; pinning prevents surprise CI regressions"
  - "tsconfig path alias `@/*` → `./*` (repo root, not `./src/*`) — D-03 mandates `--no-src-dir`"
  - "next-env.d.ts added to .gitignore — regenerated on every `next build`, not worth tracking (matches Next.js official recommendation)"

patterns-established:
  - "Engine state separation (WAVE-10): mutable rAF-hot-path state lives in lib/waveforms/engine-state.ts only — never in vitals store, never on the wire, always injected as a parameter to sample functions"
  - "Factory over singleton: createEngineState() returns a fresh object per call so tests can assert isolation without a beforeEach reset"
  - "TDD RED → GREEN rhythm on tasks marked tdd=true: failing test commit first (test: prefix), implementation commit second (feat: prefix)"
  - "Test path convention: tests/waveforms/*.test.ts — mirrors lib/waveforms/ structure, resolved via @/* alias"

requirements-completed: [WAVE-10]

duration: 6min
completed: 2026-04-21
---

# Phase 0 Plan 01: Scaffold and Engine State Summary

**Next.js 15.5 + React 19 + TS strict + Vitest 4 + Biome 2 scaffold at repo root, plus the WAVE-10 `EngineState` factory module (`lib/waveforms/engine-state.ts`) that every downstream waveform file will import.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-04-21T02:18:51Z
- **Completed:** 2026-04-21T02:25:09Z
- **Tasks:** 2 (+ 1 post-verification style commit)
- **Files modified:** 13 (all new)

## Accomplishments

- Buildable Next.js 15.5 App Router project: `pnpm build` compiles the placeholder `app/page.tsx` + `app/layout.tsx` in ~1.1 s under Turbopack with TS strict type-checking clean
- Vitest 4 + jsdom + @vitejs/plugin-react wired with the `@/*` path alias, running 3/3 passing tests for `createEngineState()` factory semantics
- Biome 2.4.12 (single-tool replacement for ESLint + Prettier) clean across the 9 source files it lints — zero errors, zero warnings
- `lib/waveforms/engine-state.ts` shipped verbatim from RESEARCH.md §engine-state.ts — factory shape (not singleton) so Plan 02's merge-regression test can assert isolation without a `beforeEach` hook
- `lib/clinical/.gitkeep` in place — directory slot for Phase 2's `nrp.ts` per D-03
- pnpm 10.33.0 locked via `packageManager` field; no accidental `package-lock.json` or `yarn.lock`

## Task Commits

Each task was committed atomically:

1. **Task 1: Scaffold Next.js 15.5 + Vitest + Biome toolchain** — `206c16f` (chore)
2. **Task 2 (RED): Failing test for EngineState factory** — `15a3689` (test) — TDD RED gate
3. **Task 2 (GREEN): EngineState module + clinical placeholder** — `14c5866` (feat) — TDD GREEN gate
4. **Post-Task 2: Biome import-wrap format fix on test file** — `dc5c957` (style)

Plan-level metadata commit (SUMMARY.md + STATE.md + ROADMAP.md) follows this summary.

## Files Created/Modified

- `package.json` — Next 15.5 + React 19 + TS 5.9 + Vitest 4 + Biome 2 deps; scripts `dev build start test test:watch lint format`; `packageManager: pnpm@10.33.0`
- `pnpm-lock.yaml` — 125 packages resolved (generated by `pnpm install`)
- `.npmrc` — `engine-strict=true` (blocks accidental `npm install`)
- `tsconfig.json` — `strict: true`, `moduleResolution: bundler`, `jsx: preserve`, `paths: { "@/*": ["./*"] }`
- `next.config.ts` — minimal `NextConfig = {}`
- `biome.json` — 2.4.12 schema, scoped `files.includes`, 2-space single-quote semicolons
- `vitest.config.ts` — `environment: jsdom`, `globals: true`, `include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx']`, `passWithNoTests: true`, `@` alias
- `.gitignore` — Next.js defaults (`node_modules/`, `.next/`, `out/`, `.DS_Store`, `*.tsbuildinfo`, `next-env.d.ts`, `.vercel`, `.env*.local`)
- `app/layout.tsx` — root layout (html + black body, no chrome, no font, no globals.css)
- `app/page.tsx` — placeholder landing ("NeoSim — see /prototype")
- `lib/waveforms/engine-state.ts` — `EngineState` interface + `createEngineState()` factory, 0 imports, 10 lines
- `lib/clinical/.gitkeep` — empty placeholder for Phase 2 `nrp.ts`
- `tests/waveforms/engine-state.test.ts` — 3 Vitest unit tests: factory defaults, instance independence, type-export compile check

## Decisions Made

- **Manual scaffold over `create-next-app`** — repo root already contains `.planning/`, `design/`, `CLAUDE.md`, `README.md`; create-next-app refuses non-empty targets. Matching flags `--ts --app --no-eslint --no-tailwind --no-src-dir --import-alias "@/*" --use-pnpm --turbopack` by hand produces an identical result with no destructive clobber risk.
- **Biome 2.4.12 pinned exact, not `^2`** — lint rule changes between patch releases can shift error counts; exact pin prevents CI surprises. RESEARCH.md §Installation step 3 prescribes `--save-exact`.
- **Biome `files.includes` scoped explicitly** — the default (everything not in `.next` / `node_modules` / `*.tsbuildinfo`) flooded Biome with 1500+ diagnostics on `.planning/`, `design/`, `.claude/`, `.codex/`, `.cursor/`. Scoped to `app/**`, `lib/**`, `tests/**`, and named config files only — those are the code surfaces Biome is supposed to guard.
- **Vitest `passWithNoTests: true`** — Vitest 4 default exits code 1 on empty discovery. Task 1's verify gate is `pnpm test` exiting 0 *before any test file exists*, so this flag is load-bearing for the task-ordering. Retained for Plan 02+ (zero behavioral cost; avoids CI false-negatives on unrelated branches).
- **`next-env.d.ts` gitignored** — Next.js regenerates on every build; tracking it adds noise. Matches Next.js official recommendation.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added `passWithNoTests: true` to vitest.config.ts**
- **Found during:** Task 1 (Scaffold) — final gate verification
- **Issue:** `pnpm test` exited 1 with "No test files found" — Vitest 4 changed defaults; the plan mandates `pnpm test` exits 0 at Task 1 completion (no tests exist until Task 2).
- **Fix:** Added `passWithNoTests: true` inside the `test:` block in `vitest.config.ts`.
- **Files modified:** `vitest.config.ts`
- **Verification:** `pnpm test` exits 0 with "No test files found, exiting with code 0"
- **Committed in:** `206c16f` (Task 1 commit)

**2. [Rule 3 - Blocking] Scoped Biome `files.includes` to code directories only**
- **Found during:** Task 1 (Scaffold) — final gate verification
- **Issue:** The RESEARCH.md §Biome Configuration Skeleton uses `files.ignore` for `.next`, `node_modules`, `*.tsbuildinfo` but nothing else. In practice this means Biome lints `.planning/` (markdown + JSON docs), `design/` (CDN-Babel throwaway JS/JSX), `.claude/`, `.codex/`, `.cursor/` — 115 files flagged with 1500+ diagnostics on non-code assets that are explicitly out of this project's scaffold. Additionally, the Biome 2.x `files.ignore` key was deprecated in favor of negated `files.includes` patterns.
- **Fix:** Replaced the `ignore` array with an explicit `includes` allowlist: `app/**`, `lib/**`, `tests/**`, `next.config.ts`, `vitest.config.ts`, `biome.json`, `package.json`, `tsconfig.json`.
- **Files modified:** `biome.json`
- **Verification:** `pnpm exec biome check .` checks 9 files (all code + config), exits 0.
- **Committed in:** `206c16f` (Task 1 commit)

**3. [Rule 1 - Formatting] Biome auto-formatted vitest.config.ts and engine-state.test.ts**
- **Found during:** Task 1 and Task 2
- **Issue:** Imports weren't alphabetically sorted (Biome `organizeImports`) and one import line exceeded width threshold (needed multi-line wrap).
- **Fix:** Ran `pnpm exec biome check --write` on the affected files.
- **Files modified:** `vitest.config.ts`, `tests/waveforms/engine-state.test.ts`
- **Verification:** `pnpm exec biome check .` exits 0
- **Committed in:** `206c16f` (Task 1 — vitest.config.ts), `dc5c957` (post-Task 2 style — test file)

---

**Total deviations:** 3 auto-fixed (2 blocking, 1 formatting).
**Impact on plan:** All three are mechanical toolchain adjustments — Vitest 4 default behavior, Biome 2.x config schema migration, auto-fixable formatter output. No architectural change, no scope creep, no skipped acceptance criteria.

## Issues Encountered

- **No TS strict complaints** on `app/layout.tsx` or `app/page.tsx` — the `ReactNode` import + typed props pattern compiled clean on first try.
- **No Biome rule needed disabling** for `next-env.d.ts` — the file is gitignored and also excluded by the scoped `files.includes`, so Biome never sees it.
- **No clashes** between Next.js's auto-generated TypeScript plugin (`"plugins": [{ "name": "next" }]`) and Biome 2 — they operate at different layers (TS language server vs. on-disk lint pass).

Locked versions that actually landed (from `pnpm ls --depth 0`):
- `next@15.5.15`
- `react@19.2.5` / `react-dom@19.2.5`
- `typescript@5.9.3`
- `vitest@4.1.4`
- `@vitejs/plugin-react@6.0.1`
- `jsdom@29.0.2`
- `@testing-library/react@16.3.2` / `@testing-library/dom@10.4.1`
- `@biomejs/biome@2.4.12`
- `@types/node@22.19.17`, `@types/react@19.2.14`, `@types/react-dom@19.2.3`

## User Setup Required

None — no external service configuration required at this plan. Phase 0 is fully local + browser-only; Vercel preview hookup lands in Plan 00-04.

## Next Phase Readiness

Plan 00-02 (engine math + Vitest merge-regression test) is unblocked:
- `@/lib/waveforms/engine-state` resolves and exports `EngineState` + `createEngineState`
- `@` path alias works in both Next build and Vitest runtime
- `tests/waveforms/` path convention established (Plan 02 adds `engine-state.merge.test.ts` + `sample-ecg.test.ts`)
- Biome config stable — Plan 02's new files should lint clean on first write if they follow the `single-quote + semicolons + 2-space` convention

No blockers. No concerns.

## TDD Gate Compliance

Task 2 (`tdd="true"`) observed the full RED → GREEN sequence:
- **RED gate:** `15a3689` — `test(00-01): add failing test for EngineState factory (RED)` — module did not exist; import failed as expected
- **GREEN gate:** `14c5866` — `feat(00-01): implement EngineState factory + clinical placeholder (GREEN)` — 3/3 tests pass
- **REFACTOR:** skipped; implementation is 10 lines of verbatim-from-research code with no cleanup opportunity

## Self-Check: PASSED

All 14 declared files exist on disk. All 4 declared commits (`206c16f`, `15a3689`, `14c5866`, `dc5c957`) are reachable from `HEAD` on branch `phase-0-waveform-prototype`.

---
*Phase: 00-waveform-prototype*
*Completed: 2026-04-21*
