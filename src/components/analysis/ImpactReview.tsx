import { useState } from "react";
import { ImpactReview as Review } from "@/api/impactReview";

export function ImpactReview({ review, loading, error, onRetry, timeMs, onSeek }: {
  review: Review | null; loading: boolean; error: string | null;
  onRetry: () => void; timeMs: number; onSeek: (timeMs: number) => void;
}) {
  const [confirmed, setConfirmed] = useState(false);
  const index = review ? review.frameTimesMs.reduce((best, t, i, times) =>
    Math.abs(t - timeMs) < Math.abs(times[best] - timeMs) ? i : best, 0) : 0;
  const buttonClass = "min-h-11 rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40";
  return <section className="space-y-3 rounded-xl border border-border p-3" aria-label="임팩트 후보 검수">
    <div>
      <h3 className="text-sm font-semibold">임팩트 후보 검수</h3>
      <p className="mt-1 text-xs text-muted-foreground">추정한 후보 프레임을 원본 영상에서 확인하세요. 자동 진단·교정 결과가 아닙니다.</p>
      <p className="mt-1 text-xs text-muted-foreground">시작·탑·피니시·템포·몸 움직임 수치·공 비행 분석은 보류 중입니다.</p>
    </div>
    <p className="text-xs text-muted-foreground">오른손 DTL의 단일 완전 스윙을 전제로 자동 계산합니다. 촬영 조건과 실제 임팩트는 원본에서 확인하세요.</p>
    {loading && <p role="status" className="text-sm">임팩트 후보 자동 계산 대기·처리 중…</p>}
    {error && <div role="alert" className="space-y-2">
      <p className="text-sm text-destructive">임팩트 판정 보류: {error}</p>
      <button type="button" className={buttonClass} onClick={onRetry}>다시 시도</button>
    </div>}
    {review && <>
      <p role="status" className="text-sm">검수 대기 후보 · {(review.candidate.timeMs / 1000).toFixed(3)}초 · {review.candidate.frameIndex + 1}번째 프레임</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={buttonClass} onClick={() => onSeek(review.candidate.timeMs)}>후보로 이동</button>
        <button type="button" className={buttonClass} disabled={index === 0} onClick={() => onSeek(review.frameTimesMs[index - 1])}>이전 프레임</button>
        <button type="button" className={buttonClass} disabled={index === review.frameTimesMs.length - 1} onClick={() => onSeek(review.frameTimesMs[index + 1])}>다음 프레임</button>
      </div>
      <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
        <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
        원본 영상에서 후보를 직접 확인했습니다.
      </label>
      <p className="text-xs text-muted-foreground">{confirmed ? "이번 화면에서 확인 표시됨. " : ""}확인 표시는 이 화면에서만 유지되며 정답 라벨이나 자동 코칭에 반영되지 않습니다.</p>
    </>}
  </section>;
}
