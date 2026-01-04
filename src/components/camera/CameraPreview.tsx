import { useEffect, useRef } from "react";

import { LiveOverlay } from "@/components/camera/LiveOverlay";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
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
    <CardContent className={embedded ? "pb-0 px-0 pt-0 space-y-4" : "space-y-4"}>
        <div className="p-3 border rounded-xl border-border bg-muted/40">
          <div className="flex items-center gap-2 pb-2 text-xs text-muted-foreground">
            프리뷰
            <Switch
              checked={isActive}
              onCheckedChange={handleToggleChange}
              disabled={!isActive && startDisabled}
              aria-label="프리뷰 켜기/끄기"
            />
          </div>
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
          {error && <p className="p-2 pb-0 text-sm text-destructive">{error}</p>}
        </div>
    </CardContent>
  );

  if (embedded) {
    return (
      <div className="space-y-2">
        {content}
      </div>
    );
  }

  return (
    <Card>
      {content}
    </Card>
  );
}
