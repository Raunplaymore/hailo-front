import { useEffect, useRef, useState } from "react";
import { CLUB_BODY_UNAVAILABLE_MESSAGE, requestClubReview } from "@/api/shots";
import type { DtlClubPointsV2Sidecar } from "@/types/shots";
import type { ImpactReview } from "@/api/impactReview";

export function ClubObservation({ jobId, sidecar, impactReview, impactLoading, manualImpactDifferent, playable, onSeek, onResult, onRetryImpact }: {
  jobId: string; sidecar?: DtlClubPointsV2Sidecar | null; playable: boolean;
  impactReview?: Pick<ImpactReview, "videoSha256" | "candidate"> | null; impactLoading?: boolean;
  manualImpactDifferent?: boolean; onRetryImpact?: () => void;
  onSeek: (ms: number) => void; onResult: (result: DtlClubPointsV2Sidecar) => void;
}) {
  const [height, setHeight] = useState(0.5);
  const [phase, setPhase] = useState<"backswing" | "downswing" | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), []);
  useEffect(() => setPhase(null), [sidecar, impactReview?.videoSha256, impactReview?.candidate.frameIndex, impactReview?.candidate.timeMs]);
  const ambiguousHeads = sidecar?.trackingQuality?.ambiguousClubHeadFrames;
  const ambiguousHandles = sidecar?.trackingQuality?.ambiguousClubHandleFrames;
  const needsGripRecheck = sidecar?.status === "succeeded" &&
    (typeof ambiguousHandles !== "number" || !Number.isSafeInteger(ambiguousHandles) || ambiguousHandles < 0);
  const savedLevels = needsGripRecheck ? undefined : sidecar?.observations?.levels;
  const reference = sidecar?.observations?.impactReference;
  const matchingImpact = Boolean(reference && impactReview && reference.videoSha256 === impactReview.videoSha256
    && reference.frameIndex === impactReview.candidate.frameIndex && reference.timeMs === impactReview.candidate.timeMs);
  const needsImpactCheck = Boolean(savedLevels?.length && !matchingImpact);
  const levels = needsImpactCheck ? undefined : savedLevels;
  const selected = levels?.find(level => level.heightFraction === height) ?? levels?.[0];
  const run = async (refresh = false) => {
    active.current?.abort();
    const controller = new AbortController(); active.current = controller;
    setLoading(true); setError("");
    try { const result = await requestClubReview(jobId, controller.signal, refresh); if (!controller.signal.aborted) { setPhase(null); onResult(result); } }
    catch (e) { if (!controller.signal.aborted) setError(`${e instanceof Error ? e.message : "관측을 불러오지 못했습니다."}${refresh ? " 이전 결과는 유지됩니다." : ""}`); }
    finally { if (!controller.signal.aborted) setLoading(false); }
  };
  return <section className="space-y-2 rounded-xl border border-border bg-card p-2" aria-label="클럽 구간 관측">
    <h3 className={levels?.length ? "sr-only" : "text-sm font-semibold"}>손과 클럽의 움직임</h3>
    {sidecar?.status === "succeeded" && typeof ambiguousHeads === "number" && Number.isInteger(ambiguousHeads) && ambiguousHeads > 0 &&
      <p className="text-xs leading-5 text-muted-foreground">헤드 후보가 둘 이상인 {ambiguousHeads}개 장면은 헤드 표시와 비교에서 제외했어요. 원본 영상으로 확인해 주세요.</p>}
    {sidecar?.status === "succeeded" && typeof ambiguousHandles === "number" && Number.isSafeInteger(ambiguousHandles) && ambiguousHandles > 0 &&
      <p className="text-xs leading-5 text-muted-foreground">그립 후보가 둘 이상인 {ambiguousHandles}개 장면은 그립·샤프트 표시와 비교에서 제외했어요. 원본 영상으로 확인해 주세요.</p>}
    {sidecar?.status === "succeeded" && Boolean(sidecar.overlay?.clubFrames.length || sidecar.pendingOverlay?.clubFrames.length)
      && (sidecar.sourceFrameCoverage?.status !== "verified"
        ? <p className="text-xs leading-5 text-muted-foreground">클럽 분석에서 빠진 프레임은 확인하지 못했어요. 원본 영상과 함께 살펴보세요.</p>
        : sidecar.sourceFrameCoverage.missingFrames > 0
          ? <p className="text-xs leading-5 text-muted-foreground">클럽 분석에서 빠진 프레임 {sidecar.sourceFrameCoverage.missingFrames}개는 선을 연결하지 않았어요.</p>
          : null)}
    {levels?.length ? <>
      <p className="sr-only">손 높이: 시작 0% → 최고점 후보 100%</p>
      {manualImpactDifferent && <p className="text-xs leading-5 text-muted-foreground">직접 선택한 타격 장면은 몸 관찰에 적용돼요. 클럽 비교는 자동 임팩트 후보 기준이에요.</p>}
      <div className="grid grid-cols-5 gap-1" role="group" aria-label="비교할 손 높이">
        {levels.map(level => <button key={level.heightFraction} type="button" aria-pressed={selected === level} onClick={() => { setHeight(level.heightFraction); if (phase && playable) onSeek(phase === "backswing" ? level.backswingMs : level.downswingMs); else if (!playable) setPhase(null); }} className={`min-h-11 rounded-lg border text-sm ${selected === level ? "border-primary bg-primary/15 text-primary" : "border-border"}`}>{Math.round(level.heightFraction * 100)}%</button>)}
      </div>
      {selected && <div>
        <p className="mb-1 text-xs leading-5 text-muted-foreground">두 장면이 각각 백스윙과 다운스윙인지, 노란 선이 실제 클럽과 맞는지 확인하세요.</p>
        <div aria-live="polite">
          <p className="text-sm font-medium">{selected.direction === "steeper" ? "내려올 때 더 세워져 보임" : selected.direction === "flatter" ? "내려올 때 더 누워져 보임" : "차이 방향 불확실"}</p>
          <p className="text-xs leading-5 text-muted-foreground">{selected.frameEdgeReason === "unverified"
            ? "이전 결과라 클럽이 화면 가장자리에 걸쳤는지 확인하지 못했어요. 다시 계산해 확인해 주세요."
            : selected.frameEdgeReason === "possible"
              ? "비교에 쓰일 클럽이 화면 가장자리에 걸쳤을 수 있어 방향 비교를 보류했어요."
              : `추정한 클럽 위치로 비교했어요.${selected.sensitiveTo10Px ? " 위치가 달라지면 비교가 불확실해질 수 있어요." : ""}`}</p>
          {selected.frameEdgeReason === "unverified" && <button type="button" disabled={loading} onClick={() => run(true)} className="mt-1 min-h-11 rounded-lg border border-border px-3 text-sm disabled:opacity-60">{loading ? "다시 계산 중…" : "클럽 관측 다시 계산"}</button>}
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {([["backswing", "백스윙", selected.backswingMs], ["downswing", "다운스윙", selected.downswingMs]] as const).map(([key, label, ms]) => <button key={key} type="button" aria-pressed={phase === key} disabled={!playable} className={`min-h-11 rounded-lg border text-sm disabled:opacity-40 ${phase === key ? "border-primary bg-primary/15 text-primary" : "border-border"}`} onClick={() => { setPhase(key); onSeek(ms); }}>{label} · {(ms / 1000).toFixed(2)}초</button>)}
        </div>
      </div>}
      <details className="text-xs text-muted-foreground"><summary className="cursor-pointer py-2">관측의 한계와 다시 계산</summary><p className="leading-5">손 높이가 비슷한 백스윙과 다운스윙 장면의 화면상 관측이며, 스윙의 정답·오류 판정은 아닙니다. 표시는 각 검출점에 5px 위치 오차를 가정하고 비교 프레임이 바뀔 가능성까지 계산한 결과입니다.{selected?.sensitiveTo10Px ? " 이 장면은 10px 오차를 가정하면 비교가 불확실해집니다." : ""} 실제 오차를 측정한 정확도가 아니며, 카메라 각도·구간 경계·잘못된 물체 검출의 영향은 별도 확인이 필요합니다.</p><button type="button" disabled={loading} onClick={() => run(true)} className="mt-2 min-h-11 rounded-lg border border-border px-3 text-sm disabled:opacity-60">{loading ? "다시 계산 중…" : "클럽 관측 다시 계산"}</button></details>
    </> : <>
      <p className="text-sm text-muted-foreground" aria-live="polite">{needsGripRecheck ? "이전에 저장된 결과에는 그립 후보 확인이 없어 그립·샤프트와 비교를 숨겼어요. 클럽 관측을 다시 계산해 주세요."
        : needsImpactCheck && impactLoading ? "임팩트 후보를 확인하는 중이에요."
        : needsImpactCheck && !impactReview ? "임팩트 후보를 확인하지 못해 비교를 보류했어요."
        : needsImpactCheck && !reference ? "이전 비교에는 임팩트 기준이 없어 다시 계산이 필요해요."
        : needsImpactCheck ? "이 비교의 임팩트 기준이 현재 후보와 달라요. 클럽 관측을 다시 계산해 주세요."
        : sidecar?.observations?.reason === "IMPACT_CANDIDATE_UNAVAILABLE" ? "임팩트 후보 없이 계산해 구간 비교를 보류했어요. 임팩트 탭에서 후보를 확인한 뒤 다시 계산해 주세요. 추적 궤적은 영상 일치가 확인되면 표시됩니다."
        : sidecar?.status === "failed" && sidecar.errorCode === "BODY_UNAVAILABLE" ? CLUB_BODY_UNAVAILABLE_MESSAGE
        : sidecar?.observations ? "이 영상에서는 안정적으로 비교할 장면을 확보하지 못했습니다." : "클럽 관측을 계산하면 높이별 비교 장면을 볼 수 있습니다."}</p>
      {needsImpactCheck && impactLoading ? null : needsImpactCheck && !impactReview && !needsGripRecheck
        ? <button type="button" disabled={!onRetryImpact} onClick={onRetryImpact} className="min-h-11 w-full rounded-lg bg-primary px-4 text-primary-foreground disabled:opacity-60">임팩트 후보 다시 확인</button>
        : <button type="button" disabled={loading} onClick={() => run(sidecar?.status === "succeeded")} className="min-h-11 w-full rounded-lg bg-primary px-4 text-primary-foreground disabled:opacity-60">{loading ? "클럽 관측 중…" : sidecar?.status === "succeeded" ? "클럽 관측 다시 계산" : "클럽 관측 계산"}</button>}
      {needsImpactCheck && reference && impactReview && onRetryImpact && <button type="button" onClick={onRetryImpact} className="min-h-11 w-full rounded-lg border border-border px-4 text-sm">임팩트 후보 다시 확인</button>}
    </>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </section>;
}
