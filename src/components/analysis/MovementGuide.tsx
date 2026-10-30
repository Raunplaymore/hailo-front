import { guideSegments, guidePointAt, type MovementGuide, type GuideKind } from "@/api/movementGuide";
const labels = { head: "머리", pelvis: "골반" };
const button = "min-h-12 rounded-lg border border-border px-3 py-2 text-sm font-semibold disabled:opacity-40";
export function MovementGuideControls({ guide, active, onActive, onSeek, timeMs, selectedImpact = false, playable = true, partialPlayable = false, frameNotice }: { guide: MovementGuide | null; active: GuideKind | null; onActive: (kind: GuideKind | null) => void; onSeek: (ms: number) => void; timeMs: number; selectedImpact?: boolean; playable?: boolean; partialPlayable?: boolean; frameNotice?: string | null }) {
  const track = active ? guide?.tracks?.[active] ?? guide?.partialTracks?.[active] : undefined;
  const partial = active ? guide?.partialTracks?.[active] : undefined;
  const hasTracks = Boolean(guide?.tracks?.head || guide?.tracks?.pelvis || guide?.partialTracks?.head || guide?.partialTracks?.pelvis);
  return <section aria-label="머리와 골반 움직임" className="space-y-2 rounded-xl border border-border p-3">
    {!guide ? <p className="text-sm text-muted-foreground">코칭에서 움직임의 준비 상태를 확인할 수 있습니다.</p> : !hasTracks ? <p className="text-sm text-muted-foreground">현재 사용할 수 있는 머리·골반 기준선이 없습니다. 코칭에서 준비 상태를 확인해 주세요.</p> : <>
      <p className="text-xs text-muted-foreground">확인할 장면으로 바로 이동합니다.</p>
      <div className="flex flex-wrap gap-2">{(["head", "pelvis"] as const).map(kind => { const selected = guide.tracks?.[kind] ?? guide.partialTracks?.[kind]; return <button key={kind} type="button" className={`${button} ${active === kind ? "bg-primary/15 text-primary border-primary/40" : "hover:bg-muted"}`} aria-pressed={active === kind} disabled={!playable || !selected} onClick={() => { if (selected) { onActive(kind); onSeek(selected.focusTimeMs); } }}>{labels[kind]} 보기</button>; })}
        {active && <button type="button" className={button} onClick={() => onActive(null)}>기준선 숨기기</button>}
      </div>
      {(["head", "pelvis"] as const).some(kind => !guide.tracks?.[kind] && !guide.partialTracks?.[kind]) && <p className="text-xs text-muted-foreground">관측이 충분하지 않은 부위의 선은 표시하지 않습니다. 원본 영상에서 직접 확인해 주세요.</p>}
      {!partialPlayable && Boolean(guide.partialTracks?.head || guide.partialTracks?.pelvis) && <p className="text-xs text-muted-foreground">영상 장면을 확인할 수 없어 기준선만 표시합니다. 움직임 점은 다른 브라우저에서 확인해 주세요.</p>}
      {active && frameNotice && (partialPlayable || !partial) && <p aria-hidden="true" className="text-xs text-muted-foreground">{frameNotice}</p>}
      {track && <>
        {partial && <p className="text-xs leading-5 text-muted-foreground">{partial.missingTimes.length > 0 && "관측이 불확실한 장면의 점과 선은 숨겼습니다. "}일부 위치는 주변 장면을 함께 이용한 추정입니다. 확인 장면은 {selectedImpact ? "선택한 장면" : "임팩트 후보"} 근처이며 가장 크게 움직인 순간이라는 뜻은 아닙니다.</p>}
        {!guidePointAt(track,timeMs) && <p className="text-xs text-muted-foreground">현재 장면은 추적이 없어 시작 기준선만 표시합니다.</p>}
        <p className="text-sm">{labels[active!]} 확인 장면 · {selectedImpact ? "선택 장면" : "임팩트 후보"} {track.phase === "before" ? "이전" : track.phase === "after" ? "이후" : "근처"}</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={button} disabled={!playable} onClick={() => onSeek(track.baseline.timeMs)}>시작 기준 자세 · {(track.baseline.timeMs / 1000).toFixed(3)}초</button>
          {([-100,100] as const).map(offset => { const p = guidePointAt(track,guide.impactMs!+offset); return <button key={offset} type="button" className={button} disabled={!playable || !p} onClick={() => p && onSeek(p.timeMs)}>{selectedImpact ? "선택 장면" : "임팩트"} {offset < 0 ? "전" : "후"}</button>; })}
        </div>
        <p className="text-xs leading-5 text-muted-foreground">{active === "head" ? "점선 십자는 시작 구간의 코 위치입니다. 얼굴 회전도 위치 변화로 보일 수 있습니다." : "점선은 시작 구간의 골반 중심입니다. 엉덩이 윤곽선이나 실제 회전 깊이는 아닙니다."} 기준점과 현재 점은 주변 관측의 중앙값이라 실제 위치와 조금 다를 수 있습니다. 카메라 움직임도 화면상 변화에 포함됩니다.</p>
      </>}
      <details><summary className="text-xs text-muted-foreground">기준선 해석 안내</summary><p className="text-xs leading-5 text-muted-foreground">고정된 후방 촬영에서 확인하세요. 화면상 이동만 표시하며, 머리 고정·얼리 익스텐션의 좋고 나쁨을 판정하지 않습니다.</p></details>
    </>}
  </section>;
}

export function MovementGuideOverlay({ guide, kind, timeMs, referenceOnly = false }: { guide: MovementGuide; kind: GuideKind; timeMs: number; referenceOnly?: boolean }) {
  const track = guide.tracks?.[kind] ?? guide.partialTracks?.[kind];
  if (!track) return null;
  const current = referenceOnly ? null : guidePointAt(track,timeMs), base = track.baseline;
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
