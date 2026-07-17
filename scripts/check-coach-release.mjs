import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workspace = resolve(root, "..");
const repos = {
  hailoInfer: resolve(workspace, "hailo-infer"),
  piService: resolve(workspace, "hailo-back"),
  piWeb: root,
};
const runtimeVerificationTestDir = mkdtempSync(resolve(tmpdir(), "coach-runtime-verification-"));
const runtimeVerificationFixturePath = resolve(runtimeVerificationTestDir, "accepted-runtime.md");
const incompleteRuntimeVerificationFixturePath = resolve(
  runtimeVerificationTestDir,
  "incomplete-runtime.md"
);
let runtimeVerificationTestDirCleaned = false;

function cleanupRuntimeVerificationTestDir() {
  if (runtimeVerificationTestDirCleaned) return;
  runtimeVerificationTestDirCleaned = true;
  rmSync(runtimeVerificationTestDir, { force: true, recursive: true });
}

process.on("exit", cleanupRuntimeVerificationTestDir);

const requiredPaths = [
  resolve(repos.hailoInfer, "app/services/coach_commentary.py"),
  resolve(repos.hailoInfer, "scripts/check_coach_commentary.py"),
  resolve(repos.hailoInfer, "scripts/preview_coach_findings.py"),
  resolve(repos.piService, "server.js"),
  resolve(repos.piService, "scripts/check-coach-findings-passthrough.mjs"),
  resolve(repos.piWeb, "scripts/check-analysis-normalization.mjs"),
  resolve(repos.piWeb, "scripts/check-coach-summary-ui.mjs"),
  resolve(repos.piWeb, "scripts/check-coach-runtime-verification.mjs"),
  resolve(repos.piWeb, "scripts/coach-release-summary.mjs"),
  resolve(repos.piWeb, "scripts/new-coach-runtime-verification.mjs"),
  resolve(repos.piWeb, "docs/coach-completion-audit.md"),
  resolve(repos.piWeb, "docs/coach-runtime-verification-template.md"),
  resolve(repos.piWeb, "package.json"),
];

for (const path of requiredPaths) {
  if (!existsSync(path)) {
    console.error(`Missing required coach release path: ${path}`);
    process.exit(1);
  }
}

const packageJson = JSON.parse(readFileSync(resolve(repos.piWeb, "package.json"), "utf8"));
for (const [scriptName, scriptCommand] of Object.entries({
  "check:coach-release": "node scripts/check-coach-release.mjs",
  "coach:release-summary": "node scripts/coach-release-summary.mjs",
  "coach:new-runtime-verification": "node scripts/new-coach-runtime-verification.mjs",
  "coach:check-runtime-verification": "node scripts/check-coach-runtime-verification.mjs",
})) {
  if (packageJson.scripts?.[scriptName] !== scriptCommand) {
    console.error(`package.json missing required coach script: ${scriptName}`);
    process.exit(1);
  }
}

writeFileSync(
  runtimeVerificationFixturePath,
  `# Coach Runtime Verification

## Sample

- Date: 2026-07-11
- Tester: release gate
- Source video / shot id: fixture-shot
- Job id: fixture-job
- View: DTL
- Expected impact frame/time: frame 60 / 1043ms
- Actual selected impact frame/time: frame 60 / 1043ms

## Deployment Evidence

- \`hailo-infer\` GitHub Actions run: fixture
- \`pi_service\` GitHub Actions run: fixture
- \`pi_web\` GitHub Actions run: fixture
- Deployed commit order confirmed:
  - \`hailo-infer\`: fixture
  - \`pi_service\`: fixture
  - \`pi_web\`: fixture

## API Evidence

\`\`\`json
{
  "analysisVersion": "hailo-coach-service7-v3",
  "events": {
    "addressMs": 0,
    "topMs": 352,
    "impactMs": 527,
    "finishMs": 718
  },
  "confidence": 0.42,
  "metrics": {
    "trackingQuality": { "score": 0.42 },
    "tempo": { "ratio": 2.01 },
    "shaftPlane": { "label": "flat" },
    "backswing": { "label": "adequate" },
    "impactStability": { "label": "unstable" }
  },
  "coachFindings": [
    {
      "key": "pattern_stuck_inside_release",
      "priority": "1순위 패턴",
      "confidence": 0.42,
      "evidence": "shaft flat + inside-out + unstable impact",
      "interpretation": "club is likely stuck behind the body",
      "action": "bring the club through the space in front of the right thigh",
      "drill": "slow pump drill",
      "checkpoint": "handle stays in front of right thigh",
      "caution": "tracking quality is reference-level",
      "theory": "인사이드-스턱 릴리스 패턴"
    }
  ]
}
\`\`\`

## UI Evidence

- Primary coach card is compressed: yes
- \`참고용\` badge appears when expected: yes
- \`판정 근거\` expands and matches \`theory\`: yes
- \`드릴\` expands and matches \`drill\`: yes
- \`체크 포인트\` expands and matches \`checkpoint\`: yes
- \`바로 할 일\` shows the first finding's correction, drill, and checkpoint when
  those fields are present: yes
- Detailed metrics remain available but not overwhelming: yes

## Coaching Review

- Does the top finding match the visible swing pattern: yes
- Does the impact time match the debug frame closely enough: yes
- Is the drill actionable for the observed issue: yes
- Is the caution appropriate for the tracking quality: yes
- Accept / reject: Accept
- Follow-up change if rejected: none
`,
  "utf8"
);

writeFileSync(
  incompleteRuntimeVerificationFixturePath,
  `# Coach Runtime Verification

## Sample

- Date:
- Tester:
- Source video / shot id:
- Job id:
- View:
- Expected impact frame/time:
- Actual selected impact frame/time:

## Deployment Evidence

- \`hailo-infer\` GitHub Actions run:
- \`pi_service\` GitHub Actions run:
- \`pi_web\` GitHub Actions run:

## API Evidence

\`\`\`json
{
  "analysisVersion": "",
  "events": {
    "impactMs": null
  },
  "confidence": null,
  "metrics": {},
  "coachFindings": []
}
\`\`\`

## UI Evidence

- Primary coach card is compressed:
- \`참고용\` badge appears when expected:
- \`판정 근거\` expands and matches \`theory\`:
- \`드릴\` expands and matches \`drill\`:
- \`체크 포인트\` expands and matches \`checkpoint\`:
- Detailed metrics remain available but not overwhelming:

## Coaching Review

- Does the top finding match the visible swing pattern:
- Does the impact time match the debug frame closely enough:
- Is the drill actionable for the observed issue:
- Is the caution appropriate for the tracking quality:
- Accept / reject:
`,
  "utf8"
);

const runtimeTemplate = readFileSync(
  resolve(repos.piWeb, "docs/coach-runtime-verification-template.md"),
  "utf8"
);
for (const requiredText of [
  'priority: "1순위 패턴"',
  "pattern_stuck_inside_release",
  "right thigh",
  "launch-direction evidence",
  "바로 할 일",
]) {
  if (!runtimeTemplate.includes(requiredText)) {
    console.error(`Runtime verification template missing required text: ${requiredText}`);
    process.exit(1);
  }
}

const releaseSummarySource = readFileSync(
  resolve(repos.piWeb, "scripts/coach-release-summary.mjs"),
  "utf8"
);
for (const requiredText of [
  "function gitRaw",
  "has uncommitted changes",
  "both staged and unstaged",
  "has local changes but no ahead commits yet",
  "Release blockers before push",
  "Post-deploy runtime verification",
  "coach:new-runtime-verification",
  "coach:check-runtime-verification",
  "impact-frame evidence",
]) {
  if (!releaseSummarySource.includes(requiredText)) {
    console.error(`Coach release summary missing required safeguard: ${requiredText}`);
    process.exit(1);
  }
}

const completionAuditSource = readFileSync(
  resolve(repos.piWeb, "docs/coach-completion-audit.md"),
  "utf8"
);
for (const requiredText of [
  "Do not mark the objective complete from local tests alone",
  "deployed runtime analysis proves",
  "end-to-end",
  "runtime verification generator overwrite guard using a temporary output",
  "A real uploaded swing is re-analyzed after deployment",
  "The runtime verification record is created for the deployed job id",
  "completed runtime verification record passes",
  "coach:check-runtime-verification",
]) {
  if (!completionAuditSource.includes(requiredText)) {
    console.error(`Coach completion audit missing required evidence boundary: ${requiredText}`);
    process.exit(1);
  }
}

const runtimeGeneratorSource = readFileSync(
  resolve(repos.piWeb, "scripts/new-coach-runtime-verification.mjs"),
  "utf8"
);
for (const requiredText of [
  'args.includes("--force")',
  "existsSync(outputPath)",
  "COACH_RUNTIME_VERIFICATION_DIR",
  "Runtime verification already exists",
  "Pass --force only",
]) {
  if (!runtimeGeneratorSource.includes(requiredText)) {
    console.error(`Runtime verification generator missing overwrite safeguard: ${requiredText}`);
    process.exit(1);
  }
}

const runtimeVerificationCheckerSource = readFileSync(
  resolve(repos.piWeb, "scripts/check-coach-runtime-verification.mjs"),
  "utf8"
);
for (const requiredText of [
  "pattern_stuck_inside_release action must mention right-thigh space",
  "coach finding makes ball-flight/face claim without launch evidence",
  "`바로 할 일` shows the first finding's correction",
  "coachFindings contains multiple primary patterns",
  "Accept / reject must be either Accept or Reject",
]) {
  if (!runtimeVerificationCheckerSource.includes(requiredText)) {
    console.error(`Runtime verification checker missing required safeguard: ${requiredText}`);
    process.exit(1);
  }
}

const commands = [
  {
    name: "pi_web runtime verification overwrite guard",
    cwd: repos.piWeb,
    command: "node",
    args: ["scripts/new-coach-runtime-verification.mjs", "--job-id", "release-overwrite-guard"],
    env: {
      COACH_RUNTIME_VERIFICATION_DIR: runtimeVerificationTestDir,
    },
    validateRepeatFailure: true,
  },
  {
    name: "pi_web runtime verification document check",
    cwd: repos.piWeb,
    command: "node",
    args: ["scripts/check-coach-runtime-verification.mjs", runtimeVerificationFixturePath],
  },
  {
    name: "pi_web incomplete runtime verification rejection",
    cwd: repos.piWeb,
    command: "node",
    args: [
      "scripts/check-coach-runtime-verification.mjs",
      incompleteRuntimeVerificationFixturePath,
    ],
    validateFailure: true,
  },
  {
    name: "hailo-infer py_compile",
    cwd: repos.hailoInfer,
    command: "python3",
    args: [
      "-m",
      "py_compile",
      "app/services/coach_commentary.py",
      "scripts/check_coach_commentary.py",
      "scripts/preview_coach_findings.py",
    ],
    env: { PYTHONPYCACHEPREFIX: "/tmp/hailo_pycache" },
  },
  {
    name: "hailo-infer coach commentary",
    cwd: repos.hailoInfer,
    command: "python3",
    args: ["scripts/check_coach_commentary.py"],
    env: { PYTHONDONTWRITEBYTECODE: "1" },
  },
  {
    name: "hailo-infer coach preview",
    cwd: repos.hailoInfer,
    command: "python3",
    args: ["scripts/preview_coach_findings.py", "--json"],
    env: { PYTHONDONTWRITEBYTECODE: "1" },
    validateJson: (payload) => {
      for (const [caseName, item] of Object.entries(payload ?? {})) {
        const primaryPatterns = (Array.isArray(item?.findings) ? item.findings : []).filter(
          (finding) => finding?.category === "pattern" && finding?.priority === "1순위 패턴"
        );
        if (primaryPatterns.length > 1) {
          throw new Error(`coach preview ${caseName} has multiple primary patterns`);
        }
      }
      const allComments = Object.values(payload ?? {}).flatMap((item) =>
        Array.isArray(item?.comments) ? item.comments.map(String) : []
      );
      for (const forbidden of ["슬라이스/풀성 구질", "푸시/훅성 구질"]) {
        if (allComments.some((comment) => comment.includes(forbidden))) {
          throw new Error(`coach preview contains unverified ball-flight claim: ${forbidden}`);
        }
      }
      const finding = payload?.low_tracking_late_release?.findings?.[0];
      if (finding?.key !== "pattern_late_club_release") {
        throw new Error("coach preview did not rank pattern_late_club_release first");
      }
      if (finding?.confidence > 0.3) {
        throw new Error("coach preview did not apply low-tracking confidence cap");
      }
      if (!String(finding?.caution ?? "").includes("추적 품질")) {
        throw new Error("coach preview did not preserve low-tracking caution");
      }
      const stuckFinding = payload?.stuck_inside_release?.findings?.[0];
      if (stuckFinding?.key !== "pattern_stuck_inside_release") {
        throw new Error("coach preview did not rank pattern_stuck_inside_release first");
      }
      if (!String(stuckFinding?.action ?? "").includes("오른쪽 허벅지 앞 공간")) {
        throw new Error("coach preview did not preserve stuck-inside correction action");
      }
      if (!String(stuckFinding?.theory ?? "").includes("인사이드-스턱 릴리스 패턴")) {
        throw new Error("coach preview did not preserve stuck-inside theory rationale");
      }
    },
  },
  {
    name: "pi_service check",
    cwd: repos.piService,
    command: "npm",
    args: ["run", "check"],
  },
  {
    name: "pi_web analysis normalization",
    cwd: repos.piWeb,
    command: "npm",
    args: ["run", "check:analysis"],
  },
  {
    name: "pi_web coach UI",
    cwd: repos.piWeb,
    command: "npm",
    args: ["run", "check:coach-ui"],
  },
  {
    name: "pi_web build",
    cwd: repos.piWeb,
    command: "npm",
    args: ["run", "build"],
  },
];

for (const step of commands) {
  console.log(`\n==> ${step.name}`);
  const result = spawnSync(step.command, step.args, {
    cwd: step.cwd,
    env: { ...process.env, ...(step.env ?? {}) },
    encoding:
      step.validateJson || step.validateRepeatFailure || step.validateFailure
        ? "utf8"
        : undefined,
    stdio:
      step.validateJson || step.validateRepeatFailure || step.validateFailure ? "pipe" : "inherit",
  });

  if (step.validateFailure) {
    if (result.status === 0) {
      console.error(`${step.name} unexpectedly passed`);
      process.exit(1);
    }
    if (!String(result.stderr).includes("Runtime verification invalid")) {
      console.error(`${step.name} failed without the expected validation message`);
      process.exit(1);
    }
    console.log("incomplete runtime verification rejection check passed");
    continue;
  }

  if (result.status !== 0) {
    if ((step.validateJson || step.validateRepeatFailure) && result.stderr) {
      process.stderr.write(result.stderr);
    }
    process.exit(result.status ?? 1);
  }

  if (step.validateJson) {
    try {
      step.validateJson(JSON.parse(result.stdout));
      console.log("coach preview contract check passed");
    } catch (error) {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    }
  }

  if (step.validateRepeatFailure) {
    const repeat = spawnSync(step.command, step.args, {
      cwd: step.cwd,
      env: { ...process.env, ...(step.env ?? {}) },
      encoding: "utf8",
      stdio: "pipe",
    });
    if (repeat.status === 0) {
      console.error("Runtime verification generator allowed overwrite without --force");
      process.exit(1);
    }
    if (!String(repeat.stderr).includes("Runtime verification already exists")) {
      console.error("Runtime verification generator failed without the expected overwrite message");
      process.exit(1);
    }
    console.log("runtime verification overwrite guard check passed");
  }
}

console.log("\ncoach release checks passed");
