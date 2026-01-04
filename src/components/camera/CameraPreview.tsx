import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { LiveOverlay } from "@/components/camera/LiveOverlay";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { LiveOverlayBox } from "@/types/session";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type CameraPreviewProps = {
  isActive: boolean;
  streamUrl: string | null;
  width: number;
  height: number;
  fps: number;
  embedded?: boolean;
  onChangeResolution: (width: number, height: number) => void;
  onChangeFps: (fps: number) => void;
  onStart: () => void;
  onStop: () => void;
  onStreamError?: () => void;
  error?: string | null;
  startDisabled?: boolean;
  statusOverlay?: string | null;
  overlayBoxes?: LiveOverlayBox[];
  overlayEnabled?: boolean;
};

const resolutionPresets = [
  { label: "640 x 640", width: 640, height: 640 },
  { label: "640 x 360", width: 640, height: 360 },
  // { label: "1280 x 720 (best)", width: 1280, height: 720 },
  // { label: "1280 x 1280", width: 1280, height: 1280 },
];

const fpsPresets = [5, 10, 15, 20];

export function CameraPreview({
  isActive,
  streamUrl,
  width,
  height,
  fps,
  embedded = false,
  onChangeResolution,
  onChangeFps,
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
  const currentResolution = `${width}x${height}`;
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
    <CardContent className={embedded ? "px-0 pt-0 space-y-4" : "space-y-4"}>
      {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">해상도 프리셋</p>

            <div className="flex flex-wrap gap-2">
              <Select
                value={currentResolution}
                onValueChange={(value) => {
                  const [w, h] = value.split("x").map(Number);
                  if (!Number.isNaN(w) && !Number.isNaN(h)) {
                    onChangeResolution(w, h);
                  }
                }}
              >
                <SelectTrigger className="w-[200px] bg-white">
                  <SelectValue placeholder="해상도 선택" />
                </SelectTrigger>
                <SelectContent className="bg-white">
                    {resolutionPresets.map((preset) => {
                      const value = `${preset.width}x${preset.height}`;
                      return (
                        <SelectItem value={value} key={preset.label}>
                          {preset.label}
                        </SelectItem>
                      );
                    })}
                </SelectContent>
              </Select>
            </div>
            {/* <div className="flex flex-wrap gap-2">
              {resolutionPresets.map((preset) => {
                const active = width === preset.width && height === preset.height;
                return (
                  <Button
                    key={preset.label}
                    type="button"
                    variant={active ? "default" : "outline"}
                    size="sm"
                    fullWidth={false}
                    className={cn(
                      "rounded-full px-3 py-1 text-xs",
                      active && "bg-blue-50 text-blue-700 hover:bg-blue-100"
                    )}
                    onClick={() => onChangeResolution(preset.width, preset.height)}
                  >
                    {preset.label}
                  </Button>
                );
              })}
            </div> */}
          </div>
          {/* FPS는 15 고정 */}
        </div>

        <div className="p-3 border rounded-xl border-border bg-muted/40">
          <div
            ref={previewWrapRef}
            className="relative w-full overflow-hidden rounded-lg border border-border bg-black/70"
            style={{ aspectRatio: `${width} / ${height}`, minHeight: 220 }}
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
                {statusOverlay && (
                  <span className="absolute left-2 top-2 rounded-full bg-black/70 px-3 py-1 text-xs font-semibold text-white">
                    {statusOverlay}
                  </span>
                )}
              </>
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <p className="text-sm text-slate-200">프리뷰가 꺼져 있습니다.</p>
              </div>
            )}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            모바일/핫스팟에서는 낮은 해상도·FPS로 시작하세요. 프리뷰를 끄면 서버 스트림 연결도
            해제됩니다.
          </p>
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
