import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { AutoRecordStatus } from "@/types/camera";
import { Spinner } from "@/components/ui/spinner";

type AutoRecordPanelProps = {
  status?: AutoRecordStatus | null;
  isRunning: boolean;
  isLoading?: boolean;
  error?: string | null;
  onStart: () => void;
  onStop: () => void;
  onFallbackManual?: () => void;
};

const STATUS_LABELS: Record<string, string> = {
  idle: "대기",
  arming: "어드레스 감지",
  addresslocked: "안정 상태 확보",
  recording: "촬영중",
  finishlocked: "마무리 처리 중",
  stopping: "정지 중",
  failed: "실패",
};

const STATUS_TONE: Record<string, string> = {
  idle: "bg-muted text-muted-foreground",
  arming: "bg-blue-50 text-blue-700",
  addresslocked: "bg-blue-50 text-blue-700",
  recording: "bg-amber-50 text-amber-800",
  finishlocked: "bg-emerald-50 text-emerald-700",
  stopping: "bg-muted text-foreground",
  failed: "bg-red-50 text-red-700",
};

export function AutoRecordPanel({
  status,
  isRunning,
  isLoading,
  error,
  onStart,
  onStop,
  onFallbackManual,
}: AutoRecordPanelProps) {
  const state = status?.state ?? "idle";
  const stateKey = state?.toLowerCase?.() ?? state;
  const badgeTone = STATUS_TONE[stateKey] ?? "bg-muted text-foreground";
  const label = STATUS_LABELS[stateKey] ?? stateKey;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
        <div>
          <CardTitle className="text-lg">자동 촬영</CardTitle>
          <CardDescription>어드레스→촬영→피니시→분석까지 자동 진행</CardDescription>
        </div>
        <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", badgeTone)}>
          {label}
        </span>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={onStart}
            disabled={isRunning || isLoading}
            variant="primary"
            fullWidth={false}
            className="rounded-lg"
          >
            {isLoading && state === "idle" ? <Spinner className="mr-2" /> : null}
            자동 촬영 시작
          </Button>
          <Button
            onClick={onStop}
            disabled={!isRunning}
            variant="outline"
            fullWidth={false}
            className="rounded-lg"
          >
            자동 촬영 중지
          </Button>
          {onFallbackManual && (
            <Button onClick={onFallbackManual} variant="ghost" fullWidth={false} className="rounded-lg">
              수동 촬영으로 전환
            </Button>
          )}
        </div>

        {status?.recordingFilename && (
          <div className="text-xs text-muted-foreground">
            최근 파일: <span className="font-semibold">{status.recordingFilename}</span>
          </div>
        )}

        {typeof status?.motionScore === "number" && (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Motion score (디버그)</p>
            <div className="h-2 w-full rounded-full bg-muted">
              <div
                className="h-2 rounded-full bg-blue-500 transition-all"
                style={{ width: `${Math.min(100, Math.max(0, status.motionScore * 100))}%` }}
              />
            </div>
          </div>
        )}

        {(status?.lastError || error) && (
          <p className="text-sm text-red-600">
            {status?.lastError || error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
