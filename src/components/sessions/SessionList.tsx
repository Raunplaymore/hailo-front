import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { SessionRecord, SessionStatus } from "@/types/session";

type SessionListProps = {
  sessions: SessionRecord[];
  isLoading?: boolean;
  error?: string | null;
  onRefresh: () => void;
  onSelect: (session: SessionRecord) => void;
  title?: string;
  emptyMessage?: string;
};

const STATUS_LABELS: Record<SessionStatus, string> = {
  recorded: "촬영 완료",
  analyzing: "분석 중",
  done: "분석 완료",
  failed: "분석 실패",
};

const STATUS_STYLES: Record<SessionStatus, string> = {
  recorded: "bg-slate-50 text-slate-700 border border-slate-200",
  analyzing: "bg-blue-50 text-blue-700 border border-blue-200",
  done: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  failed: "bg-red-50 text-red-700 border border-red-200",
};

export function SessionList({
  sessions,
  isLoading,
  error,
  onRefresh,
  onSelect,
  title = "스윙 세션 기록",
  emptyMessage = "아직 촬영된 세션이 없습니다.",
}: SessionListProps) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between pb-3">
        <div>
          <CardTitle className="text-lg">{title}</CardTitle>
          <CardDescription>카메라에서 기록한 스윙 세션 목록입니다.</CardDescription>
        </div>
        <Button
          type="button"
          onClick={onRefresh}
          variant="outline"
          size="sm"
          fullWidth={false}
          className="rounded-lg"
          disabled={isLoading}
        >
          {isLoading ? "새로고침 중..." : "새로고침"}
        </Button>
      </CardHeader>
      <CardContent>
        {error && <p className="mb-2 text-sm text-destructive">{error}</p>}
        {sessions.length === 0 ? (
          <div className="rounded-xl border border-border bg-muted/50 p-4 text-sm text-muted-foreground">
            {emptyMessage}
          </div>
        ) : (
          <ul className="m-0 grid list-none gap-3 p-0">
            {sessions.map((session) => (
              <li
                key={session.id}
                className="flex w-full flex-col gap-2 break-words rounded-xl border border-border bg-card p-3 text-sm"
              >
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-semibold">
                    {session.filename}
                  </span>
                  <span className="break-words text-xs text-muted-foreground">
                    {STATUS_LABELS[session.status]} ·{" "}
                    {new Date(session.createdAt).toLocaleString()}
                  </span>
                  <span
                    className={cn(
                      "inline-flex w-fit items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold",
                      STATUS_STYLES[session.status]
                    )}
                  >
                    {session.status === "analyzing" && (
                      <span className="h-2 w-2 animate-pulse rounded-full bg-blue-500" />
                    )}
                    {STATUS_LABELS[session.status]}
                  </span>
                  {session.status === "failed" && session.errorMessage && (
                    <p className="break-words text-xs text-destructive">
                      {session.errorMessage}
                    </p>
                  )}
                  {session.analysisJobId && (
                    <span className="text-xs text-muted-foreground">
                      Job ID: {session.analysisJobId}
                    </span>
                  )}
                </div>
                <div className="mt-1 flex justify-end">
                  <Button
                    type="button"
                    onClick={() => onSelect(session)}
                    variant="outline"
                    size="sm"
                    fullWidth={false}
                  >
                    결과 보기
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
