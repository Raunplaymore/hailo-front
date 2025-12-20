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
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">원본 영상</p>
            <CardTitle className="text-lg">분석 영상</CardTitle>
            <CardDescription>DTL 단일 카메라 기준 영상입니다.</CardDescription>
          </div>
          <span className="text-xs text-muted-foreground">DTL 기준</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {videoUrl ? (
          <video
            ref={videoRef}
            key={videoUrl}
            className={cn(
              "w-full max-h-[600px] rounded-xl border border-border bg-black object-contain transition",
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
          <p className="text-sm text-muted-foreground">스윙 이벤트 타임라인</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
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
                    "rounded-lg border px-3 py-2 text-left text-sm font-semibold transition",
                    disabled
                      ? "cursor-not-allowed border-border bg-muted/60 text-muted-foreground"
                      : "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                  )}
                >
                  <span className="block text-xs text-muted-foreground">{EVENT_LABELS[key]}</span>
                  <span className="text-base">
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
