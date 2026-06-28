import {
  Activity,
  Camera,
  MonitorPlay,
  Play,
  Radio,
  RefreshCw,
  Settings,
  Square,
  Wifi,
  WifiOff,
} from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { CameraStatus } from "@/types/camera";
import type { SessionState } from "@/types/session";

type PreviewPreset = {
  width: number;
  height: number;
  fps: number;
};

type FieldConnectionPanelProps = {
  baseUrl: string;
  status: CameraStatus | null;
  statusError?: string | null;
  isLoading?: boolean;
  lastCheckedAt?: string | null;
  isPreviewOn: boolean;
  isStreaming: boolean;
  streamClients: number;
  previewPreset: PreviewPreset;
  sessionState: SessionState;
  onRefresh: () => void;
  onOpenSettings: () => void;
  onStartPreview: () => void;
  onStopPreview: () => void;
};

type Tone = "good" | "warn" | "danger" | "info" | "muted";

const TONE_CLASSES: Record<Tone, string> = {
  good: "border-emerald-300/30 bg-emerald-400/10 text-emerald-100",
  warn: "border-amber-300/30 bg-amber-400/10 text-amber-100",
  danger: "border-red-300/30 bg-red-400/10 text-red-100",
  info: "border-sky-300/30 bg-sky-400/10 text-sky-100",
  muted: "border-border bg-muted/45 text-muted-foreground",
};

const DOT_CLASSES: Record<Tone, string> = {
  good: "bg-emerald-300",
  warn: "bg-amber-300",
  danger: "bg-red-300",
  info: "bg-sky-300",
  muted: "bg-muted-foreground",
};

const SESSION_LABELS: Record<SessionState, string> = {
  idle: "대기",
  starting: "시작 준비",
  arming: "어드레스 감지",
  addressLocked: "어드레스 확인",
  recording: "촬영 중",
  finishLocked: "종료 감지",
  stopping: "정지 중",
  analyzing: "분석 중",
  done: "완료",
  failed: "실패",
};

const activeSessionStates = new Set<SessionState>([
  "starting",
  "arming",
  "addressLocked",
  "recording",
  "finishLocked",
  "stopping",
  "analyzing",
]);

export function FieldConnectionPanel({
  baseUrl,
  status,
  statusError,
  isLoading = false,
  lastCheckedAt,
  isPreviewOn,
  isStreaming,
  streamClients,
  previewPreset,
  sessionState,
  onRefresh,
  onOpenSettings,
  onStartPreview,
  onStopPreview,
}: FieldConnectionPanelProps) {
  const normalizedBaseUrl = baseUrl.trim();
  const hasBaseUrl = normalizedBaseUrl.length > 0;
  const apiOnline = hasBaseUrl && Boolean(status) && !statusError;
  const cameraReady = Boolean(status?.cameraDetected);
  const sessionActive = activeSessionStates.has(sessionState);
  const sessionTone: Tone =
    sessionState === "failed" ? "danger" : sessionActive ? "info" : sessionState === "done" ? "good" : "muted";
  const apiTone: Tone = !hasBaseUrl ? "muted" : statusError ? "danger" : apiOnline ? "good" : "warn";
  const cameraTone: Tone = !apiOnline ? "muted" : cameraReady ? "good" : "danger";
  const previewTone: Tone = isPreviewOn || isStreaming ? "info" : "muted";
  const primaryAction = isPreviewOn ? (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="min-h-11 gap-2 rounded-xl"
      onClick={onStopPreview}
    >
      <Square className="size-4" aria-hidden="true" />
      프리뷰 종료
    </Button>
  ) : (
    <Button
      type="button"
      size="sm"
      className="min-h-11 gap-2 rounded-xl"
      disabled={!hasBaseUrl}
      onClick={onStartPreview}
    >
      <Play className="size-4" aria-hidden="true" />
      프리뷰 시작
    </Button>
  );

  return (
    <Card className="border-white/10 bg-card/80 shadow-2xl shadow-black/20">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200/80">
              Phone hotspot controller
            </p>
            <CardTitle className="mt-1 text-xl">현장 연결</CardTitle>
            <CardDescription className="mt-1">
              핸드폰 핫스팟에 붙은 Pi를 이 화면에서 제어합니다.
            </CardDescription>
          </div>
          <StatusPill
            label={apiOnline ? "Pi online" : "대기"}
            tone={apiTone}
            pulse={isLoading || apiTone === "warn"}
          />
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {statusError && (
          <div
            className="rounded-xl border border-red-400/25 bg-red-400/10 px-3 py-2 text-sm text-red-100"
            role="alert"
          >
            {statusError}
          </div>
        )}

        <div className="rounded-xl border border-border bg-muted/30 p-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            {apiOnline ? (
              <Wifi className="size-4 text-emerald-200" aria-hidden="true" />
            ) : (
              <WifiOff className="size-4 text-amber-200" aria-hidden="true" />
            )}
            핫스팟 모드
          </div>
          <p className="mt-2 break-words text-xs leading-5 text-muted-foreground">
            {hasBaseUrl ? (
              <>
                접속 주소{" "}
                <span className="font-semibold text-foreground">{normalizedBaseUrl}</span>
              </>
            ) : (
              "설정에서 Pi 서버 주소를 먼저 입력하세요."
            )}
          </p>
          {lastCheckedAt && (
            <p className="mt-1 text-xs text-muted-foreground">
              최근 확인: {new Date(lastCheckedAt).toLocaleTimeString()}
            </p>
          )}
        </div>

        <dl className="grid grid-cols-2 gap-2 text-sm">
          <StatusTile
            icon={<Radio className="size-4" aria-hidden="true" />}
            label="Pi API"
            value={apiOnline ? "응답 중" : hasBaseUrl ? "확인 필요" : "주소 없음"}
            description={apiOnline ? "같은 핫스팟 네트워크" : "핫스팟/주소 확인"}
            tone={apiTone}
          />
          <StatusTile
            icon={<Camera className="size-4" aria-hidden="true" />}
            label="Camera"
            value={cameraReady ? "Ready" : apiOnline ? "Not found" : "-"}
            description={cameraReady ? "촬영 가능" : "카메라 감지 대기"}
            tone={cameraTone}
          />
          <StatusTile
            icon={<MonitorPlay className="size-4" aria-hidden="true" />}
            label="Preview"
            value={isPreviewOn ? "On" : isStreaming ? "Streaming" : "Off"}
            description={`${previewPreset.width} x ${previewPreset.height} · ${previewPreset.fps}fps`}
            tone={previewTone}
          />
          <StatusTile
            icon={<Activity className="size-4" aria-hidden="true" />}
            label="Session"
            value={SESSION_LABELS[sessionState]}
            description={streamClients > 0 ? `${streamClients} client` : "client 없음"}
            tone={sessionTone}
          />
        </dl>

        <div className="grid gap-2 sm:grid-cols-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-11 gap-2 rounded-xl"
            disabled={isLoading}
            onClick={onRefresh}
          >
            <RefreshCw className={cn("size-4", isLoading && "animate-spin")} aria-hidden="true" />
            상태 확인
          </Button>
          {primaryAction}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-11 gap-2 rounded-xl"
            onClick={onOpenSettings}
          >
            <Settings className="size-4" aria-hidden="true" />
            연결 설정
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusPill({ label, tone, pulse = false }: { label: string; tone: Tone; pulse?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
        TONE_CLASSES[tone]
      )}
    >
      <span className={cn("size-1.5 rounded-full", DOT_CLASSES[tone], pulse && "animate-pulse")} aria-hidden="true" />
      {label}
    </span>
  );
}

function StatusTile({
  icon,
  label,
  value,
  description,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  description: string;
  tone: Tone;
}) {
  return (
    <div className={cn("rounded-xl border p-3", TONE_CLASSES[tone])}>
      <dt className="flex items-center gap-1.5 text-xs opacity-80">
        {icon}
        {label}
      </dt>
      <dd className="mt-1 font-semibold text-current">{value}</dd>
      <p className="mt-1 text-xs opacity-80">{description}</p>
    </div>
  );
}
