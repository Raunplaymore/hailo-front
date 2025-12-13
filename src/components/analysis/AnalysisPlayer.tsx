import { useRef } from "react";
import { AnalysisResult, SwingEventKey } from "../../types/shots";
import { Card } from "../Card";

type AnalysisPlayerProps = {
  videoUrl?: string;
  events?: AnalysisResult["events"];
  isModalOpen?: boolean;
};

const EVENT_LABELS: Record<SwingEventKey, string> = {
  address: "Address",
  top: "Top",
  impact: "Impact",
  finish: "Finish",
};

export function AnalysisPlayer({ videoUrl, events, isModalOpen }: AnalysisPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const handleSeek = (key: SwingEventKey) => {
    const timeMs = events?.[key]?.timeMs;
    if (timeMs == null) return;

    const video = videoRef.current;
    if (!video) return;

    const seekTo = timeMs / 1000;
    const apply = () => {
      video.currentTime = seekTo;
    };

    if (video.readyState < 1) {
      const onLoaded = () => {
        apply();
        video.removeEventListener("loadedmetadata", onLoaded);
      };
      video.addEventListener("loadedmetadata", onLoaded);
      video.load();
    } else {
      apply();
    }
  };

  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">원본 영상</p>
        <span className="text-xs text-slate-400">DTL 단일 카메라 기준</span>
      </div>
      {videoUrl ? (
        <video
          ref={videoRef}
          key={videoUrl}
          className={`w-full rounded-lg border border-slate-200 max-h-[600px] object-contain bg-black transition ${
            isModalOpen ? "opacity-0 pointer-events-none" : "opacity-100"
          }`}
          controls
          preload="metadata"
          src={videoUrl}
          aria-hidden={isModalOpen}
        >
          브라우저에서 video 태그를 지원하지 않습니다.
        </video>
      ) : (
        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
          선택된 영상이 없습니다. 업로드 후 분석 탭에서 확인하세요.
        </div>
      )}

      <div className="space-y-2">
        <p className="text-sm text-slate-500">스윙 이벤트 타임라인</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {(Object.keys(EVENT_LABELS) as SwingEventKey[]).map((key) => {
            const event = events?.[key];
            const disabled = !event;
            return (
              <button
                key={key}
                type="button"
                onClick={() => handleSeek(key)}
                disabled={disabled}
                className={`rounded-lg border px-3 py-2 text-left text-sm font-semibold transition ${
                  disabled
                    ? "border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed"
                    : "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                }`}
              >
                <span className="block text-xs text-slate-500">{EVENT_LABELS[key]}</span>
                <span className="text-base">{event ? `${Math.round(event.timeMs)} ms` : "-"}</span>
              </button>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
