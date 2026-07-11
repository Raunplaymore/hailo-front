import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workspace = resolve(root, "..");
const repos = [
  ["hailo-infer", resolve(workspace, "hailo-infer")],
  ["pi_service", resolve(workspace, "pi_service")],
  ["pi_web", root],
];

function git(cwd, args) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(result.stderr || `git ${args.join(" ")} failed in ${cwd}`);
  }
  return result.stdout.trim();
}

console.log("Coach release summary\n");
console.log("Push order: hailo-infer -> pi_service -> pi_web\n");

for (const [name, cwd] of repos) {
  if (!existsSync(resolve(cwd, ".git"))) {
    console.log(`## ${name}`);
    console.log(`missing repo: ${cwd}\n`);
    continue;
  }

  const status = git(cwd, ["status", "--short", "--branch"]);
  const commits = git(cwd, ["log", "--oneline", "origin/main..HEAD"]);
  console.log(`## ${name}`);
  console.log(status || "clean");
  console.log(commits || "no ahead commits");
  console.log("");
}
