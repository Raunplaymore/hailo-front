import { Button } from "../Button";
import { Card } from "../Card";
import { useEffect, useRef } from "react";

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
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm text-slate-500">MJPEG 스트림</p>
          <h2 className="text-lg font-semibold text-slate-900">실시간 프리뷰</h2>
        </div>
        <div className="flex gap-2">
          {isActive ? (
            <Button
              type="button"
              variant="outline"
              className="w-auto px-3 py-1 text-sm"
              onClick={handleStopClick}
            >
              프리뷰 끄기
            </Button>
          ) : (
            <Button
              type="button"
              className="w-auto px-3 py-1 text-sm"
              onClick={onStart}
              disabled={startDisabled}
            >
              프리뷰 켜기
            </Button>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-red-600 mb-2">{error}</p>}

      <div className="grid gap-3 md:grid-cols-2 mb-3">
        <div className="space-y-2">
          <p className="text-xs text-slate-500">해상도 프리셋</p>
          <div className="flex flex-wrap gap-2">
            {resolutionPresets.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => onChangeResolution(preset.width, preset.height)}
                className={`px-3 py-1 rounded-full border text-xs ${
                  width === preset.width && height === preset.height
                    ? "border-blue-500 text-blue-600 bg-blue-50"
                    : "border-slate-200 text-slate-700 bg-slate-50 hover:border-blue-300"
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-xs text-slate-500">FPS</p>
          <div className="flex flex-wrap gap-2">
            {fpsPresets.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => onChangeFps(item)}
                className={`px-3 py-1 rounded-full border text-xs ${
                  fps === item
                    ? "border-blue-500 text-blue-600 bg-blue-50"
                    : "border-slate-200 text-slate-700 bg-slate-50 hover:border-blue-300"
                }`}
              >
                {item} fps
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-600">
            <input
              type="number"
              value={fps}
              min={5}
              max={30}
              onChange={(e) => onChangeFps(Number(e.target.value) || 0)}
              className="w-20 rounded-lg border border-slate-200 px-2 py-1 text-sm"
            />
            직접 입력
          </label>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
        {isActive && streamUrl ? (
          <img
            ref={imgRef}
            key={streamUrl}
            src={streamUrl}
            alt="Camera preview"
            className="w-full rounded-lg border border-slate-200 object-contain bg-black max-h-[360px]"
          />
        ) : (
          <p className="text-sm text-slate-500">프리뷰가 꺼져 있습니다.</p>
        )}
        <p className="text-xs text-slate-500 mt-2">
          모바일/핫스팟에서는 낮은 해상도·FPS로 시작하세요. 프리뷰를 끄면 서버 스트림 연결도 해제됩니다.
        </p>
      </div>
    </Card>
  );
}
