---
phase: 00-waveform-prototype
plan: 04
type: execute
wave: 4
depends_on:
  - "00-03"
files_modified:
  - .planning/phases/00-waveform-prototype/00-VERIFICATION.md
autonomous: false
requirements:
  - WAVE-01
  - WAVE-03
  - WAVE-04
  - WAVE-05
user_setup:
  - service: vercel
    why: "Per D-16, iPhone test target is the Vercel preview deploy (not localhost-over-LAN). Requires the user's Vercel account to be linked to the GitHub repo so branch pushes trigger preview builds."
    env_vars: []
    dashboard_config:
      - task: "Link GitHub repo to Vercel project (one-time)"
        location: "Vercel Dashboard → Add New → Project → Import from GitHub"
      - task: "Confirm preview deployments are enabled for non-default branches"
        location: "Vercel Project → Settings → Git → Preview Deployments"

must_haves:
  truths:
    - "Repo is pushed to a remote git branch that Vercel auto-deploys as a preview"
    - "User opens the preview URL on a newer-generation iPhone (13/14/15/16-class per D-13) in Safari landscape"
    - "FPS overlay screenshot after 60s continuous run shows rolling avg ≥ 58 fps and min ≥ 55 fps (D-14a)"
    - "Safari Web Inspector heap snapshot at t=0 and t=5min shows heap flat — ArrayBuffer count stable (D-14b)"
    - "Visual inspection on DPR=3 confirms crisp ECG stroke with no ghosting at the sweep boundary (D-14d)"
    - "Evidence (screenshots + heap snapshot) pasted into 00-VERIFICATION.md per D-15"
  artifacts:
    - path: ".planning/phases/00-waveform-prototype/00-VERIFICATION.md"
      provides: "Phase 0 evidence artifact: FPS screenshot, heap snapshots, DPR inspection notes"
      contains: "FPS"
  key_links:
    - from: "Vercel preview URL"
      to: "/prototype"
      via: "Git push → Vercel auto-build → HTTPS preview URL"
      pattern: "/prototype"
---

<objective>
Deploy the scaffold to Vercel preview, guide the user through capturing the four required pieces of iPhone-side evidence (FPS overlay screenshot, Safari heap snapshots at t=0 and t=5min, DPR=3 visual check), and codify the evidence into `00-VERIFICATION.md` so Phase 0 can close.

Purpose: This is the phase's de-risking payoff. Plans 01/02/03 produce the code; this plan produces the **evidence** that proves 60 fps on a real iPhone at real DPR=3 with a flat heap — the four success-criteria bullets from ROADMAP §Phase 0 that cannot be validated on localhost or in CI. Per D-16, Vercel preview is the only acceptable test target (localhost-over-LAN skews `performance.now()` precision on iOS 17+, Pitfall F).

Output: `00-VERIFICATION.md` with pasted screenshots/notes and a go/no-go stamp. If evidence fails thresholds, the transition blocks and `/gsd-plan-phase 0 --gaps` is run against the failures.
</objective>

<execution_context>
@/Users/onlypaul/Workspace/neosim/.claude/get-shit-done/workflows/execute-plan.md
@/Users/onlypaul/Workspace/neosim/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@/Users/onlypaul/Workspace/neosim/CLAUDE.md
@/Users/onlypaul/Workspace/neosim/.planning/phases/00-waveform-prototype/00-CONTEXT.md
@/Users/onlypaul/Workspace/neosim/.planning/phases/00-waveform-prototype/00-RESEARCH.md
@/Users/onlypaul/Workspace/neosim/.planning/phases/00-waveform-prototype/00-VALIDATION.md
@/Users/onlypaul/Workspace/neosim/.planning/phases/00-waveform-prototype/00-03-sweep-canvas-and-prototype-route-PLAN.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Push to git and verify Vercel preview is live</name>
  <files>(no source files modified; deployment side-effect)</files>
  <read_first>
    - /Users/onlypaul/Workspace/neosim/.planning/phases/00-waveform-prototype/00-CONTEXT.md D-16 — Vercel preview URL is the iPhone test target, not localhost
    - /Users/onlypaul/Workspace/neosim/.planning/phases/00-waveform-prototype/00-RESEARCH.md §Pitfall F iOS Safari Preview-Deploy HTTPS Requirement (lines 500–506)
    - /Users/onlypaul/Workspace/neosim/.planning/phases/00-waveform-prototype/00-RESEARCH.md §Environment Availability (lines 514–534) — Vercel CLI is optional; git push flow is sufficient
  </read_first>
  <action>
    1. **Commit state.** Ensure all Plan 01/02/03 changes are committed. Run `git status` — working tree should be clean or only have SUMMARY.md files staged.

    2. **Push to a preview branch.** If current branch is `main`, create a feature branch for Phase 0 work (`git checkout -b phase-0-waveform-prototype`) before pushing — avoids accidentally deploying Phase 0's throwaway `/prototype` to the production Vercel domain. If the Vercel project is not yet linked to the GitHub repo, PAUSE HERE and surface the user_setup requirement: the user must complete the one-time Vercel↔GitHub link via Vercel Dashboard (see frontmatter `user_setup.dashboard_config`). After linking, push the branch: `git push -u origin phase-0-waveform-prototype`.

    3. **Poll for preview URL.** Use `gh` CLI if available (`gh pr create --fill --draft` then read the Vercel bot comment) OR poll `vercel ls` if the Vercel CLI is authenticated OR simply ask the user to paste the preview URL from their Vercel dashboard. The preview URL will follow the pattern `https://neosim-<hash>-<username>.vercel.app`.

    4. **Smoke-check the preview URL.** `curl -sI <preview-url>/prototype` should return `200 OK` with `content-type: text/html`. If it returns 404, the build likely failed — check the Vercel build logs. Do NOT proceed to iPhone testing until `/prototype` returns 200 on the preview URL.

    5. **Surface preview URL to the user** as the target for the next task (iPhone evidence capture).

    Surface-without-automation: if Vercel isn't linked or the user wants to skip Vercel and use a different HTTPS target (e.g., their own domain), flag that as a deviation from D-16 and proceed only with explicit user override. Pitfall F warns that localhost-over-LAN HTTP will silently skew `performance.now()` on iOS 17+, so LAN testing is NOT an acceptable substitute.
  </action>
  <verify>
    <automated>git status --porcelain | grep -E "^(UU| U|U |AA|DD)" ; test $? -ne 0  # working tree has no merge conflicts</automated>
  </verify>
  <acceptance_criteria>
    - Current branch is NOT `main` (prevents Phase 0 throwaway code deploying to production domain) — verify with `git branch --show-current`
    - Branch has been pushed to the origin remote — verify with `git rev-parse --abbrev-ref --symbolic-full-name @{u}` returns a non-empty upstream
    - Preview URL is known and stored (surfaced to the checkpoint task below)
    - `curl -sI <preview-url>/prototype` returns HTTP 200 (record the URL in a local note for the next task to reference)
  </acceptance_criteria>
  <done>
    Phase 0 branch is pushed; Vercel preview URL is live and returns 200 on `/prototype`. User has the URL to open on their iPhone in the next task.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 2: iPhone evidence capture — FPS, heap, DPR, LPM</name>
  <what-built>
    Plans 01–03 built the scaffold, engine math, tests, and `/prototype` route. Task 1 above deployed it to a Vercel preview URL (HTTPS). This checkpoint is the user performing the four device-side measurements that cannot be automated, per D-14:

    (a) FPS overlay screenshot after 60s continuous run — must show rolling avg ≥ 58 fps AND min ≥ 55 fps
    (b) Safari heap snapshots at t=0 and t=5min — ArrayBuffer count must be stable (no growth)
    (c) Visual DPR=3 inspection — ECG stroke must be crisp with no ghosting at the sweep boundary
    (d) Low Power Mode sanity — enable Settings → Battery → Low Power Mode; confirm waveform still advances with clinically correct HR period (no visual halving of heart rate) even though FPS overlay reports ~30 fps
  </what-built>
  <how-to-verify>
    **Setup (one-time):**
    1. Open the Vercel preview URL on the newer-generation iPhone (per D-13 — 13/14/15/16-class; iPhone 12 re-verification is a Phase 5 soak item, not a P0 blocker).
    2. Rotate iPhone to landscape orientation.
    3. Close all other tabs in Safari.
    4. Ensure iPhone is NOT in Low Power Mode yet (Settings → Battery → Low Power Mode OFF). Battery should be > 50% to avoid LPM auto-engaging.
    5. Connect iPhone to your Mac via USB cable. On Mac, open Safari → Develop menu → [iPhone device name] → select the preview URL tab. This opens Safari Web Inspector for remote debug.
    6. In Web Inspector, open the **Memory** tab — this is where heap snapshots happen.

    **Step 1 — FPS screenshot (WAVE-01, D-14a):**
    1. Navigate to `<preview-url>/prototype` on the iPhone.
    2. Wait 60 continuous seconds. Do not switch tabs, scroll, or lock the phone.
    3. Take an iPhone screenshot (side button + volume up). The screenshot must capture the FPS overlay text at top-right.
    4. Confirm the overlay reads `FPS {avg} · min {min}` where `avg ≥ 58` and `min ≥ 55`. If not, record the actual numbers and STOP — this is a phase failure and requires `/gsd-plan-phase 0 --gaps`.
    5. Save the screenshot locally (AirDrop to Mac is easiest) as `phase-0-fps-60s.png` or similar.

    **Step 2 — Heap snapshot t=0 (WAVE-04, D-14b):**
    1. Hard-refresh the preview URL on the iPhone (hold the reload button, tap "Reload Without Content Blockers" — forces a clean state).
    2. Immediately in Web Inspector Memory tab, click "Take Snapshot." Wait for it to complete (~5 s).
    3. Note the `ArrayBuffer` count and total heap size. The Float32Array ring buffer should appear as one 5 KB ArrayBuffer (1250 floats × 4 bytes).
    4. Save snapshot or at minimum screenshot the Memory tab summary panel.

    **Step 3 — Heap snapshot t=5min (WAVE-04, D-14b):**
    1. Leave the page running for exactly 5 minutes (set a timer).
    2. Click "Take Snapshot" again in Web Inspector Memory tab.
    3. Compare to t=0 snapshot:
       - ArrayBuffer count should be **identical** (no growth).
       - Total heap size should be within ~1–2 MB of t=0 (any growth should be JS engine caches, not ArrayBuffer expansion).
    4. If ArrayBuffer count grew, the buffer is leaking — STOP, record the delta, and require gap closure.
    5. Screenshot both snapshot summaries side-by-side.

    **Step 4 — DPR=3 crispness check (WAVE-05, D-14d):**
    1. Take a zoomed-in iPhone screenshot of the ECG stroke mid-sweep. Use iPhone's built-in zoom (pinch-out on an existing screenshot) or take a fresh screenshot then Markup zoom.
    2. Visually inspect: (i) stroke edges are sharp, no softness/blur; (ii) no ghosting halo behind the sweep cursor; (iii) no tearing line where the clear-ahead rectangle meets the drawn waveform.
    3. If any of these three defects are visible, record which one and STOP — likely a `Math.min(DPR, 2)` slip in `sweepCanvas.ts` (re-check the grep from Plan 03 acceptance criteria).

    **Step 5 — Low Power Mode (WAVE-03, D-14 implicit):**
    1. Enable Settings → Battery → Low Power Mode.
    2. Return to `/prototype` and let it run for 30 continuous seconds.
    3. FPS overlay now shows `~30` average — this is expected iOS behavior (rAF throttled to 30 Hz per Pitfall 5).
    4. Visually confirm the ECG beats still occur at the correct rate (HR=140 bpm ≈ 2.33 beats/second = ~14 beats in 6 seconds). Count beats over a 6-second span and verify count is 13–15. If the beat rate halved (now ~7 beats in 6 seconds), the engine is frame-counted not time-based — WAVE-03 regression.
    5. Disable Low Power Mode when done.
    6. Screenshot the FPS overlay in LPM state — it should show amber text (avg < 55 threshold in UI-SPEC).

    **Evidence assembly:**
    After capturing all screenshots + snapshot panels, paste them into `.planning/phases/00-waveform-prototype/00-VERIFICATION.md` (create the file if absent). Use the template below — fill in actual values:

    ```markdown
    # Phase 0 — Verification Evidence

    **Device:** iPhone {13|14|15|16} · iOS {version}
    **Preview URL:** https://neosim-{hash}-{user}.vercel.app/prototype
    **Captured:** {date}

    ## D-14a — FPS Overlay (60s continuous run)
    ![fps-60s](./evidence/phase-0-fps-60s.png)
    Rolling avg: {N} fps · Min: {N} fps — PASS if avg ≥ 58 AND min ≥ 55.

    ## D-14b — Heap Snapshots (t=0 vs t=5min)
    ![heap-t0](./evidence/phase-0-heap-t0.png)
    ![heap-t5](./evidence/phase-0-heap-t5.png)
    ArrayBuffer count t=0: {N} · t=5min: {N} — PASS if delta = 0.
    Total heap t=0: {N} MB · t=5min: {N} MB — PASS if delta < 2 MB.

    ## D-14d — DPR=3 Crispness
    ![dpr3-zoom](./evidence/phase-0-dpr3-zoom.png)
    Stroke edges: {sharp|blurry} · Ghosting: {none|visible} · Tearing: {none|visible}.

    ## WAVE-03 — Low Power Mode Sanity
    ![lpm-fps](./evidence/phase-0-lpm-fps.png)
    FPS overlay in LPM: avg {~30}, color amber. Beat count over 6s at HR=140: {N} (expected 13–15). PASS if in range.

    ## Sign-off
    - [ ] D-14a FPS
    - [ ] D-14b Heap
    - [ ] D-14d DPR
    - [ ] WAVE-03 LPM
    - [ ] Vitest merge regression green (SC#5 — already confirmed in Plan 02)
    ```

    Commit the VERIFICATION.md (and any `evidence/` image directory) before resuming.
  </how-to-verify>
  <resume-signal>
    Reply with one of:
    - `approved` — all four gates pass; commit VERIFICATION.md, this phase is ready for `/gsd-verify-work` → `/gsd-transition`.
    - `failed {gate}` — specify which gate failed (fps / heap / dpr / lpm) plus the actual measurement. Planner will run `/gsd-plan-phase 0 --gaps` against the failure.
    - `blocked {reason}` — e.g., "no Mac for Web Inspector" (→ fall back to `performance.measureUserAgentSpecificMemory()` on-page per RESEARCH.md assumption A10), or "Vercel not linked" (→ complete user_setup).
  </resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

N/A at P0. The Vercel preview URL is public HTTPS, noindex by default, serves only the throwaway `/prototype` static asset with zero server state or user data.

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-00-04 | I (Information Disclosure) | Vercel preview URL shared publicly | accept | Preview URLs are obscure (branch-hash-user subdomain), noindex by default, and the route serves only an ECG sinus render — no PII, no credentials. Acceptable risk. |
| T-00-05 | D (Denial of Service) | `/prototype` route inadvertently deployed to production Vercel domain | mitigate | Task 1 enforces a non-main branch before push; Phase 2 planning will delete `app/prototype/*` per D-01 before Phase 2 ships. |
</threat_model>

<verification>
Plan-level gates (all human-verified in Task 2):
- FPS avg ≥ 58, min ≥ 55 for 60s continuous (WAVE-01)
- ArrayBuffer count stable across t=0 and t=5min snapshots (WAVE-04)
- Visual DPR=3 crispness confirmed (WAVE-05)
- LPM beat rate matches HR=140 period (13–15 beats over 6 seconds) (WAVE-03)
- Vitest merge-regression test stays green (WAVE-10 — already confirmed in Plan 02; re-confirmed via `pnpm test` before branch push)
- `00-VERIFICATION.md` exists and all four sign-off boxes are checked
</verification>

<success_criteria>
Phase 0 closes when:
- All four device-side gates pass
- `00-VERIFICATION.md` is committed with actual measurements (not placeholders)
- Phase 0 requirements WAVE-01, WAVE-03, WAVE-04, WAVE-05, WAVE-07, WAVE-10 are each backed by evidence (WAVE-07 + WAVE-10 backed by the Vitest tests from Plans 01/02; WAVE-03 + WAVE-04 + WAVE-05 + WAVE-01 backed by device evidence from this plan)
</success_criteria>

<output>
After completion, create `.planning/phases/00-waveform-prototype/00-04-SUMMARY.md` documenting:
- Actual FPS numbers captured (avg, min)
- Actual heap delta (t=0 vs t=5min ArrayBuffer count, total heap MB)
- Actual LPM beat count over 6s
- The Vercel preview URL used (keep for Phase 1 spike re-use)
- Any gate that failed and the resulting gap-closure plan filed (if any)
- Confirmation that `/prototype` is flagged for deletion in Phase 2 transition
</output>
