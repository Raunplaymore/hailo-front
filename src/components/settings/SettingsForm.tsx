import { Card } from "../ui/card";
import { Button } from "../ui/button";

export type UploadSettings = {
  club?: string;
  viewpoint?: "down_the_line" | "face_on";
  handedness?: "right" | "left";
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

  return (
    <Card className="space-y-4 p-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">스윙 설정</h2>
        <p className="text-sm text-muted-foreground">선택한 조건은 다음 촬영과 업로드에 적용됩니다.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-1 text-sm text-muted-foreground">
          촬영 시점
          <select
            value={value.viewpoint ?? "down_the_line"}
            onChange={(e) => handleChange("viewpoint", e.target.value)}
            className="min-h-12 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
          >
            <option value="down_the_line">후방 (DTL)</option>
            <option value="face_on">정면</option>
          </select>
        </label>

        <label className="grid gap-1 text-sm text-muted-foreground">
          사용 손
          <select
            value={value.handedness ?? "right"}
            onChange={(e) => handleChange("handedness", e.target.value)}
            className="min-h-12 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
          >
            <option value="right">오른손</option>
            <option value="left">왼손</option>
          </select>
        </label>

        <label className="grid gap-1 text-sm text-muted-foreground">클럽
          <select value={value.club ?? "driver"} onChange={e => handleChange("club", e.target.value)} className="min-h-12 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground">
            <option value="driver">드라이버</option><option value="wood">우드</option><option value="iron">아이언</option>
          </select>
        </label>
      </div>
      <p className="text-xs leading-5 text-muted-foreground">현재 임팩트 후보와 자세 비교는 오른손 후방 촬영을 기준으로 제공합니다.</p>
      <details className="border-t border-border"><summary className="text-sm font-semibold">고급 촬영 옵션</summary><div className="grid gap-4 pb-2 md:grid-cols-2">
        <label className="grid gap-1 text-sm text-muted-foreground">
          FPS (선택)
          <input
            type="number"
            min={1}
            placeholder="예: 60"
            value={value.fps ?? ""}
            onChange={(e) => handleChange("fps", e.target.value)}
            className="min-h-12 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
          />
        </label>

        <label className="grid gap-1 text-sm text-muted-foreground md:col-span-2">
          ROI [x,y,w,h] (JSON)
          <input
            type="text"
            placeholder='예: [100,200,400,400]'
            value={value.roi ?? ""}
            onChange={(e) => handleChange("roi", e.target.value)}
            className="min-h-12 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
          />
        </label>

        <label className="grid gap-1 text-sm text-muted-foreground">
          카메라-볼 거리(m)
          <input
            type="number"
            step="0.1"
            min={0}
            placeholder="예: 3.0"
            value={value.cam_distance ?? ""}
            onChange={(e) => handleChange("cam_distance", e.target.value)}
            className="min-h-12 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
          />
        </label>

        <label className="grid gap-1 text-sm text-muted-foreground">
          카메라 높이(m)
          <input
            type="number"
            step="0.1"
            min={0}
            placeholder="예: 1.2"
            value={value.cam_height ?? ""}
            onChange={(e) => handleChange("cam_height", e.target.value)}
            className="min-h-12 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
          />
        </label>

        <label className="grid gap-1 text-sm text-muted-foreground md:col-span-2">
          렌즈 선택
          <select
            value={value.lens ?? ""}
            onChange={(e) => handleChange("lens", e.target.value)}
            className="min-h-12 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
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
          <span className="text-xs text-muted-foreground">
            {lensError || "렌즈 선택 시 h_fov/v_fov가 자동 입력됩니다."}
          </span>
        </label>

        <label className="grid gap-1 text-sm text-muted-foreground">
          수평 FOV(도)
          <input
            type="number"
            step="0.1"
            min={0}
            placeholder="예: 60"
            value={value.h_fov ?? ""}
            onChange={(e) => handleChange("h_fov", e.target.value)}
            className="min-h-12 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
          />
        </label>

        <label className="grid gap-1 text-sm text-muted-foreground">
          수직 FOV(도)
          <input
            type="number"
            step="0.1"
            min={0}
            placeholder="예: 34"
            value={value.v_fov ?? ""}
            onChange={(e) => handleChange("v_fov", e.target.value)}
            className="min-h-12 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
          />
        </label>

        <label className="grid gap-1 text-sm text-muted-foreground">
          임팩트 프레임 번호
          <input
            type="number"
            min={0}
            placeholder="예: 70"
            value={value.impact_frame ?? ""}
            onChange={(e) => handleChange("impact_frame", e.target.value)}
            className="min-h-12 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
          />
        </label>

        <label className="grid gap-1 text-sm text-muted-foreground">
          추적 프레임 수
          <input
            type="number"
            min={1}
            placeholder="기본 20"
            value={value.track_frames ?? ""}
            onChange={(e) => handleChange("track_frames", e.target.value)}
            className="min-h-12 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
          />
        </label>
      </div></details>

      {onSubmit && (
        <div className="flex justify-end">
          <Button className="px-3 py-1 text-sm" type="button" variant="primary" fullWidth={false} onClick={onSubmit}>
            완료
          </Button>
        </div>
      )}
    </Card>
  );
}
