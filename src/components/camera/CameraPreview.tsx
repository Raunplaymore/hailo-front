import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

import {
  Select,
  SelectLabel,
  SelectGroup,
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
  onChangeResolution: (width: number, height: number) => void;
  onChangeFps: (fps: number) => void;
  onStart: () => void;
  onStop: () => void;
  error?: string | null;
  startDisabled?: boolean;
};

const resolutionPresets = [
  { label: "640 x 360 (저화질)", width: 640, height: 360 },
  { label: "854 x 480 (밸런스)", width: 854, height: 480 },
  { label: "1280 x 720", width: 1280, height: 720 },
];

const fpsPresets = [10, 15, 20];

export function CameraPreview({
  isActive,
  streamUrl,
  width,
  height,
  fps,
  onChangeResolution,
  onChangeFps,
  onStart,
  onStop,
  error,
  startDisabled = false,
}: CameraPreviewProps) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const currentResolution = `${width}x${height}`;
  const handleStopClick = () => {
    if (imgRef.current) {
      imgRef.current.src = "";
    }
    onStop();
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

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3">
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
              프리뷰 켜기
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
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
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">FPS</p>
            <div className="flex flex-wrap gap-2">
              {fpsPresets.map((item) => {
                const active = fps === item;
                return (
                  <Button
                    key={item}
                    type="button"
                    variant={active ? "default" : "outline"}
                    size="sm"
                    fullWidth={false}
                    className={cn(
                      "rounded-full px-3 py-1 text-xs",
                      active && "bg-blue-50 text-blue-700 hover:bg-blue-100"
                    )}
                    onClick={() => onChangeFps(item)}
                  >
                    {item} fps
                  </Button>
                );
              })}
            </div>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="number"
                value={fps}
                min={5}
                max={30}
                onChange={(e) => onChangeFps(Number(e.target.value) || 0)}
                className="w-24 px-2 text-sm border rounded-lg shadow-sm h-9 border-input bg-background focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
              직접 입력
            </label>
          </div>
        </div>

        <div className="p-3 border rounded-xl border-border bg-muted/40">
          {isActive && streamUrl ? (
            <img
              ref={imgRef}
              key={streamUrl}
              src={streamUrl}
              alt="Camera preview"
              className="w-full rounded-lg border border-border object-contain bg-black max-h-[360px]"
            />
          ) : (
            <p className="text-sm text-muted-foreground">프리뷰가 꺼져 있습니다.</p>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            모바일/핫스팟에서는 낮은 해상도·FPS로 시작하세요. 프리뷰를 끄면 서버 스트림 연결도
            해제됩니다.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
