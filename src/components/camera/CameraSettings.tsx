import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export type CameraSettingsValue = {
  baseUrl: string;
  token: string;
  sessionPrefix: string;
  autoStopPreviewOnCapture: boolean;
};

type CameraSettingsProps = {
  value: CameraSettingsValue;
  history: string[];
  aiConfigNote?: string | null;
  onChange: (next: CameraSettingsValue) => void;
  onSelectHistory: (url: string) => void;
  onClearHistory: () => void;
};

export function CameraSettings({
  value,
  history,
  aiConfigNote,
  onChange,
  onSelectHistory,
  onClearHistory,
}: CameraSettingsProps) {
  return (
    <Card>
      <CardHeader className="gap-2">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground">라즈베리파이 카메라</p>
            <CardTitle className="text-lg">카메라 연결 설정</CardTitle>
            <CardDescription>
              주소/토큰을 저장해 빠르게 프리뷰·캡처를 시작하세요.
            </CardDescription>
          </div>
          <span className="text-[11px] text-muted-foreground">
            env: VITE_CAMERA_BASE_URL / VITE_CAMERA_API_BASE / VITE_CAMERA_AUTH_TOKEN
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <label className="block space-y-1">
          <span className="text-sm font-medium text-foreground">카메라 서버 주소</span>
          <input
            type="text"
            value={value.baseUrl}
            onChange={(e) => onChange({ ...value, baseUrl: e.target.value })}
            placeholder="예: http://라즈베리파이:3001"
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
          <p className="text-xs text-muted-foreground">
            핫스팟 연결 시 IP를 직접 입력하고 저장해 두세요.
          </p>
        </label>

        <p className="text-xs text-muted-foreground">
          파일명 자동 생성: <span className="font-semibold">golf_YYYYMMDD_HHmmss_mmm_type.ext</span>
        </p>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={value.autoStopPreviewOnCapture}
            onChange={(e) => onChange({ ...value, autoStopPreviewOnCapture: e.target.checked })}
            className="h-4 w-4 rounded border-border text-primary focus:ring-2 focus:ring-blue-200"
          />
          <span className="text-sm text-foreground">녹화 전에 프리뷰 자동 종료</span>
        </label>

        <div className="space-y-1">
          <span className="text-sm font-medium text-foreground">AI 라벨 구성</span>
          <div className="w-full rounded-xl border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">
            yolov8s_nms_golf.json (고정)
          </div>
          <p className="text-xs text-muted-foreground">
            {aiConfigNote ||
              "현재 웹은 골프용 설정만 사용합니다. 필요 시 카메라 서버에서 변경하세요."}
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">최근 사용한 주소</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              fullWidth={false}
              className="rounded-lg"
              onClick={onClearHistory}
              disabled={history.length === 0}
            >
              기록 삭제
            </Button>
          </div>
          {history.length === 0 ? (
            <p className="rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              기록이 없습니다. 주소를 입력 후 프리뷰/상태 확인 시 자동으로 저장됩니다.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {history.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => onSelectHistory(item)}
                  className="rounded-full border border-border bg-muted/60 px-3 py-1 text-xs text-foreground transition hover:border-blue-400 hover:text-blue-600"
                >
                  {item}
                </button>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
