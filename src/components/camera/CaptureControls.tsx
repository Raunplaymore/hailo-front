import { useState } from "react";

import { Button as ShadButton } from "@/components/ui/button";
import {
  ButtonGroup,
  ButtonGroupText,
} from "@/components/ui/button-group"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { Label } from "@/components/ui/label"
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
};

const captureResolutionPresets = [
  { label: "640 x 360", width: 640, height: 360 },
  { label: "640 x 640", width: 640, height: 640 },
  { label: "1280 x 720", width: 1280, height: 720 },
  { label: "1280 x 1280", width: 1280, height: 1280 },
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
  onCaptureMp4,
  onCaptureAnalyze,
  busyMessage,
}: CaptureControlsProps) {
  const [selectedAction, setSelectedAction] = useState<"video" | "swing">("video");

  const handleAction = () => {
    if (selectedAction === "video") {
      onCaptureMp4(durationSec || 5);
    } else {
      onCaptureAnalyze(durationSec || 5);
    }
  };

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm text-slate-500">캡처</p>
          <h2 className="text-lg font-semibold text-slate-900">녹화 / 사진</h2>
        </div>
      </div>
      {busyMessage && <p className="mb-2 text-sm text-red-600">{busyMessage}</p>}
      {isBusy && (
        <p className="mb-2 text-sm text-amber-600">
          카메라 사용 중(스트리밍/녹화). 스트림을 끄거나 완료된 뒤에 캡처를 시도하세요.
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
        </div>
        <div className="space-y-3">
          <div className="grid w-full max-w-sm gap-6">
            <ButtonGroup>
              <ButtonGroupText asChild>
                <Label htmlFor="fps" className="inline-flex w-24 shrink-0">
                  fps
                </Label>
              </ButtonGroupText>
              <InputGroup>
                <InputGroupInput
                  id="fps"
                  placeholder="fps (0~60)"
                  onChange={(e) => onFpsChange(Number(e.target.value) || 0)}
                  min={10}
                  max={60}
                  value={fps} />
              </InputGroup>
            </ButtonGroup>
          </div>
          <div className="grid w-full max-w-sm gap-6">
            <ButtonGroup>
              <ButtonGroupText asChild>
                <Label htmlFor="durationSec" className="inline-flex w-24 shrink-0">
                  duration
                </Label>
              </ButtonGroupText>
              <InputGroup>
                <InputGroupInput
                  id="durationSec"
                  className="w-40"
                  placeholder="durationSec (0~30)"
                  onChange={(e) => onDurationChange(Number(e.target.value) || 0)}
                  min={10}
                  max={30}
                  value={durationSec} />
              </InputGroup>
              <ButtonGroupText>초</ButtonGroupText>
            </ButtonGroup>
          </div>
        </div>
      </div>
      <div className="grid gap-3 mt-4 md:grid-cols-2">
        <ButtonGroup className="w-full">
          <ShadButton
            onClick={() => setSelectedAction("video")}
            disabled={isBusy}
            variant={selectedAction === "video" ? "primary" : "outline"}
          >
            🎥 Video
          </ShadButton>
          <ShadButton
            onClick={() => setSelectedAction("swing")}
            disabled={isBusy}
            variant={selectedAction === "swing" ? "primary" : "outline"}
          >
            ⛳️ Swing
          </ShadButton>
        </ButtonGroup>
      </div>
      <div className="grid gap-3 mt-4 md:grid-cols-2">
        <ShadButton variant="primary" onClick={handleAction} disabled={isBusy || isCapturing}>
          {isCapturing ? "진행 중..." : "Action!"}
        </ShadButton>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        캡처 요청 중에는 상태 스피너가 표시됩니다. 409 응답 시 “카메라 사용 중”으로 안내합니다.
      </p>
    </Card>
  );
}
