import { Button } from "../Button";
import { Card } from "../Card";

type CaptureControlsProps = {
  isCapturing: boolean;
  isBusy?: boolean;
  resolution: { width: number; height: number };
  fps: number;
  durationSec: number;
  onResolutionChange: (width: number, height: number) => void;
  onFpsChange: (fps: number) => void;
  onDurationChange: (seconds: number) => void;
  onCaptureJpg: () => void;
  onCaptureMp4: (seconds: number) => void;
  onCaptureAnalyze: (seconds: number) => void;
  busyMessage?: string | null;
  streamClients?: number;
};

const captureResolutionPresets = [
  { label: "1080p", width: 1920, height: 1080 },
  { label: "720p", width: 1280, height: 720 },
];

export function CaptureControls({
  isCapturing,
  isBusy = false,
  resolution,
  fps,
  durationSec,
  onResolutionChange,
  onFpsChange,
  onDurationChange,
  onCaptureJpg,
  onCaptureMp4,
  onCaptureAnalyze,
  busyMessage,
  streamClients,
}: CaptureControlsProps) {
  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm text-slate-500">캡처</p>
          <h2 className="text-lg font-semibold text-slate-900">녹화 / 사진</h2>
        </div>
      </div>
      {busyMessage && <p className="text-sm text-red-600 mb-2">{busyMessage}</p>}
      {isBusy && (
        <p className="text-sm text-amber-600 mb-2">
          카메라 사용 중(스트리밍/녹화). 스트림을 끄거나 완료된 뒤에 캡처를 시도하세요.
          {typeof streamClients === "number" && streamClients > 0 && ` 접속자: ${streamClients}명`}
        </p>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3">
          <p className="text-xs text-slate-500">해상도</p>
          <div className="flex flex-wrap gap-2">
            {captureResolutionPresets.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => onResolutionChange(preset.width, preset.height)}
                className={`px-3 py-1 rounded-full border text-xs ${
                  resolution.width === preset.width && resolution.height === preset.height
                    ? "border-blue-500 text-blue-600 bg-blue-50"
                    : "border-slate-200 text-slate-700 bg-slate-50 hover:border-blue-300"
                }`}
              >
                {preset.label} ({preset.width}x{preset.height})
              </button>
            ))}
          </div>
          <label className="block text-xs text-slate-600">
            커스텀 해상도
            <div className="flex gap-2 mt-1">
              <input
                type="number"
                value={resolution.width}
                onChange={(e) => onResolutionChange(Number(e.target.value) || 0, resolution.height)}
                className="w-24 rounded-lg border border-slate-200 px-2 py-1 text-sm"
              />
              <input
                type="number"
                value={resolution.height}
                onChange={(e) => onResolutionChange(resolution.width, Number(e.target.value) || 0)}
                className="w-24 rounded-lg border border-slate-200 px-2 py-1 text-sm"
              />
            </div>
          </label>
        </div>
        <div className="space-y-3">
          <label className="block text-xs text-slate-600">
            FPS (mp4)
            <input
              type="number"
              value={fps}
              onChange={(e) => onFpsChange(Number(e.target.value) || 0)}
              className="w-full rounded-lg border border-slate-200 px-2 py-1 text-sm mt-1"
              min={10}
              max={60}
            />
          </label>
          <label className="block text-xs text-slate-600">
            녹화 시간(sec)
            <input
              type="number"
              value={durationSec}
              onChange={(e) => onDurationChange(Number(e.target.value) || 0)}
              className="w-full rounded-lg border border-slate-200 px-2 py-1 text-sm mt-1"
              min={1}
              max={30}
            />
          </label>
        </div>
      </div>

      <div className="grid gap-3 mt-4 md:grid-cols-2">
        <Button
          type="button"
          onClick={onCaptureJpg}
          isLoading={isCapturing}
          loadingText="캡처 중..."
          disabled={isBusy}
        >
          사진 찍기 (JPG)
        </Button>
        <Button
          type="button"
          onClick={() => onCaptureMp4(5)}
          isLoading={isCapturing}
          loadingText="녹화 중..."
          disabled={isBusy}
        >
          녹화(MP4) 5초
        </Button>
        <Button
          type="button"
          onClick={() => onCaptureMp4(durationSec || 5)}
          isLoading={isCapturing}
          loadingText="녹화 중..."
          disabled={isBusy}
        >
          녹화(MP4) 사용자 지정
        </Button>
        <Button
          type="button"
          onClick={() => onCaptureAnalyze(durationSec || 5)}
          isLoading={isCapturing}
          loadingText="요청 중..."
          disabled={isBusy}
        >
          녹화 후 분석 요청
        </Button>
      </div>
      <p className="text-xs text-slate-500 mt-2">
        캡처 요청 중에는 상태 스피너가 표시됩니다. 409 응답 시 “카메라 사용 중”으로 안내합니다.
      </p>
    </Card>
  );
}
