---
phase: 00-waveform-prototype
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - package.json
  - pnpm-lock.yaml
  - .npmrc
  - tsconfig.json
  - next.config.ts
  - biome.json
  - vitest.config.ts
  - app/layout.tsx
  - app/page.tsx
  - lib/clinical/.gitkeep
  - lib/waveforms/engine-state.ts
  - .gitignore
autonomous: true
requirements:
  - WAVE-10
user_setup: []

must_haves:
  truths:
    - "pnpm install succeeds from a clean checkout (lockfile present)"
    - "pnpm build succeeds (empty Next 15.5 App Router compiles under TS strict)"
    - "pnpm test runs Vitest and exits cleanly (zero tests is acceptable at this stage)"
    - "pnpm exec biome check . exits 0 on the scaffold"
    - "engine-state.ts exports EngineState type + createEngineState() factory returning independent instances"
  artifacts:
    - path: "package.json"
      provides: "pnpm-managed Next 15.5 + React 19 + TS strict + Vitest + Biome scaffold"
      contains: "\"packageManager\": \"pnpm@"
    - path: "tsconfig.json"
      provides: "TypeScript strict mode"
      contains: "\"strict\": true"
    - path: "vitest.config.ts"
      provides: "Vitest jsdom runner with @vitejs/plugin-react and @/* alias"
      contains: "environment: 'jsdom'"
    - path: "biome.json"
      provides: "Biome 2.x lint + format config"
      contains: "\"$schema\""
    - path: "lib/waveforms/engine-state.ts"
      provides: "EngineState type + createEngineState() factory (WAVE-10 guardrail — D-08, Shape B / factory)"
      exports: ["EngineState", "createEngineState"]
    - path: "lib/clinical/.gitkeep"
      provides: "Empty placeholder directory so Phase 2's nrp.ts has a home (D-03)"
    - path: "app/layout.tsx"
      provides: "Root App Router layout (html, body, no chrome)"
  key_links:
    - from: "package.json"
      to: "pnpm-lock.yaml"
      via: "pnpm install"
      pattern: "\"packageManager\": \"pnpm@"
    - from: "vitest.config.ts"
      to: "lib/waveforms/"
      via: "@/* alias resolves to repo root so tests can import @/lib/waveforms/engine-state"
      pattern: "alias"
---

<objective>
Establish the permanent Next.js 15.5 scaffold (package manager, lint, format, type, test toolchain) and write the EngineState module — the one piece of permanent engine code that has no code dependencies and must exist before anything else can import it.

Purpose: This scaffold ships forward to Phase 2+ unchanged. Getting it right once means Phase 2 inherits a working Vitest + Biome + TS-strict + App Router environment with zero ceremony. `engine-state.ts` is included in Wave 1 because it has no dependencies (pure factory, no React, no Canvas, no imports) and every downstream file imports from it — putting it in a later wave would force an extra wave for no reason.

Output: A buildable Next.js project with lint + test toolchains wired, and the WAVE-10 engine-state module that Plans 02/03/04 import.
</objective>

<execution_context>
@/Users/onlypaul/Workspace/neosim/.claude/get-shit-done/workflows/execute-plan.md
@/Users/onlypaul/Workspace/neosim/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@/Users/onlypaul/Workspace/neosim/CLAUDE.md
@/Users/onlypaul/Workspace/neosim/.planning/PROJECT.md
@/Users/onlypaul/Workspace/neosim/.planning/ROADMAP.md
@/Users/onlypaul/Workspace/neosim/.planning/STATE.md
@/Users/onlypaul/Workspace/neosim/.planning/phases/00-waveform-prototype/00-CONTEXT.md
@/Users/onlypaul/Workspace/neosim/.planning/phases/00-waveform-prototype/00-RESEARCH.md
@/Users/onlypaul/Workspace/neosim/.planning/phases/00-waveform-prototype/00-PATTERNS.md

<interfaces>
<!-- These are the contracts this plan CREATES. Plans 02/03 consume them. -->

lib/waveforms/engine-state.ts (new; authoritative shape from RESEARCH.md lines 656–668):
```typescript
export interface EngineState {
  phase: number;     // [0, 1) — position in current beat
  rFired: boolean;   // debounce for R-peak detection per beat
  lastT: number;     // last performance.now() seen; 0 = uninitialized
  jitter: number;    // reserved for AFib (P2); always 1 at P0
}

export function createEngineState(): EngineState;
```

Rationale (D-08 / WAVE-10): Factory shape (not singleton) so tests get isolated
instances and the Vitest merge-regression test needs no `beforeEach` reset.
The jitter field is reserved for Phase 2 AFib and is always 1 at P0 — present
in the type so future diffs don't reshape the interface.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Scaffold Next.js 15.5 + Vitest + Biome toolchain</name>
  <files>package.json, pnpm-lock.yaml, .npmrc, tsconfig.json, next.config.ts, biome.json, vitest.config.ts, app/layout.tsx, app/page.tsx, .gitignore</files>
  <read_first>
    - /Users/onlypaul/Workspace/neosim/.planning/phases/00-waveform-prototype/00-CONTEXT.md (D-01, D-02, D-03 — scaffold kit and directory layout are LOCKED)
    - /Users/onlypaul/Workspace/neosim/.planning/phases/00-waveform-prototype/00-RESEARCH.md §Installation (lines 134–170) — the exact `pnpm create next-app@15.5` flags and follow-up `pnpm add -D` commands
    - /Users/onlypaul/Workspace/neosim/.planning/phases/00-waveform-prototype/00-RESEARCH.md §Vitest Configuration Skeleton (lines 172–195) — verbatim `vitest.config.ts` shape
    - /Users/onlypaul/Workspace/neosim/.planning/phases/00-waveform-prototype/00-RESEARCH.md §Biome Configuration Skeleton (lines 197–212)
    - /Users/onlypaul/Workspace/neosim/.planning/phases/00-waveform-prototype/00-RESEARCH.md §Environment Availability (lines 514–534) — baseline probes (node, pnpm, git)
  </read_first>
  <action>
    Per D-02, scaffold in the current repo root using the RESEARCH.md §Installation command verbatim. Sequence:

    1. **Baseline probes** (from RESEARCH.md §Environment Availability). Run `node --version`, `pnpm --version`, `git --version`. If pnpm is missing, run `corepack enable` first. If node < 18, stop and surface the blocker.

    2. **Scaffold in place.** The repo root `/Users/onlypaul/Workspace/neosim` already contains `.planning/`, `design/`, `.claude/`, `.codex/`, `.cursor/`, and an 8-byte `README.md`. Do NOT run `pnpm create next-app` in a subdirectory — we want the scaffold files (package.json, app/, next.config.ts, tsconfig.json) at repo root per D-03 `--no-src-dir`. Approach: create the scaffold files manually to match what `create-next-app@15.5 --ts --app --no-eslint --no-tailwind --no-src-dir --import-alias "@/*" --use-pnpm --turbopack` would produce, then run `pnpm install`. Do not use `pnpm create next-app` because it will refuse to write into a non-empty directory.

       Manual scaffold files to write:
       - `package.json` — scripts `dev: next dev --turbopack`, `build: next build`, `start: next start`, `test: vitest run`, `test:watch: vitest`, `lint: biome check .`, `format: biome check --write .`. Dependencies: `next@^15.5.15`, `react@^19.2.5`, `react-dom@^19.2.5`. DevDependencies: `typescript@^5.9.3`, `@types/node@^22`, `@types/react@^19`, `@types/react-dom@^19`, `vitest@^4`, `@vitejs/plugin-react@^6`, `jsdom@^29`, `@testing-library/react@^16`, `@testing-library/dom@^10`, `@biomejs/biome@^2` (use `--save-exact` for Biome per §Installation step 3). Add top-level `"packageManager": "pnpm@10.33.0"`.
       - `.npmrc` — single line `engine-strict=true` (prevents accidental npm installs; RESEARCH.md §Standard Stack pnpm row).
       - `tsconfig.json` — Next 15.5 defaults with `"strict": true`, `"moduleResolution": "bundler"`, `"jsx": "preserve"`, `"paths": { "@/*": ["./*"] }`, `"include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"]`, `"exclude": ["node_modules"]`.
       - `next.config.ts` — minimal `import type { NextConfig } from 'next'; const nextConfig: NextConfig = {}; export default nextConfig;`.
       - `vitest.config.ts` — VERBATIM from RESEARCH.md lines 176–193 (environment: 'jsdom', globals: true, include for `tests/**/*.test.ts` + `.test.tsx`, plugins: [react()], alias `'@'` to repo root).
       - `biome.json` — from RESEARCH.md §Biome Configuration Skeleton lines 201–210 (formatter space/2, linter recommended, single-quote + semicolons, ignore `.next`/`node_modules`/`*.tsbuildinfo`).
       - `app/layout.tsx` — minimal root layout: `export default function RootLayout({ children }: { children: React.ReactNode }) { return (<html lang="en"><body style={{ margin: 0, background: '#000' }}>{children}</body></html>); }` plus `export const metadata = { title: 'NeoSim' };`. No Tailwind, no `next/font`, no globals.css (D-02 defers all styling).
       - `app/page.tsx` — placeholder root page: `export default function Page() { return <main style={{ padding: 16, color: '#fff', fontFamily: 'system-ui' }}><p>NeoSim — see <code>/prototype</code></p></main>; }`. Landing lands in Phase 4; this is just so `pnpm build` doesn't complain about an empty `app/`.
       - `.gitignore` — append Next.js defaults if not already present: `node_modules/`, `.next/`, `out/`, `.DS_Store`, `*.tsbuildinfo`, `.vercel`, `.env*.local`. Preserve existing entries.

    3. **Install.** `pnpm install` — this will generate `pnpm-lock.yaml`.

    4. **Biome init (only if biome.json is missing).** Skip `pnpm exec biome init` because we've written `biome.json` manually per the research skeleton; avoid clobber. Run `pnpm exec biome check .` to confirm the scaffold lints clean. If it flags rules on the manually-written files, auto-fix with `pnpm exec biome check --write .`.

    5. **Verify gates.** `pnpm build` must succeed. `pnpm test` must run (zero tests found is fine at this task — we're just verifying the config resolves). `pnpm exec biome check .` must exit 0.

    Cite decisions in commits: "scaffold per D-01/D-02/D-03; Vitest/Biome per RESEARCH.md §Installation".
  </action>
  <verify>
    <automated>pnpm install &amp;&amp; pnpm build &amp;&amp; pnpm test &amp;&amp; pnpm exec biome check .</automated>
  </verify>
  <acceptance_criteria>
    - `package.json` exists and `grep '"packageManager": "pnpm@' package.json` matches
    - `grep '"strict": true' tsconfig.json` matches
    - `grep "environment: 'jsdom'" vitest.config.ts` matches
    - `grep -E "@vitejs/plugin-react" package.json` matches in devDependencies
    - `grep -E "\"next\":\s*\"\\^15\\.5" package.json` matches (Next 15.5.x locked per D-02)
    - `grep -E "\"react\":\s*\"\\^19" package.json` matches
    - `grep -E "\"@biomejs/biome\"" package.json` matches
    - `test -f pnpm-lock.yaml` (not package-lock.json; not yarn.lock)
    - `test -f app/layout.tsx` and `test -f app/page.tsx`
    - `pnpm build` exits 0
    - `pnpm test` exits 0 (zero tests found is acceptable)
    - `pnpm exec biome check .` exits 0
  </acceptance_criteria>
  <done>
    Repo root has package.json + pnpm-lock.yaml + tsconfig.json (strict) + vitest.config.ts (jsdom) + biome.json + next.config.ts + app/layout.tsx + app/page.tsx. `pnpm install`, `pnpm build`, `pnpm test`, `pnpm exec biome check .` all exit 0. No npm/yarn lockfile, no ESLint config, no Tailwind config.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Write EngineState module + lib/clinical placeholder</name>
  <files>lib/waveforms/engine-state.ts, lib/clinical/.gitkeep</files>
  <behavior>
    - `createEngineState()` returns `{ phase: 0, rFired: false, lastT: 0, jitter: 1 }`
    - Two calls to `createEngineState()` return independent objects: mutating `a.phase` does not affect `b.phase`
    - `EngineState` is exported as a `type` / `interface` (not just a value) so downstream files can import it for parameter typing
    - The file has zero imports (pure ES module with no deps) — guarantees no circular-import risk when `sampleEcg.ts` and test files import from it
  </behavior>
  <read_first>
    - /Users/onlypaul/Workspace/neosim/.planning/phases/00-waveform-prototype/00-CONTEXT.md (D-08 — engine-state module scope; D-03 — directory layout including lib/clinical/)
    - /Users/onlypaul/Workspace/neosim/.planning/phases/00-waveform-prototype/00-RESEARCH.md §engine-state.ts (lines 654–668) — authoritative shape
    - /Users/onlypaul/Workspace/neosim/.planning/phases/00-waveform-prototype/00-RESEARCH.md §Pattern 4 Engine-State Module Scope (lines 369–394) — Shape B factory rationale
    - /Users/onlypaul/Workspace/neosim/.planning/phases/00-waveform-prototype/00-PATTERNS.md §Engine-state separation (lines 188–195)
  </read_first>
  <action>
    Write `lib/waveforms/engine-state.ts` VERBATIM from RESEARCH.md §engine-state.ts (lines 656–668). The exact content:

    ```ts
    // lib/waveforms/engine-state.ts
    export interface EngineState {
      phase: number;     // [0, 1) — position in current beat
      rFired: boolean;   // debounce for R-peak detection per beat
      lastT: number;     // last performance.now() seen; 0 = uninitialized
      jitter: number;    // reserved for AFib (P2); always 1 at P0
    }

    export function createEngineState(): EngineState {
      return { phase: 0, rFired: false, lastT: 0, jitter: 1 };
    }
    ```

    Rationale (cite in the commit message): implements D-08 — module-scoped factory shape (Pattern 4 Shape B). Plan 02's Vitest merge-regression test depends on factory semantics (independent instances per `createEngineState()` call) so it can assert merge isolation without a `beforeEach` hook. Do NOT export a singleton `engineState` constant — that breaks the test isolation WAVE-10 relies on.

    Also create `lib/clinical/.gitkeep` as an empty file so the directory exists for Phase 2's `nrp.ts` (D-03). `.gitkeep` is a convention — the file has no content requirement; an empty file is correct.

    Do NOT write `sampleEcg.ts`, `sweepCanvas.ts`, or any test file in this task — those belong to Plans 02 and 03 (they have dependencies on Vitest config being verified and on this file existing).
  </action>
  <verify>
    <automated>pnpm exec tsc --noEmit &amp;&amp; pnpm exec biome check lib/waveforms/engine-state.ts &amp;&amp; test -f lib/clinical/.gitkeep</automated>
  </verify>
  <acceptance_criteria>
    - `test -f lib/waveforms/engine-state.ts` succeeds
    - `grep -E "export interface EngineState" lib/waveforms/engine-state.ts` matches
    - `grep -E "export function createEngineState" lib/waveforms/engine-state.ts` matches
    - `grep -E "phase: 0" lib/waveforms/engine-state.ts` matches (factory default)
    - `grep -E "rFired: false" lib/waveforms/engine-state.ts` matches
    - `grep -E "lastT: 0" lib/waveforms/engine-state.ts` matches
    - `grep -E "jitter: 1" lib/waveforms/engine-state.ts` matches
    - File has NO `import` statement (grep -c "^import" returns 0) — confirms zero-dependency status
    - `test -f lib/clinical/.gitkeep` succeeds
    - `pnpm exec tsc --noEmit` exits 0 (the new file type-checks under strict)
    - `pnpm exec biome check lib/waveforms/engine-state.ts` exits 0
  </acceptance_criteria>
  <done>
    `lib/waveforms/engine-state.ts` exports `EngineState` type and `createEngineState()` factory. `lib/clinical/.gitkeep` exists as an empty file. TypeScript strict compiles clean, Biome lints clean. No singleton export; no imports.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

N/A at P0. The prototype has no auth, no user data, no server routes, no wire protocol, no persistence, no secrets. The only network surface is the static route served from Vercel preview URL (which is `noindex` by default per Vercel preview deployment defaults).

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-00-01 | I (Information Disclosure) | Vercel preview URL | accept | Preview URLs are noindex by default. No PII, no credentials, no business logic — the only artifact reachable is a throwaway ECG render page. |

Rationale: RESEARCH.md §Security Domain (not reproduced here; see phase research) explicitly scopes security work as N/A for Phase 0 — no auth surface, no data surface, no route handlers. Full STRIDE modeling begins in Phase 4 when session creation + Pusher private channels + Zod wire validation land.
</threat_model>

<verification>
Plan-level gate (run after both tasks complete):
- `pnpm install && pnpm build && pnpm test && pnpm exec biome check .` all exit 0
- `lib/waveforms/engine-state.ts` and `lib/clinical/.gitkeep` both exist
- `git status` shows only the intended new files (scaffold + engine-state + placeholder)
</verification>

<success_criteria>
- Next.js 15.5 + React 19 + TS strict + Vitest 4 + Biome 2 scaffold builds, tests, and lints clean from a fresh `pnpm install`
- `EngineState` + `createEngineState()` exist and match RESEARCH.md §engine-state.ts shape verbatim
- Directory skeleton `app/`, `lib/waveforms/`, `lib/clinical/`, `tests/` is in place (tests/ directory materializes in Plan 02)
- Repo is pnpm-locked (not npm, not yarn)
</success_criteria>

<output>
After completion, create `.planning/phases/00-waveform-prototype/00-01-SUMMARY.md` documenting:
- Exact `pnpm-lock.yaml` Next/React/Vitest/Biome versions that landed
- Whether manual scaffold or `create-next-app` was used (and why)
- Any Biome rule that needed disabling for Next's `next-env.d.ts`
- Any TS strict complaint that surfaced on the minimal `app/page.tsx` / `app/layout.tsx`
</output>
