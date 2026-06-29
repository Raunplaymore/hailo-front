import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  const impactStability =
    analysis?.metrics.impactStability ??
    formatMetricLabel(fusionPrimary) ??
    formatMetricLabel(bodyPrimary) ??
    fallback;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">핵심 지표</CardTitle>
        <CardDescription>분석 결과에서 핵심 지표를 요약합니다.</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <MetricCard label="Shaft Plane" value={shaftPlane} />
        <MetricCard label="Tempo" value={tempoRatio} />
        <MetricCard label="Backswing" value={backswing} />
        <MetricCard label="Impact Stability" value={impactStability} />
      </CardContent>
    </Card>
  );
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
    <div className="rounded-xl border border-border bg-muted/50 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-base font-semibold text-foreground">
        {value ?? "-"}
      </p>
    </div>
  );
}
