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
assert.match(source, /Boolean\(caution\)/, "Reference badge must be shown when a finding has caution text.");
assert.match(source, /confidence\s*!==\s*null\s*&&\s*confidence\s*<\s*0\.35/, "Reference badge must be shown for low-confidence findings.");
assert.match(source, />\s*참고용\s*</, "CoachSummary must render the visible reference badge label.");
assert.match(source, /referenceSignal\s*\?/, "CoachSummary must conditionally render the reference badge.");
assert.match(source, /function PrimaryPracticePlan\(/, "CoachSummary must render a compact practice plan for the primary finding.");
assert.match(source, /바로 할 일/, "CoachSummary must label the primary actionable practice plan.");
assert.match(source, /function PrimaryEvidenceDetails\(/, "CoachSummary must collapse primary evidence separately from the action plan.");
assert.match(source, /판정 근거 보기/, "CoachSummary must hide detailed evidence behind a compact disclosure.");
assert.match(source, /finding\.action/, "Structured coach finding action must be preserved separately from evidence text.");
assert.match(source, /수정 방향/, "CoachSummary must show the correction direction separately in expanded details.");
assert.match(source, /summary\?: string \| null/, "CoachSummary must accept the analysis summary to avoid a duplicate summary card.");
assert.match(source, /코치 액션/, "CoachSummary should focus the compact panel on actionable coaching.");

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
assert.match(appSource, /compact\s*\n\s*\/>/, "Analysis progress should use compact mode on the analysis screen.");
assert.doesNotMatch(appSource, /<CardTitle className="text-lg">코칭 요약<\/CardTitle>/, "Analysis summary must not render as a separate duplicate card.");
assert.match(appSource, /xl:sticky xl:top-4/, "Analysis video should remain sticky on wide screens to reduce scrolling.");
assert.match(appSource, /order-first/, "Analysis video should appear before long details on mobile layouts.");
assert.match(appSource, /xl:order-none/, "Analysis video should return to its desktop order on wide screens.");
assert.match(videoPlayerSource, /max-h-\[46vh\]/, "Analysis video must remain useful on a narrow portrait screen.");
assert.match(videoPlayerSource, /md:max-h-\[50vh\]/, "Analysis video height must stay viewport-limited on medium layouts.");
assert.match(videoPlayerSource, /xl:max-h-\[52vh\]/, "Analysis video height must stay viewport-limited on wide layouts.");
assert.match(playerSource, /video\.videoWidth \/ video\.videoHeight/, "Overlay bounds must use the source video's intrinsic aspect ratio.");
assert.match(playerSource, /new ResizeObserver\(syncOverlayBounds\)/, "Overlay bounds must update when the player size changes.");
assert.match(playerSource, /style=\{overlayBounds\}/, "Overlay must render only inside the object-contain video area.");
assert.match(playerSource, /HAND_TRAIL_DURATION_MS = 800/, "Hand overlay must keep the trail focused on recent movement.");
assert.match(playerSource, /HAND_TRAIL_MAX_GAP_MS = 120/, "Hand overlay must avoid drawing through tracking gaps.");
assert.match(playerSource, /strokeLinecap="round"/, "Hand trail segments must render as a smooth fading line.");
assert.match(playerSource, /CLUB_TRAIL_MAX_GAP_MS = 120/, "Club trajectory must not bridge long detection gaps.");
assert.match(playerSource, /function smoothClubTrailPaths\(/, "Club trajectory must use a dedicated smoothing path builder.");
assert.match(playerSource, /smoothClubTrailPaths\(clubFrames, "head"\)/, "Club-head trajectory must render as a smooth path.");
assert.match(playerSource, /strokeLinejoin="round"/, "Club trajectory curve must have rounded joins.");
assert.match(playerSource, /grid min-w-0 grid-cols-2 gap-2/, "Analysis timeline must fit a narrow viewport without horizontal scrolling.");
assert.match(playerSource, /<AnalysisVideoPlayer/, "Analysis view must use the dedicated video player.");
assert.doesNotMatch(videoPlayerSource, /\scontrols(?:\s|=|>)/, "Native video controls must not cover the analysis frame.");
assert.match(videoPlayerSource, /aria-label=\{isPlaying \? "분석 영상 일시정지" : "분석 영상 재생"\}/, "Video surface must expose keyboard playback state.");
assert.match(videoPlayerSource, /aria-label="영상 재생 위치"/, "Custom player must expose an accessible seek control.");
assert.match(videoPlayerSource, /border-t border-white\/10 px-3 pb-2 pt-1/, "Seek control must occupy its own full-width row on mobile.");
assert.match(videoPlayerSource, /className="h-11 w-full cursor-pointer/, "Seek control must use the complete available width.");
assert.match(videoPlayerSource, /webkitEnterFullscreen/, "Custom player must retain an iOS fullscreen fallback.");
assert.match(playerSource, /isReference \? " · 참고"/, "Reference-only events must be visibly labeled in the timeline.");
assert.match(keyMetricsSource, /validationStatus !== "usable"/, "Partial validation must keep event-dependent key metrics hidden.");
assert.match(metricsTableSource, /analysis\.eventValidation\.status !== "usable"/, "Partial validation must keep event-dependent detail metrics hidden.");
assert.doesNotMatch(sessionSource, /overflow-x-auto pb-1 whitespace-nowrap/, "Session progress must wrap instead of overflowing on mobile.");
assert.match(sessionSource, /grid grid-cols-2 gap-2 sm:flex sm:flex-wrap/, "Session progress must use a two-column mobile layout.");
assert.match(connectionSource, /flex flex-wrap items-start justify-between gap-3/, "Connection header must wrap its status badge on narrow screens.");
assert.match(connectionSource, /min-w-0 overflow-hidden rounded-xl border p-3/, "Connection tiles must constrain long status text.");
assert.match(shotListSource, /block break-all text-xs text-muted-foreground/, "Upload Job IDs must wrap inside a narrow lookup card.");
assert.match(shotListSource, /\[overflow-wrap:anywhere\]/, "Upload filenames must wrap before expanding the lookup dialog.");
assert.match(sessionListSource, /block break-all text-xs text-muted-foreground/, "Session Job IDs must wrap inside a narrow lookup card.");

console.log("coach summary UI check passed");
