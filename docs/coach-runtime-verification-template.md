# Coach Runtime Verification Template

Copy this template for each post-deploy sample that is used to accept the coach
commentary release.

## Sample

- Date:
- Tester:
- Source video / shot id:
- Job id:
- View:
- Expected impact frame/time:
- Actual selected impact frame/time:

## Deployment Evidence

- `hailo-infer` GitHub Actions run:
- `pi_service` GitHub Actions run:
- `pi_web` GitHub Actions run:
- Deployed commit order confirmed:
  - `hailo-infer`:
  - `pi_service`:
  - `pi_web`:

## API Evidence

Paste or summarize the relevant analysis response fields:

```json
{
  "analysisVersion": "",
  "events": {
    "addressMs": null,
    "topMs": null,
    "impactMs": null,
    "finishMs": null
  },
  "confidence": null,
  "metrics": {
    "trackingQuality": {},
    "tempo": {},
    "shaftPlane": {},
    "backswing": {},
    "impactStability": {}
  },
  "coachFindings": [
    {
      "key": "",
      "priority": "",
      "confidence": null,
      "evidence": "",
      "interpretation": "",
      "action": "",
      "drill": "",
      "checkpoint": "",
      "caution": "",
      "theory": ""
    }
  ]
}
```

Required checks:

- `coachFindings` is an object array.
- First finding has `key`, `priority`, `confidence`, `evidence`, `action`,
  `drill`, `checkpoint`, `caution`, and `theory`.
- Low-confidence/caution finding appears as reference guidance, not absolute
  diagnosis.
- No slice/hook/face claim is made without ball tracking.

## UI Evidence

- Primary coach card is compressed:
- `참고용` badge appears when expected:
- `판정 근거` expands and matches `theory`:
- `드릴` expands and matches `drill`:
- `체크 포인트` expands and matches `checkpoint`:
- Detailed metrics remain available but not overwhelming:

## Coaching Review

- Does the top finding match the visible swing pattern?
- Does the impact time match the debug frame closely enough?
- Is the drill actionable for the observed issue?
- Is the caution appropriate for the tracking quality?
- Accept / reject:
- Follow-up change if rejected:

