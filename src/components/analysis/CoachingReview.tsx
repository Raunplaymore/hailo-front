import { useEffect, useState, type RefObject } from "react";
import { requestCoachingReview, type CoachingReview as Review, type CoachingEvidence } from "@/api/coachingReview";
import { CoachingLesson } from "./CoachingLesson";

const button = "min-h-12 rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40";
export type ContourStatus = "checking" | "playing" | "shown" | "other" | "unverified";
export function CoachingReview({ jobId, videoSha256, addressMs, selectedAddress = false, hasAddressCandidate = false, onChooseAddress, onResetAddress, addressSelectionError, canChooseAddress = false, impactMs, impactFrameIndex, candidatePending, analysisReady, analysisError, onRetryAnalysis, playable, contourStatus, canRetryContour, onResult, onEvidence, onSeek, onRetryContour, active = true, sourceVideoRef, onReferenceOpen }: {
  jobId: string; videoSha256?: string; addressMs?: number; impactMs?: number; candidatePending: boolean; analysisReady: boolean; playable: boolean;
  selectedAddress?: boolean; hasAddressCandidate?: boolean; onChooseAddress?: () => void; onResetAddress?: () => void;
  addressSelectionError?: string | null; canChooseAddress?: boolean;
  analysisError?: string | null;
  onRetryAnalysis?: () => void;
  impactFrameIndex?: number; contourStatus?: ContourStatus; canRetryContour?: boolean;
  active?: boolean; sourceVideoRef?: RefObject<HTMLVideoElement | null>; onReferenceOpen?: () => void;
  onResult: (value: Review | null) => void; onEvidence: (evidence: CoachingEvidence) => void; onSeek: (ms: number) => void;
  onRetryContour?: (ms: number) => void;
}) {
  const [result, setResult] = useState<Review | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setResult(null); onResult(null); setError(null); setLoading(true);
    if (!analysisReady || candidatePending) return;
    if (!videoSha256 || addressMs === undefined || impactMs === undefined) { setLoading(false); return; }
    requestCoachingReview(jobId, addressMs, impactMs, videoSha256, impactFrameIndex)
      .then(value => { if (!cancelled) { setResult(value); onResult(value); } })
      .catch(reason => { if (!cancelled) setError(reason instanceof Error ? reason.message : "근거 장면을 준비하지 못했습니다."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [jobId, videoSha256, addressMs, impactMs, impactFrameIndex, candidatePending, analysisReady, attempt, onResult]);

  return <section aria-label="스윙 코칭" className="space-y-3">
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs font-semibold text-primary">이번 스윙에서 살펴볼 것</p>
      <h3 className="mt-1 text-lg font-semibold">골반이 돌아갈 공간</h3>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">후방에서 촬영한 한 번의 스윙에서 {impactFrameIndex === undefined ? "임팩트 후보" : "직접 선택한 장면"} 전 엉덩이 뒤쪽을 봅니다. 영상이 잘리거나 반복되면 구간이 틀릴 수 있어요. 공은 직접 감지하지 않고 준비 자세로 방향을 추정합니다. 원본에서 공 위치와 타격 장면을 확인해 주세요.</p>
      <div className="mt-4 rounded-lg bg-muted/50 p-3 text-sm">
        <p className="font-medium">{addressMs === undefined ? "준비 자세 후보 없음" : `${selectedAddress ? "직접 선택한 준비 자세" : "준비 자세 후보"} · ${(addressMs / 1000).toFixed(2)}초`}</p>
        {addressMs !== undefined && <p className="mt-1 text-xs leading-5 text-muted-foreground">실제 준비 자세와 다르면 영상에서 바꿔 주세요.</p>}
        {addressMs !== undefined && <button type="button" className="min-h-11 font-semibold text-primary underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40" disabled={!playable} onClick={() => onSeek(addressMs)}>준비 자세 장면 보기</button>}
        <details open={addressMs === undefined || undefined}>
          <summary className="min-h-11 cursor-pointer py-3 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{addressMs === undefined ? "준비 자세 선택하기" : "준비 자세 바꾸기"}</summary>
          <p className="text-xs leading-5 text-muted-foreground">영상에서 스윙 전 준비 자세를 찾아 멈춘 뒤 선택하세요. 선택은 이 화면에서만 유지됩니다.</p>
          <button type="button" className={`${button} mt-2 w-full`} disabled={!canChooseAddress} onClick={onChooseAddress}>현재 장면을 준비 자세로 선택</button>
          {!canChooseAddress && <p className="mt-2 text-xs text-muted-foreground">영상과 프레임 시각이 준비되면 선택할 수 있어요.</p>}
          {selectedAddress && <button type="button" className={`${button} mt-2 w-full`} onClick={onResetAddress}>{hasAddressCandidate ? "준비 자세 후보로 되돌리기" : "준비 자세 선택 취소"}</button>}
          {addressSelectionError && <p role="alert" className="mt-2 text-xs text-destructive">{addressSelectionError}</p>}
        </details>
      </div>
      {!analysisReady ? analysisError ? <div role="status" className="mt-4 space-y-2 text-sm text-muted-foreground"><p>분석 결과를 불러오지 못해 골반 관찰을 준비하지 못했어요.</p>{onRetryAnalysis && <button type="button" className={button} onClick={onRetryAnalysis}>분석 결과 다시 불러오기</button>}</div>
        : <p role="status" className="mt-4 text-sm text-muted-foreground">분석 결과를 확인하면 골반 관찰을 준비합니다.</p>
        : addressMs === undefined ? <p role="status" className="mt-4 text-sm text-muted-foreground">준비 자세를 선택하면 골반 관찰을 시작합니다.</p>
        : loading ? <p role="status" className="mt-4 text-sm text-muted-foreground">{candidatePending ? "임팩트 구간을 찾고 있어요…" : "골반 윤곽과 근거 장면을 준비하고 있어요…"}</p>
        : error ? <div role="alert" className="mt-4 space-y-2"><p className="text-sm">{error}</p><button type="button" className={button} onClick={() => setAttempt(n => n + 1)}>근거 다시 불러오기</button></div>
        : <CoachingObservation result={result} playable={playable} onEvidence={onEvidence} onSeek={onSeek} selectedImpact={impactFrameIndex !== undefined} contourStatus={contourStatus} canRetryContour={canRetryContour} onRetryContour={onRetryContour} />}
    </div>
    <CoachingLesson topic="pelvis" referenceVideo active={active} sourceVideoRef={sourceVideoRef} onReferenceOpen={onReferenceOpen} />
  </section>;
}

export function CoachingObservation({ result, playable, onEvidence, onSeek, selectedImpact = false, contourStatus = "checking", canRetryContour = false, onRetryContour }: {
  result: Review | null; playable: boolean; onEvidence: (evidence: CoachingEvidence) => void; onSeek: (ms: number) => void;
  selectedImpact?: boolean; contourStatus?: ContourStatus; canRetryContour?: boolean; onRetryContour?: (ms: number) => void;
}) {
  const evidence = result?.evidence;
  const recovery = result?.reason === "CAMERA_BACKGROUND_AMBIGUOUS"
    ? "배경 보정에 따라 골반 위치가 달라져 관찰을 보류했어요. 원본 영상을 확인하고 카메라와 배경이 고정된 상태로 다시 촬영해 주세요."
    : result?.reason === "CAMERA_MOTION_OR_BACKGROUND_UNCLEAR"
    ? "안정적인 배경을 충분히 확인하지 못했습니다. 준비 자세 후보가 다르면 위에서 바꿔 보세요. 다음 촬영에서는 카메라와 배경을 고정해 주세요."
    : result?.reason === "VIDEO_TIMING_UNAVAILABLE"
      ? "영상과 분석 프레임의 시각을 확인하지 못했습니다. 영상을 다시 열어 확인해 주세요."
    : result?.reason === "BALL_DIRECTION_UNCLEAR"
      ? "준비 자세로 공 방향을 추정하기 어렵습니다. 후방에서 준비 자세와 손이 함께 보이도록 촬영해 주세요."
      : result?.reason === "PHASE_COVERAGE_INSUFFICIENT"
        ? "임팩트 전 확인 가능한 장면이 부족하거나 간격이 넓습니다. 임팩트 탭에서 타격 장면을 확인해 주세요."
        : result?.reason === "SILHOUETTE_UNRELIABLE"
          ? "골반 뒤쪽 윤곽을 구분하기 어렵습니다. 몸 전체와 엉덩이 뒤쪽이 가리지 않게 촬영해 주세요."
          : result?.reason === "ADDRESS_UNSTABLE"
            ? "준비 자세의 기준선을 안정적으로 잡지 못했습니다. 스윙 시작 전 잠시 준비 자세를 유지해 주세요."
            : result?.reason === "PELVIS_HEIGHT_UNCERTAIN"
              ? "준비 자세와 관찰 장면에서 윤곽을 잰 높이가 달라 비교를 보류했어요. 영상을 직접 확인해 주세요."
              : "아래 교습 예시에서 확인할 움직임을 볼 수 있습니다. 자동으로 확인하지 못한 영상은 정상 판정으로 표시하지 않습니다.";
  if (!result || result.status === "unavailable" || !evidence) {
    return <div className="mt-4 space-y-2" role="status">
      <p className="text-sm font-medium">{result?.summary || "임팩트 후보가 없어 골반 확인 구간을 준비하지 못했습니다."}</p>
      <p className="text-xs leading-5 text-muted-foreground">{recovery}</p>
    </div>;
  }
  return <div className="mt-4 space-y-3" aria-live="polite">
    <div className="rounded-lg bg-muted/50 p-3">
      <p className="text-xs font-semibold text-muted-foreground">영상에서 관찰한 움직임</p>
      <p className="mt-1 text-sm font-medium leading-6">{result.summary}</p>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">추정 공 방향: 화면 {evidence.ballDirection === "right" ? "오른쪽" : "왼쪽"}. 원본과 다르거나 공 위치를 확인할 수 없다면 이 관찰을 해석하지 마세요.</p>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">배경이 움직이면 기준선이 어긋날 수 있어요. 원본에서 배경도 확인해 주세요.</p>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">{evidence.observation === "toward_ball"
        ? "얼리 익스텐션을 살펴볼 때 확인하는 방향입니다. 영상에서도 이동이 보인다면 아래 교습 원리와 연습을 참고해 보세요. 화면상 윤곽만으로 얼리 익스텐션이나 교정 필요성을 확정하지 않습니다."
        : "이 구간의 관찰 결과이며, 스윙 전체가 좋다는 판정은 아닙니다."}</p>
    </div>
    <button type="button" className={`${button} w-full border-primary bg-primary text-primary-foreground hover:bg-primary/90`} disabled={!playable} onClick={() => onEvidence(evidence)}>근거 구간 천천히 보기</button>
    {!playable && <p className="text-xs text-muted-foreground">영상이 준비되면 근거 구간을 재생할 수 있습니다.</p>}
    <div className="grid grid-cols-2 gap-2">
      <button type="button" className={button} disabled={!playable} onClick={() => onSeek(evidence.addressMs)}>준비 자세</button>
      <button type="button" className={button} disabled={!playable} onClick={() => onSeek(evidence.focusMs)}>확인 장면 · {(evidence.focusMs / 1000).toFixed(2)}초</button>
    </div>
    <p className="text-xs leading-5 text-muted-foreground" role="status">{contourStatus === "unverified" ? `표시된 장면을 확인하지 못해 선을 보류했어요. ${canRetryContour ? "다시 확인하거나 " : ""}영상을 직접 살펴봐 주세요.` : contourStatus === "other" ? "이 장면은 윤곽을 측정하지 않았어요. ‘확인 장면’을 눌러 보세요." : contourStatus === "checking" ? "표시된 장면을 확인하고 있어요." : "노란 점선은 시작 기준, 초록 선은 추정 윤곽이에요. 영상이 멈춘 측정 장면에서만 표시됩니다."}</p>
    {contourStatus === "unverified" && canRetryContour && onRetryContour && <button type="button" className={`${button} w-full`} disabled={!playable} onClick={() => onRetryContour(evidence.focusMs)}>선 다시 확인</button>}
    <details className="text-xs text-muted-foreground">
      <summary className="min-h-12 cursor-pointer py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">관찰 범위와 근거</summary>
      <p className="leading-5">옷을 포함한 골반 뒤쪽 윤곽의 화면상 위치를 검사했습니다. 시작 기준선과 현재 윤곽선을 영상 위에 표시합니다. {selectedImpact ? "임팩트 기준은 직접 선택한 장면" : "임팩트는 모델의 후보"}이며 공 방향도 준비 자세에서 추정합니다. 윤곽 관찰을 골프 진단으로 사용하는 정확도는 아직 검증 중입니다.</p>
      <p className="mt-2 leading-5">{evidence.cameraMotion === "similarity_corrected" ? "배경을 기준으로 카메라의 작은 이동·회전·크기 변화를 보정하려고 했습니다." : evidence.cameraMotion === "translation_corrected" ? "배경을 기준으로 작은 카메라 이동을 보정하려고 했습니다." : "배경이 안정적인 구간을 검사했습니다."}</p>
      {!!result.excludedFrames?.length && <p className="mt-2 leading-5">불확실한 {result.excludedFrames.length}개 장면은 제외했습니다. 필요한 구간이 남아 있는 경우에만 관찰 결과를 표시합니다.</p>}
      <p className="mt-2 leading-5">검사 구간 {(evidence.startMs / 1000).toFixed(2)}–{(evidence.endMs / 1000).toFixed(2)}초 · 측정 변화 {evidence.shiftPx.toFixed(1)}px · 구분 한계 {evidence.noisePx.toFixed(1)}px ({evidence.width}×{evidence.height} 영상 기준)</p>
    </details>
  </div>;
}

export function PelvisContourOverlay({ evidence, timeMs }: { evidence: CoachingEvidence; timeMs: number }) {
  const point = evidence.points.reduce((best, p) => Math.abs(p.timeMs - timeMs) < Math.abs(best.timeMs - timeMs) ? p : best);
  // shortcut: 1.1ms covers source timestamp rounding; validate again if timestamp precision changes.
  const current = Math.abs(point.timeMs - timeMs) <= 1.1 ? point : null;
  return <svg viewBox="0 0 1 1" preserveAspectRatio="none" className="block h-full w-full" aria-label="골반 뒤쪽 윤곽과 준비 자세 기준선">
    {current && <>
      <line x1={current.referenceTop?.[0] ?? current.referenceX} x2={current.referenceBottom?.[0] ?? current.referenceX} y1={current.referenceTop?.[1] ?? Math.max(0, current.referenceY - .16)} y2={current.referenceBottom?.[1] ?? Math.min(1, current.referenceY + .16)} stroke="#fbbf24" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeDasharray="5 4" />
      <line x1={current.x} x2={current.x} y1={current.y - .035} y2={current.y + .035} stroke="#34d399" strokeWidth="3" vectorEffect="non-scaling-stroke" />
      <line x1={current.referenceX} x2={current.x} y1={current.y} y2={current.y} stroke="#34d399" strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </>}
  </svg>;
}
