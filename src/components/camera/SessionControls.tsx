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
  startDisabled?: boolean;
  onStart: () => void;
  onStop: () => void;
  onReset: () => void;
};

const STATE_LABELS: Record<SessionState, string> = {
  idle: "대기",
  starting: "시작 준비 중",
  recording: "촬영 중",
  stopping: "정지 중",
  analyzing: "분석 중",
  done: "완료",
  failed: "실패",
};

const STATE_STYLES: Record<SessionState, string> = {
  idle: "bg-slate-50 text-slate-700 border border-slate-200",
  starting: "bg-amber-50 text-amber-700 border border-amber-200",
  recording: "bg-amber-50 text-amber-700 border border-amber-200",
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

export function SessionControls({
  state,
  jobId,
  filename,
  analysisStatus,
  sessionStatus,
  error,
  analysisError,
  startDisabled = false,
  onStart,
  onStop,
  onReset,
}: SessionControlsProps) {
  const isRecording = state === "recording";
  const isBusy = state === "starting" || state === "stopping" || state === "analyzing";
  const canStart = state === "idle" || state === "done" || state === "failed";
  const showStart = !isRecording && !isBusy;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">AI 인퍼런스 세션</p>
            <CardTitle className="text-lg">원탭 스윙 세션</CardTitle>
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
      <CardContent className="space-y-3">
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
        <div className="flex flex-wrap gap-2">
          {isRecording ? (
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
    </Card>
  );
}
