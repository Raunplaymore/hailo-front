import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { transform } from "esbuild";

const source = await readFile("src/components/debug/InferDebugPage.tsx", "utf8");

assert.match(source, /viewpoint: "unknown",\s*handedness: "unknown"/, "New labels must not invent camera view or handedness.");
assert.doesNotMatch(source, /loadedAnnotation\.handedness === "unknown"/, "Existing unknown handedness must not be rewritten.");
assert.match(source, /<option value="unknown">미지정<\/option>[\s\S]{0,120}<option value="right">오른손<\/option>/, "Handedness must offer an unknown option.");
assert.match(source, /data\.meta\.timeBasis !== "source_pts"/, "Estimated frame clocks must be visible to reviewers.");
assert.match(source, /data\.meta\.legacyFrameNumbersChanged/, "Remapped old frame labels must be flagged for review.");
assert.match(source, /event\?\.source === "manual" && analysisEvents\[key\]/, "Analysis-generated event labels must not compare against themselves.");
assert.match(source, /분석 초안/, "Analysis-generated events must be labeled as drafts.");
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
assert.match(source, /저장 \{annotationCatalog\?\.count/, "The saved swing count must be visible.");
assert.match(source, /Dataset progress/, "The 30-swing dataset target must be shown.");
assert.match(source, /저장된 스윙/, "Saved swings must be available as a reopenable list.");
assert.match(source, /const \[annotationSearch, setAnnotationSearch\] = useState\(""\)/, "Saved swings must have local search state.");
assert.match(source, /item\.jobId\.toLowerCase\(\)\.includes\(query\)/, "Saved swing search must match partial Job IDs case-insensitively.");
assert.match(source, /aria-label="저장된 스윙 Job ID 검색"/, "Saved swing search must have an accessible label.");
assert.match(source, /일치하는 Job이 없습니다/, "Saved swing search must explain an empty result.");
assert.match(source, /const \[focusMode, setFocusMode\] = useState\(true\)/, "Labeling focus must default on.");
assert.match(source, /!focusMode && overlayOptions\.modelHeadPath/, "Focus mode must hide model paths.");
assert.match(source, /!focusMode && overlayOptions\.labels && labeledHeadTrack/, "Focus mode must hide the ground-truth path.");
assert.match(source, /포커스 ON에서는 선·박스·스켈레톤을 숨기고/, "The focus behavior must be explained.");
assert.match(source, /const loadRequestRef = useRef\(0\)/, "Overlapping job loads must be ordered.");
assert.match(source, /requestId !== loadRequestRef\.current/, "Stale job responses must be ignored.");
assert.match(source, /saveSwingTrackingAnnotation\(annotation\.jobId, annotation\)/, "Saves must use the loaded annotation jobId.");
assert.match(source, /Job 불일치/, "A visible job mismatch guard must block saving.");

const helpers = source.slice(source.indexOf("function frameLabelMap("), source.indexOf("function formatMs("));
const handlers = source.slice(source.indexOf("  const prefillCurrent ="), source.indexOf("  const markEvent ="));
assert.ok(helpers.includes("function fillMissingModelPoints") && handlers.includes("const prefillAll"));
const { code } = await transform(`${helpers}\n${handlers}\nglobalThis.handlers = { prefillCurrent, prefillAll };`, { loader: "ts" });

function prefill(action, frames, labels, selectedFrame = frames[0]) {
  const context = {
    selectedFrame,
    data: { frames, meta: {} },
    threshold: 0.2,
    annotation: { frames: structuredClone(labels) },
    strongestDetection: (frame, key) => frame.noDetection ? null : { key },
    boxCenter: (detection) => detection.key === "club_head" ? { x: 0.7, y: 0.8 } : { x: 0.4, y: 0.5 },
    setNotice: () => {},
  };
  context.mutateAnnotation = (update) => { context.annotation = update(context.annotation); };
  vm.runInNewContext(code, context);
  context.handlers[action]();
  return context.annotation.frames;
}

const manual = { x: 0, y: 0.3, source: "manual" };
const model = { x: 0.1, y: 0.2, source: "model" };
const frames = Array.from({ length: 7 }, (_, frame) => ({ frame, timeMs: frame * 33 }));
const labels = [
  { ...frames[0], clubHeadVisibility: "occluded", clubHandle: manual, clubHandleVisibility: "visible" },
  { ...frames[1], clubHandleVisibility: "out_of_frame" },
  { ...frames[2], clubHead: manual, clubHeadVisibility: "visible", clubHandle: manual, clubHandleVisibility: "visible" },
  { ...frames[3], clubHeadVisibility: "out_of_frame", clubHandleVisibility: "occluded" },
  { ...frames[4], clubHead: model, clubHeadVisibility: "visible", clubHandleVisibility: "unknown" },
  { ...frames[5], clubHeadVisibility: "unknown" },
];
for (const action of ["prefillCurrent", "prefillAll"]) {
  const result = prefill(action, frames, labels);
  assert.equal(result[0].clubHeadVisibility, "occluded", `${action} must retain hidden head`);
  assert.equal(result[0].clubHead, undefined, `${action} must not add a head behind a hidden label`);
  assert.equal(result[0].clubHandle.source, "manual", `${action} must retain a manual handle`);
  assert.equal(result[0].clubHandle.x, 0, `${action} must retain a zero coordinate`);
}
const currentPartial = prefill("prefillCurrent", frames, labels, frames[1]);
assert.equal(currentPartial[1].clubHead.source, "model", "Current-frame prefill must fill an empty head");
assert.equal(currentPartial[1].clubHandleVisibility, "out_of_frame", "Current-frame prefill must retain a hidden handle");
const all = prefill("prefillAll", frames, labels);
assert.equal(all[1].clubHead.source, "model", "An empty head can receive a model draft");
assert.equal(all[1].clubHandleVisibility, "out_of_frame", "An out-of-frame handle must remain hidden");
assert.equal(all[1].clubHandle, undefined);
assert.equal(all[2].clubHead.source, "manual");
assert.equal(all[2].clubHandle.source, "manual");
assert.equal(all[3].clubHeadVisibility, "out_of_frame");
assert.equal(all[3].clubHandleVisibility, "occluded");
assert.equal(all[4].clubHead.x, model.x, "Existing model drafts must not be silently replaced");
assert.equal(all[4].clubHandle.source, "model", "Unknown empty points can receive a model draft");
assert.equal(all[5].clubHead.source, "model");
assert.equal(all[6].clubHead.source, "model", "A new frame can receive both drafts");
assert.equal(all[6].clubHandle.source, "model");
const none = prefill("prefillAll", [{ ...frames[0], noDetection: true }], [labels[0]]);
assert.equal(none[0].clubHeadVisibility, "occluded", "No detections must leave labels unchanged");

console.log("tracking lab responsive UI check passed");
