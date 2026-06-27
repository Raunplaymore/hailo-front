import type { CSSProperties } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Eye, Trash2 } from "lucide-react";
import { SessionRecord, SessionStatus } from "@/types/session";

type SessionListProps = {
  sessions: SessionRecord[];
  isLoading?: boolean;
  error?: string | null;
  onRefresh: () => void;
  onSelect: (session: SessionRecord) => void;
  onDelete: (session: SessionRecord) => void;
  deletingId?: string | null;
  title?: string;
  emptyMessage?: string;
};

const STATUS_LABELS: Record<SessionStatus, string> = {
  recording: "촬영 중",
  recorded: "촬영 완료",
  analyzing: "분석 중",
  done: "분석 완료",
  failed: "분석 실패",
};

const STATUS_STYLES: Record<SessionStatus, string> = {
  recording: "bg-amber-400/10 text-amber-100 border border-amber-300/30",
  recorded: "bg-muted/60 text-muted-foreground border border-border",
  analyzing: "bg-sky-400/10 text-sky-100 border border-sky-300/30",
  done: "bg-emerald-400/10 text-emerald-100 border border-emerald-300/30",
  failed: "bg-red-400/10 text-red-100 border border-red-300/30",
};

export function SessionList({
  sessions,
  isLoading,
  error,
  onRefresh,
  onSelect,
  onDelete,
  deletingId,
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
                className="flex w-full flex-col gap-3 break-words rounded-xl border border-border bg-card p-3 text-sm"
              >
                <div className="min-w-0 space-y-1">
                  <span className="block w-full text-sm font-semibold leading-5" style={TITLE_CLAMP_STYLE}>
                    {session.filename}
                  </span>
                  <span className="block break-words text-xs text-muted-foreground">
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
                      <span className="h-2 w-2 animate-pulse rounded-full bg-sky-300" />
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
                <div className="mt-1 flex flex-wrap justify-end gap-2 border-t border-border/70 pt-3">
                  <Button
                    type="button"
                    onClick={() => onSelect(session)}
                    variant="outline"
                    size="sm"
                    fullWidth={false}
                    disabled={session.status === "recording"}
                    className="gap-2"
                  >
                    <Eye className="h-4 w-4" />
                    결과 보기
                  </Button>
                  <Button
                    type="button"
                    onClick={() => onDelete(session)}
                    variant="destructive"
                    size="icon"
                    fullWidth={false}
                    disabled={session.status === "recording" || deletingId === session.id}
                    aria-label={deletingId === session.id ? "삭제 중" : "삭제"}
                    title={deletingId === session.id ? "삭제 중" : "삭제"}
                  >
                    <Trash2 className="h-4 w-4" />
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

const TITLE_CLAMP_STYLE: CSSProperties = {
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
};
