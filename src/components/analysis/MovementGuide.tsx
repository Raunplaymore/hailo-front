import { guideSegments, guidePointAt, type MovementGuide, type GuideKind } from "@/api/movementGuide";
const labels = { head: "머리", pelvis: "골반" };
const button = "min-h-12 rounded-lg border border-border px-3 py-2 text-sm font-semibold disabled:opacity-40";
export function MovementGuideControls({ guide, active, onActive, onSeek, timeMs, playable = true }: { guide: MovementGuide | null; active: GuideKind | null; onActive: (kind: GuideKind | null) => void; onSeek: (ms: number) => void; timeMs: number; playable?: boolean }) {
  const track = active ? guide?.tracks?.[active] : undefined;
  return <section aria-label="머리와 골반 움직임" className="space-y-2 rounded-xl border border-border p-3">
    {!guide ? <p className="text-sm text-muted-foreground">움직임을 확인할 장면을 준비하고 있어요.</p> : guide.status === "unavailable" ? <p className="text-sm text-muted-foreground">현재 사용할 수 있는 머리·골반 기준선이 없습니다. 자세 비교에서 준비 상태를 확인해 주세요.</p> : <>
      <p className="text-xs text-muted-foreground">확인할 장면으로 바로 이동합니다.</p>
      <div className="flex flex-wrap gap-2">{(["head", "pelvis"] as const).map(kind => <button key={kind} type="button" className={`${button} ${active === kind ? "bg-primary/15 text-primary border-primary/40" : "hover:bg-muted"}`} aria-pressed={active === kind} disabled={!playable || !guide.tracks?.[kind]} onClick={() => { onActive(kind); onSeek(guide.tracks![kind]!.focusTimeMs); }}>{labels[kind]} 보기</button>)}
        {active && <button type="button" className={button} onClick={() => onActive(null)}>기준선 숨기기</button>}
      </div>
      {track && <>
        {!guidePointAt(track,timeMs) && <p className="text-xs text-muted-foreground">현재 장면은 추적이 없어 시작 기준선만 표시합니다.</p>}
        <p className="text-sm">{labels[active!]} 확인 장면 · 임팩트 후보 {track.phase === "before" ? "이전" : track.phase === "after" ? "이후" : "근처"}</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={button} disabled={!playable} onClick={() => onSeek(track.baseline.timeMs)}>시작 기준 자세</button>
          {([[-100,"임팩트 전"],[100,"임팩트 후"]] as const).map(([offset,label]) => { const p = guidePointAt(track,guide.impactMs!+offset); return <button key={label} type="button" className={button} disabled={!playable || !p} onClick={() => p && onSeek(p.timeMs)}>{label}</button>; })}
        </div>
        <p className="text-xs leading-5 text-muted-foreground">{active === "head" ? "점선 십자는 시작 구간의 코 위치입니다. 얼굴 회전도 위치 변화로 보일 수 있습니다." : "점선은 시작 구간의 골반 중심입니다. 엉덩이 윤곽선이나 실제 회전 깊이는 아닙니다."} 실선과 점은 현재 추적 위치입니다.</p>
      </>}
      <details><summary className="text-xs text-muted-foreground">기준선 해석 안내</summary><p className="text-xs leading-5 text-muted-foreground">고정된 후방 촬영에서 확인하세요. 화면상 이동만 표시하며, 머리 고정·얼리 익스텐션의 좋고 나쁨을 판정하지 않습니다.</p></details>
    </>}
  </section>;
}

export function MovementGuideOverlay({ guide, kind, timeMs }: { guide: MovementGuide; kind: GuideKind; timeMs: number }) {
  const track = guide.tracks?.[kind];
  if (!track) return null;
  const current = guidePointAt(track,timeMs), base = track.baseline;
  const color = kind === "head" ? "#67e8f9" : "#fbbf24";
  return <svg viewBox="0 0 1 1" preserveAspectRatio="none" className="block h-full w-full" aria-label={`${labels[kind]} 화면상 기준선`}>
    <line x1={base.x} x2={base.x} y1={kind === "head" ? base.y-.06 : 0} y2={kind === "head" ? base.y+.06 : 1} stroke={color} strokeWidth=".004" strokeDasharray=".01 .01" />
    {kind === "head" && <line x1={base.x-.08} x2={base.x+.08} y1={base.y} y2={base.y} stroke={color} strokeWidth=".004" strokeDasharray=".01 .01" />}
    {current && <>
      {guideSegments(track,timeMs).map(([a,b]) => <line key={b.timeMs} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={color} strokeWidth=".004" opacity=".5" />)}
      <line x1={base.x} y1={base.y} x2={current.x} y2={current.y} stroke={color} strokeWidth=".005" />
      <ellipse cx={current.x} cy={current.y} rx=".015" ry={.015*guide.width!/guide.height!} fill={color} stroke="black" strokeWidth=".002" />
    </>}
  </svg>;
}
