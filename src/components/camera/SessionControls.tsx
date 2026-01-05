import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { SessionState } from "@/types/session";
import { JobStatus } from "@/types/shots";

type SessionControlsProps = {
  state: SessionState;
  jobId?: string | null;
  filename?: string | null;
  analysisStatus?: JobStatus | null;
  sessionStatus?: string | null;
  error?: string | null;
  analysisError?: string | null;
  club?: string | null;
  startDisabled?: boolean;
  embedded?: boolean;
  onStart: () => void;
  onStop: () => void;
  onReset: () => void;
  onClubChange?: (club: string) => void;
};

const STATE_LABELS: Record<SessionState, string> = {
  idle: "대기",
  starting: "시작 준비 중",
  arming: "어드레스 감지 중",
  addressLocked: "어드레스 완료",
  recording: "촬영 중",
  finishLocked: "스윙 종료 감지",
  stopping: "정지 중",
  analyzing: "분석 중",
  done: "완료",
  failed: "실패",
};

const STATE_STYLES: Record<SessionState, string> = {
  idle: "bg-slate-50 text-slate-700 border border-slate-200",
  starting: "bg-amber-50 text-amber-700 border border-amber-200",
  arming: "bg-amber-50 text-amber-700 border border-amber-200",
  addressLocked: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  recording: "bg-amber-50 text-amber-700 border border-amber-200",
  finishLocked: "bg-amber-50 text-amber-700 border border-amber-200",
  stopping: "bg-slate-100 text-slate-700 border border-slate-200",
  analyzing: "bg-blue-50 text-blue-700 border border-blue-200",
  done: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  failed: "bg-red-50 text-red-700 border border-red-200",
};

const ANALYSIS_LABELS: Record<JobStatus, string> = {
  idle: "대기",
  "not-analyzed": "분석 전",
  queued: "대기열",
  running: "분석 중",
  succeeded: "완료",
  failed: "실패",
};

const STATE_STEP_INDEX: Record<SessionState, number> = {
  idle: 0,
  starting: 1,
  arming: 1,
  addressLocked: 1,
  recording: 2,
  finishLocked: 3,
  stopping: 3,
  analyzing: 4,
  done: 5,
  failed: 5,
};

const STEP_LABELS = ["대기", "어드레스 감지", "촬영", "정지", "분석", "완료"];

export function SessionControls({
  state,
  jobId,
  filename,
  analysisStatus,
  sessionStatus,
  error,
  analysisError,
  club,
  startDisabled = false,
  embedded = false,
  onStart,
  onStop,
  onReset,
  onClubChange,
}: SessionControlsProps) {
  const isRecording = state === "recording";
  const isBusy =
    state === "starting" ||
    state === "arming" ||
    state === "addressLocked" ||
    state === "finishLocked" ||
    state === "stopping" ||
    state === "analyzing";
  const canStart = state === "idle" || state === "done" || state === "failed";
  const showStart = !isRecording && !isBusy;
  const showStop =
    isRecording ||
    state === "starting" ||
    state === "arming" ||
    state === "addressLocked" ||
    state === "finishLocked";
  const stepLabels = [...STEP_LABELS];
  if (state === "failed") {
    stepLabels[stepLabels.length - 1] = "실패";
  }
  const activeStep = STATE_STEP_INDEX[state];
  const clubOptions = [
    { value: "driver", label: "Driver" },
    { value: "wood", label: "Wood" },
    { value: "iron", label: "Iron" },
  ];

  const header = (
    <CardHeader className={embedded ? "p-2 px-0" : "pb-3"}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">AI 인퍼런스 세션</p>
          {/* <CardTitle className="text-lg">원탭 스윙 세션</CardTitle> */}
          <CardDescription>시작 → 실시간 인퍼런스 → 종료 → 분석</CardDescription>
        </div>
        <span
          className={cn(
            "rounded-full px-2 py-1 text-xs font-semibold",
            STATE_STYLES[state]
          )}
        >
          {STATE_LABELS[state]}
        </span>
      </div>
    </CardHeader>
  );

  const content = (
    <CardContent className={embedded ? "px-0 pt-0 space-y-3" : "space-y-3"}>
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">진행 상태</p>
        <div className="flex items-center gap-1.5 overflow-x-auto whitespace-nowrap">
          {stepLabels.map((label, index) => {
            const isActive = index === activeStep;
            const isComplete = index < activeStep;
            const isFailed = state === "failed" && index === activeStep;
            return (
              <div
                key={label}
                className={cn(
                  "flex items-center justify-center rounded-full border px-1.5 py-0.5 text-[10px] font-semibold",
                  isComplete && "border-emerald-200 bg-emerald-50 text-emerald-700",
                  isActive && !isFailed && "border-blue-200 bg-blue-50 text-blue-700",
                  isFailed && "border-red-200 bg-red-50 text-red-700",
                  !isActive && !isComplete && !isFailed && "border-border bg-muted/50 text-muted-foreground"
                )}
              >
                {label}
              </div>
            );
          })}
        </div>
      </div>
      {(error || analysisError) && (
        <p className="text-sm text-destructive">
          {error || analysisError}
        </p>
      )}
      {jobId && (
        <p className="text-xs text-muted-foreground">Session ID: {jobId}</p>
      )}
      {filename && (
        <p className="text-xs text-muted-foreground">파일: {filename}</p>
      )}
      {analysisStatus && (
        <p className="text-xs text-muted-foreground">
          분석 상태: {ANALYSIS_LABELS[analysisStatus] ?? analysisStatus}
        </p>
      )}
      {sessionStatus && (
        <p className="text-xs text-muted-foreground">
          세션 상태: {sessionStatus}
        </p>
      )}
      <label className="grid gap-1 text-sm text-muted-foreground">
        <select
          value={club ?? "driver"}
          onChange={(e) => onClubChange?.(e.target.value)}
          className="w-full px-3 py-2 text-sm border rounded-lg border-border bg-background text-foreground"
          disabled={isRecording || isBusy || !onClubChange}
        >
          {clubOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <div className="flex flex-wrap gap-2">
        {showStop ? (
          <Button
            type="button"
            variant="destructive"
            fullWidth={false}
            className="rounded-lg"
            onClick={onStop}
          >
            Stop
          </Button>
        ) : showStart ? (
          <Button
            type="button"
            fullWidth={false}
            className="rounded-lg"
            onClick={onStart}
            disabled={startDisabled || isBusy}
          >
            Start
          </Button>
        ) : null}
        {canStart && (state === "done" || state === "failed") && (
          <Button
            type="button"
            variant="outline"
            fullWidth={false}
            className="rounded-lg"
            onClick={onReset}
          >
            새 세션 준비
          </Button>
        )}
        {isBusy && (
          <Button type="button" variant="outline" fullWidth={false} className="rounded-lg" disabled>
            처리 중...
          </Button>
        )}
      </div>
    </CardContent>
  );

  if (embedded) {
    return (
      <div className="space-y-1">
        {header}
        {content}
      </div>
    );
  }

  return (
    <Card>
      {header}
      {content}
    </Card>
  );
}
