import { useState } from "react";
import { ImpactReview as Review } from "@/api/impactReview";

export function ImpactReview({ review, loading, error, onRetry, timeMs, onSeek, playable = true }: {
  review: Review | null; loading: boolean; error: string | null;
  onRetry: () => void; timeMs: number; onSeek: (timeMs: number) => void; playable?: boolean;
}) {
  const [confirmed, setConfirmed] = useState(false);
  const index = review ? review.frameTimesMs.reduce((best, t, i, times) =>
    Math.abs(t - timeMs) < Math.abs(times[best] - timeMs) ? i : best, 0) : 0;
  const buttonClass = "min-h-12 rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40";
  return <section className="space-y-2 rounded-xl border border-border p-3" aria-label="임팩트 후보 검수">
    <p className="text-xs text-muted-foreground">추정한 임팩트 장면을 영상에서 확인하세요.</p>
    {loading && <p role="status" className="text-sm">임팩트 후보 자동 계산 대기·처리 중…</p>}
    {error && <div role="alert" className="space-y-2">
      <p className="text-sm text-destructive">임팩트 판정 보류: {error}</p>
      <button type="button" className={buttonClass} onClick={onRetry}>다시 시도</button>
    </div>}
    {review && <>
      <p role="status" className="text-sm">임팩트 후보 · {(review.candidate.timeMs / 1000).toFixed(3)}초 · {review.candidate.frameIndex + 1}번째 프레임</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={buttonClass} disabled={!playable} onClick={() => onSeek(review.candidate.timeMs)}>후보로 이동</button>
        <button type="button" className={buttonClass} disabled={!playable || index === 0} onClick={() => onSeek(review.frameTimesMs[index - 1])}>이전 프레임</button>
        <button type="button" className={buttonClass} disabled={!playable || index === review.frameTimesMs.length - 1} onClick={() => onSeek(review.frameTimesMs[index + 1])}>다음 프레임</button>
      </div>
      <details><summary className="text-xs text-muted-foreground">후보 확인 표시 및 분석 범위</summary>
      <label className="flex min-h-12 cursor-pointer items-center gap-2 text-sm">
        <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
        원본 영상에서 후보를 직접 확인했습니다.
      </label>
      <p className="text-xs text-muted-foreground">{confirmed ? "이번 화면에서 확인 표시됨. " : ""}확인 표시는 이 화면에서만 유지되며 정답 라벨이나 자동 코칭에 반영되지 않습니다.</p>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">오른손 후방(DTL) 단일 완전 스윙 기준입니다. 자동 진단·교정 결과가 아니며, 시작·탑·피니시·템포·몸 움직임 수치·공 비행 분석은 보류 중입니다.</p></details>
    </>}
  </section>;
}
