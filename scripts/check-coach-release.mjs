import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workspace = resolve(root, "..");
const repos = {
  hailoInfer: resolve(workspace, "hailo-infer"),
  piService: resolve(workspace, "pi_service"),
  piWeb: root,
};

const requiredPaths = [
  resolve(repos.hailoInfer, "app/services/coach_commentary.py"),
  resolve(repos.hailoInfer, "scripts/check_coach_commentary.py"),
  resolve(repos.hailoInfer, "scripts/preview_coach_findings.py"),
  resolve(repos.piService, "server.js"),
  resolve(repos.piService, "scripts/check-coach-findings-passthrough.mjs"),
  resolve(repos.piWeb, "scripts/check-analysis-normalization.mjs"),
  resolve(repos.piWeb, "scripts/check-coach-summary-ui.mjs"),
];

for (const path of requiredPaths) {
  if (!existsSync(path)) {
    console.error(`Missing required coach release path: ${path}`);
    process.exit(1);
  }
}

const commands = [
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
    args: ["scripts/preview_coach_findings.py", "low_tracking_late_release", "--json"],
    env: { PYTHONDONTWRITEBYTECODE: "1" },
    validateJson: (payload) => {
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
    encoding: step.validateJson ? "utf8" : undefined,
    stdio: step.validateJson ? "pipe" : "inherit",
  });

  if (result.status !== 0) {
    if (step.validateJson && result.stderr) {
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
}

console.log("\ncoach release checks passed");
