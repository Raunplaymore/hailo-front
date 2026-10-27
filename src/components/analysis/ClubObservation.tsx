import { useEffect, useRef, useState } from "react";
import { requestClubReview } from "@/api/shots";
import type { DtlClubPointsV2Sidecar } from "@/types/shots";

export function ClubObservation({ jobId, sidecar, onSeek, onResult }: {
  jobId: string; sidecar?: DtlClubPointsV2Sidecar | null;
  onSeek: (ms: number) => void; onResult: (result: DtlClubPointsV2Sidecar) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), []);
  const levels = sidecar?.observations?.levels;
  const run = async () => {
    active.current?.abort();
    const controller = new AbortController(); active.current = controller;
    setLoading(true); setError("");
    try { const result = await requestClubReview(jobId, controller.signal); if (!controller.signal.aborted) onResult(result); }
    catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "관측을 불러오지 못했습니다."); }
    finally { if (!controller.signal.aborted) setLoading(false); }
  };
  return <section className="space-y-3 rounded-xl border border-border bg-card p-4" aria-label="클럽 구간 관측">
    <div><h3 className="font-semibold">손과 클럽의 움직임</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">손 높이가 비슷한 올라가는 장면과 내려오는 장면을 확인하세요. 화면상 관측이며 스윙의 정답·오류 판정은 아닙니다.</p></div>
    {levels?.length ? <>
      <p className="text-xs text-muted-foreground">손 높이: 시작 0% → 최고점 후보 100%</p>
      {levels.map(level => <div key={level.heightFraction} className="rounded-lg border border-border p-3">
        <p className="text-sm font-medium">손 높이 {Math.round(level.heightFraction * 100)}% · {level.direction === "steeper" ? "내려올 때 더 세워져 보임" : level.direction === "flatter" ? "내려올 때 더 누워져 보임" : "차이 방향 불확실"}</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button className="min-h-11 rounded-lg border border-border text-sm" onClick={() => onSeek(level.backswingMs)}>올라가는 장면</button>
          <button className="min-h-11 rounded-lg border border-border text-sm" onClick={() => onSeek(level.downswingMs)}>내려오는 장면</button>
        </div>
      </div>)}
      <details className="text-xs text-muted-foreground"><summary className="cursor-pointer py-2">관측의 한계</summary><p className="leading-5">표시는 각 검출점에 5px 위치 오차를 가정하고 비교 프레임이 바뀔 가능성까지 계산한 결과입니다. 실제 오차를 측정한 정확도가 아니며, 카메라 각도·구간 경계·잘못된 물체 검출의 영향은 별도 확인이 필요합니다.</p></details>
    </> : <><p className="text-sm text-muted-foreground">{sidecar?.observations ? "이 영상에서는 안정적으로 비교할 장면을 확보하지 못했습니다." : "클럽 관측을 계산하면 높이별 비교 장면을 볼 수 있습니다."}</p><button disabled={loading} onClick={run} className="min-h-11 w-full rounded-lg bg-primary px-4 text-primary-foreground disabled:opacity-60">{loading ? "클럽 관측 중…" : "클럽 관측 계산"}</button></>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </section>;
}
