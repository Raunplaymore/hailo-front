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
- Composite rules prioritize combined patterns such as late release,
  stuck-inside release, and over-the-top before isolated symptoms.
- User-facing summaries suppress redundant isolated symptoms and prevent
  multiple `1순위 패턴` findings from competing in the preview set.
- Low tracking quality caps swing-finding confidence and adds caution text.
- Ball-flight and face-angle claims remain bounded when ball tracking or launch
  direction evidence is missing.
- `pi_service` checks that `coachFindings` are passed through without rewriting
  or filtering the object array.
- `pi_web` normalizes `confidence`, `caution`, and `theory`.
- `pi_web` renders low-confidence or caution findings with a visible `참고용`
  badge, keeps detailed rationale/drill/checkpoint expandable, and shows a
  compact `바로 할 일` practice plan for the primary finding.
- `pi_web` keeps analysis details/debug metrics available behind collapsed
  sections so the primary coach action and video stay scannable.
- Runtime verification records are append-only by default: the generator refuses
  to overwrite an existing job-id record unless `--force` is explicitly used.
- `npm run check:coach-release` runs the local cross-repo release gate and
  validates the runtime verification overwrite guard with a real temporary file.

## Local Evidence Command

```bash
cd /Users/hwangjunguk/Desktop/dir_UK/dir_sandbox/pi_web
npm run check:coach-release
```

This command currently covers:

- `hailo-infer` coach commentary regression checks;
- `hailo-infer` representative coach preview contract, including no duplicate
  primary pattern and no unverified ball-flight wording;
- `hailo-infer` stuck-inside release preview contract, including the
  `pattern_stuck_inside_release` key, theory rationale, and right-thigh-space
  correction action;
- `pi_service` coach findings pass-through checks;
- `pi_web` analysis normalization checks;
- `pi_web` coach-summary UI checks;
- runtime verification template/release-summary preflight checks;
- runtime verification generator overwrite guard using a temporary output
  directory and repeated job id;
- runtime verification document checker using a completed fixture record;
- `pi_web` production build.

## Not Yet Proven

The goal is not complete until these are true in the deployed runtime:

- The ahead commits are pushed and GitHub Actions complete successfully for
  `hailo-infer`, `pi_service`, and `pi_web`.
- A real uploaded swing is re-analyzed after deployment.
- The API response contains the structured `coachFindings` fields end-to-end.
- The analysis screen shows the expected compressed coach layout, `참고용` badge,
  `바로 할 일`, rationale, drill, and checkpoint.
- The runtime verification record is created for the deployed job id and kept as
  release evidence.
- The completed runtime verification record passes
  `npm run coach:check-runtime-verification -- <record>`.
- The user-facing comment is reviewed against the actual debug impact frame and
  judged directionally correct.

Use `docs/coach-runtime-verification-template.md` to record the runtime evidence
for each accepted sample.

## Completion Rule

Do not mark the objective complete from local tests alone. Local checks prove the
implementation and contracts; deployed runtime analysis proves the end-to-end
product behavior.
