import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { LiveOverlay } from "@/components/camera/LiveOverlay";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  error?: string | null;
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
  error,
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
  const startLabel = error ? "프리뷰 재연결" : "프리뷰 켜기";

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

  const header = (
    <CardHeader className={embedded ? "px-0 pb-2 flex-row items-start justify-between gap-3" : "flex-row items-start justify-between gap-3"}>
      <div>
        <p className="text-xs text-muted-foreground">MJPEG 스트림</p>
        <CardTitle className="text-xl">실시간 프리뷰</CardTitle>
      </div>
      <div className="flex gap-2">
        {isActive ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            fullWidth={false}
            className="rounded-lg"
            onClick={handleStopClick}
          >
            프리뷰 끄기
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            fullWidth={false}
            className="rounded-lg"
            onClick={onStart}
            disabled={startDisabled}
          >
            {startLabel}
          </Button>
        )}
      </div>
    </CardHeader>
  );

  const content = (
    <CardContent className={embedded ? "pb-0 px-0 pt-0 space-y-4" : "space-y-4"}>
      {error && <p className="text-sm text-destructive">{error}</p>}

        <p className="text-xs text-muted-foreground">
          프리뷰는 15fps 고정이며 해상도 프리셋은 설정 탭에서 선택합니다.
        </p>

        <div className="p-3 border rounded-xl border-border bg-muted/40">
          <div
            ref={previewWrapRef}
            className="relative w-full overflow-hidden border rounded-lg border-border bg-black/70"
            style={{ aspectRatio: `${width} / ${height}`, minHeight: 220 }}
          >
            {isActive && streamUrl ? (
              <>
                <img
                  ref={imgRef}
                  key={streamUrl}
                  src={streamUrl}
                  alt="Camera preview"
                  className="absolute inset-0 object-contain w-full h-full"
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
                {statusOverlay && (
                  <span className="absolute px-3 py-1 text-xs font-semibold text-white rounded-full left-2 top-2 bg-black/70">
                    {statusOverlay}
                  </span>
                )}
              </>
            ) : (
              <div className="flex items-center justify-center w-full h-full">
                <p className="text-sm text-slate-200">프리뷰가 꺼져 있습니다.</p>
              </div>
            )}
          </div>
        </div>
    </CardContent>
  );

  if (embedded) {
    return (
      <div className="space-y-2">
        {header}
        {content}
      </div>
    );
  }

  return (
    <Card>
      {header}
      {content}
    </Card>
  );
}
