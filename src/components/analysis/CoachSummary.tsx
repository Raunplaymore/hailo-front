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
  summary?: string | null;
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
  action: string | null;
  caution: string | null;
  theory: string | null;
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
  const main = [finding.evidence, finding.interpretation]
    .filter(Boolean)
    .join(" ");
  return {
    priority: finding.priority ?? null,
    main: main || finding.action || finding.key || "코칭 항목",
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

function isReferenceSignal(confidence: number | null, caution: string | null): boolean {
  return Boolean(caution) || (confidence !== null && confidence < 0.35);
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
  compact = false,
}: {
  items: CoachSummaryItem[];
  startIndex?: number;
  compact?: boolean;
}) {
  return (
    <ol className={cn(compact ? "space-y-2" : "space-y-3")}>
      {items.map(({ key, parsed, action, caution, theory, confidence, severity }, idx) => {
        const itemIndex = startIndex + idx;
        const confidenceText = confidenceLabel(confidence);
        const severityText = severity ? SEVERITY_LABELS[severity] ?? severity : null;
        const notice = lowConfidenceNotice(confidence, caution);
        const hasDetails = action || parsed.drill || parsed.checkpoint || caution || notice;
        const summaryText = compact ? compactText(parsed.main, 72) : compactText(parsed.main);
        const referenceSignal = isReferenceSignal(confidence, caution);
        return (
          <li key={`${itemIndex}-${key ?? parsed.main}`}>
            <details
              className={cn(
                "group rounded-2xl border bg-card/70 shadow-sm transition-colors open:bg-card",
                compact && "rounded-xl shadow-none",
              )}
            >
              <summary
                className={cn(
                  "flex cursor-pointer list-none flex-col gap-2 px-3 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden",
                  compact ? "min-h-10 py-2" : "min-h-12 py-3",
                )}
              >
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
                  {referenceSignal ? (
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700">
                      참고용
                    </span>
                  ) : null}
                  {hasDetails ? (
                    <span className="ml-auto rounded-full border border-border bg-background px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                      <span className="group-open:hidden">펼치기</span>
                      <span className="hidden group-open:inline">접기</span>
                    </span>
                  ) : null}
                </div>
                <p className={cn("break-words [overflow-wrap:anywhere] text-sm text-foreground", compact ? "leading-5" : "leading-6")}>{summaryText}</p>
              </summary>
              <div className="border-t px-3 pb-3 pt-2">
                <p className="break-words [overflow-wrap:anywhere] text-sm leading-6 text-foreground">{parsed.main}</p>
                {action ? (
                  <div className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
                    <p className="text-xs font-semibold text-emerald-900">수정 방향</p>
                    <p className="mt-1 break-words [overflow-wrap:anywhere] text-sm leading-6 text-emerald-950">{action}</p>
                  </div>
                ) : null}
                {theory ? (
                  <div className="mt-2 rounded-xl border border-border bg-muted/40 px-3 py-2">
                    <p className="text-xs font-semibold text-muted-foreground">판정 근거</p>
                    <p className="mt-1 break-words [overflow-wrap:anywhere] text-sm leading-6 text-foreground">{theory}</p>
                  </div>
                ) : null}
                {parsed.drill ? (
                  <div className="mt-2 rounded-xl bg-muted/60 px-3 py-2">
                    <p className="text-xs font-semibold text-muted-foreground">드릴</p>
                    <p className="mt-1 break-words [overflow-wrap:anywhere] text-sm leading-6 text-foreground">{parsed.drill}</p>
                  </div>
                ) : null}
                {parsed.checkpoint ? (
                  <div className="mt-2 rounded-xl border border-dashed px-3 py-2">
                    <p className="text-xs font-semibold text-muted-foreground">체크 포인트</p>
                    <p className="mt-1 break-words [overflow-wrap:anywhere] text-sm leading-6 text-foreground">{parsed.checkpoint}</p>
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

function PrimaryPracticePlan({ item }: { item: CoachSummaryItem }) {
  const steps = [
    { label: "수정", value: item.action },
    { label: "드릴", value: item.parsed.drill },
    { label: "체크", value: item.parsed.checkpoint },
  ].filter((step): step is { label: string; value: string } => Boolean(step.value));

  if (steps.length === 0) return null;

  return (
    <div className="w-full min-w-0 max-w-full overflow-hidden rounded-2xl border border-emerald-200 bg-emerald-50/80 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold text-emerald-900">바로 할 일</p>
        {item.parsed.priority ? (
          <span className="rounded-full border border-emerald-200 bg-white/70 px-2.5 py-1 text-[11px] font-semibold text-emerald-900">
            {item.parsed.priority}
          </span>
        ) : null}
      </div>
      <div className="mt-2 grid min-w-0 grid-cols-1 gap-2 lg:grid-cols-3">
        {steps.map((step, index) => (
          <div key={step.label} className="min-w-0 max-w-full overflow-hidden rounded-xl border border-emerald-200 bg-white/70 px-3 py-2">
            <p className="text-[11px] font-semibold text-emerald-800">
              {index + 1}. {step.label}
            </p>
            <p className="mt-1 max-w-full whitespace-normal break-all text-sm leading-5 text-emerald-950">{step.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function PrimaryEvidenceDetails({ item }: { item: CoachSummaryItem }) {
  return (
    <details className="group rounded-2xl border border-border bg-muted/20">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">판정 근거 보기</p>
          <p className="truncate text-xs text-muted-foreground">{compactText(item.parsed.main, 80)}</p>
        </div>
        <span className="shrink-0 rounded-full border border-border bg-background px-2.5 py-1 text-xs font-semibold text-muted-foreground">
          <span className="group-open:hidden">펼치기</span>
          <span className="hidden group-open:inline">접기</span>
        </span>
      </summary>
      <div className="border-t px-3 pb-3 pt-3">
        <CoachSummaryList items={[item]} compact />
      </div>
    </details>
  );
}

export function CoachSummary({ summary, comments, findings }: CoachSummaryProps) {
  const structured: CoachSummaryItem[] = findings?.length
    ? findings.map((finding) => ({
        key: finding.key ?? undefined,
        parsed: commentFromFinding(finding),
        action: finding.action ?? null,
        caution: finding.caution ?? null,
        theory: finding.theory ?? null,
        confidence: typeof finding.confidence === "number" ? finding.confidence : null,
        severity: finding.severity ?? null,
      }))
    : [];
  const fallback: CoachSummaryItem[] = structured.length > 0 ? [] : (comments ?? []).map((comment) => ({
    key: undefined,
    parsed: parseComment(comment),
    action: null,
    caution: null,
    theory: null,
    confidence: null,
    severity: null,
  }));
  const list = structured.length > 0 ? structured : fallback;
  const primaryItem = list.slice(0, 1);
  const extraItems = list.slice(1);
  return (
    <Card>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-lg">코치 액션</CardTitle>
        <CardDescription>요약과 가장 중요한 수정 포인트를 먼저 표시합니다.</CardDescription>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        {list.length === 0 ? (
          <p className="text-sm text-muted-foreground">{summary || "코멘트가 없습니다."}</p>
        ) : (
          <div className="space-y-3">
            {summary ? (
              <p className="rounded-xl border border-border bg-muted/35 px-3 py-2 text-sm leading-6 text-muted-foreground">
                {summary}
              </p>
            ) : null}
            {primaryItem[0] ? <PrimaryPracticePlan item={primaryItem[0]} /> : null}
            {primaryItem[0] ? <PrimaryEvidenceDetails item={primaryItem[0]} /> : null}
            {extraItems.length > 0 ? (
              <details className="group rounded-2xl border border-dashed bg-muted/20">
                <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
                  <span className="text-sm font-semibold text-foreground">나머지 코멘트 {extraItems.length}개</span>
                  <span className="rounded-full border border-border bg-background px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                    <span className="group-open:hidden">펼치기</span>
                    <span className="hidden group-open:inline">접기</span>
                  </span>
                </summary>
                <div className="border-t px-3 pb-3 pt-3">
                  <CoachSummaryList items={extraItems} startIndex={1} compact />
                </div>
              </details>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
