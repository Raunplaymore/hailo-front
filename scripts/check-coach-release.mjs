import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workspace = resolve(root, "..");

const commands = [
  {
    name: "hailo-infer py_compile",
    cwd: resolve(workspace, "hailo-infer"),
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
    cwd: resolve(workspace, "hailo-infer"),
    command: "python3",
    args: ["scripts/check_coach_commentary.py"],
    env: { PYTHONDONTWRITEBYTECODE: "1" },
  },
  {
    name: "hailo-infer coach preview",
    cwd: resolve(workspace, "hailo-infer"),
    command: "python3",
    args: ["scripts/preview_coach_findings.py", "low_tracking_late_release", "--json"],
    env: { PYTHONDONTWRITEBYTECODE: "1" },
  },
  {
    name: "pi_service check",
    cwd: resolve(workspace, "pi_service"),
    command: "npm",
    args: ["run", "check"],
  },
  {
    name: "pi_web analysis normalization",
    cwd: root,
    command: "npm",
    args: ["run", "check:analysis"],
  },
  {
    name: "pi_web coach UI",
    cwd: root,
    command: "npm",
    args: ["run", "check:coach-ui"],
  },
  {
    name: "pi_web build",
    cwd: root,
    command: "npm",
    args: ["run", "build"],
  },
];

for (const step of commands) {
  console.log(`\n==> ${step.name}`);
  const result = spawnSync(step.command, step.args, {
    cwd: step.cwd,
    env: { ...process.env, ...(step.env ?? {}) },
    stdio: "inherit",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log("\ncoach release checks passed");
