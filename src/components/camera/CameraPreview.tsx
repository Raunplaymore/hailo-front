import { useEffect, useRef } from "react";
import { Camera, Radio, WifiOff } from "lucide-react";

import { LiveOverlay } from "@/components/camera/LiveOverlay";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { LiveOverlayBox } from "@/types/session";

type CameraPreviewProps = {
  isActive: boolean;
  streamUrl: string | null;
  width: number;
  height: number;
  embedded?: boolean;
  onStart: () => void;
  onStop: () => void;
  onStreamError?: () => void;
  startDisabled?: boolean;
  statusOverlay?: string | null;
  overlayBoxes?: LiveOverlayBox[];
  overlayEnabled?: boolean;
};

export function CameraPreview({
  isActive,
  streamUrl,
  width,
  height,
  embedded = false,
  onStart,
  onStop,
  onStreamError,
  startDisabled = false,
  statusOverlay = null,
  overlayBoxes = [],
  overlayEnabled = false,
}: CameraPreviewProps) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const previewWrapRef = useRef<HTMLDivElement | null>(null);
  const handleStopClick = () => {
    if (imgRef.current) {
      imgRef.current.src = "";
    }
    onStop();
  };
  const handleToggleChange = (checked: boolean) => {
    if (checked) {
      if (!startDisabled) {
        onStart();
      }
      return;
    }
    handleStopClick();
  };

  useEffect(() => {
    // isActive=false 또는 streamUrl이 비어질 때 명시적으로 src를 비워 스트림을 끊어준다.
    if (!isActive || !streamUrl) {
      if (imgRef.current) {
        imgRef.current.src = "";
      }
    }
    return () => {
      if (imgRef.current) {
        imgRef.current.src = "";
      }
    };
  }, [isActive, streamUrl]);

  const content = (
    <CardContent className={embedded ? "px-0 pb-0 pt-0" : "space-y-4"}>
      <section className="overflow-hidden rounded-2xl border border-white/10 bg-card/90 shadow-2xl shadow-black/25">
        <div className="flex flex-col gap-3 border-b border-border/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "flex size-8 items-center justify-center rounded-lg border",
                  isActive
                    ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
                    : "border-border bg-muted/60 text-muted-foreground"
                )}
              >
                {isActive ? (
                  <Radio className="size-4" aria-hidden="true" />
                ) : (
                  <WifiOff className="size-4" aria-hidden="true" />
                )}
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">Live Preview</p>
                <p className="text-xs text-muted-foreground">
                  {width} x {height} · 15fps · AI overlay ready
                </p>
              </div>
            </div>
          </div>
          <label className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-border bg-muted/40 px-3 text-sm text-muted-foreground sm:min-w-40">
            <span>{isActive ? "프리뷰 ON" : "프리뷰 OFF"}</span>
            <Switch
              checked={isActive}
              onCheckedChange={handleToggleChange}
              disabled={!isActive && startDisabled}
              aria-label="프리뷰 켜기/끄기"
            />
          </label>
        </div>

        <div
          ref={previewWrapRef}
          className="relative w-full overflow-hidden bg-black"
          style={{ aspectRatio: `${width} / ${height}`, minHeight: 280 }}
        >
          {isActive && streamUrl ? (
            <>
              <img
                ref={imgRef}
                key={streamUrl}
                src={streamUrl}
                alt="Camera preview"
                className="absolute inset-0 h-full w-full object-contain"
                onError={() => onStreamError?.()}
              />
              {overlayEnabled && (
                <LiveOverlay
                  containerRef={previewWrapRef}
                  boxes={overlayBoxes}
                  sourceWidth={width}
                  sourceHeight={height}
                />
              )}
              <div className="absolute left-3 top-3 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/25 bg-black/70 px-3 py-1 text-xs font-semibold text-emerald-100 backdrop-blur">
                  <span className="size-1.5 animate-pulse rounded-full bg-emerald-300" aria-hidden="true" />
                  LIVE
                </span>
                {statusOverlay && (
                  <span className="rounded-full border border-sky-300/25 bg-black/70 px-3 py-1 text-xs font-semibold text-sky-100 backdrop-blur">
                    {statusOverlay}
                  </span>
                )}
              </div>
              <span className="absolute bottom-3 right-3 rounded-full border border-white/10 bg-black/65 px-3 py-1 text-xs font-medium text-white/80 backdrop-blur">
                {width} x {height}
              </span>
            </>
          ) : (
            <div className="flex h-full min-h-[280px] flex-col items-center justify-center gap-4 px-6 text-center">
              <div className="flex size-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-muted-foreground">
                <Camera className="size-7" aria-hidden="true" />
              </div>
              <div>
                <p className="text-base font-semibold text-foreground">프리뷰 대기</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  현재 설정: {width} x {height} · 15fps
                </p>
              </div>
              <Button
                type="button"
                size="lg"
                fullWidth={false}
                onClick={onStart}
                disabled={startDisabled}
                className="min-w-40"
              >
                프리뷰 시작
              </Button>
            </div>
          )}
        </div>
      </section>
    </CardContent>
  );

  if (embedded) {
    return content;
  }

  return (
    <Card>
      {content}
    </Card>
  );
}
