export type GolfMetricKind = "shaftPlane" | "clubPath" | "backswing";

type MetricLabel = {
  label?: string | null;
  confidence?: number | null;
};

const LABELS: Record<GolfMetricKind, Record<string, string>> = {
  shaftPlane: {
    flat: "낮은 기울기",
    neutral: "중립 기울기",
    steep: "가파른 기울기",
    withheld: "판정 보류",
  },
  clubPath: {
    "inside-out": "인→아웃",
    "outside-in": "아웃→인",
    neutral: "인→인(중립)",
    "inside-inside": "인→인",
    withheld: "판정 보류",
  },
  backswing: {
    adequate: "백스윙 크기 적정",
    short: "백스윙 크기 작음",
    long: "백스윙 크기 큼",
    low: "백스윙 탑이 낮음",
    low_top: "백스윙 탑이 낮음",
    high: "백스윙 탑이 높음",
    high_top: "백스윙 탑이 높음",
    withheld: "판정 보류",
  },
};

export function translateGolfMetricLabel(label: string | null | undefined, kind: GolfMetricKind) {
  if (!label) return null;
  const normalized = label.trim().toLowerCase();
  return LABELS[kind][normalized] ?? label;
}

export function formatGolfMetric(metric: MetricLabel | null | undefined, kind: GolfMetricKind) {
  const label = translateGolfMetricLabel(metric?.label, kind);
  if (!label) return null;
  if (metric?.confidence == null) return label;
  return `${label} (${Math.round(metric.confidence * 100)}%)`;
}
