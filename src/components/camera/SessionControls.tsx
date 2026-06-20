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
import { Activity, AlertTriangle, Play, RotateCcw, Square } from "lucide-react";

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
  idle: "border-border bg-muted/60 text-muted-foreground",
  starting: "border-amber-300/30 bg-amber-400/10 text-amber-100",
  arming: "border-amber-300/30 bg-amber-400/10 text-amber-100",
  addressLocked: "border-emerald-300/30 bg-emerald-400/10 text-emerald-100",
  recording: "border-rose-300/30 bg-rose-400/10 text-rose-100",
  finishLocked: "border-amber-300/30 bg-amber-400/10 text-amber-100",
  stopping: "border-slate-300/20 bg-slate-400/10 text-slate-100",
  analyzing: "border-sky-300/30 bg-sky-400/10 text-sky-100",
  done: "border-emerald-300/30 bg-emerald-400/10 text-emerald-100",
  failed: "border-red-300/30 bg-red-400/10 text-red-100",
};

const STATE_DOTS: Record<SessionState, string> = {
  idle: "bg-muted-foreground",
  starting: "bg-amber-300",
  arming: "bg-amber-300",
  addressLocked: "bg-emerald-300",
  recording: "bg-rose-300",
  finishLocked: "bg-amber-300",
  stopping: "bg-slate-300",
  analyzing: "bg-sky-300",
  done: "bg-emerald-300",
  failed: "bg-red-300",
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
    <CardHeader className={embedded ? "p-0 pb-4" : "pb-3"}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200/80">
            AI inference session
          </p>
          <CardTitle className="mt-1 text-xl">원탭 스윙 세션</CardTitle>
          <CardDescription className="mt-1">
            어드레스 감지부터 분석 요청까지 한 번의 흐름으로 진행합니다.
          </CardDescription>
        </div>
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
            STATE_STYLES[state]
          )}
        >
          <span
            className={cn("size-1.5 rounded-full", STATE_DOTS[state], isBusy && "animate-pulse")}
            aria-hidden="true"
          />
          {STATE_LABELS[state]}
        </span>
      </div>
    </CardHeader>
  );

  const content = (
    <CardContent className={embedded ? "space-y-4 px-0 pb-0 pt-0" : "space-y-4"}>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-foreground">진행 상태</p>
          <span className="text-xs text-muted-foreground">{activeStep + 1} / {stepLabels.length}</span>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-1 whitespace-nowrap">
          {stepLabels.map((label, index) => {
            const isActive = index === activeStep;
            const isComplete = index < activeStep;
            const isFailed = state === "failed" && index === activeStep;
            return (
              <div
                key={label}
                className={cn(
                  "flex min-h-8 items-center justify-center rounded-full border px-3 text-xs font-semibold transition",
                  isComplete && "border-emerald-300/30 bg-emerald-400/10 text-emerald-100",
                  isActive && !isFailed && "border-sky-300/30 bg-sky-400/10 text-sky-100",
                  isFailed && "border-red-300/30 bg-red-400/10 text-red-100",
                  !isActive && !isComplete && !isFailed && "border-border bg-muted/40 text-muted-foreground"
                )}
              >
                {label}
              </div>
            );
          })}
        </div>
      </div>
      {(error || analysisError) && (
        <div className="flex gap-2 rounded-xl border border-red-400/25 bg-red-400/10 px-3 py-2 text-sm text-red-100" role="alert">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>{error || analysisError}</p>
        </div>
      )}
      {(jobId || filename || analysisStatus || sessionStatus) && (
        <dl className="grid gap-2 rounded-xl border border-border bg-muted/30 p-3 text-xs">
          {jobId && (
            <div className="min-w-0">
              <dt className="text-muted-foreground">Session ID</dt>
              <dd className="truncate font-medium text-foreground">{jobId}</dd>
            </div>
          )}
          {filename && (
            <div className="min-w-0">
              <dt className="text-muted-foreground">파일</dt>
              <dd className="truncate font-medium text-foreground">{filename}</dd>
            </div>
          )}
          {analysisStatus && (
            <div>
              <dt className="text-muted-foreground">분석 상태</dt>
              <dd className="font-medium text-foreground">
                {ANALYSIS_LABELS[analysisStatus] ?? analysisStatus}
              </dd>
            </div>
          )}
          {sessionStatus && (
            <div>
              <dt className="text-muted-foreground">세션 상태</dt>
              <dd className="font-medium text-foreground">{sessionStatus}</dd>
            </div>
          )}
        </dl>
      )}
      <label className="grid gap-2 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">클럽</span>
        <select
          value={club ?? "driver"}
          onChange={(e) => onClubChange?.(e.target.value)}
          className="min-h-11 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isRecording || isBusy || !onClubChange}
        >
          {clubOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <div className="grid gap-2 sm:grid-cols-2">
        {showStop ? (
          <Button
            type="button"
            variant="destructive"
            className="h-12 gap-2 rounded-xl"
            onClick={onStop}
          >
            <Square className="size-4" aria-hidden="true" />
            Stop Session
          </Button>
        ) : showStart ? (
          <Button
            type="button"
            className="h-12 gap-2 rounded-xl"
            onClick={onStart}
            disabled={startDisabled || isBusy}
          >
            <Play className="size-4" aria-hidden="true" />
            Start Swing
          </Button>
        ) : null}
        {canStart && (state === "done" || state === "failed") && (
          <Button
            type="button"
            variant="outline"
            className="h-12 gap-2 rounded-xl"
            onClick={onReset}
          >
            <RotateCcw className="size-4" aria-hidden="true" />
            새 세션 준비
          </Button>
        )}
        {isBusy && (
          <Button type="button" variant="outline" className="h-12 gap-2 rounded-xl" disabled>
            <Activity className="size-4 animate-pulse" aria-hidden="true" />
            처리 중...
          </Button>
        )}
      </div>
    </CardContent>
  );

  if (embedded) {
    return (
      <section className="rounded-2xl border border-white/10 bg-card/90 p-4 shadow-2xl shadow-black/20">
        {header}
        {content}
      </section>
    );
  }

  return (
    <Card>
      {header}
      {content}
    </Card>
  );
}
