import { AnalysisResult, JobStatus, SwingEventKey } from "../../types/shots";
import { Card } from "../Card";
import { Button } from "../Button";

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
  { key: "clubPath", label: "Club Path", description: "YOLO 클럽 트래킹 적용 후 활성화 예정" },
  { key: "swingPlane", label: "Swing Plane", description: "단일 카메라 신뢰도 확보 후 제공" },
  { key: "attackAngle", label: "Attack Angle", description: "헤드 궤적 안정화 후 제공" },
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
  idle: "bg-slate-100 text-slate-700 border border-slate-200",
  "not-analyzed": "bg-slate-50 text-slate-600 border border-slate-200",
  queued: "bg-amber-50 text-amber-700 border border-amber-200",
  running: "bg-blue-50 text-blue-700 border border-blue-200",
  succeeded: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  failed: "bg-red-50 text-red-700 border border-red-200",
};

const formatMs = (value?: number | null) => (value == null ? "-" : `${Math.round(value)} ms`);
const formatAngle = (value?: number | null) => (value == null ? "-" : `${value.toFixed(1)}°`);

export function MetricsTable({ analysis, status, onOpenVideo }: MetricsTableProps) {
  const currentStatus: JobStatus = analysis?.status ?? status ?? "idle";

  if (!analysis && (currentStatus === "idle" || currentStatus === "not-analyzed")) {
    return (
      <Card>
        <p className="text-slate-500 text-sm">
          {currentStatus === "not-analyzed"
            ? "아직 분석 결과가 없습니다. 목록에서 분석을 실행해 주세요."
            : "샷을 선택하면 분석 상태와 지표가 표시됩니다."}
        </p>
      </Card>
    );
  }

  if (!analysis && (currentStatus === "queued" || currentStatus === "running")) {
    return (
      <Card className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">분석 상태</p>
          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${STATUS_TONES[currentStatus]}`}>
            {STATUS_LABELS[currentStatus]}
          </span>
        </div>
        <p className="text-base text-slate-800">
          서버에서 영상을 처리 중입니다. 완료되면 지표가 자동으로 갱신됩니다.
        </p>
      </Card>
    );
  }

  if (currentStatus === "failed") {
    return (
      <Card className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">분석 상태</p>
          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${STATUS_TONES[currentStatus]}`}>
            {STATUS_LABELS[currentStatus]}
          </span>
        </div>
        <p className="text-base text-red-600">
          {analysis?.errorMessage ?? "분석이 실패했습니다. 다시 시도해주세요."}
        </p>
      </Card>
    );
  }

  const tempo = analysis?.metrics.tempo;
  const eventTiming = analysis?.metrics.eventTiming;
  const ball = analysis?.metrics.ball;
  const pending = analysis?.pending ?? PENDING_FALLBACK;

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-0.5">
          <p className="text-sm text-slate-500">분석 상태</p>
          <p className="text-lg font-semibold text-slate-900">{STATUS_LABELS[currentStatus]}</p>
          {analysis?.jobId && (
            <p className="text-xs text-slate-500">Job ID: {analysis.jobId}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${STATUS_TONES[currentStatus]}`}>
            {STATUS_LABELS[currentStatus]}
          </span>
          {onOpenVideo && (
            <Button
              type="button"
              onClick={onOpenVideo}
              variant="outline"
              className="w-auto px-3 py-1 text-sm"
              fullWidth={false}
            >
              영상 크게 보기
            </Button>
          )}
        </div>
      </div>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">Tempo</p>
          <span className="text-xs text-slate-400">백스윙 : 다운스윙</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <MetricCard label="비율" value={tempo?.ratio ?? "-"} />
          <MetricCard label="다운스윙 시간" value={formatMs(tempo?.downswingMs)} />
          <MetricCard label="백스윙 시간" value={formatMs(tempo?.backswingMs)} />
        </div>
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">Event Timing (상대 시점)</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(EVENT_LABELS) as SwingEventKey[]).map((key) => (
            <MetricCard key={key} label={EVENT_LABELS[key]} value={formatMs(eventTiming?.[key])} />
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">Ball (근사)</p>
          <span className="text-xs text-slate-400">단일 카메라 기준</span>
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
          <p className="text-sm text-slate-500">준비 중 지표</p>
          <span className="text-xs text-slate-400">YOLO 기반 클럽 트래킹 후 공개</span>
        </div>
        <div className="space-y-1">
          {pending.map((p) => (
            <div
              key={p.key}
              className="flex items-center justify-between rounded-lg border border-dashed border-slate-200 px-3 py-2"
            >
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-slate-800">{p.label}</span>
                <span className="text-xs text-slate-500">{p.description}</span>
              </div>
              <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-600 font-semibold">
                준비 중
              </span>
            </div>
          ))}
        </div>
      </section>
    </Card>
  );
}

type MetricCardProps = {
  label: string;
  value: string | number;
};

function MetricCard({ label, value }: MetricCardProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-base font-semibold text-slate-900">{value}</p>
    </div>
  );
}
