import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { AnalysisResult, GenericMetricPayload, JobStatus, MetricGroup } from "@/types/shots";

type KeyMetricsProps = {
  analysis?: AnalysisResult | null;
  status?: JobStatus;
};

export function KeyMetrics({ analysis, status }: KeyMetricsProps) {
  const currentStatus: JobStatus = analysis?.status ?? status ?? "idle";
  const isRunning = currentStatus === "queued" || currentStatus === "running";
  const fallback = isRunning ? "분석 중" : "데이터 부족";
  const fusionPrimary = pickPrimaryMetric(analysis?.metrics.fusion);
  const bodyPrimary = pickPrimaryMetric(analysis?.metrics.body);

  const tempoRatio = analysis?.metrics.tempo?.ratio ?? fallback;
  const shaftPlane = formatMetricLabel(analysis?.metrics.shaftPlane) ?? analysis?.metrics.swingPlane ?? fallback;
  const backswing = formatMetricLabel(analysis?.metrics.backswing) ?? fallback;
  const quality = analysis ? analysisQuality(analysis) : null;
  const impactStability =
    analysis?.metrics.impactStability ??
    formatMetricLabel(fusionPrimary) ??
    formatMetricLabel(bodyPrimary) ??
    fallback;
  const validationStatus = analysis?.eventValidation?.status;
  const eventMetricsUsable = !validationStatus || validationStatus === "usable";

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="text-lg">핵심 지표</CardTitle>
            <CardDescription>분석 결과에서 핵심 지표를 요약합니다.</CardDescription>
          </div>
          {quality ? (
            <span className={cn("rounded-full border px-2.5 py-1 text-xs font-semibold", quality.className)}>
              {quality.label}
            </span>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {validationStatus && validationStatus !== "usable" ? (
          <div className="rounded-xl border border-amber-300/40 bg-amber-400/10 px-3 py-2 text-sm text-amber-100">
            <p className="font-semibold">{validationStatus === "partial" ? "스윙 이벤트 참고값" : "스윙 이벤트 판정 보류"}</p>
            <p className="mt-1 text-xs leading-5 text-amber-100/80">{analysis?.eventValidation?.message ?? "클럽 추적과 pose 이벤트가 일치하지 않아 템포·임팩트·경로 코칭을 제공하지 않습니다."}</p>
          </div>
        ) : null}
        {quality && eventMetricsUsable ? (
          <p className="rounded-xl border border-border bg-muted/35 px-3 py-2 text-xs leading-5 text-muted-foreground">
            {quality.message}
          </p>
        ) : null}
        {eventMetricsUsable ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <MetricCard label="Shaft Plane" value={shaftPlane} />
            <MetricCard label="Tempo" value={tempoRatio} />
            <MetricCard label="Backswing" value={backswing} />
            <MetricCard label="Impact Stability" value={impactStability} />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function analysisQuality(analysis: AnalysisResult) {
  const overall = typeof analysis.confidence === "number" ? analysis.confidence : null;
  const tracking = analysis.metrics.trackingQuality?.score ?? analysis.metrics.trackingQuality?.confidence ?? null;
  const score = Math.min(overall ?? 1, tracking ?? 1);
  const percentText = overall == null ? "" : ` 전체 신뢰도 ${Math.round(overall * 100)}%.`;

  if (score < 0.25) {
    return {
      label: "참고용 분석",
      className: "border-slate-200 bg-slate-50 text-slate-800",
      message: `트래킹 품질이 낮아 코칭은 우선순위 참고용으로 보세요.${percentText} 촬영 구도와 클럽 검출 품질을 먼저 확인하는 것이 좋습니다.`,
    };
  }
  if (score < 0.5) {
    return {
      label: "참고 가능",
      className: "border-yellow-200 bg-yellow-50 text-yellow-900",
      message: `일부 지표는 사용할 수 있지만 세부 진단은 흔들릴 수 있습니다.${percentText} 코멘트는 반복 촬영에서 같은 패턴이 나오는지 확인하세요.`,
    };
  }
  return {
    label: "신뢰 가능",
    className: "border-emerald-200 bg-emerald-50 text-emerald-900",
    message: `추적 품질이 비교적 안정적입니다.${percentText} 코칭 우선순위와 드릴을 기준으로 반복 확인해도 됩니다.`,
  };
}

function formatMetricLabel(metric?: { label?: string | null; confidence?: number | null; score?: number | null }) {
  if (!metric?.label) return null;
  const confidence = metric.confidence ?? metric.score;
  if (confidence == null) return metric.label;
  return `${metric.label} (${Math.round(confidence * 100)}%)`;
}

function pickPrimaryMetric(group?: MetricGroup): GenericMetricPayload | undefined {
  if (!group) return undefined;
  return Object.values(group).find((item) => item && typeof item === "object" && item.label) as
    | GenericMetricPayload
    | undefined;
}

type MetricCardProps = {
  label: string;
  value: string | number | null;
};

function MetricCard({ label, value }: MetricCardProps) {
  return (
    <div className="min-w-0 rounded-xl border border-border bg-muted/50 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="break-words text-base font-semibold text-foreground">
        {value ?? "-"}
      </p>
    </div>
  );
}
