import { Card } from "../Card";
import { Button } from "../Button";

export type CameraSettingsValue = {
  baseUrl: string;
  token: string;
  sessionPrefix: string;
  autoStopPreviewOnCapture: boolean;
};

type CameraSettingsProps = {
  value: CameraSettingsValue;
  history: string[];
  onChange: (next: CameraSettingsValue) => void;
  onSelectHistory: (url: string) => void;
  onClearHistory: () => void;
};

export function CameraSettings({
  value,
  history,
  onChange,
  onSelectHistory,
  onClearHistory,
}: CameraSettingsProps) {
  return (
    <Card>
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <p className="text-sm text-slate-500">라즈베리파이 카메라</p>
          <h2 className="text-lg font-semibold text-slate-900">카메라 연결 설정</h2>
        </div>
        <span className="text-xs text-slate-500">env: VITE_CAMERA_API_BASE / VITE_CAMERA_AUTH_TOKEN</span>
      </div>

      <div className="space-y-4">
        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-700">카메라 서버 주소</span>
          <input
            type="text"
            value={value.baseUrl}
            onChange={(e) => onChange({ ...value, baseUrl: e.target.value })}
            placeholder="예: http://192.168.45.89:3001"
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          />
          <p className="text-xs text-slate-500">핫스팟 연결 시 IP를 직접 입력하고 저장해 두세요.</p>
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-700">액세스 토큰 (선택)</span>
          <input
            type="password"
            value={value.token}
            onChange={(e) => onChange({ ...value, token: e.target.value })}
            placeholder="Bearer 토큰"
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          />
          <p className="text-xs text-slate-500">API 호출 시 Authorization 헤더로 전송됩니다. 프리뷰는 token 쿼리로 전달됩니다.</p>
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-700">세션 이름 (파일명 prefix)</span>
          <input
            type="text"
            value={value.sessionPrefix}
            onChange={(e) => onChange({ ...value, sessionPrefix: e.target.value.trim() })}
            placeholder="예: rangenight 또는 club9"
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          />
          <p className="text-xs text-slate-500">파일명: [세션_]golf_YYYYMMDD_HHmmss_mmm_type.ext</p>
        </label>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={value.autoStopPreviewOnCapture}
            onChange={(e) => onChange({ ...value, autoStopPreviewOnCapture: e.target.checked })}
            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-slate-700">녹화 전에 프리뷰 자동 종료</span>
        </label>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700">최근 사용한 주소</span>
            <Button
              type="button"
              variant="outline"
              className="w-auto px-3 py-1 text-xs"
              fullWidth={false}
              onClick={onClearHistory}
              disabled={history.length === 0}
            >
              기록 삭제
            </Button>
          </div>
          {history.length === 0 ? (
            <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
              기록이 없습니다. 주소를 입력 후 프리뷰/상태 확인 시 자동으로 저장됩니다.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {history.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => onSelectHistory(item)}
                  className="px-3 py-1 rounded-full border border-slate-200 bg-slate-50 text-xs text-slate-700 hover:border-blue-400 hover:text-blue-600"
                >
                  {item}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
