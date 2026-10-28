import { useEffect, useState } from "react";
import { requestCoachingReview, type CoachingReview as Review, type CoachingEvidence } from "@/api/coachingReview";
import { CoachingLesson } from "./CoachingLesson";

const button = "min-h-12 rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40";
export function CoachingReview({ jobId, videoSha256, addressMs, impactMs, candidatePending, playable, onResult, onEvidence, onSeek }: {
  jobId: string; videoSha256?: string; addressMs: number; impactMs?: number; candidatePending: boolean; playable: boolean;
  onResult: (value: Review | null) => void; onEvidence: (evidence: CoachingEvidence) => void; onSeek: (ms: number) => void;
}) {
  const [result, setResult] = useState<Review | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setResult(null); onResult(null); setError(null); setLoading(true);
    if (candidatePending) return;
    if (!videoSha256 || impactMs === undefined) { setLoading(false); return; }
    requestCoachingReview(jobId, addressMs, impactMs, videoSha256)
      .then(value => { if (!cancelled) { setResult(value); onResult(value); } })
      .catch(reason => { if (!cancelled) setError(reason instanceof Error ? reason.message : "근거 장면을 준비하지 못했습니다."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [jobId, videoSha256, addressMs, impactMs, candidatePending, attempt, onResult]);

  return <section aria-label="스윙 코칭" className="space-y-3">
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs font-semibold text-primary">이번 스윙에서 살펴볼 것</p>
      <h3 className="mt-1 text-lg font-semibold">골반이 돌아갈 공간</h3>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">후방에서 촬영한 완전한 스윙 한 번을 기준으로, 임팩트 후보 전 엉덩이 뒤쪽의 움직임을 봅니다. 영상이 잘리거나 스윙이 반복되면 구간이 틀릴 수 있어요. 임팩트 후보와 추정 공 방향은 원본에서 확인해 주세요.</p>
      {loading ? <p role="status" className="mt-4 text-sm text-muted-foreground">{candidatePending ? "임팩트 구간을 찾고 있어요…" : "골반 윤곽과 근거 장면을 준비하고 있어요…"}</p>
        : error ? <div role="alert" className="mt-4 space-y-2"><p className="text-sm">{error}</p><button type="button" className={button} onClick={() => setAttempt(n => n + 1)}>근거 다시 불러오기</button></div>
        : <CoachingObservation result={result} playable={playable} onEvidence={onEvidence} onSeek={onSeek} />}
    </div>
    <CoachingLesson topic="pelvis" />
  </section>;
}

export function CoachingObservation({ result, playable, onEvidence, onSeek }: {
  result: Review | null; playable: boolean; onEvidence: (evidence: CoachingEvidence) => void; onSeek: (ms: number) => void;
}) {
  const evidence = result?.evidence;
  const recovery = result?.reason === "CAMERA_MOTION_OR_BACKGROUND_UNCLEAR"
    ? "카메라 움직임을 보정할 만큼 안정적인 배경을 확보하지 못했습니다. 다음 촬영에서는 카메라를 고정하고 배경이 보이도록 잡아 주세요."
    : result?.reason === "BALL_DIRECTION_UNCLEAR"
      ? "몸과 공의 방향을 확인하기 어렵습니다. 후방에서 준비 자세와 손이 함께 보이도록 촬영해 주세요."
      : result?.reason === "PHASE_COVERAGE_INSUFFICIENT"
        ? "임팩트 전 확인 가능한 장면이 부족하거나 사이가 너무 멉니다. 준비 자세부터 임팩트까지 끊김 없이 촬영해 주세요."
        : result?.reason === "SILHOUETTE_UNRELIABLE"
          ? "골반 뒤쪽 윤곽을 구분하기 어렵습니다. 몸 전체와 엉덩이 뒤쪽이 가리지 않게 촬영해 주세요."
          : result?.reason === "ADDRESS_UNSTABLE"
            ? "준비 자세의 기준선을 안정적으로 잡지 못했습니다. 스윙 시작 전 잠시 준비 자세를 유지해 주세요."
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
      <p className="mt-2 text-xs leading-5 text-muted-foreground">{evidence.observation === "toward_ball"
        ? "얼리 익스텐션을 살펴볼 때 확인하는 방향입니다. 영상에서도 이동이 보인다면 아래 교습 원리와 연습을 참고해 보세요. 이 관찰만으로 원인이나 교정 필요성을 확정하지 않습니다."
        : "이 구간의 관찰 결과이며, 스윙 전체가 좋다는 판정은 아닙니다."}</p>
    </div>
    <button type="button" className={`${button} w-full border-primary bg-primary text-primary-foreground hover:bg-primary/90`} disabled={!playable} onClick={() => onEvidence(evidence)}>근거 구간 천천히 보기</button>
    {!playable && <p className="text-xs text-muted-foreground">영상이 준비되면 근거 구간을 재생할 수 있습니다.</p>}
    <div className="grid grid-cols-2 gap-2">
      <button type="button" className={button} disabled={!playable} onClick={() => onSeek(evidence.addressMs)}>준비 자세</button>
      <button type="button" className={button} disabled={!playable} onClick={() => onSeek(evidence.focusMs)}>확인 장면 · {(evidence.focusMs / 1000).toFixed(2)}초</button>
    </div>
    <details className="text-xs text-muted-foreground">
      <summary className="min-h-12 cursor-pointer py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">관찰 범위와 근거</summary>
      <p className="leading-5">옷을 포함한 골반 뒤쪽 윤곽의 화면상 위치를 검사했습니다. 시작 기준선과 현재 윤곽선을 영상 위에 표시합니다. 임팩트는 모델의 후보이며 공 방향도 준비 자세에서 추정합니다. 윤곽 관찰을 골프 진단으로 사용하는 정확도는 아직 검증 중입니다.</p>
      <p className="mt-2 leading-5">{evidence.cameraMotion === "similarity_corrected" ? "배경을 기준으로 카메라의 작은 이동·회전·크기 변화를 보정했습니다." : evidence.cameraMotion === "translation_corrected" ? "배경을 기준으로 작은 카메라 이동을 보정했습니다." : "배경이 안정적인 구간을 검사했습니다."}</p>
      {!!result.excludedFrames?.length && <p className="mt-2 leading-5">불확실한 {result.excludedFrames.length}개 장면은 제외했습니다. 필요한 구간이 남아 있는 경우에만 관찰 결과를 표시합니다.</p>}
      <p className="mt-2 leading-5">검사 구간 {(evidence.startMs / 1000).toFixed(2)}–{(evidence.endMs / 1000).toFixed(2)}초 · 측정 변화 {evidence.shiftPx.toFixed(1)}px · 구분 한계 {evidence.noisePx.toFixed(1)}px ({evidence.width}×{evidence.height} 영상 기준)</p>
    </details>
  </div>;
}

export function PelvisContourOverlay({ evidence, timeMs }: { evidence: CoachingEvidence; timeMs: number }) {
  const point = evidence.points.reduce((best, p) => Math.abs(p.timeMs - timeMs) < Math.abs(best.timeMs - timeMs) ? p : best);
  const current = Math.abs(point.timeMs - timeMs) <= 40 ? point : null;
  return <svg viewBox="0 0 1 1" preserveAspectRatio="none" className="block h-full w-full" aria-label="골반 뒤쪽 윤곽과 준비 자세 기준선">
    {current && <>
      <line x1={current.referenceTop?.[0] ?? current.referenceX} x2={current.referenceBottom?.[0] ?? current.referenceX} y1={current.referenceTop?.[1] ?? Math.max(0, current.referenceY - .16)} y2={current.referenceBottom?.[1] ?? Math.min(1, current.referenceY + .16)} stroke="#fbbf24" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeDasharray="5 4" />
      <line x1={current.x} x2={current.x} y1={current.y - .035} y2={current.y + .035} stroke="#34d399" strokeWidth="3" vectorEffect="non-scaling-stroke" />
      <line x1={current.referenceX} x2={current.x} y1={current.y} y2={current.y} stroke="#34d399" strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </>}
  </svg>;
}
