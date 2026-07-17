# Coach Release Checklist

Use this checklist before pushing the coach commentary changes across the
Raspberry Pi analysis workspace.

## Scope

The coach feature spans three repositories:

- `hailo-infer`: generates `coachSummary`, structured `coachFindings`, theory,
  confidence, and caution.
- `pi_service`: passes analysis results through without rewriting structured
  coach finding objects.
- `pi_web`: normalizes and renders coach findings, including theory rationale
  and reference/low-confidence state.

## Local Gates

Run these before any push:

```bash
cd /Users/hwangjunguk/Desktop/Ray/UK/hailo-front
npm run coach:release-summary
npm run check:coach-release
```

If both commands look correct, push using the commands printed by
`coach:release-summary`.

The command above runs the repo-specific gates below:

```bash
cd /Users/hwangjunguk/Desktop/Ray/UK/hailo-infer
PYTHONPYCACHEPREFIX=/tmp/hailo_pycache python3 -m py_compile app/services/coach_commentary.py scripts/check_coach_commentary.py scripts/preview_coach_findings.py
PYTHONDONTWRITEBYTECODE=1 python3 scripts/check_coach_commentary.py
PYTHONDONTWRITEBYTECODE=1 python3 scripts/preview_coach_findings.py --json

cd /Users/hwangjunguk/Desktop/Ray/UK/hailo-back
npm run check

cd /Users/hwangjunguk/Desktop/Ray/UK/hailo-front
npm run check:analysis
npm run check:coach-ui
npm run build
```

`npm run check:coach-release` also creates a temporary runtime verification
record and reruns the generator with the same job id. The second run must fail
without `--force`, proving that post-deploy verification records cannot be
silently overwritten.

## Contract Checks

- `coachFindings` must remain an object array end-to-end.
- `confidence`, `caution`, and `theory` must survive
  `hailo-infer -> pi_service -> pi_web`.
- Low tracking quality must reduce swing-finding confidence and show `참고용`
  in the UI.
- Composite findings should appear before isolated symptoms.
- User-facing preview should not show more than one `1순위 패턴`.
- Redundant low-level findings should be suppressed in the user-facing summary.
- Ball-flight and face-angle claims must stay bounded unless ball tracking and
  launch-direction evidence exist.
- Runtime verification records must be append-only by default. Existing records
  can be replaced only with explicit `--force` and reviewer intent.

## Push Order

Push in dependency order:

1. `hailo-infer`
2. `pi_service`
3. `pi_web`

This order ensures the backend can emit the full structured contract before the
service and UI rely on it.

## Post-Deploy Runtime Check

After GitHub Actions completes:

1. Create a runtime verification record with
   `npm run coach:new-runtime-verification -- --job-id <job-id> --shot-id <shot-id> --tester <name>`.
2. Re-analyze a known weak-tracking sample such as the IMG_5082-style case.
3. Confirm `coachFindings[0]` includes `key`, `priority`, `confidence`,
   `caution`, `theory`, `drill`, and `checkpoint`.
4. Confirm the analysis screen shows:
   - one compressed primary coach item;
   - `바로 할 일` correction/drill/checkpoint summary when fields exist;
   - `참고용` badge for low-confidence or caution findings;
   - expandable `판정 근거`, `드릴`, and `체크 포인트`;
   - no slice/hook/push/pull/face diagnosis when ball tracking is missing.
5. Compare the displayed impact timing and confidence with the debug frame view
   before treating the result as accepted.
6. Validate the completed evidence record with
   `npm run coach:check-runtime-verification -- docs/runtime-verifications/<date>-<job-id>.md`.
