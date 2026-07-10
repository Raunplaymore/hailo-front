import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { CoachFinding } from "@/types/shots";

type CoachSummaryProps = {
  comments?: string[];
  findings?: CoachFinding[];
};

type ParsedComment = {
  priority: string | null;
  main: string;
  drill: string | null;
  checkpoint: string | null;
};

type CoachSummaryItem = {
  key?: string;
  parsed: ParsedComment;
  caution: string | null;
  confidence: number | null;
  severity: string | null;
};

const PRIORITY_CLASSES: Record<string, string> = {
  "1순위 패턴": "border-amber-200 bg-amber-50 text-amber-900",
  "2순위 패턴": "border-orange-200 bg-orange-50 text-orange-900",
  "임팩트 재현성": "border-sky-200 bg-sky-50 text-sky-900",
  "촬영 품질": "border-slate-200 bg-slate-50 text-slate-700",
  "범위 제한": "border-slate-200 bg-slate-50 text-slate-700",
  "유지": "border-emerald-200 bg-emerald-50 text-emerald-900",
};

const SEVERITY_LABELS: Record<string, string> = {
  critical: "긴급",
  high: "중요",
  medium: "확인",
  info: "참고",
};

const SEVERITY_CLASSES: Record<string, string> = {
  critical: "border-red-200 bg-red-50 text-red-900",
  high: "border-amber-200 bg-amber-50 text-amber-900",
  medium: "border-sky-200 bg-sky-50 text-sky-900",
  info: "border-slate-200 bg-slate-50 text-slate-700",
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

function commentFromFinding(finding: CoachFinding): ParsedComment {
  const main = [finding.evidence, finding.interpretation, finding.action]
    .filter(Boolean)
    .join(" ");
  return {
    priority: finding.priority ?? null,
    main: main || finding.key || "코칭 항목",
    drill: finding.drill ?? null,
    checkpoint: finding.checkpoint ?? finding.caution ?? null,
  };
}

function confidenceLabel(confidence: number | null): string | null {
  if (confidence === null || Number.isNaN(confidence)) return null;
  return `신뢰도 ${Math.round(Math.max(0, Math.min(1, confidence)) * 100)}%`;
}

function confidenceClass(confidence: number | null): string {
  if (confidence === null) return "border-slate-200 bg-slate-50 text-slate-700";
  if (confidence < 0.35) return "border-slate-200 bg-slate-50 text-slate-700";
  if (confidence < 0.6) return "border-yellow-200 bg-yellow-50 text-yellow-900";
  return "border-emerald-200 bg-emerald-50 text-emerald-900";
}

function lowConfidenceNotice(confidence: number | null, caution: string | null): string | null {
  if (caution) return null;
  if (confidence !== null && confidence < 0.35) {
    return "트래킹 신뢰도가 낮아 확정 진단보다 참고 신호로 해석하세요.";
  }
  return null;
}

function compactText(value: string, maxLength = 96): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trim()}…`;
}

function CoachSummaryList({
  items,
  startIndex = 0,
}: {
  items: CoachSummaryItem[];
  startIndex?: number;
}) {
  return (
    <ol className="space-y-3">
      {items.map(({ key, parsed, caution, confidence, severity }, idx) => {
        const itemIndex = startIndex + idx;
        const confidenceText = confidenceLabel(confidence);
        const severityText = severity ? SEVERITY_LABELS[severity] ?? severity : null;
        const notice = lowConfidenceNotice(confidence, caution);
        const hasDetails = parsed.drill || parsed.checkpoint || caution || notice;
        return (
          <li key={`${itemIndex}-${key ?? parsed.main}`}>
            <details
              className="group rounded-2xl border bg-card/70 shadow-sm transition-colors open:bg-card"
              open={itemIndex === 0}
            >
              <summary className="flex min-h-12 cursor-pointer list-none flex-col gap-2 px-3 py-3 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-muted-foreground">#{itemIndex + 1}</span>
                  {severityText ? (
                    <span
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-xs font-semibold",
                        severity ? SEVERITY_CLASSES[severity] : undefined,
                      )}
                    >
                      {severityText}
                    </span>
                  ) : null}
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
                  {confidenceText ? (
                    <span
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-xs font-semibold",
                        confidenceClass(confidence),
                      )}
                    >
                      {confidenceText}
                    </span>
                  ) : null}
                  {hasDetails ? (
                    <span className="ml-auto rounded-full border border-border bg-background px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                      <span className="group-open:hidden">펼치기</span>
                      <span className="hidden group-open:inline">접기</span>
                    </span>
                  ) : null}
                </div>
                <p className="text-sm leading-6 text-foreground">{compactText(parsed.main)}</p>
              </summary>
              <div className="border-t px-3 pb-3 pt-2">
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
                {caution && caution !== parsed.checkpoint ? (
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">{caution}</p>
                ) : null}
                {notice ? (
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">{notice}</p>
                ) : null}
              </div>
            </details>
          </li>
        );
      })}
    </ol>
  );
}

export function CoachSummary({ comments, findings }: CoachSummaryProps) {
  const structured: CoachSummaryItem[] = findings?.length
    ? findings.map((finding) => ({
        key: finding.key ?? undefined,
        parsed: commentFromFinding(finding),
        caution: finding.caution ?? null,
        confidence: typeof finding.confidence === "number" ? finding.confidence : null,
        severity: finding.severity ?? null,
      }))
    : [];
  const fallback: CoachSummaryItem[] = structured.length > 0 ? [] : (comments ?? []).map((comment) => ({
    key: undefined,
    parsed: parseComment(comment),
    caution: null,
    confidence: null,
    severity: null,
  }));
  const list = structured.length > 0 ? structured : fallback;
  const primaryItems = list.slice(0, 3);
  const extraItems = list.slice(3);
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">코치 코멘트</CardTitle>
        <CardDescription>핵심 항목은 요약으로 접고, 필요한 드릴과 체크 포인트만 펼쳐서 봅니다.</CardDescription>
      </CardHeader>
      <CardContent>
        {list.length === 0 ? (
          <p className="text-sm text-muted-foreground">코멘트가 없습니다.</p>
        ) : (
          <div className="space-y-3">
            <CoachSummaryList items={primaryItems} />
            {extraItems.length > 0 ? (
              <details className="group rounded-2xl border border-dashed bg-muted/20">
                <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
                  <span className="text-sm font-semibold text-foreground">추가 코멘트 {extraItems.length}개</span>
                  <span className="rounded-full border border-border bg-background px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                    <span className="group-open:hidden">펼치기</span>
                    <span className="hidden group-open:inline">접기</span>
                  </span>
                </summary>
                <div className="border-t px-3 pb-3 pt-3">
                  <CoachSummaryList items={extraItems} startIndex={3} />
                </div>
              </details>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
