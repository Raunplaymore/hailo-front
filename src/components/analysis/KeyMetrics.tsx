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

  const tempoStatus = metricStatus(analysis, "tempo");
  const shaftStatus = metricStatus(analysis, "shaft");
  const pathStatus = metricStatus(analysis, "path");
  const backswingStatus = metricStatus(analysis, "backswing");
  const impactStatus = metricStatus(analysis, "impactStability");
  const impactTime = analysis?.events?.impact?.timeMs ?? analysis?.metrics?.eventTiming?.impact;
  const tempoRatio = metricValue(analysis?.metrics.tempo?.ratio ?? fallback, tempoStatus);
  const shaftAngle = analysis?.metrics.shaftPlane?.angleDeg;
  const shaftPlane = metricValue(typeof shaftAngle === "number" && Number.isFinite(shaftAngle) ? `${shaftAngle.toFixed(1)}° · 기존 2D 추정` : fallback, shaftStatus);
  const clubPath = metricValue(fallback, pathStatus);
  const backswing = metricValue(fallback, backswingStatus);
  const quality = analysis ? analysisQuality(analysis) : null;
  const legacyImpact =
    analysis?.metrics.impactStability ?? formatMetricLabel(fusionPrimary) ?? formatMetricLabel(bodyPrimary) ?? fallback;
  const impactStability = metricValue(legacyImpact, impactStatus, "평가 준비 중");
  const validationStatus = analysis?.eventValidation?.status;

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
        {quality ? (
          <p className="rounded-xl border border-border bg-muted/35 px-3 py-2 text-xs leading-5 text-muted-foreground">
            {quality.message}
          </p>
        ) : null}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
          <MetricCard label="샤프트 기울기" value={shaftPlane} status={shaftStatus} />
          <MetricCard label="클럽 진행 경로" value={clubPath} status={pathStatus} />
          <MetricCard label="템포" value={tempoRatio} status={tempoStatus} />
          <MetricCard label="백스윙" value={backswing} status={backswingStatus} />
          <MetricCard label="임팩트 재현성" value={impactStability} status={impactStatus} />
          <MetricCard
            label="임팩트 시점"
            value={impactTime != null ? `${Math.round(impactTime)} ms · 기존 후보` : "미확인"}
            status={impactTime != null ? "reference" : "withheld"}
          />
        </div>
        <p className="text-xs leading-5 text-muted-foreground">
          샤프트 값은 이전 단일 카메라의 2D 추정입니다. 자세의 좋고 나쁨이나 3D 경로를 뜻하지 않으며, 임팩트도 원본 영상에서 확인해야 합니다.
        </p>
      </CardContent>
    </Card>
  );
}

function analysisQuality(analysis: AnalysisResult) {
  const overall = analysis.analysisQuality?.score ??
    (typeof analysis.confidence === "number" ? analysis.confidence : null);
  const tracking = analysis.metrics.trackingQuality?.score ?? analysis.metrics.trackingQuality?.confidence ?? null;
  const score = Math.min(overall ?? 1, tracking ?? 1);
  const percentText = overall == null ? "" : ` 관측 커버리지 ${Math.round(overall * 100)}%.`;

  if (score < 0.25) {
    return {
      label: "근거 제한",
      className: "border-slate-200 bg-slate-50 text-slate-800",
      message: `관측 데이터가 부족합니다.${percentText} 이 수치는 정답 확률이 아니며 촬영·추적 범위를 뜻합니다.`,
    };
  }
  if (score < 0.5) {
    return {
      label: "일부 근거",
      className: "border-yellow-200 bg-yellow-50 text-yellow-900",
      message: `일부 구간을 관측했습니다.${percentText} 각 지표의 한계를 따로 확인하세요.`,
    };
  }
  return {
    label: "관측 충분",
    className: "border-emerald-200 bg-emerald-50 text-emerald-900",
    message: `관측 범위는 비교적 충분합니다.${percentText} 골프 동작의 정확도를 뜻하지는 않습니다.`,
  };
}

function formatMetricLabel(metric?: { label?: string | null; confidence?: number | null; score?: number | null }) {
  if (!metric?.label) return null;
  const confidence = metric.confidence;
  if (confidence == null) return metric.label;
  return `${metric.label} (${Math.round(confidence * 100)}%)`;
}

function metricStatus(analysis: AnalysisResult | null | undefined, key: string) {
  if (!analysis) return undefined;
  if (["path", "impactStability", "backswing"].includes(key)) return "withheld";
  const status =
    analysis.eventValidation?.metricEvidence?.[key]?.status ??
    analysis.eventValidation?.metricAvailability?.[key];
  if (status === "withheld" || (analysis.eventValidation && analysis.eventValidation.status !== "usable")) return "withheld";
  return "reference";
}

function metricValue(
  value: string | number | null,
  status?: "confirmed" | "reference" | "withheld",
  withheldLabel = "보류",
) {
  if (status === "withheld") return withheldLabel;
  return value;
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
  status?: "confirmed" | "reference" | "withheld";
};

function MetricCard({ label, value, status }: MetricCardProps) {
  return (
    <div className="min-w-0 rounded-xl border border-border bg-muted/50 px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{label}</p>
        {status ? (
          <span className={cn(
            "rounded-full border px-1.5 py-0.5 text-[10px] font-semibold",
            status === "confirmed"
              ? "border-emerald-300/50 text-emerald-200"
              : status === "reference"
                ? "border-amber-300/50 text-amber-200"
                : "border-slate-400/40 text-slate-300",
          )}>
            {status === "confirmed" ? "확정" : status === "reference" ? "참고" : "보류"}
          </span>
        ) : null}
      </div>
      <p className="break-words text-base font-semibold text-foreground">
        {value ?? "-"}
      </p>
    </div>
  );
}
