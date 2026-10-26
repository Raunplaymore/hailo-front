import type { MovementGuide } from "@/api/movementGuide";
import { useEffect, useReducer, useRef, useState } from "react";
import { canReviewFrames, requestPracticePreview, requestPracticeReview, parsePracticeBaseline, comparePracticeBaseline, type PracticeBaseline, type PracticeReview } from "@/api/practiceReview";

export type PracticeState = {
  addressMs: number | null; comparisonMs: number | null;
  result: PracticeReview | null; loading: boolean; error: string | null;
  pattern: "yes" | "no" | null;
};
export const initialPracticeState: PracticeState = {
  addressMs: null, comparisonMs: null, result: null, loading: false, error: null, pattern: null,
};
type Action =
  | { type: "select"; slot: "addressMs" | "comparisonMs"; timeMs: number }
  | { type: "start" }
  | { type: "result"; result: PracticeReview }
  | { type: "error"; message: string }
  | { type: "pattern"; value: "yes" | "no" };

export function practiceReducer(state: PracticeState, action: Action): PracticeState {
  switch (action.type) {
    case "select": return { ...state, [action.slot]: action.timeMs, result: null, error: null, loading: false, pattern: null };
    case "start": return { ...state, loading: true, result: null, error: null, pattern: null };
    case "result": return { ...state, loading: false, result: action.result, error: null };
    case "error": return { ...state, loading: false, result: null, error: action.message };
    case "pattern": return { ...state, pattern: action.value };
  }
}

const buttonClass = "min-h-12 rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40";
const BASELINE_KEY = "hailo:dtl-posture-practice-baseline:v1";
const seconds = (timeMs: number) => `${(timeMs / 1000).toFixed(3)}초`;

export function PracticeCoach({ jobId, videoSha256, timeMs, playable, onCapture, onSeek, suggestedAddressMs = 200, suggestedComparisonMs, candidatePending = false, onGuide }: {
  jobId: string; videoSha256?: string; timeMs: number; playable: boolean;
  onCapture: () => number | null; onSeek: (timeMs: number) => void;
  suggestedAddressMs?: number; suggestedComparisonMs?: number; candidatePending?: boolean; onGuide?: (guide: MovementGuide | null) => void;
}) {
  const [state, dispatch] = useReducer(practiceReducer, initialPracticeState);
  const [prepareError, setPrepareError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [preparing, setPreparing] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [activeSlot, setActiveSlot] = useState<"addressMs" | "comparisonMs">("addressMs");
  const [seen, setSeen] = useState({ addressMs: false, comparisonMs: false });
  useEffect(() => {
    let cancelled = false;
    onGuide?.(null);
    setPreparing(true); setUnavailable(false); setPrepareError(null); setSeen({ addressMs: false, comparisonMs: false });
    if (candidatePending) return;
    if (suggestedComparisonMs === undefined) { setPreparing(false); setPrepareError("임팩트 후보가 없어 비교 장면을 준비하지 못했습니다."); onGuide?.({version:"movement-guide-v1",status:"unavailable"}); return; }
    requestPracticePreview(jobId, suggestedAddressMs, suggestedComparisonMs, videoSha256).then((preview) => {
      if (cancelled) return;
      onGuide?.(preview.movementGuide ?? {version:"movement-guide-v1",status:"unavailable"});
      if (preview.status === "ready") {
        dispatch({ type: "select", slot: "addressMs", timeMs: preview.addressMs! });
        dispatch({ type: "select", slot: "comparisonMs", timeMs: preview.comparisonMs! });
      } else setUnavailable(true);
    }).catch(() => { if (!cancelled) { setPrepareError("장면 준비에 연결하지 못했습니다. 다시 시도해 주세요."); onGuide?.({version:"movement-guide-v1",status:"unavailable"}); } })
      .finally(() => { if (!cancelled) setPreparing(false); });
    return () => { cancelled = true; };
  }, [jobId, videoSha256, suggestedAddressMs, suggestedComparisonMs, candidatePending, attempt, onGuide]);
  const viewing = useRef<"addressMs" | "comparisonMs" | null>(null);
  useEffect(() => {
    const slot = viewing.current;
    if (slot && playable && state[slot] !== null && Math.abs(timeMs - state[slot]!) < 50) {
      setSeen((current) => ({ ...current, [slot]: true })); viewing.current = null;
    }
  }, [timeMs, playable, state.addressMs, state.comparisonMs]);
  const show = (slot: "addressMs" | "comparisonMs") => {
    if (state[slot] === null) return;
    setActiveSlot(slot); viewing.current = slot; onSeek(state[slot]!);
  };
  const [baseline, setBaseline] = useState<PracticeBaseline | null>(null);
  const [sameConditions, setSameConditions] = useState(false);
  const [storageMessage, setStorageMessage] = useState<string | null>(null);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(BASELINE_KEY);
      setBaseline(saved ? parsePracticeBaseline(JSON.parse(saved)) : null);
    } catch { setStorageMessage("브라우저에 저장된 기준을 읽을 수 없습니다. 현재 영상 비교는 계속할 수 있습니다."); }
  }, []);
  const saveBaseline = () => {
    if (state.pattern !== "yes" || state.result?.status !== "review_candidate" || !state.result.evidence) return;
    const next = parsePracticeBaseline({
      version: state.result.version, jobId, addressMs: state.addressMs, comparisonMs: state.comparisonMs,
      changeDeg: state.result.evidence.changeDeg, savedAt: new Date().toISOString(),
      ...(state.result.evidence.side ? { side: state.result.evidence.side } : {}),
    });
    if (!next) return;
    try {
      localStorage.setItem(BASELINE_KEY, JSON.stringify(next));
      setBaseline(next); setSameConditions(false); setStorageMessage("연습 전 기준을 이 브라우저에 저장했습니다.");
    } catch { setStorageMessage("기준을 저장하지 못했습니다. 브라우저 저장 공간 설정을 확인해 주세요."); }
  };
  const deleteBaseline = () => {
    try {
      localStorage.removeItem(BASELINE_KEY);
      setBaseline(null); setSameConditions(false); setStorageMessage("저장한 기준을 삭제했습니다.");
    } catch { setStorageMessage("기준을 삭제하지 못했습니다. 브라우저 저장 공간 설정을 확인해 주세요."); }
  };
  const requestId = useRef(0);
  useEffect(() => () => { requestId.current += 1; }, []);
  const valid = canReviewFrames(state.addressMs, state.comparisonMs);
  const select = (slot: "addressMs" | "comparisonMs") => {
    const selected = onCapture();
    if (selected === null || !Number.isFinite(selected)) return;
    requestId.current += 1;
    setSameConditions(false);
    setSeen((current) => ({ ...current, [slot]: true }));
    setUnavailable(false); setPrepareError(null);
    dispatch({ type: "select", slot, timeMs: Math.round(selected) });
  };
  const submit = async () => {
    if (!valid || !seen.addressMs || !seen.comparisonMs || !playable || state.loading) return;
    const id = ++requestId.current;
    setSameConditions(false);
    dispatch({ type: "start" });
    try {
      const result = await requestPracticeReview(jobId, state.addressMs!, state.comparisonMs!, videoSha256);
      if (id === requestId.current) dispatch({ type: "result", result });
    } catch (error) {
      if (id === requestId.current) dispatch({ type: "error", message: error instanceof Error ? error.message : "자세 비교에 실패했습니다. 다시 시도해 주세요." });
    }
  };
  const result = state.result;
  const comparison = comparePracticeBaseline(baseline, result, sameConditions);
  return <section aria-label="한 가지 자세 연습" className="space-y-3 rounded-xl border border-border p-3">
    <div>
      <h3 className="font-semibold">상체 자세 비교</h3>
      <p className="mt-1 text-xs text-muted-foreground">두 장면 후보를 확인하면 상체 기울기를 비교합니다.</p>
    </div>
    {preparing ? <p role="status" className="text-sm">비교 가능한 장면을 준비하고 있어요…</p> : prepareError ? <div role="alert" className="text-sm"><p>{prepareError}</p><button type="button" className={buttonClass} onClick={() => setAttempt((n) => n + 1)}>장면 준비 다시 시도</button></div> : unavailable ? <p role="status" className="text-sm leading-6">이 영상은 비교할 자세를 충분히 추적하지 못했습니다. 반복해서 장면을 찾을 필요는 없습니다.</p> : <>
      <div className="grid grid-cols-2 gap-2">
        {([['addressMs', '1. 준비 자세'], ['comparisonMs', '2. 공에 닿기 직전']] as const).map(([slot, label]) => <button key={slot} type="button" className={buttonClass} aria-pressed={activeSlot === slot} disabled={state[slot] === null} onClick={() => show(slot)}>
          {label} {seen[slot] ? '✓' : '보기'}
        </button>)}
      </div>
      <p className="text-xs text-muted-foreground">{!seen.addressMs ? '① 준비 자세를 눌러 영상에서 확인하세요.' : !seen.comparisonMs ? '② 공에 닿기 직전을 눌러 확인하세요.' : '고정된 후방 촬영이며, 두 장면과 자세 선이 맞으면 비교하세요.'}</p>
      <button type="button" className={`${buttonClass} w-full border-primary bg-primary text-primary-foreground hover:bg-primary/90`} disabled={!valid || !seen.addressMs || !seen.comparisonMs || !playable || state.loading} onClick={() => void submit()}>{state.loading ? "비교 중…" : "두 장면이 맞아요 · 비교"}</button>
    </>}
    <details className="text-xs">
      <summary className="min-h-12 cursor-pointer py-3 text-muted-foreground">장면이 다르면 직접 조정</summary>
      <p className="mb-2">영상을 멈추고 해당 장면으로 저장하세요. 현재 {seconds(timeMs)}</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={buttonClass} disabled={!playable} onClick={() => select("addressMs")}>준비 자세로 저장</button>
        <button type="button" className={buttonClass} disabled={!playable} onClick={() => select("comparisonMs")}>공에 닿기 직전으로 저장</button>
      </div>
      {!playable && <p>영상을 불러온 뒤 선택할 수 있습니다.</p>}
    </details>
    {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
    {result && playable && <div className="space-y-3 border-t border-border pt-3" aria-live="polite">
      <p className="text-sm font-semibold">{result.status === "withheld" ? "이 영상에서는 비교하기 어려워요" : result.status === "review_candidate" ? "영상에서 확인할 변화" : "뚜렷한 변화는 찾지 못했어요"}</p>
      <p className="text-sm leading-6">{result.status === "withheld" ? "선택한 장면의 자세 추적이 불안정합니다. 같은 영상에서 반복 시도하지 않아도 됩니다." : result.message}</p>
      {result.evidence && <div className="rounded-lg bg-background p-3 text-sm">
        <p>화면상 몸통 기울기: {result.evidence.address.angleDeg.toFixed(1)}° → {result.evidence.comparison.angleDeg.toFixed(1)}°</p>
        <p className="mt-1 text-xs text-muted-foreground">수직선 기준 2D 각도입니다. 실제 몸통 회전량이나 구질 원인을 뜻하지 않습니다.</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" className={buttonClass} disabled={!playable} onClick={() => onSeek(result.evidence!.address.timeMs)}>첫 근거 장면</button>
          <button type="button" className={buttonClass} disabled={!playable} onClick={() => onSeek(result.evidence!.comparison.timeMs)}>두 번째 근거 장면</button>
        </div>
      </div>}
      {result.status === "review_candidate" && <>
        <p className="text-sm">원본 영상에서도 상체가 일어나는 변화가 보이나요?</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" aria-pressed={state.pattern === "yes"} className={buttonClass} onClick={() => dispatch({ type: "pattern", value: "yes" })}>보여요 · 연습 확인</button>
          <button type="button" aria-pressed={state.pattern === "no"} className={buttonClass} onClick={() => dispatch({ type: "pattern", value: "no" })}>아니요 · 보류</button>
        </div>
        {state.pattern === "no" && <p className="text-sm text-muted-foreground">이 비교로 교정을 권하지 않겠습니다. 선택한 장면과 관절 표시를 다시 확인하세요.</p>}
        {state.pattern === "yes" && result.practice && <div className="space-y-2 rounded-lg border border-primary/30 bg-background p-3">
          <h4 className="text-sm font-semibold">{result.practice.title}</h4>
          <ol className="list-decimal space-y-2 pl-5 text-sm leading-6">{result.practice.steps.map((step, index) => <li key={index}>{step}</li>)}</ol>
          <p className="text-sm leading-6"><strong>다음 스윙에서 확인:</strong> {result.practice.checkpoint}</p>
          <button type="button" className={buttonClass} onClick={saveBaseline}>{baseline ? "이 스윙으로 연습 전 기준 바꾸기" : "이 스윙을 연습 전 기준으로 저장"}</button>
          <p className="text-xs text-muted-foreground">기준은 이 브라우저에만 저장합니다. 다음 스윙의 두 장면을 비교하면 변화량을 나란히 볼 수 있습니다.</p>
        </div>}
      </>}
      {baseline && result.status !== "withheld" && result.evidence && baseline.jobId !== jobId && <div className="space-y-2 rounded-lg border border-border bg-background p-3">
        <h4 className="text-sm font-semibold">연습 전과 비교</h4>
        <label className="flex min-h-12 items-start gap-2 text-sm leading-6">
          <input type="checkbox" className="mt-1.5 size-4 shrink-0" checked={sameConditions} onChange={(event) => setSameConditions(event.target.checked)} />
          같은 골퍼·클럽·카메라 위치에서 같은 완전한 스윙 구간으로 촬영했습니다.
        </label>
        {comparison ? <>
          <p className="text-sm">상체가 세워진 변화량: 연습 전 {comparison.beforeDeg.toFixed(1)}° → 이번 {comparison.afterDeg.toFixed(1)}°</p>
          <p className="text-xs text-muted-foreground">음수는 반대로 기울어진 변화입니다. 차이 감소가 타구 개선을 뜻하지 않습니다.</p>
        </> : sameConditions ? <p className="text-sm text-muted-foreground">측정에 사용한 관절 쪽이 달라 직접 비교를 보류합니다.</p> : <p className="text-xs text-muted-foreground">촬영 조건을 확인한 뒤 두 스윙의 변화량을 비교합니다.</p>}
      </div>}
      <p className="text-xs text-muted-foreground">선택과 확인 표시는 이 화면에서만 유지됩니다. 확정 진단이나 학습 정답으로 저장하지 않습니다.</p>
    </div>}
    {baseline && <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
      <p className="text-xs text-muted-foreground">이 브라우저의 연습 전 기준 · {new Date(baseline.savedAt).toLocaleDateString("ko-KR")}</p>
      <button type="button" className={buttonClass} onClick={deleteBaseline}>저장한 기준 삭제</button>
    </div>}
    {storageMessage && <p role="status" className="text-xs text-muted-foreground">{storageMessage}</p>}
  </section>;
}
