import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { AnalysisResult, JobStatus, SwingEventKey } from "../../types/shots";

type MetricsTableProps = {
  analysis?: AnalysisResult | null;
  status?: JobStatus;
  onOpenVideo?: () => void;
};

const EVENT_LABELS: Record<SwingEventKey, string> = {
  address: "Address",
  top: "Top",
  impact: "Impact",
  finish: "Finish",
};

const PENDING_FALLBACK = [
  { key: "pelvisPose", label: "Pelvis Rotation", description: "포즈 키포인트 모델 연동 후 직접 판정" },
  { key: "attackAngle", label: "Attack Angle", description: "정면/측면 보정값 확보 후 제공" },
  { key: "threeDimensionalPath", label: "3D Club Path", description: "다중 시점 캘리브레이션 후 제공" },
];

const STATUS_LABELS: Record<JobStatus, string> = {
  idle: "대기",
  "not-analyzed": "분석 전",
  queued: "대기열",
  running: "분석 중",
  succeeded: "완료",
  failed: "실패",
};

const STATUS_TONES: Record<JobStatus, string> = {
  idle: "bg-muted text-foreground border border-border",
  "not-analyzed": "bg-muted text-muted-foreground border border-border",
  queued: "bg-amber-400/10 text-amber-100 border border-amber-300/30",
  running: "bg-sky-400/10 text-sky-100 border border-sky-300/30",
  succeeded: "bg-emerald-400/10 text-emerald-100 border border-emerald-300/30",
  failed: "bg-red-400/10 text-red-100 border border-red-300/30",
};

const formatMs = (value?: number | null) => (value == null ? "-" : `${Math.round(value)} ms`);
const formatAngle = (value?: number | null) => (value == null ? "-" : `${value.toFixed(1)}°`);
const formatPercent = (value?: number | null) => (value == null ? "-" : `${Math.round(value * 100)}%`);
const formatMetricLabel = (metric?: { label?: string | null; confidence?: number | null; score?: number | null }) => {
  if (!metric?.label) return "-";
  const value = metric.confidence ?? metric.score;
  return value == null ? metric.label : `${metric.label} (${formatPercent(value)})`;
};

export function MetricsTable({ analysis, status, onOpenVideo }: MetricsTableProps) {
  const currentStatus: JobStatus = analysis?.status ?? status ?? "idle";

  if (!analysis && (currentStatus === "idle" || currentStatus === "not-analyzed")) {
    return (
      <Card>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {currentStatus === "not-analyzed"
              ? "아직 분석 결과가 없습니다. 목록에서 분석을 실행해 주세요."
              : "샷을 선택하면 분석 상태와 지표가 표시됩니다."}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!analysis && (currentStatus === "queued" || currentStatus === "running")) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">분석 상태</CardTitle>
            <StatusBadge status={currentStatus} />
          </div>
          <CardDescription>
            서버에서 영상을 처리 중입니다. 완료되면 지표가 자동으로 갱신됩니다.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (currentStatus === "failed") {
    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">분석 상태</CardTitle>
            <StatusBadge status={currentStatus} />
          </div>
          <CardDescription className="text-destructive">
            {analysis?.errorMessage ?? "분석이 실패했습니다. 다시 시도해주세요."}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const tempo = analysis?.metrics.tempo;
  const eventTiming = analysis?.metrics.eventTiming;
  const ball = analysis?.metrics.ball;
  const shaftPlane = analysis?.metrics.shaftPlane;
  const backswing = analysis?.metrics.backswing;
  const readiness = analysis?.metrics.readiness;
  const trackingQuality = analysis?.metrics.trackingQuality;
  const pending = analysis?.pending ?? PENDING_FALLBACK;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0 space-y-1">
            <CardTitle className="text-lg">분석 상태</CardTitle>
            <CardDescription className="break-words text-xs text-muted-foreground">
              {analysis?.jobId ? `Job ID: ${analysis.jobId}` : "선택된 샷의 상태를 표시합니다."}
            </CardDescription>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <StatusBadge status={currentStatus} />
            {onOpenVideo && (
              <Button type="button" onClick={onOpenVideo} variant="outline" size="sm" fullWidth={false}>
                영상 크게 보기
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Tempo</p>
            <span className="text-xs text-muted-foreground">백스윙 : 다운스윙</span>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <MetricCard label="비율" value={tempo?.ratio ?? "-"} />
            <MetricCard label="다운스윙 시간" value={formatMs(tempo?.downswingMs)} />
            <MetricCard label="백스윙 시간" value={formatMs(tempo?.backswingMs)} />
          </div>
        </section>

        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Event Timing (상대 시점)</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(EVENT_LABELS) as SwingEventKey[]).map((key) => (
              <MetricCard key={key} label={EVENT_LABELS[key]} value={formatMs(eventTiming?.[key])} />
            ))}
          </div>
        </section>

        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Ball (근사)</p>
            <span className="text-xs text-muted-foreground">단일 카메라 기준</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <MetricCard
              label="Launch Direction"
              value={ball?.launchDirection ? ball.launchDirection : "-"}
            />
            <MetricCard label="Launch Angle" value={formatAngle(ball?.launchAngle)} />
            <MetricCard
              label="Speed Relative"
              value={ball?.speedRelative ? ball.speedRelative : "-"}
            />
          </div>
        </section>

        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Service7 전신/클럽 진단</p>
            <span className="text-xs text-muted-foreground">2D 추적 기준</span>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <MetricCard label="Shaft Plane" value={formatMetricLabel(shaftPlane)} />
            <MetricCard label="Shaft Angle" value={formatAngle(shaftPlane?.angleDeg)} />
            <MetricCard label="Backswing" value={formatMetricLabel(backswing)} />
            <MetricCard label="Readiness" value={formatMetricLabel(readiness)} />
            <MetricCard label="Tracking Quality" value={formatMetricLabel(trackingQuality)} />
            <MetricCard label="Overall Confidence" value={formatPercent(analysis?.confidence)} />
          </div>
          {trackingQuality && (
            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground sm:grid-cols-4">
              <MetricCard label="Club Head Frames" value={trackingQuality.clubHeadFrames ?? "-"} />
              <MetricCard label="Handle Frames" value={trackingQuality.clubHandleFrames ?? "-"} />
              <MetricCard label="Ball Frames" value={trackingQuality.ballFrames ?? "-"} />
              <MetricCard label="Person Frames" value={trackingQuality.personFrames ?? "-"} />
            </div>
          )}
        </section>

        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">확장 예정 지표</p>
            <span className="text-xs text-muted-foreground">추가 센서/포즈 모델 필요</span>
          </div>
          <div className="space-y-1">
            {pending.map((p) => (
              <div
                key={p.key}
                className="flex items-center justify-between rounded-lg border border-dashed border-border px-3 py-2"
              >
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-foreground">{p.label}</span>
                  <span className="text-xs text-muted-foreground">{p.description}</span>
                </div>
                <span className="rounded-full bg-muted px-2 py-1 text-xs font-semibold text-muted-foreground">
                  준비 중
                </span>
              </div>
            ))}
          </div>
        </section>
      </CardContent>
    </Card>
  );
}

type MetricCardProps = {
  label: string;
  value: string | number;
};

function MetricCard({ label, value }: MetricCardProps) {
  return (
    <div className="rounded-xl border border-border bg-muted/50 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-base font-semibold text-foreground">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: JobStatus }) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-1 text-xs font-semibold",
        STATUS_TONES[status] ?? STATUS_TONES.idle
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
