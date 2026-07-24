import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile("src/components/debug/InferDebugPage.tsx", "utf8");

assert.match(source, /handedness: "right"/, "New tracking labels must default to a right-handed golfer.");
assert.match(
  source,
  /loadedAnnotation\.handedness === "unknown"/,
  "Legacy unknown-handed annotations must be promoted to the right-handed default."
);
assert.doesNotMatch(source, /<option value="unknown">미지정<\/option>[\s\S]{0,120}<option value="right">오른손<\/option>/, "Handedness must not open on an unknown option.");
assert.match(
  source,
  /lg:grid-cols-\[minmax\(0,1fr\)_19rem\]/,
  "Laptop layouts must use a canvas and tool rail instead of full-width stacked cards."
);
assert.match(
  source,
  /2xl:grid-cols-\[17rem_minmax\(0,1fr\)_20rem\]/,
  "Wide layouts must use the full three-column lab workspace."
);
assert.match(source, /order-1 min-w-0/, "The frame canvas must appear first on narrow screens.");
assert.match(source, /lg:sticky lg:top-4/, "The tool rail must remain visible on laptop layouts.");
assert.match(source, /sm:grid-cols-2 lg:col-span-2/, "Dataset and event cards must share the second row on medium layouts.");
assert.doesNotMatch(source, /\["erase"/, "Clear must not appear as a third labeling tool.");
assert.match(
  source,
  /사람 머리가 아니라 실제 골프채 헤드의 중앙/,
  "The club-head target must be unambiguous to Korean labelers."
);
assert.match(source, /그립 부분의 중앙/, "The handle target must be described as the grip center.");
assert.match(source, /setPointVisibility/, "Occluded and out-of-frame targets must be labelable.");
assert.match(source, /현재 프레임 라벨 삭제/, "Deleting labels must be an explicit frame action.");

console.log("tracking lab responsive UI check passed");
