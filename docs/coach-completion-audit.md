# Coach Completion Audit

This audit tracks whether the coach-commentary objective is complete enough to
call done. It intentionally separates local implementation evidence from runtime
evidence.

## Objective

Generate useful golf coaching comments from detected swing events and metrics by
combining golf-swing theory, structured analysis, validation, review, and an
improvement loop.

## Proven Locally

- `hailo-infer` emits structured `coachFindings` with `evidence`,
  `interpretation`, `action`, `drill`, `checkpoint`, `caution`, `confidence`,
  and `theory`.
- Composite rules prioritize combined patterns such as late release and
  over-the-top before isolated symptoms.
- Low tracking quality caps swing-finding confidence and adds caution text.
- Ball-flight claims remain bounded when ball tracking is missing.
- `pi_service` checks that `coachFindings` are passed through without rewriting
  or filtering the object array.
- `pi_web` normalizes `confidence`, `caution`, and `theory`.
- `pi_web` renders low-confidence or caution findings with a visible `참고용`
  badge and keeps detailed rationale/drill/checkpoint expandable.
- `npm run check:coach-release` runs the local cross-repo release gate.

## Local Evidence Command

```bash
cd /Users/hwangjunguk/Desktop/dir_UK/dir_sandbox/pi_web
npm run check:coach-release
```

This command currently covers:

- `hailo-infer` coach commentary regression checks;
- `hailo-infer` representative coach preview contract;
- `pi_service` coach findings pass-through checks;
- `pi_web` analysis normalization checks;
- `pi_web` coach-summary UI checks;
- `pi_web` production build.

## Not Yet Proven

The goal is not complete until these are true in the deployed runtime:

- The ahead commits are pushed and GitHub Actions complete successfully for
  `hailo-infer`, `pi_service`, and `pi_web`.
- A real uploaded swing is re-analyzed after deployment.
- The API response contains the structured `coachFindings` fields end-to-end.
- The analysis screen shows the expected compressed coach layout, `참고용` badge,
  rationale, drill, and checkpoint.
- The user-facing comment is reviewed against the actual debug impact frame and
  judged directionally correct.

## Completion Rule

Do not mark the objective complete from local tests alone. Local checks prove the
implementation and contracts; deployed runtime analysis proves the end-to-end
product behavior.

