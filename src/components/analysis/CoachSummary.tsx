import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

type CoachSummaryProps = {
  comments?: string[];
};

type ParsedComment = {
  priority: string | null;
  main: string;
  drill: string | null;
  checkpoint: string | null;
};

const PRIORITY_CLASSES: Record<string, string> = {
  "1순위 패턴": "border-amber-200 bg-amber-50 text-amber-900",
  "2순위 패턴": "border-orange-200 bg-orange-50 text-orange-900",
  "임팩트 재현성": "border-sky-200 bg-sky-50 text-sky-900",
  "촬영 품질": "border-slate-200 bg-slate-50 text-slate-700",
  "범위 제한": "border-slate-200 bg-slate-50 text-slate-700",
  "유지": "border-emerald-200 bg-emerald-50 text-emerald-900",
};

function splitFirst(value: string, marker: string): [string, string | null] {
  const index = value.indexOf(marker);
  if (index < 0) return [value.trim(), null];
  return [value.slice(0, index).trim(), value.slice(index + marker.length).trim()];
}

function parseComment(comment: string): ParsedComment {
  const priorityMatch = comment.match(/^\[([^\]]+)\]\s*/);
  const priority = priorityMatch?.[1] ?? null;
  const withoutPriority = priorityMatch ? comment.slice(priorityMatch[0].length) : comment;
  const [beforeDrill, drillAndRest] = splitFirst(withoutPriority, " 드릴: ");
  if (!drillAndRest) {
    const [main, checkpoint] = splitFirst(beforeDrill, " 체크: ");
    return { priority, main, drill: null, checkpoint };
  }
  const [drill, checkpoint] = splitFirst(drillAndRest, " 체크: ");
  return { priority, main: beforeDrill, drill, checkpoint };
}

export function CoachSummary({ comments }: CoachSummaryProps) {
  const list = comments ?? [];
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">코치 코멘트</CardTitle>
        <CardDescription>우선순위, 처방 드릴, 확인 포인트를 분리해 보여줍니다.</CardDescription>
      </CardHeader>
      <CardContent>
        {list.length === 0 ? (
          <p className="text-sm text-muted-foreground">코멘트가 없습니다.</p>
        ) : (
          <ol className="space-y-3">
            {list.map((comment, idx) => {
              const parsed = parseComment(comment);
              return (
                <li key={`${idx}-${comment}`} className="rounded-2xl border bg-card/70 p-3 shadow-sm">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-muted-foreground">#{idx + 1}</span>
                    {parsed.priority ? (
                      <span
                        className={cn(
                          "rounded-full border px-2.5 py-1 text-xs font-semibold",
                          PRIORITY_CLASSES[parsed.priority] ?? "border-primary/20 bg-primary/10 text-primary",
                        )}
                      >
                        {parsed.priority}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-sm leading-6 text-foreground">{parsed.main}</p>
                  {parsed.drill ? (
                    <div className="mt-2 rounded-xl bg-muted/60 px-3 py-2">
                      <p className="text-xs font-semibold text-muted-foreground">드릴</p>
                      <p className="mt-1 text-sm leading-6 text-foreground">{parsed.drill}</p>
                    </div>
                  ) : null}
                  {parsed.checkpoint ? (
                    <div className="mt-2 rounded-xl border border-dashed px-3 py-2">
                      <p className="text-xs font-semibold text-muted-foreground">체크 포인트</p>
                      <p className="mt-1 text-sm leading-6 text-foreground">{parsed.checkpoint}</p>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
