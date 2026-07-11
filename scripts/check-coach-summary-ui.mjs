import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile("src/components/analysis/CoachSummary.tsx", "utf8");

assert.match(source, /function isReferenceSignal\(/, "CoachSummary must centralize reference-signal logic.");
assert.match(source, /Boolean\(caution\)/, "Reference badge must be shown when a finding has caution text.");
assert.match(source, /confidence\s*!==\s*null\s*&&\s*confidence\s*<\s*0\.35/, "Reference badge must be shown for low-confidence findings.");
assert.match(source, />\s*참고용\s*</, "CoachSummary must render the visible reference badge label.");
assert.match(source, /referenceSignal\s*\?/, "CoachSummary must conditionally render the reference badge.");

console.log("coach summary UI check passed");
