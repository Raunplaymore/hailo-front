import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile("src/components/analysis/CoachSummary.tsx", "utf8");
const appSource = await readFile("src/App.tsx", "utf8");
const playerSource = await readFile("src/components/analysis/AnalysisPlayer.tsx", "utf8");
const videoPlayerSource = await readFile("src/components/analysis/AnalysisVideoPlayer.tsx", "utf8");
const keyMetricsSource = await readFile("src/components/analysis/KeyMetrics.tsx", "utf8");
const metricsTableSource = await readFile("src/components/analysis/MetricsTable.tsx", "utf8");
const sessionSource = await readFile("src/components/camera/SessionControls.tsx", "utf8");
const connectionSource = await readFile("src/components/camera/FieldConnectionPanel.tsx", "utf8");
const shotListSource = await readFile("src/components/shots/ShotList.tsx", "utf8");
const sessionListSource = await readFile("src/components/sessions/SessionList.tsx", "utf8");

assert.match(source, /function isReferenceSignal\(/, "CoachSummary must centralize reference-signal logic.");
assert.match(source, /Boolean\(caution\)/, "Reference guidance must account for finding caution text.");
assert.match(source, /confidence\s*!==\s*null\s*&&\s*confidence\s*<\s*0\.35/, "Reference guidance must account for low-confidence findings.");
assert.match(source, /function PrimaryPracticePlan\(/, "CoachSummary must render a focused primary practice plan.");
assert.match(source, /function areInstructionsRedundant\(/, "CoachSummary must detect semantically repeated action and checkpoint text.");
assert.match(source, /jaccard >= 0\.7/, "Repeated coaching steps must use a conservative token-similarity threshold.");
assert.match(source, /slice\(0, index\)/, "Practice steps must remove later instructions that repeat an earlier step.");
assert.match(source, /이전 시스템의 제안/, "Historical suggestions must be identified as past output.");
assert.match(source, /이전 동작 제안/, "Historical swing cues must be identified as past output.");
assert.match(source, /이전 연습 제안/, "Historical drills must be identified as past output.");
assert.match(source, /이전 확인 제안/, "Historical checkpoints must be identified as past output.");
assert.match(source, /function EvidenceDetails\(/, "CoachSummary must collapse evidence separately from practice steps.");
assert.match(source, /이전 기록의 근거 보기/, "Historical evidence must be identified as past output.");
assert.match(source, /이전 후보 시점 보기/, "Historical evidence jumps must identify the timing as a candidate.");
assert.match(source, /item\.category === "backswing"/, "Backswing advice must map only to the measured top event.");
assert.match(source, /item\.category === "shaft_plane"/, "Shaft-plane advice must map only to the measured impact event.");
assert.match(playerSource, /evidenceFocus\.event/, "AnalysisPlayer must seek to a requested coaching evidence event.");
assert.match(source, /finding\.action/, "Structured coach finding action must be preserved separately from evidence text.");
assert.match(source, /finding\.evidence/, "Structured evidence must remain available in the collapsed disclosure.");
assert.match(source, /finding\.interpretation/, "Structured interpretation must remain available in the collapsed disclosure.");
assert.match(source, /function AdditionalFindings\(/, "Secondary coaching must be grouped behind a compact disclosure.");
assert.match(source, /function MaintainPoints\(/, "Positive maintenance points must be separated from corrective coaching.");
assert.match(source, /function QualityNotices\(/, "Capture and analysis quality notices must render outside corrective coaching.");
assert.match(source, /item\.category === "quality"/, "Quality findings must be partitioned before selecting the primary coach action.");
assert.match(source, /item\.category !== "quality"/, "Primary coaching must exclude capture and analysis quality findings.");
assert.match(source, /촬영 안내를 코칭으로 대신하지 않습니다/, "The empty state must explain why no corrective action is shown.");
assert.match(source, /sequence_rushed_proxy/, "Duplicate transition proxy findings must be recognized for concise coaching.");
assert.doesNotMatch(source, /<div className="border-t px-3 pb-3 pt-2">\s*<p[^>]*>\{parsed\.main\}<\/p>/, "Expanded findings must not repeat the summary sentence before their details.");
assert.match(source, /summary\?: string \| null/, "CoachSummary must accept the analysis summary to avoid a duplicate summary card.");
assert.match(source, /과거 코칭 기록/, "Historical coaching must be identified as an unvalidated record.");

assert.match(appSource, /상세 지표 \/ 디버그/, "Analysis screen must group detailed metrics under a compact disclosure.");
const detailedMetricsDisclosure = appSource.match(
  /<details className="([^"]+)">[\s\S]{0,600}?상세 지표 \/ 디버그/
);
assert.ok(detailedMetricsDisclosure, "Detailed metrics must be collapsed by default.");
for (const className of ["group", "rounded-2xl", "border", "border-border", "bg-card", "shadow-sm"]) {
  assert.ok(
    detailedMetricsDisclosure[1].split(/\s+/).includes(className),
    `Detailed metrics disclosure must retain the ${className} class.`
  );
}
assert.match(appSource, /compact\s*\/>/, "Analysis progress should use compact mode on the analysis screen.");
assert.doesNotMatch(appSource, /<CardTitle className="text-lg">코칭 요약<\/CardTitle>/, "Analysis summary must not render as a separate duplicate card.");
assert.ok(appSource.indexOf("<AnalysisPlayer") < appSource.indexOf("연구 기록 및 상세 수치"), "The video must precede research details in DOM order.");
assert.match(appSource, /연구 기록 및 상세 수치<\/summary>/, "Research details stay collapsed by default.");
assert.match(appSource, /max-w-5xl/, "Allow room for the video and analysis columns on wide screens.");
assert.match(playerSource, /analysis-workspace/, "Analysis must use the bounded video and tools workspace.");
assert.match(playerSource, /analysis-scroll/, "Analysis content must scroll separately from the video.");
assert.match(videoPlayerSource, /max-h-\[32vh\]/, "Analysis video must remain useful on a narrow portrait screen.");
assert.match(videoPlayerSource, /md:max-h-\[50vh\]/, "Analysis video height must stay viewport-limited on medium layouts.");
assert.match(videoPlayerSource, /xl:max-h-\[52vh\]/, "Analysis video height must stay viewport-limited on wide layouts.");
assert.match(playerSource, /video\.videoWidth \/ video\.videoHeight/, "Overlay bounds must use the source video's intrinsic aspect ratio.");
assert.match(playerSource, /new ResizeObserver\(syncOverlayBounds\)/, "Overlay bounds must update when the player size changes.");
assert.match(playerSource, /style=\{overlayBounds\}/, "Overlay must render only inside the object-contain video area.");
assert.match(playerSource, /HAND_TRAIL_DURATION_MS = 800/, "Hand overlay must keep the trail focused on recent movement.");
assert.match(playerSource, /HAND_TRAIL_MAX_GAP_MS = 120/, "Hand overlay must avoid drawing through tracking gaps.");
assert.match(playerSource, /strokeLinecap="round"/, "Hand trail segments must render as a smooth fading line.");
assert.match(playerSource, /CLUB_TRAIL_MAX_GAP_MS = 120/, "Club trajectory must not bridge long detection gaps.");
assert.match(playerSource, /CLUB_TRAIL_DURATION_MS = 550/, "Club trajectory must remain a short live trail instead of a full-video scribble.");
assert.match(playerSource, /CLUB_TRAIL_MIN_CONFIDENCE = 0\.3/, "Club trajectory must hide low-confidence detections.");
assert.match(playerSource, /function smoothPathFromPoints\(/, "Club trajectory must use a dedicated smoothing path builder.");
assert.match(playerSource, /clubTrailSegments\(clubFrames, "head"\)/, "Club-head observations must be segmented before drawing.");
assert.match(playerSource, /strokeLinejoin="round"/, "Club trajectory curve must have rounded joins.");
assert.match(playerSource, /grid min-w-0 grid-cols-5 gap-1/, "Analysis timeline must fit a narrow viewport without horizontal scrolling.");
assert.match(playerSource, /<AnalysisVideoPlayer/, "Analysis view must use the dedicated video player.");
assert.doesNotMatch(videoPlayerSource, /\scontrols(?:\s|=|>)/, "Native video controls must not cover the analysis frame.");
assert.match(videoPlayerSource, /aria-label=\{isPlaying \? "분석 영상 일시정지" : "분석 영상 재생"\}/, "Video surface must expose keyboard playback state.");
assert.match(videoPlayerSource, /aria-label="영상 재생 위치"/, "Custom player must expose an accessible seek control.");
assert.match(videoPlayerSource, /flex h-14 items-center gap-1 px-1/, "Playback, seek and frame controls must share one compact row.");
assert.match(videoPlayerSource, /className="block h-11 w-full min-w-0 cursor-pointer/, "Seek control must fill the space between frame buttons without overflowing.");
assert.match(videoPlayerSource, /webkitEnterFullscreen/, "Custom player must retain an iOS fullscreen fallback.");
assert.match(playerSource, /임팩트는 추정 후보, 나머지는 연구 참고/, "Timeline must distinguish the candidate from research reference events.");
assert.match(keyMetricsSource, /validationStatus !== "usable"/, "Partial validation must keep event-dependent key metrics hidden.");
assert.match(metricsTableSource, /analysis\.eventValidation\.status !== "usable"/, "Partial validation must keep event-dependent detail metrics hidden.");
assert.doesNotMatch(sessionSource, /overflow-x-auto pb-1 whitespace-nowrap/, "Session progress must wrap instead of overflowing on mobile.");
assert.match(sessionSource, /grid grid-cols-6 gap-1/, "Session progress must keep its six stages in a compact row.");
assert.match(connectionSource, /flex flex-wrap items-start justify-between gap-3/, "Connection header must wrap its status badge on narrow screens.");
assert.match(connectionSource, /min-w-0 overflow-hidden rounded-xl border p-3/, "Connection tiles must constrain long status text.");
assert.match(shotListSource, /break-all text-xs text-muted-foreground/, "Upload Job IDs must wrap inside a narrow lookup card.");
assert.match(shotListSource, /\[overflow-wrap:anywhere\]/, "Upload filenames must wrap before expanding the lookup dialog.");
assert.match(sessionListSource, /break-all text-xs text-muted-foreground/, "Session Job IDs must wrap inside a narrow lookup card.");

console.log("coach summary UI check passed");
