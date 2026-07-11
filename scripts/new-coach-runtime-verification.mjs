import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);

function valueFor(flag) {
  const index = args.indexOf(flag);
  if (index < 0) return null;
  return args[index + 1] ?? null;
}

const jobId = valueFor("--job-id");
const shotId = valueFor("--shot-id");
const tester = valueFor("--tester") ?? "";
const force = args.includes("--force");

if (!jobId) {
  console.error("Usage: npm run coach:new-runtime-verification -- --job-id <job-id> [--shot-id <shot-id>] [--tester <name>] [--force]");
  process.exit(1);
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const templatePath = join(root, "docs", "coach-runtime-verification-template.md");
const outputDir = process.env.COACH_RUNTIME_VERIFICATION_DIR
  ? resolve(process.env.COACH_RUNTIME_VERIFICATION_DIR)
  : join(root, "docs", "runtime-verifications");
const date = new Date().toISOString().slice(0, 10);
const safeJobId = jobId.replace(/[^a-zA-Z0-9._-]/g, "-");
const outputPath = join(outputDir, `${date}-${safeJobId}.md`);

if (existsSync(outputPath) && !force) {
  console.error(`Runtime verification already exists: ${outputPath}`);
  console.error("Pass --force only if you intentionally want to replace it.");
  process.exit(1);
}

let content = await readFile(templatePath, "utf8");
content = content
  .replace("- Date:", `- Date: ${date}`)
  .replace("- Tester:", `- Tester: ${tester}`)
  .replace("- Source video / shot id:", `- Source video / shot id: ${shotId ?? ""}`)
  .replace("- Job id:", `- Job id: ${jobId}`);

await mkdir(outputDir, { recursive: true });
await writeFile(outputPath, content, "utf8");

console.log(outputPath);
