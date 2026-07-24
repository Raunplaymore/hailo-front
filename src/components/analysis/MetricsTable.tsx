import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { AnalysisResult, GenericMetricPayload, JobStatus, MetricGroup, SwingEventKey } from "../../types/shots";

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
  const value = metric.confidence;
  return value == null ? metric.label : `${metric.label} (${formatPercent(value)})`;
};

const compactDetail = (parts: Array<string | number | null | undefined>) =>
  parts.filter((part) => part !== null && part !== undefined && part !== "-").join(" · ");

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

  if (analysis?.eventValidation && analysis.eventValidation.status !== "usable") {
    const bodyMetrics = toMetricEntries(analysis.metrics.body);
    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0 space-y-1">
              <CardTitle className="text-lg">{analysis.eventValidation.status === "partial" ? "상세 지표 제한" : "상세 지표 보류"}</CardTitle>
              <CardDescription className="break-words text-xs text-muted-foreground">
                {analysis.eventValidation.status === "partial"
                  ? "포즈 이벤트는 참고용으로 제공하고 클럽 확정이 필요한 수치는 표시하지 않습니다."
                  : "클럽 추적과 pose 이벤트 근거가 부족해 이벤트 기반 수치를 표시하지 않습니다."}
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
        <CardContent>
          <div className="rounded-xl border border-amber-300/40 bg-amber-400/10 px-3 py-2 text-sm text-amber-100">
            <p className="font-semibold">{analysis.eventValidation.status === "partial" ? "참고 이벤트만 제공됩니다" : "재촬영이 필요합니다"}</p>
            <p className="mt-1 text-xs leading-5 text-amber-100/80">
              {analysis.eventValidation.message ?? "클럽 헤드가 임팩트 전후에 선명하게 보이도록, 스윙 전체를 화면에 담아 다시 촬영해 주세요."}
            </p>
          </div>
          {bodyMetrics.length > 0 ? (
            <div className="mt-3">
              <MetricGroupSection
                title="Body Metrics"
                description="클럽 이벤트와 무관하게 확보된 pose 기반 전신 데이터"
                metrics={bodyMetrics}
              />
            </div>
          ) : null}
        </CardContent>
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
  const bodyMetrics = toMetricEntries(analysis?.metrics.body);
  const clubMetrics = toMetricEntries(analysis?.metrics.club);
  const fusionMetrics = toMetricEntries(analysis?.metrics.fusion);
  const pending = analysis?.pending ?? PENDING_FALLBACK;
  const metricAvailability = analysis?.eventValidation?.metricAvailability ?? {};
  const availability = (key: string) => {
    const value = analysis?.eventValidation?.metricEvidence?.[key]?.status ?? metricAvailability[key];
    return value === "confirmed" || value === "reference" || value === "withheld" ? value : undefined;
  };
  const tempoAvailability = availability("tempo");
  const ballAvailability = availability("ball");
  const shaftAvailability = availability("shaft");
  const backswingAvailability = availability("backswing");
  const qualityScore = analysis?.analysisQuality?.score ?? analysis?.confidence;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0 space-y-1">
            <CardTitle className="text-lg">상세 지표</CardTitle>
            <CardDescription className="break-words text-xs text-muted-foreground">
              {analysis?.jobId
                ? `필요한 항목만 펼쳐서 확인합니다. Job ID: ${analysis.jobId}`
                : "필요한 항목만 펼쳐서 확인합니다."}
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

      <CardContent className="space-y-2">
        <CollapsibleMetricSection
          title="Tempo"
          summary={compactDetail([
            availabilityLabel(tempoAvailability),
            tempo?.ratio ? `${tempo.ratio}:1` : null,
            tempo?.downswingMs != null ? `DS ${formatMs(tempo.downswingMs)}` : null,
            tempo?.backswingMs != null ? `BS ${formatMs(tempo.backswingMs)}` : null,
          ]) || "분석 대기"}
        >
          {tempoAvailability === "withheld" ? (
            <WithheldNotice text="이벤트 근거가 부족해 템포 수치를 제공하지 않습니다." />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <MetricCard label="비율" value={tempo?.ratio ?? "-"} />
                <MetricCard label="다운스윙 시간" value={formatMs(tempo?.downswingMs)} />
                <MetricCard label="백스윙 시간" value={formatMs(tempo?.backswingMs)} />
              </div>
              {tempoAvailability === "reference" ? (
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  시간 구간의 참고값입니다. 이 비율만으로 전환 순서나 손·하체 선행을 판정하지 않습니다.
                </p>
              ) : null}
            </>
          )}
        </CollapsibleMetricSection>

        <CollapsibleMetricSection
          title="Event Timing"
          summary={compactDetail([
            eventTiming?.impact != null ? `Impact ${formatMs(eventTiming.impact)}` : null,
            eventTiming?.top != null ? `Top ${formatMs(eventTiming.top)}` : null,
          ]) || "이벤트 없음"}
        >
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(EVENT_LABELS) as SwingEventKey[]).map((key) => (
              <MetricCard key={key} label={EVENT_LABELS[key]} value={formatMs(eventTiming?.[key])} />
            ))}
          </div>
        </CollapsibleMetricSection>

        <CollapsibleMetricSection
          title="Ball"
          summary={ballAvailability === "withheld"
            ? "보류 · 공 비행 추적 미검증"
            : compactDetail([ball?.launchDirection, ball?.speedRelative, formatAngle(ball?.launchAngle)]) || "공 추적 없음"}
        >
          {ballAvailability === "withheld" ? (
            <WithheldNotice text="연속적인 공 identity와 카메라 좌표 보정이 검증되기 전에는 출발 방향·각도·속도를 표시하지 않습니다." />
          ) : (
            <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-3">
              <MetricCard label="Launch Direction" value={ball?.launchDirection ? ball.launchDirection : "-"} />
              <MetricCard label="Launch Angle" value={formatAngle(ball?.launchAngle)} />
              <MetricCard label="Speed Relative" value={ball?.speedRelative ? ball.speedRelative : "-"} />
            </div>
          )}
        </CollapsibleMetricSection>

        <CollapsibleMetricSection
          title="Service7 전신/클럽 진단"
          summary={compactDetail([
            `Shaft ${metricAvailabilitySummary(shaftAvailability, formatMetricLabel(shaftPlane))}`,
            `Backswing ${metricAvailabilitySummary(backswingAvailability, formatMetricLabel(backswing))}`,
            `Tracking ${formatMetricLabel(trackingQuality)}`,
          ])}
        >
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <MetricCard label="Shaft Plane" value={shaftAvailability === "withheld" ? "보류" : formatMetricLabel(shaftPlane)} />
            <MetricCard label="Shaft Angle" value={shaftAvailability === "withheld" ? "보류" : formatAngle(shaftPlane?.angleDeg)} />
            <MetricCard label="Backswing" value={backswingAvailability === "withheld" ? "보류" : formatMetricLabel(backswing)} />
            <MetricCard label="촬영 준비 상태" value={formatMetricLabel(readiness)} />
            <MetricCard label="클럽 관측 상태" value={formatMetricLabel(trackingQuality)} />
            <MetricCard label="관측 커버리지" value={formatPercent(qualityScore)} />
          </div>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            관측 커버리지는 영상에서 pose와 클럽을 얼마나 확보했는지 나타내며, 코칭 정답 확률이 아닙니다.
          </p>
          {trackingQuality && (
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground sm:grid-cols-4">
              <MetricCard label="Club Head Frames" value={trackingQuality.clubHeadFrames ?? "-"} />
              <MetricCard label="Handle Frames" value={trackingQuality.clubHandleFrames ?? "-"} />
              <MetricCard label="Club Frames" value={trackingQuality.clubFrames ?? "-"} />
              <MetricCard label="Ball Frames" value={trackingQuality.ballFrames ?? "-"} />
              <MetricCard label="Person Frames" value={trackingQuality.personFrames ?? "-"} />
            </div>
          )}
        </CollapsibleMetricSection>

        {bodyMetrics.length > 0 && (
          <MetricGroupSection title="Body Metrics" description="pose 기반 전신 분석 결과" metrics={bodyMetrics} />
        )}

        {clubMetrics.length > 0 && (
          <MetricGroupSection title="Club Metrics" description="클럽 추적 기반 세부 지표" metrics={clubMetrics} />
        )}

        {fusionMetrics.length > 0 && (
          <MetricGroupSection title="Fusion Metrics" description="body/club 융합 분석 결과" metrics={fusionMetrics} />
        )}

        <CollapsibleMetricSection
          title="확장 예정 지표"
          summary={`${pending.length}개 준비 중`}
        >
          <div className="space-y-1">
            {pending.map((p) => (
              <div key={p.key} className="flex items-center justify-between rounded-lg border border-dashed border-border px-3 py-2">
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
        </CollapsibleMetricSection>
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
    <div className="min-w-0 rounded-xl border border-border bg-muted/50 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="break-words text-base font-semibold text-foreground">{value}</p>
    </div>
  );
}

function availabilityLabel(status?: string) {
  if (status === "confirmed") return "확정";
  if (status === "reference") return "참고";
  if (status === "withheld") return "보류";
  return null;
}

function metricAvailabilitySummary(status: string | undefined, value: string) {
  if (status === "withheld") return "보류";
  return compactDetail([availabilityLabel(status), value]);
}

function WithheldNotice({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-slate-400/30 bg-slate-400/10 px-3 py-2 text-xs leading-5 text-muted-foreground">
      <p className="font-semibold text-foreground">현재 판정 보류</p>
      <p className="mt-1">{text}</p>
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

function toMetricEntries(group?: MetricGroup) {
  if (!group) return [];
  return Object.entries(group).filter(([, value]) => value && typeof value === "object") as Array<
    [string, GenericMetricPayload]
  >;
}

function formatGroupMetricValue(metric: GenericMetricPayload) {
  if (metric.label) {
    const strength = metric.confidence;
    return strength == null ? metric.label : `${metric.label} (${Math.round(strength * 100)}%)`;
  }
  if (typeof metric.ratio === "number" || typeof metric.ratio === "string") {
    const ratio = typeof metric.ratio === "number" ? `${metric.ratio}:1` : metric.ratio;
    const downswing = typeof metric.downswingMs === "number" ? `DS ${formatMs(metric.downswingMs)}` : null;
    const backswing = typeof metric.backswingMs === "number" ? `BS ${formatMs(metric.backswingMs)}` : null;
    return compactDetail([ratio, downswing, backswing]) || ratio;
  }
  if (Array.isArray(metric.evidence) && metric.evidence.length > 0) {
    const strength = metric.confidence;
    const prefix = strength == null ? "" : `${Math.round(strength * 100)}% · `;
    return `${prefix}${metric.evidence.slice(0, 3).join(", ")}`;
  }
  if (typeof metric.sampleCount === "number") {
    const strength = metric.confidence;
    return compactDetail([
      `${metric.sampleCount} samples`,
      strength == null ? null : `${Math.round(strength * 100)}%`,
    ]);
  }
  if (typeof metric.score === "number") return `점수 ${metric.score.toFixed(2)}`;
  if (typeof metric.confidence === "number") return `${Math.round(metric.confidence * 100)}%`;
  return "-";
}

function formatMetricKey(key: string) {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function CollapsibleMetricSection({
  title,
  summary,
  defaultOpen = false,
  children,
}: {
  title: string;
  summary: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details className="group rounded-xl border border-border bg-muted/20" open={defaultOpen}>
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="truncate text-xs text-muted-foreground">{summary}</p>
        </div>
        <span className="rounded-full border border-border bg-background px-2.5 py-1 text-xs font-semibold text-muted-foreground">
          <span className="group-open:hidden">펼치기</span>
          <span className="hidden group-open:inline">접기</span>
        </span>
      </summary>
      <div className="border-t px-3 pb-3 pt-2">{children}</div>
    </details>
  );
}

function MetricGroupSection({
  title,
  description,
  metrics,
}: {
  title: string;
  description: string;
  metrics: Array<[string, GenericMetricPayload]>;
}) {
  const summary = compactDetail(
    metrics.slice(0, 3).map(([key, value]) => `${formatMetricKey(key)} ${formatGroupMetricValue(value)}`)
  );
  return (
    <CollapsibleMetricSection title={title} summary={summary || description}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {metrics.map(([key, value]) => (
          <MetricCard key={key} label={formatMetricKey(key)} value={formatGroupMetricValue(value)} />
        ))}
      </div>
      <div className="space-y-1">
        {metrics
          .filter(([, value]) => value.comment)
          .map(([key, value]) => (
            <div key={`${key}-comment`} className="rounded-lg border border-border bg-muted/30 px-3 py-2">
              <p className="text-xs font-semibold text-foreground">{formatMetricKey(key)}</p>
              <p className="mt-1 text-xs text-muted-foreground">{value.comment}</p>
            </div>
          ))}
      </div>
    </CollapsibleMetricSection>
  );
}
