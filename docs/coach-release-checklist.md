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
cd /Users/hwangjunguk/Desktop/dir_UK/dir_sandbox/hailo-infer
PYTHONPYCACHEPREFIX=/tmp/hailo_pycache python3 -m py_compile app/services/coach_commentary.py scripts/check_coach_commentary.py scripts/preview_coach_findings.py
PYTHONDONTWRITEBYTECODE=1 python3 scripts/check_coach_commentary.py
PYTHONDONTWRITEBYTECODE=1 python3 scripts/preview_coach_findings.py low_tracking_late_release --json

cd /Users/hwangjunguk/Desktop/dir_UK/dir_sandbox/pi_service
npm run check

cd /Users/hwangjunguk/Desktop/dir_UK/dir_sandbox/pi_web
npm run check:analysis
npm run check:coach-ui
npm run build
```

## Contract Checks

- `coachFindings` must remain an object array end-to-end.
- `confidence`, `caution`, and `theory` must survive
  `hailo-infer -> pi_service -> pi_web`.
- Low tracking quality must reduce swing-finding confidence and show `참고용`
  in the UI.
- Composite findings should appear before isolated symptoms.
- Redundant low-level findings should be suppressed in the user-facing summary.
- Ball-flight claims must stay bounded unless ball tracking exists.

## Push Order

Push in dependency order:

1. `hailo-infer`
2. `pi_service`
3. `pi_web`

This order ensures the backend can emit the full structured contract before the
service and UI rely on it.

## Post-Deploy Runtime Check

After GitHub Actions completes:

1. Re-analyze a known weak-tracking sample such as the IMG_5082-style case.
2. Confirm `coachFindings[0]` includes `key`, `priority`, `confidence`,
   `caution`, `theory`, `drill`, and `checkpoint`.
3. Confirm the analysis screen shows:
   - one compressed primary coach item;
   - `참고용` badge for low-confidence or caution findings;
   - expandable `판정 근거`, `드릴`, and `체크 포인트`;
   - no slice/hook/face diagnosis when ball tracking is missing.
4. Compare the displayed impact timing and confidence with the debug frame view
   before treating the result as accepted.

