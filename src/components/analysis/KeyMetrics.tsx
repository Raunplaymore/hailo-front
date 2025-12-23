import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AnalysisResult, JobStatus } from "@/types/shots";

type KeyMetricsProps = {
  analysis?: AnalysisResult | null;
  status?: JobStatus;
};

export function KeyMetrics({ analysis, status }: KeyMetricsProps) {
  const currentStatus: JobStatus = analysis?.status ?? status ?? "idle";
  const isRunning = currentStatus === "queued" || currentStatus === "running";
  const fallback = isRunning ? "분석 중" : "데이터 부족";

  const tempoRatio = analysis?.metrics.tempo?.ratio ?? fallback;
  const swingPlane = analysis?.metrics.swingPlane ?? fallback;
  const impactStability = analysis?.metrics.impactStability ?? fallback;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">핵심 지표</CardTitle>
        <CardDescription>분석 결과에서 핵심 지표를 요약합니다.</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-3 gap-2">
        <MetricCard label="Swing Plane" value={swingPlane} />
        <MetricCard label="Tempo" value={tempoRatio} />
        <MetricCard label="Impact Stability" value={impactStability} />
      </CardContent>
    </Card>
  );
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
