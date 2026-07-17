import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workspace = resolve(root, "..");
const repos = [
  ["hailo-infer", resolve(workspace, "hailo-infer")],
  ["hailo-back", resolve(workspace, "hailo-back")],
  ["hailo-front", root],
];

function git(cwd, args) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(result.stderr || `git ${args.join(" ")} failed in ${cwd}`);
  }
  return result.stdout.trim();
}

function gitRaw(cwd, args) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(result.stderr || `git ${args.join(" ")} failed in ${cwd}`);
  }
  return result.stdout;
}

function parsePorcelainStatus(status) {
  const lines = status.split("\n").filter(Boolean);
  return {
    lines,
    staged: lines.filter((line) => line[0] !== " " && line[0] !== "?"),
    unstaged: lines.filter((line) => line[1] !== " " || line.startsWith("??")),
  };
}

console.log("Coach release summary\n");
console.log("Push order: hailo-infer -> hailo-back -> hailo-front\n");

const releaseWarnings = [];

for (const [name, cwd] of repos) {
  if (!existsSync(resolve(cwd, ".git"))) {
    console.log(`## ${name}`);
    console.log(`missing repo: ${cwd}\n`);
    continue;
  }

  const status = git(cwd, ["status", "--short", "--branch"]);
  const porcelain = parsePorcelainStatus(gitRaw(cwd, ["status", "--porcelain=v1"]));
  const commits = git(cwd, ["log", "--oneline", "origin/main..HEAD"]);
  console.log(`## ${name}`);
  console.log(status || "clean");
  console.log(commits || "no ahead commits");
  if (porcelain.lines.length > 0) {
    releaseWarnings.push(`${name}: has uncommitted changes; commit before push or the deployment will not include them.`);
  }
  if (porcelain.staged.length > 0 && porcelain.unstaged.length > 0) {
    releaseWarnings.push(`${name}: has both staged and unstaged changes; review staging before committing.`);
  }
  if (porcelain.lines.length > 0 && !commits) {
    releaseWarnings.push(`${name}: has local changes but no ahead commits yet.`);
  }
  console.log("");
}

if (releaseWarnings.length > 0) {
  console.log("Release blockers before push:\n");
  for (const warning of releaseWarnings) {
    console.log(`- ${warning}`);
  }
  console.log("");
}

console.log("Push commands after `npm run check:coach-release` passes:\n");
for (const [name, cwd] of repos) {
  console.log(`# ${name}`);
  console.log(`git -C ${cwd} push`);
}

console.log("\nPost-deploy runtime verification:\n");
console.log("# After all GitHub Actions complete and a deployed analysis job exists:");
console.log("npm run coach:new-runtime-verification -- --job-id <job-id> --shot-id <shot-id> --tester <name>");
console.log("# Then fill docs/runtime-verifications/<date>-<job-id>.md with API, UI, and impact-frame evidence.");
console.log("npm run coach:check-runtime-verification -- docs/runtime-verifications/<date>-<job-id>.md");
