import { useRef } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { AnalysisResult, SwingEventKey } from "../../types/shots";

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
    <Card>
      <CardHeader className="p-4 pb-2">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-lg">분석 영상</CardTitle>
            <CardDescription className="text-xs">DTL 단일 카메라 기준</CardDescription>
          </div>
          <span className="text-xs text-muted-foreground">DTL 기준</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 p-4 pt-0">
        {videoUrl ? (
          <video
            ref={videoRef}
            key={videoUrl}
            className={cn(
              "w-full max-h-[36vh] rounded-xl border border-border bg-black object-contain transition md:max-h-[44vh] xl:max-h-[52vh]",
              isModalOpen ? "pointer-events-none opacity-0" : "opacity-100"
            )}
            controls
            preload="metadata"
            src={videoUrl}
            aria-hidden={isModalOpen}
          >
            브라우저에서 video 태그를 지원하지 않습니다.
          </video>
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-muted/40 px-4 py-6 text-sm text-muted-foreground">
            선택된 영상이 없습니다. 업로드 후 분석 탭에서 확인하세요.
          </div>
        )}

        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">스윙 이벤트 타임라인</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {(Object.keys(EVENT_LABELS) as SwingEventKey[]).map((key) => {
              const event = events?.[key];
              const disabled = !event;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleSeek(key)}
                  disabled={disabled}
                  className={cn(
                    "min-w-[104px] rounded-lg border px-3 py-2 text-left text-sm font-semibold transition",
                    disabled
                      ? "cursor-not-allowed border-border bg-muted/60 text-muted-foreground"
                      : "border-sky-300/30 bg-sky-400/10 text-sky-100 hover:bg-sky-400/15"
                  )}
                >
                  <span className="block text-xs text-muted-foreground">{EVENT_LABELS[key]}</span>
                  <span className="text-sm">
                    {event ? `${Math.round(event.timeMs)} ms` : "-"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
