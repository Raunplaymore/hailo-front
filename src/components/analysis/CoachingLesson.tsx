import { useEffect, useState, type RefObject } from "react";

export function CoachingLesson({ topic, referenceVideo = false, active = true, sourceVideoRef, onReferenceOpen }: {
  topic: "pelvis" | "head"; referenceVideo?: boolean; active?: boolean;
  sourceVideoRef?: RefObject<HTMLVideoElement | null>; onReferenceOpen?: () => void;
}) {
  const pelvis = topic === "pelvis";
  const [showReference, setShowReference] = useState(false);
  useEffect(() => { if (!active || !pelvis) setShowReference(false); }, [active, pelvis]);
  useEffect(() => {
    const video = sourceVideoRef?.current;
    if (!showReference || !video) return;
    const close = () => setShowReference(false);
    video.addEventListener("play", close);
    return () => video.removeEventListener("play", close);
  }, [showReference, sourceVideoRef]);
  return <details className="group rounded-xl border border-border bg-card" onToggle={event => { if (!event.currentTarget.open) setShowReference(false); }}>
    <summary className="min-h-12 cursor-pointer rounded-xl px-4 py-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      교습 원리와 연습
      <span className="mt-1 block pl-4 text-xs font-normal text-muted-foreground">{pelvis ? "골반이 돌아갈 공간" : "머리는 안정적으로, 회전은 자연스럽게"}</span>
    </summary>
    <div className="space-y-4 border-t border-border px-4 pb-4 pt-3">
      <p className="text-xs leading-5 text-muted-foreground">내 영상의 판정과 별개인 일반 교습 안내입니다.</p>
      {pelvis ? <>
        <p className="text-sm leading-6">얼리 익스텐션은 다운스윙에서 몸이 일찍 펴지며 골반이 준비 자세보다 공 쪽으로 가까워지는 패턴을 말합니다. 이때 팔과 클럽이 지나갈 공간이 줄어들 수 있습니다.</p>
        {referenceVideo && <section className="space-y-2 rounded-lg bg-muted/50 p-3" aria-label="전문가 동작 시범">
          <p className="text-sm font-semibold">전문가 동작 시범</p>
          <p className="text-xs text-muted-foreground">Dave Phillips · Titleist · YouTube · 영어 · 약 2분 30초</p>
          <p className="text-xs leading-5 text-muted-foreground">준비 자세부터 내려오는 구간까지 엉덩이 뒤쪽과 기준선의 관계를 보세요. 아래에 한국어 연습 요약이 있습니다. 촬영 각도와 체형이 다르므로 모양을 그대로 맞출 필요는 없습니다.</p>
          <button type="button" aria-expanded={showReference} className="min-h-11 w-full rounded-lg border border-border px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => {
            if (!showReference) onReferenceOpen?.();
            setShowReference(!showReference);
          }}>{showReference ? "시범 영상 닫기" : "시범 영상 보기"}</button>
          {showReference && <div className="space-y-2">
            <iframe className="aspect-video w-full rounded-lg border-0" title="Dave Phillips 골반 움직임 시범" src="https://www.youtube-nocookie.com/embed/IbslJLSPA20?rel=0" referrerPolicy="strict-origin-when-cross-origin" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
            <a href="https://www.youtube.com/watch?v=IbslJLSPA20" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-xs font-semibold text-primary underline">YouTube에서 열기</a>
          </div>}
        </section>}
        <figure className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <PelvisIllustration thrust={false} />
            <PelvisIllustration thrust />
          </div>
          <figcaption className="text-xs leading-5 text-muted-foreground">후방(DTL)에서 보는 방향을 단순화한 개념도입니다. 점선은 준비 자세의 엉덩이 뒤쪽 기준이며, 개인별 정답 각도나 실제 측정값을 뜻하지 않습니다.</figcaption>
        </figure>
        <div className="space-y-2 rounded-lg bg-muted/50 p-3">
          <h4 className="text-sm font-semibold">공 없이 천천히 느껴보기</h4>
          <p className="break-keep text-xs leading-5 text-muted-foreground">목표는 공을 보내는 방향입니다. 오른손 스윙은 왼쪽 엉덩이가 목표 쪽, 오른쪽이 반대쪽입니다.</p>
          <ol className="list-decimal space-y-2 break-keep pl-4 text-sm leading-6">
            <li>편하게 준비한 뒤, 작은 백스윙에서 목표 반대쪽 엉덩이를 뒤로 돌려봅니다.</li>
            <li>천천히 내려오며 목표 쪽 엉덩이가 뒤로 돌 공간을 만듭니다.</li>
            <li>몸을 억지로 낮게 붙잡지 말고 자연스럽게 피니시합니다.</li>
          </ol>
          <p className="text-xs leading-5 text-muted-foreground">힘으로 엉덩이를 계속 뒤로 밀기보다 회전할 공간을 느껴보세요. 불편하면 멈추고 동작 범위를 줄이세요.</p>
        </div>
      </> : <>
        <p className="text-sm leading-6">머리의 안정과 자연스러운 회전을 함께 봅니다. 얼굴이 돌아가는 움직임까지 억지로 막거나, 피니시까지 고개를 붙잡아 둘 필요는 없습니다.</p>
        <div className="space-y-2 rounded-lg bg-muted/50 p-3">
          <h4 className="text-sm font-semibold">공 없이 작은 스윙으로 확인하기</h4>
          <p className="text-sm leading-6">편안한 준비 자세에서 천천히 몸을 돌리고, 얼굴과 목도 자연스럽게 따라가도록 합니다. 임팩트 전후의 몸통 변화와 얼굴 회전을 나누어 살펴보세요.</p>
          <p className="text-xs leading-5 text-muted-foreground">코 한 점의 이동에는 얼굴 회전이 섞입니다. 코의 이동량만으로 머리가 불안정하다고 판단하지 않습니다.</p>
        </div>
      </>}
      <a
        href={pelvis ? "https://www.titleist.com/videos/instruction/early-extension-swing-fault" : "https://www.titleist.com/videos/instruction/golf-myths-keep-your-head-still"}
        target="_blank" rel="noopener noreferrer"
        className="flex min-h-12 items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span>{pelvis ? "Dave Phillips · 골반 움직임 교습" : "Jonathan Yarwood · 머리 움직임 교습"}<span className="mt-1 block text-xs font-normal text-muted-foreground">Titleist 원문 · 새 창</span></span>
        <span aria-hidden="true">↗</span>
      </a>
    </div>
  </details>;
}

function PelvisIllustration({ thrust }: { thrust: boolean }) {
  const label = thrust ? "공 쪽으로 밀림" : "뒤쪽 공간에서 회전";
  const color = thrust ? "#fbbf24" : "#34d399";
  const hipX = thrust ? 82 : 51;
  return <div className="overflow-hidden rounded-lg border border-border bg-background p-2">
    <p className="text-center text-xs font-semibold" style={{ color }}>{label}</p>
    <svg viewBox="0 0 160 150" role="img" aria-label={`${label}. 공은 오른쪽, 점선은 준비 자세의 엉덩이 뒤쪽 기준선입니다.`} className="mt-1 block w-full">
      <path d="M 15 130 H 150" stroke="currentColor" opacity=".2" />
      <path d="M 40 25 V 126" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 4" opacity=".5" />
      <path d="M 51 71 L 78 39 M 51 71 L 65 99 L 59 128 M 78 45 L 100 80" fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" opacity=".12" />
      <circle cx="85" cy="29" r="8" fill="currentColor" opacity=".12" />
      <path d={`M ${hipX} 71 L ${thrust ? 94 : 79} 40 M ${hipX} 71 L 70 99 L 64 128 M ${thrust ? 94 : 79} 46 L 107 80`} fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={thrust ? 99 : 86} cy="29" r="8" fill="none" stroke={color} strokeWidth="3" />
      <ellipse cx={hipX} cy="71" rx="11" ry="8" fill={color} fillOpacity=".2" stroke={color} strokeWidth="2" />
      {thrust ? <path d="M 45 89 H 89 M 83 84 L 89 89 L 83 94" fill="none" stroke={color} strokeWidth="2" /> : <path d="M 58 58 C 32 47 27 76 43 85 M 35 85 L 43 85 L 41 77" fill="none" stroke={color} strokeWidth="2" />}
      <circle cx="140" cy="127" r="3" fill="currentColor" />
      <text x="111" y="116" fill="currentColor" fontSize="11" opacity=".75">공 방향 →</text>
    </svg>
  </div>;
}
