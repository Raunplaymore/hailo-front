import { CameraStatus } from "../../types/camera";
import { Button } from "../Button";
import { Card } from "../Card";

type CameraStatusPanelProps = {
  status: CameraStatus | null;
  onRefresh: () => void;
  isLoading?: boolean;
  error?: string | null;
  lastCheckedAt?: string | null;
};

export function CameraStatusPanel({
  status,
  onRefresh,
  isLoading,
  error,
  lastCheckedAt,
}: CameraStatusPanelProps) {
  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm text-muted-foreground">Hailo Camera API</p>
          <h2 className="text-lg font-semibold text-foreground">연결/상태</h2>
        </div>
        <Button
          type="button"
          variant="outline"
          className="w-auto px-3 py-1 text-sm"
          onClick={onRefresh}
          isLoading={Boolean(isLoading)}
          loadingText="확인 중..."
        >
          상태 확인
        </Button>
      </div>
      {error && <p className="text-sm text-destructive mb-2">{error}</p>}
      {lastCheckedAt && (
        <p className="text-xs text-muted-foreground mb-2">최근 확인: {new Date(lastCheckedAt).toLocaleString()}</p>
      )}
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <StatusRow label="카메라 감지" value={status ? (status.cameraDetected ? "Yes" : "No") : "-"} />
        <StatusRow label="Busy" value={status ? (status.busy ? "사용 중" : "대기") : "-"} />
        <StatusRow label="Streaming" value={status ? (status.streaming ? "ON" : "OFF") : "-"} />
        <StatusRow
          label="마지막 촬영"
          value={status?.lastCaptureAt ? new Date(status.lastCaptureAt).toLocaleString() : "-"}
        />
        <StatusRow
          label="최근 오류"
          value={status?.lastError ? status.lastError : "-"}
          className="col-span-2"
        />
      </dl>
    </Card>
  );
}

function StatusRow({
  label,
  value,
  className = "",
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={`bg-muted/35 border border-border rounded-lg px-3 py-2 ${className}`}>
      <dt className="text-[12px] text-muted-foreground">{label}</dt>
      <dd className="text-sm font-semibold text-foreground break-words">{value}</dd>
    </div>
  );
}
