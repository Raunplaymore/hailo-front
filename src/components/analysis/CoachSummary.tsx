import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Video } from "lucide-react";
import type { CoachFinding, SwingEventKey } from "@/types/shots";

type CoachSummaryProps = {
  summary?: string | null;
  comments?: string[];
  findings?: CoachFinding[];
  events?: Partial<Record<SwingEventKey, { timeMs: number }>>;
  onWatchEvidence?: (event: SwingEventKey) => void;
};

function evidenceEvent(item: CoachSummaryItem): SwingEventKey | null {
  if (item.category === "backswing") return "top";
  if (item.category === "shaft_plane") return "impact";
  return null;
}

function EvidenceJump({ item, events, onWatchEvidence }: {
  item: CoachSummaryItem;
  events?: CoachSummaryProps["events"];
  onWatchEvidence?: CoachSummaryProps["onWatchEvidence"];
}) {
  const event = evidenceEvent(item);
  if (!event || events?.[event]?.timeMs == null || !onWatchEvidence) return null;
  return (
    <button
      type="button"
      onClick={() => onWatchEvidence(event)}
      className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-emerald-300 bg-white/80 px-3 py-2 text-sm font-semibold text-emerald-950 transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2"
    >
      <Video className="size-4" aria-hidden="true" />
      영상에서 확인
    </button>
  );
}

type ParsedComment = {
  priority: string | null;
  main: string;
  drill: string | null;
  checkpoint: string | null;
};

type CoachSummaryItem = {
  key?: string;
  category: string | null;
  parsed: ParsedComment;
  evidence: string | null;
  interpretation: string | null;
  action: string | null;
  caution: string | null;
  theory: string | null;
  confidence: number | null;
  severity: string | null;
  evidenceLevel: string | null;
};

const PRIORITY_CLASSES: Record<string, string> = {
  "1순위 패턴": "border-amber-200 bg-amber-50 text-amber-900",
  "2순위 패턴": "border-orange-200 bg-orange-50 text-orange-900",
  "전환 순서": "border-amber-200 bg-amber-50 text-amber-900",
  "임팩트 재현성": "border-sky-200 bg-sky-50 text-sky-900",
  "축 안정성": "border-indigo-200 bg-indigo-50 text-indigo-900",
  "스윙 경로": "border-violet-200 bg-violet-50 text-violet-900",
  "촬영 품질": "border-slate-200 bg-slate-50 text-slate-700",
  "범위 제한": "border-slate-200 bg-slate-50 text-slate-700",
  "분석 범위": "border-slate-200 bg-slate-50 text-slate-700",
  "개선 후보": "border-amber-200 bg-amber-50 text-amber-900",
  "유지": "border-emerald-200 bg-emerald-50 text-emerald-900",
};

const SEVERITY_LABELS: Record<string, string> = {
  critical: "긴급",
  high: "중요",
  medium: "확인",
  info: "참고",
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
    checkpoint: finding.checkpoint ?? null,
  };
}

function confidenceLabel(confidence: number | null): string | null {
  if (confidence === null || Number.isNaN(confidence)) return null;
  return `신뢰도 ${Math.round(Math.max(0, Math.min(1, confidence)) * 100)}%`;
}

function isReferenceSignal(confidence: number | null, caution: string | null, evidenceLevel?: string | null): boolean {
  return evidenceLevel === "reference" || Boolean(caution) || (confidence !== null && confidence < 0.35);
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

function instructionTokens(value: string): Set<string> {
  return new Set(
    value
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .map((token) => token.trim())
      .filter(Boolean)
  );
}

function areInstructionsRedundant(first: string, second: string): boolean {
  const left = instructionTokens(first);
  const right = instructionTokens(second);
  if (left.size === 0 || right.size === 0) return false;
  const intersection = [...left].filter((token) => right.has(token)).length;
  const union = new Set([...left, ...right]).size;
  const overlap = intersection / Math.min(left.size, right.size);
  const jaccard = intersection / union;
  return overlap >= 0.8 && jaccard >= 0.7;
}

const FINDING_TITLES: Record<string, string> = {
  tempo_rushed_transition: "전환이 너무 급해요",
  tempo_reference_candidate: "전환 리듬을 다시 확인해요",
  shoulder_turn_reference_candidate: "몸통 회전 여유를 확인해요",
  sequence_rushed_proxy: "다운스윙은 몸부터 시작해요",
  impact_unstable: "임팩트를 더 일정하게 만들어요",
  head_unstable: "상체 중심을 안정적으로 유지해요",
  path_inside_out: "클럽이 몸 뒤에 남지 않게 해요",
  backswing_adequate: "백스윙 크기는 지금처럼 유지해요",
  shaft_neutral: "샤프트 플레인은 현재 범위에서 유지해요",
};

function findingTitle(item: CoachSummaryItem): string {
  if (item.key && FINDING_TITLES[item.key]) return FINDING_TITLES[item.key];
  return item.parsed.priority ?? item.category ?? "스윙 포인트";
}

function actionText(item: CoachSummaryItem): string {
  return item.action ?? item.parsed.main;
}

function EvidenceDetails({ item }: { item: CoachSummaryItem }) {
  const confidenceText = confidenceLabel(item.confidence);
  const notice = lowConfidenceNotice(item.confidence, item.caution);
  const reference = isReferenceSignal(item.confidence, item.caution, item.evidenceLevel)
    ? "이번 영상의 개선 후보입니다. 같은 신호가 반복되는지 확인하면서 적용하세요."
    : null;
  const evidence = [
    item.evidence ? { label: "영상에서 보인 점", value: item.evidence } : null,
    item.interpretation ? { label: "이렇게 해석했어요", value: item.interpretation } : null,
    item.theory ? { label: "분석 방식", value: item.theory } : null,
  ].filter((entry): entry is { label: string; value: string } => Boolean(entry));

  if (evidence.length === 0 && !item.caution && !notice && !confidenceText) return null;

  return (
    <details className="group rounded-xl border border-border bg-muted/25">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
        <span className="text-sm font-semibold text-foreground">왜 이 조언이 나왔나요?</span>
        <span className="shrink-0 rounded-full border border-border bg-background px-2.5 py-1 text-xs font-semibold text-muted-foreground">
          <span className="group-open:hidden">보기</span>
          <span className="hidden group-open:inline">닫기</span>
        </span>
      </summary>
      <div className="space-y-2 border-t px-3 pb-3 pt-3">
        {evidence.map((entry) => (
          <div key={entry.label}>
            <p className="text-xs font-semibold text-muted-foreground">{entry.label}</p>
            <p className="mt-1 break-words [overflow-wrap:anywhere] text-sm leading-6 text-foreground">{entry.value}</p>
          </div>
        ))}
        {confidenceText ? <p className="text-xs text-muted-foreground">{confidenceText}</p> : null}
        {reference ? <p className="text-xs leading-5 text-muted-foreground">{reference}</p> : null}
        {item.caution ? <p className="text-xs leading-5 text-muted-foreground">{item.caution}</p> : null}
        {notice ? <p className="text-xs leading-5 text-muted-foreground">{notice}</p> : null}
      </div>
    </details>
  );
}

function PracticeSteps({ item }: { item: CoachSummaryItem }) {
  const candidates = [
    { label: "스윙에서 느낄 것", value: actionText(item) },
    { label: "연습 방법", value: item.parsed.drill },
    { label: "확인할 것", value: item.parsed.checkpoint },
  ].filter((step): step is { label: string; value: string } => Boolean(step.value));
  const steps = candidates.filter(
    (step, index) =>
      !candidates
        .slice(0, index)
        .some((previous) => areInstructionsRedundant(previous.value, step.value))
  );

  if (steps.length === 0) return null;

  return (
    <ol className="space-y-2">
      {steps.map((step, index) => (
        <li key={step.label} className="flex gap-3 rounded-xl border border-emerald-200 bg-white/75 px-3 py-3">
          <span className="grid size-6 shrink-0 place-items-center rounded-full bg-emerald-700 text-xs font-bold text-white">{index + 1}</span>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-emerald-900">{step.label}</p>
            <p className="mt-1 break-words [overflow-wrap:anywhere] text-sm leading-6 text-emerald-950">{step.value}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function PrimaryPracticePlan({ item, events, onWatchEvidence }: {
  item: CoachSummaryItem;
  events?: CoachSummaryProps["events"];
  onWatchEvidence?: CoachSummaryProps["onWatchEvidence"];
}) {
  const severityText = item.severity ? SEVERITY_LABELS[item.severity] ?? item.severity : null;
  const reference = isReferenceSignal(item.confidence, item.caution, item.evidenceLevel)
    ? "확정 진단이 아닌 개선 후보입니다. 무리하지 말고 다음 스윙과 비교하세요."
    : null;
  return (
    <section className="rounded-2xl border border-emerald-200 bg-emerald-50/75 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-emerald-900">이번 스윙에서 하나만</span>
        {severityText ? <span className="rounded-full border border-emerald-200 bg-white/75 px-2.5 py-1 text-xs font-semibold text-emerald-900">{severityText}</span> : null}
        {item.parsed.priority ? (
          <span className={cn("rounded-full border px-2.5 py-1 text-xs font-semibold", PRIORITY_CLASSES[item.parsed.priority] ?? "border-emerald-200 bg-white/75 text-emerald-900")}>
            {item.parsed.priority}
          </span>
        ) : null}
        {reference ? <span className="rounded-full border border-slate-200 bg-white/75 px-2.5 py-1 text-xs font-semibold text-slate-700">참고해서 보기</span> : null}
      </div>
      <h3 className="mt-3 text-lg font-bold tracking-tight text-emerald-950">{findingTitle(item)}</h3>
      <p className="mt-1 text-sm leading-6 text-emerald-900">
        {item.parsed.drill
          ? "아래 연습 하나만 천천히 반복해 보세요."
          : "아래 한 가지 기준만 다음 스윙에서 확인해 보세요."}
      </p>
      <div className="mt-3"><PracticeSteps item={item} /></div>
      <div className="mt-3"><EvidenceJump item={item} events={events} onWatchEvidence={onWatchEvidence} /></div>
      {reference ? <p className="mt-3 text-xs leading-5 text-emerald-900/80">{reference}</p> : null}
    </section>
  );
}

function AdditionalFindings({ items }: { items: CoachSummaryItem[] }) {
  if (items.length === 0) return null;
  return (
    <details className="group rounded-2xl border border-dashed bg-muted/20">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
        <div>
          <p className="text-sm font-semibold text-foreground">추가로 확인할 점 {items.length}개</p>
          <p className="text-xs text-muted-foreground">첫 번째 연습이 익숙해진 뒤에만 펼쳐 보세요.</p>
        </div>
        <span className="shrink-0 rounded-full border border-border bg-background px-2.5 py-1 text-xs font-semibold text-muted-foreground">
          <span className="group-open:hidden">보기</span>
          <span className="hidden group-open:inline">닫기</span>
        </span>
      </summary>
      <ol className="space-y-2 border-t px-3 pb-3 pt-3">
        {items.map((item, index) => (
          <li key={`${index}-${item.key ?? item.parsed.main}`}>
            <details className="group/item rounded-xl border bg-card/70">
              <summary className="flex cursor-pointer list-none flex-col gap-1 px-3 py-3 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-muted-foreground">#{index + 2}</span>
                  <p className="text-sm font-semibold text-foreground">{findingTitle(item)}</p>
                  <span className="ml-auto shrink-0 text-xs text-muted-foreground group-open/item:hidden">보기</span>
                  <span className="ml-auto hidden shrink-0 text-xs text-muted-foreground group-open/item:inline">닫기</span>
                </div>
                <p className="break-words [overflow-wrap:anywhere] text-sm leading-5 text-muted-foreground">{compactText(actionText(item), 110)}</p>
              </summary>
              <div className="space-y-2 border-t px-3 pb-3 pt-3">
                {item.parsed.drill ? <div><p className="text-xs font-semibold text-muted-foreground">연습 방법</p><p className="mt-1 text-sm leading-6 text-foreground">{item.parsed.drill}</p></div> : null}
                {item.parsed.checkpoint ? <div><p className="text-xs font-semibold text-muted-foreground">확인할 것</p><p className="mt-1 text-sm leading-6 text-foreground">{item.parsed.checkpoint}</p></div> : null}
                <EvidenceDetails item={item} />
              </div>
            </details>
          </li>
        ))}
      </ol>
    </details>
  );
}

function MaintainPoints({ items }: { items: CoachSummaryItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/40 px-3 py-3">
      <p className="text-sm font-semibold text-emerald-950">지금처럼 유지할 점</p>
      <ul className="mt-2 space-y-2">
        {items.map((item) => (
          <li key={item.key ?? item.parsed.main} className="rounded-xl bg-white/60 px-3 py-2">
            <p className="text-sm font-semibold text-emerald-950">{findingTitle(item)}</p>
            <p className="mt-1 text-sm leading-5 text-emerald-900">{compactText(actionText(item), 120)}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function QualityNotices({ items }: { items: CoachSummaryItem[] }) {
  if (items.length === 0) return null;
  return (
    <Card>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-base">촬영·분석 확인</CardTitle>
        <CardDescription>
          스윙 자세 조언이 아니라, 분석 구간과 데이터 품질에 관한 안내입니다.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 p-4 pt-0">
        {items.map((item) => (
          <div key={item.key ?? item.parsed.main} className="rounded-xl border border-border bg-muted/25 px-3 py-3">
            <p className="text-sm font-semibold text-foreground">
              {item.parsed.priority ?? "분석 범위"}
            </p>
            {item.evidence ? (
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.evidence}</p>
            ) : null}
            <p className="mt-1 text-sm leading-6 text-foreground">{actionText(item)}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function CoachSummary({ summary, comments, findings, events, onWatchEvidence }: CoachSummaryProps) {
  const structured: CoachSummaryItem[] = findings?.length
    ? findings.map((finding) => ({
        key: finding.key ?? undefined,
        category: finding.category ?? null,
        parsed: commentFromFinding(finding),
        evidence: finding.evidence ?? null,
        interpretation: finding.interpretation ?? null,
        action: finding.action ?? null,
        caution: finding.caution ?? null,
        theory: finding.theory ?? null,
        confidence: typeof finding.confidence === "number" ? finding.confidence : null,
        severity: finding.severity ?? null,
        evidenceLevel: finding.evidenceLevel ?? null,
      }))
    : [];
  const fallback: CoachSummaryItem[] = structured.length > 0 ? [] : (comments ?? []).map((comment) => ({
    key: undefined,
    category: null,
    parsed: parseComment(comment),
    evidence: null,
    interpretation: null,
    action: null,
    caution: null,
    theory: null,
    confidence: null,
    severity: null,
    evidenceLevel: null,
  }));
  const rawList = structured.length > 0 ? structured : fallback;
  const hasTempoTransitionFinding = rawList.some((item) => item.key === "tempo_rushed_transition");
  const list = hasTempoTransitionFinding
    ? rawList.filter((item) => item.key !== "sequence_rushed_proxy")
    : rawList;
  const qualityItems = list.filter((item) => item.category === "quality");
  const coachingItems = list.filter((item) => item.category !== "quality");
  const actionItems = coachingItems.filter((item) => item.severity !== "info");
  const primaryItem = actionItems[0] ?? null;
  const extraItems = actionItems.filter((item) => item !== primaryItem);
  const maintainItems = coachingItems.filter((item) => item.severity === "info");
  return (
    <div className="space-y-3">
      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-lg">코치 액션</CardTitle>
          <CardDescription>
            확정 교정과 근거가 있는 개선 후보를 구분해 하나씩 제공합니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          {coachingItems.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-4 py-4">
              <p className="text-sm font-semibold text-foreground">이번 영상에서는 교정 액션을 보류했습니다.</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                신뢰할 수 있는 스윙 교정 근거가 확보되지 않아 촬영 안내를 코칭으로 대신하지 않습니다.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {primaryItem ? <PrimaryPracticePlan item={primaryItem} events={events} onWatchEvidence={onWatchEvidence} /> : (
                <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/40 px-4 py-3">
                  <p className="text-sm font-semibold text-emerald-950">확인된 범위에서는 새 교정 항목이 없습니다.</p>
                  <p className="mt-1 text-sm leading-6 text-emerald-900">
                    유지점은 확인된 항목에만 해당하며 스윙 전체 평가가 아닙니다.
                  </p>
                </div>
              )}
              {primaryItem ? <EvidenceDetails item={primaryItem} /> : null}
              <AdditionalFindings items={extraItems} />
              <MaintainPoints items={maintainItems} />
            </div>
          )}
        </CardContent>
      </Card>
      <QualityNotices items={qualityItems} />
    </div>
  );
}
