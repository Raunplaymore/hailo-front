import { useState } from "react";
import { frameIndexAtOrBefore, ImpactReview as Review, type VideoClock } from "@/api/impactReview";

export function ImpactReview({ review, manualClock, clockLoading = false, clockError, onClockRetry, loading, error, onRetry, timeMs, onSeek, onChooseCurrent, selectionError, playable = true }: {
  review: Review | null; loading: boolean; error: string | null;
  manualClock?: VideoClock | null; clockLoading?: boolean; clockError?: string | null; onClockRetry?: () => void;
  onRetry: () => void; timeMs: number; onSeek: (timeMs: number) => void;
  onChooseCurrent: () => void; selectionError: string | null; playable?: boolean;
}) {
  const [confirmed, setConfirmed] = useState(false);
  const clock = review ?? manualClock;
  const index = clock ? frameIndexAtOrBefore(clock.frameTimesMs, timeMs) ?? 0 : 0;
  const buttonClass = "min-h-12 rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40";
  return <section className="space-y-2 rounded-xl border border-border p-3" aria-label="임팩트 후보 검수">
    <p className="text-xs leading-5 text-muted-foreground">오른손 후방에서 완전한 스윙 한 번을 촬영한 영상 기준입니다. 영상이 잘렸거나 여러 스윙이 이어지거나 연습 동작이면 후보가 틀릴 수 있습니다. 느리게 저장한 영상에서도 후보가 어긋날 수 있으니 원본에서 확인하세요.</p>
    {loading && <p role="status" className="text-sm">임팩트 후보 자동 계산 대기·처리 중…</p>}
    {error && <div role="alert" className="space-y-2">
      <p className="text-sm text-destructive">임팩트 판정 보류: {error}</p>
      <button type="button" className={buttonClass} onClick={onRetry}>다시 시도</button>
    </div>}
    {clockLoading && <p role="status" className="text-sm">직접 선택할 영상의 프레임을 확인하고 있어요…</p>}
    {clockError && <div role="alert" className="space-y-2"><p className="text-sm">{clockError}</p><button type="button" className={buttonClass} onClick={onClockRetry}>영상 시각 다시 확인</button></div>}
    {clock && <>
      {review ? <p role="status" className="text-sm">임팩트 후보 · {(review.candidate.timeMs / 1000).toFixed(3)}초 · {review.candidate.frameIndex + 1}번째 프레임</p>
        : <p role="status" className="text-sm">후보를 찾지 못했어요. 영상에서 타격 장면을 직접 선택할 수 있습니다.</p>}
      <div className="flex flex-wrap gap-2">
        {review && <button type="button" className={buttonClass} disabled={!playable} onClick={() => onSeek(review.candidate.timeMs)}>후보로 이동</button>}
        <button type="button" className={buttonClass} disabled={!playable || index === 0} onClick={() => onSeek(clock.frameTimesMs[index - 1])}>이전 프레임</button>
        <button type="button" className={buttonClass} disabled={!playable || index === clock.frameTimesMs.length - 1} onClick={() => onSeek(clock.frameTimesMs[index + 1])}>다음 프레임</button>
      </div>
      <p className="text-xs leading-5 text-muted-foreground">{review ? "후보와 타격 장면이 다르면 " : "타격 장면을 찾아 "}영상을 멈추고 타격 장면을 선택하세요. 영상에 타격 장면이 없다면 다시 촬영해 주세요. 선택은 이 화면에서만 유지되며 정답 라벨로 저장하지 않습니다.</p>
      <button type="button" className={`${buttonClass} w-full`} disabled={!playable} onClick={onChooseCurrent}>현재 장면으로 골반 확인</button>
      {selectionError && <p role="alert" className="text-xs text-destructive">{selectionError}</p>}
      {review && <details><summary className="text-xs text-muted-foreground">후보 확인 표시 및 분석 범위</summary>
      <label className="flex min-h-12 cursor-pointer items-center gap-2 text-sm">
        <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
        분석 영상에서 후보를 직접 확인했습니다.
      </label>
      <p className="text-xs text-muted-foreground">{confirmed ? "이번 화면에서 확인 표시됨. " : ""}확인 표시는 이 화면에서만 유지되며 정답 라벨이나 자동 코칭에 반영되지 않습니다.</p>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">오른손 후방(DTL) 단일 완전 스윙 기준입니다. 자동 진단·교정 결과가 아니며, 시작·탑·피니시·템포·몸 움직임 수치·공 비행 분석은 보류 중입니다.</p></details>}
    </>}
  </section>;
}
