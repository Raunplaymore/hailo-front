import { readFileSync } from "node:fs";

const filePath = process.argv[2];

if (!filePath) {
  console.error("Usage: npm run coach:check-runtime-verification -- <verification-file.md>");
  process.exit(1);
}

const source = readFileSync(filePath, "utf8");

function fail(message) {
  console.error(`Runtime verification invalid: ${message}`);
  process.exit(1);
}

function requireText(text) {
  if (!source.includes(text)) {
    fail(`missing required text: ${text}`);
  }
}

function valueFor(label) {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const sameLinePattern = new RegExp(`^- ${escapedLabel}:\\s*(.+)$`, "m");
  const sameLineValue = source.match(sameLinePattern)?.[1]?.trim();
  if (sameLineValue) return sameLineValue;

  const multilinePattern = new RegExp(`^- ${escapedLabel}\\s*\\n\\s+(.+)$`, "m");
  const continuation = source.match(multilinePattern)?.[1]?.trim() ?? "";
  const valueIndex = continuation.lastIndexOf(":");
  if (valueIndex < 0) return continuation;
  return continuation.slice(valueIndex + 1).trim();
}

for (const heading of [
  "## Sample",
  "## Deployment Evidence",
  "## API Evidence",
  "## UI Evidence",
  "## Coaching Review",
]) {
  requireText(heading);
}

for (const label of [
  "Date",
  "Tester",
  "Source video / shot id",
  "Job id",
  "View",
  "Expected impact frame/time",
  "Actual selected impact frame/time",
]) {
  if (!valueFor(label)) {
    fail(`sample field is empty: ${label}`);
  }
}

for (const label of [
  "`hailo-infer` GitHub Actions run",
  "`pi_service` GitHub Actions run",
  "`pi_web` GitHub Actions run",
]) {
  if (!valueFor(label)) {
    fail(`deployment evidence is empty: ${label}`);
  }
}

const jsonMatch = source.match(/```json\s*([\s\S]*?)```/);
if (!jsonMatch) {
  fail("missing API evidence JSON block");
}

let api;
try {
  api = JSON.parse(jsonMatch[1]);
} catch (error) {
  fail(`API evidence JSON is not parseable: ${error instanceof Error ? error.message : error}`);
}

if (!api.analysisVersion) fail("analysisVersion is empty");
if (typeof api.confidence !== "number") fail("confidence must be numeric");
if (!api.events || typeof api.events.impactMs !== "number") fail("events.impactMs must be numeric");
if (!api.metrics || typeof api.metrics !== "object") fail("metrics object is missing");
if (!Array.isArray(api.coachFindings) || api.coachFindings.length === 0) {
  fail("coachFindings must be a non-empty object array");
}

const firstFinding = api.coachFindings[0];
for (const field of [
  "key",
  "priority",
  "confidence",
  "evidence",
  "action",
  "drill",
  "checkpoint",
  "caution",
  "theory",
]) {
  const value = firstFinding?.[field];
  if (value === null || value === undefined || value === "") {
    fail(`first coach finding field is empty: ${field}`);
  }
}

const primaryPatterns = api.coachFindings.filter(
  (finding) => finding?.priority === "1순위 패턴"
);
if (primaryPatterns.length > 1) {
  fail("coachFindings contains multiple primary patterns");
}

const stuckInsideFinding = api.coachFindings.find(
  (finding) => finding?.key === "pattern_stuck_inside_release"
);
if (stuckInsideFinding) {
  const action = String(stuckInsideFinding.action ?? "");
  if (!action.includes("오른쪽 허벅지") && !action.toLowerCase().includes("right thigh")) {
    fail("pattern_stuck_inside_release action must mention right-thigh space");
  }
}

const ball = api.metrics?.ball ?? api.ball ?? {};
const hasLaunchDirection =
  typeof ball.launchDirection === "string" &&
  ball.launchDirection.trim() !== "" &&
  ball.launchDirection !== "unknown";
const hasBallTracking =
  hasLaunchDirection ||
  Number(ball.confidence ?? 0) > 0 ||
  Number(api.metrics?.trackingQuality?.ballFrames ?? 0) > 0;
if (!hasBallTracking) {
  const coachText = JSON.stringify(api.coachFindings);
  for (const forbidden of [
    "슬라이스",
    "훅",
    "푸시",
    "풀",
    "slice",
    "hook",
    "push",
    "pull",
    "face angle",
    "face-angle",
    "페이스",
  ]) {
    if (coachText.toLowerCase().includes(forbidden.toLowerCase())) {
      fail(`coach finding makes ball-flight/face claim without launch evidence: ${forbidden}`);
    }
  }
}

for (const label of [
  "Primary coach card is compressed",
  "`참고용` badge appears when expected",
  "`판정 근거` expands and matches `theory`",
  "`드릴` expands and matches `drill`",
  "`체크 포인트` expands and matches `checkpoint`",
  "`바로 할 일` shows the first finding's correction, drill, and checkpoint when",
  "Detailed metrics remain available but not overwhelming",
  "Does the top finding match the visible swing pattern",
  "Does the impact time match the debug frame closely enough",
  "Is the drill actionable for the observed issue",
  "Is the caution appropriate for the tracking quality",
]) {
  if (!valueFor(label)) {
    fail(`review field is empty: ${label}`);
  }
}

const decision = valueFor("Accept / reject").toLowerCase();
if (decision !== "accept" && decision !== "reject") {
  fail("Accept / reject must be either Accept or Reject");
}

console.log("coach runtime verification check passed");
