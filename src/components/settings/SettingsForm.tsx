import { useMemo } from "react";
import { Card } from "../Card";
import { Button } from "../Button";

export type UploadSettings = {
  club?: string;
  lens?: string;
  fps?: number;
  roi?: string;
  cam_distance?: number;
  cam_height?: number;
  h_fov?: number;
  v_fov?: number;
  impact_frame?: number;
  track_frames?: number;
};

type SettingsFormProps = {
  value: UploadSettings;
  lensOptions?: string[];
  lensError?: string | null;
  onChange: (next: UploadSettings) => void;
  onSubmit?: () => void;
};

export function SettingsForm({ value, lensOptions = [], lensError, onChange, onSubmit }: SettingsFormProps) {
  const toNumber = (v: string) => {
    const n = Number(v);
    return Number.isNaN(n) ? undefined : n;
  };

  const handleChange = (key: keyof UploadSettings, v: string) => {
    const numericKeys: (keyof UploadSettings)[] = [
      "fps",
      "cam_distance",
      "cam_height",
      "h_fov",
      "v_fov",
      "impact_frame",
      "track_frames",
    ];
    const nextVal = numericKeys.includes(key) ? toNumber(v) : v;
    onChange({ ...value, [key]: v === "" ? undefined : nextVal });
  };

  const clubOptions = useMemo(
    () => [
      { value: "driver", label: "Driver" },
      { value: "wood", label: "Fairway Wood" },
      { value: "hybrid", label: "Hybrid" },
      { value: "iron", label: "Iron" },
      { value: "wedge", label: "Wedge" },
      { value: "putter", label: "Putter" },
      { value: "unknown", label: "기타/미지정" },
    ],
    []
  );

  return (
    <Card className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">업로드/분석 설정</h2>
        <p className="text-sm text-slate-600">분석 시 함께 전달할 선택 옵션들입니다.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-1 text-sm text-slate-700">
          클럽
          <select
            value={value.club ?? "driver"}
            onChange={(e) => handleChange("club", e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            {clubOptions.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1 text-sm text-slate-700">
          FPS (선택)
          <input
            type="number"
            min={1}
            placeholder="예: 60"
            value={value.fps ?? ""}
            onChange={(e) => handleChange("fps", e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          />
        </label>

        <label className="grid gap-1 text-sm text-slate-700 md:col-span-2">
          ROI [x,y,w,h] (JSON)
          <input
            type="text"
            placeholder='예: [100,200,400,400]'
            value={value.roi ?? ""}
            onChange={(e) => handleChange("roi", e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          />
        </label>

        <label className="grid gap-1 text-sm text-slate-700">
          카메라-볼 거리(m)
          <input
            type="number"
            step="0.1"
            min={0}
            placeholder="예: 3.0"
            value={value.cam_distance ?? ""}
            onChange={(e) => handleChange("cam_distance", e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          />
        </label>

        <label className="grid gap-1 text-sm text-slate-700">
          카메라 높이(m)
          <input
            type="number"
            step="0.1"
            min={0}
            placeholder="예: 1.2"
            value={value.cam_height ?? ""}
            onChange={(e) => handleChange("cam_height", e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          />
        </label>

        <label className="grid gap-1 text-sm text-slate-700 md:col-span-2">
          렌즈 선택
          <select
            value={value.lens ?? ""}
            onChange={(e) => handleChange("lens", e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="" disabled>
              렌즈를 선택하세요
            </option>
            {lensOptions.map((lens) => (
              <option key={lens} value={lens}>
                {lens}
              </option>
            ))}
          </select>
          <span className="text-xs text-slate-500">
            {lensError || "렌즈 선택 시 h_fov/v_fov가 자동 입력됩니다."}
          </span>
        </label>

        <label className="grid gap-1 text-sm text-slate-700">
          수평 FOV(도)
          <input
            type="number"
            step="0.1"
            min={0}
            placeholder="예: 60"
            value={value.h_fov ?? ""}
            onChange={(e) => handleChange("h_fov", e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          />
        </label>

        <label className="grid gap-1 text-sm text-slate-700">
          수직 FOV(도)
          <input
            type="number"
            step="0.1"
            min={0}
            placeholder="예: 34"
            value={value.v_fov ?? ""}
            onChange={(e) => handleChange("v_fov", e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          />
        </label>

        <label className="grid gap-1 text-sm text-slate-700">
          임팩트 프레임 번호
          <input
            type="number"
            min={0}
            placeholder="예: 70"
            value={value.impact_frame ?? ""}
            onChange={(e) => handleChange("impact_frame", e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          />
        </label>

        <label className="grid gap-1 text-sm text-slate-700">
          추적 프레임 수
          <input
            type="number"
            min={1}
            placeholder="기본 20"
            value={value.track_frames ?? ""}
            onChange={(e) => handleChange("track_frames", e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          />
        </label>
      </div>

      {onSubmit && (
        <div className="flex justify-end">
          <Button className="px-3 py-1 text-sm" type="button" variant="primary" fullWidth={false} onClick={onSubmit}>
            저장
          </Button>
        </div>
      )}
    </Card>
  );
}
