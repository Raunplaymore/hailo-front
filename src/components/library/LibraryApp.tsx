import { FormEvent, useEffect, useMemo, useState } from "react";
import { Archive, CalendarDays, ChevronLeft, ChevronRight, Clock3, Film, ImageOff, RefreshCw, Trash2, Video } from "lucide-react";
import { normalizeAnalysis } from "../../api/shots";
import { AnalysisPlayer } from "../analysis/AnalysisPlayer";
import { CoachSummary } from "../analysis/CoachSummary";
import { KeyMetrics } from "../analysis/KeyMetrics";
import { Button } from "../Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import type { AnalysisResult, JobStatus, SwingEventKey } from "../../types/shots";

type LibraryJob = {
  jobId: string;
  status?: string;
  archivedAt?: string;
  videoStored: boolean;
  thumbnailUrl?: string | null;
  posterUrl?: string | null;
  shot?: { media?: { filename?: string }; originalName?: string } | null;
  analysis?: { summary?: string; confidence?: number } | null;
};

type LibraryDetail = LibraryJob & {
  analysis?: unknown;
  progress?: unknown;
  artifacts?: Array<{ artifact?: string; filename?: string }>;
};

type LibraryListResponse = {
  jobs: LibraryJob[];
  total?: number;
  nextCursor?: string | null;
};

type PeriodFilter = "all" | "7d" | "30d" | "90d" | "year";

const PERIOD_OPTIONS: Array<{ value: PeriodFilter; label: string; days?: number }> = [
  { value: "all", label: "전체" },
  { value: "7d", label: "7일", days: 7 },
  { value: "30d", label: "30일", days: 30 },
  { value: "90d", label: "90일", days: 90 },
  { value: "year", label: "올해" },
];

function sinceForPeriod(period: PeriodFilter) {
  if (period === "all") return null;
  const since = new Date();
  if (period === "year") since.setMonth(0, 1);
  else since.setDate(since.getDate() - (PERIOD_OPTIONS.find((option) => option.value === period)?.days ?? 0));
  return since.toISOString();
}

function analysisForLibrary(job: LibraryDetail | null): AnalysisResult | null {
  if (!job?.analysis || typeof job.analysis !== "object") return null;
  return normalizeAnalysis(job.analysis, job.jobId, (job.status ?? "succeeded") as JobStatus);
}

function qualityFor(job: LibraryJob) {
  const analysis = job.analysis;
  if (!analysis || typeof analysis !== "object") return { label: "분석 보관", className: "border-border bg-muted text-muted-foreground" };
  const confidence = typeof analysis.confidence === "number" ? analysis.confidence : null;
  const tracking = (analysis as { metrics?: { trackingQuality?: { score?: number; confidence?: number } } }).metrics?.trackingQuality;
  const score = Math.min(confidence ?? 1, tracking?.score ?? tracking?.confidence ?? 1);
  if (job.status === "failed") return { label: "분석 실패", className: "border-red-300/40 bg-red-500/10 text-red-100" };
  if (score < 0.25) return { label: "참고용 분석", className: "border-slate-300/30 bg-slate-400/10 text-slate-100" };
  if (score < 0.5) return { label: "일부 참고", className: "border-amber-300/30 bg-amber-400/10 text-amber-100" };
  return { label: "분석 완료", className: "border-emerald-300/30 bg-emerald-400/10 text-emerald-100" };
}

function thumbnailFor(job: LibraryJob) {
  return job.thumbnailUrl || job.posterUrl || null;
}

function archiveDate(job: LibraryJob) {
  if (!job.archivedAt) return null;
  const date = new Date(job.archivedAt);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateLabel(job: LibraryJob) {
  const date = archiveDate(job);
  if (!date) return "날짜 정보 없음";
  return new Intl.DateTimeFormat("ko-KR", { month: "short", day: "numeric", weekday: "short" }).format(date);
}

async function libraryRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...options,
    credentials: "include",
    headers: { Accept: "application/json", ...(options.headers || {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(String(body.error || body.message || response.statusText));
  return body as T;
}

export function LibraryApp() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [jobs, setJobs] = useState<LibraryJob[]>([]);
  const [selected, setSelected] = useState<LibraryDetail | null>(null);
  const [coachEvidenceFocus, setCoachEvidenceFocus] = useState<{ event: SwingEventKey; requestId: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState<PeriodFilter>("all");
  const [pageSize, setPageSize] = useState(12);
  const [cursorStack, setCursorStack] = useState<string[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const selectedAnalysis = useMemo(() => analysisForLibrary(selected), [selected]);

  const loadJobs = async (cursor = "") => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: String(pageSize) });
      if (cursor) params.set("cursor", cursor);
      const since = sinceForPeriod(period);
      if (since) params.set("since", since);
      const result = await libraryRequest<LibraryListResponse>(`/api/library/jobs?${params.toString()}`);
      setJobs(result.jobs || []);
      setTotal(result.total ?? result.jobs?.length ?? 0);
      setNextCursor(result.nextCursor ?? null);
      setError(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "기록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    libraryRequest<{ authenticated: boolean }>("/api/auth/me")
      .then(() => {
        setAuthenticated(true);
      })
      .catch(() => setAuthenticated(false));
  }, []);

  useEffect(() => {
    if (!authenticated) return;
    setCursorStack([]);
    void loadJobs();
  }, [authenticated, period, pageSize]);

  const login = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await libraryRequest("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      setPassword("");
      setAuthenticated(true);
    } catch {
      setError("비밀번호를 확인하세요.");
    }
  };

  const openJob = async (jobId: string) => {
    try {
      const result = await libraryRequest<{ job: LibraryDetail }>(`/api/library/jobs/${encodeURIComponent(jobId)}`);
      setSelected(result.job);
      setError(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "분석 결과를 불러오지 못했습니다.");
    }
  };

  const deleteJob = async (jobId: string) => {
    if (!window.confirm("이 스윙 기록과 NAS 보관 파일을 삭제할까요? Pi에도 삭제 이력이 동기화됩니다.")) return;
    try {
      await libraryRequest(`/api/library/jobs/${encodeURIComponent(jobId)}`, { method: "DELETE" });
      if (selected?.jobId === jobId) setSelected(null);
      const currentCursor = cursorStack.at(-1) ?? "";
      await loadJobs(currentCursor);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "삭제하지 못했습니다.");
    }
  };

  if (authenticated === null) {
    return <main className="mx-auto flex min-h-screen max-w-xl items-center p-5 text-sm text-muted-foreground">NAS 라이브러리를 확인 중입니다.</main>;
  }

  const currentPage = cursorStack.length + 1;
  const changePeriod = (nextPeriod: PeriodFilter) => {
    if (nextPeriod === period) return;
    setPeriod(nextPeriod);
  };

  const goNextPage = async () => {
    if (!nextCursor) return;
    setCursorStack((previous) => [...previous, nextCursor]);
    await loadJobs(nextCursor);
  };

  const goPreviousPage = async () => {
    if (!cursorStack.length) return;
    const previousStack = cursorStack.slice(0, -1);
    setCursorStack(previousStack);
    await loadJobs(previousStack.at(-1) ?? "");
  };

  const firstArchivedDate = jobs.reduce<Date | null>((latest, job) => {
    const date = archiveDate(job);
    return date && (!latest || date > latest) ? date : latest;
  }, null);

  if (!authenticated) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md items-center p-5">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Hailo Swing Library</CardTitle>
            <CardDescription>NAS에 보관된 완료 스윙을 안전하게 조회합니다.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-3" onSubmit={login}>
              <label className="grid gap-1 text-sm font-medium">
                라이브러리 비밀번호
                <input className="rounded-md border bg-background px-3 py-2" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
              </label>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button className="w-full" type="submit">로그인</Button>
            </form>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-5xl space-y-4 p-3 pb-10 sm:space-y-5 sm:p-6">
      <header className="flex items-center justify-between gap-3 py-1 sm:py-2">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-2xl border border-primary/25 bg-primary/10 text-primary shadow-[0_8px_24px_hsl(var(--primary)/0.12)]"><Archive className="size-5" aria-hidden="true" /></span>
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-tight">스윙 라이브러리</h1>
            <p className="text-xs text-muted-foreground sm:text-sm">보관본을 찾아보고 학습 후보를 고르세요</p>
          </div>
        </div>
        <Button variant="outline" fullWidth={false} className="grid size-11 place-items-center !p-0" aria-label="기록 새로고침" title="기록 새로고침" onClick={() => loadJobs(cursorStack.at(-1) ?? "")} disabled={loading}>
          <RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} aria-hidden="true" />
        </Button>
      </header>
      {error && <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      {selected && (
        <section className="space-y-3" aria-label="선택한 스윙 분석">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-primary">보관된 분석</p>
              <h2 className="truncate text-lg font-bold">{selected.shot?.originalName || selected.shot?.media?.filename || selected.jobId}</h2>
              <p className="text-xs text-muted-foreground">{selected.archivedAt ? new Date(selected.archivedAt).toLocaleString() : selected.jobId}</p>
            </div>
            <Button variant="outline" fullWidth={false} className="min-h-11 px-3 py-2 text-sm" onClick={() => setSelected(null)}><ChevronLeft className="mr-1 size-4" aria-hidden="true" />목록</Button>
          </div>
          {selected.videoStored ? (
            <AnalysisPlayer
              videoUrl={`/api/library/jobs/${encodeURIComponent(selected.jobId)}/video`}
              events={selectedAnalysis?.events}
              overlay={selectedAnalysis?.overlay}
              evidenceFocus={coachEvidenceFocus}
            />
          ) : <p className="rounded-xl border border-dashed bg-muted/40 p-4 text-sm text-muted-foreground">원본 영상은 없고 분석 결과만 보관되어 있습니다.</p>}
          {selectedAnalysis ? <KeyMetrics analysis={selectedAnalysis} status={selectedAnalysis.status} /> : null}
          {selectedAnalysis ? <CoachSummary summary={selectedAnalysis.summary} comments={selectedAnalysis.coachSummary} findings={selectedAnalysis.coachFindings} events={selectedAnalysis.events} onWatchEvidence={(event) => setCoachEvidenceFocus((current) => ({ event, requestId: (current?.requestId ?? 0) + 1 }))} /> : (
            <Card><CardContent className="p-4 text-sm text-muted-foreground">이 기록은 이전 형식으로 보관되어 상세 코칭을 표시할 수 없습니다.</CardContent></Card>
          )}
          <Card className="border-destructive/30">
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">삭제하면 NAS 보관 파일이 제거되고 Pi에 삭제 이력이 동기화됩니다.</p>
              <Button variant="danger" fullWidth={false} className="min-h-11 rounded-xl px-3 py-2" onClick={() => deleteJob(selected.jobId)}><Trash2 className="mr-2 size-4" aria-hidden="true" />이 기록 삭제</Button>
            </CardContent>
          </Card>
        </section>
      )}
      <Card className="overflow-hidden border-border/90">
        <CardHeader className="gap-4 p-4 pb-3 sm:p-6 sm:pb-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.15em] text-primary"><Film className="size-3.5" aria-hidden="true" /> Archive</p>
              <CardTitle className="mt-1 text-lg">보관된 스윙</CardTitle>
              <CardDescription className="mt-1">날짜별로 훑어보고 필요한 영상만 열어보세요.</CardDescription>
            </div>
            <div className="shrink-0 rounded-xl border border-border bg-muted/40 px-3 py-2 text-right">
              <p className="text-lg font-bold leading-none tabular-nums">{total.toLocaleString()}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">보관 기록</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 rounded-xl border border-border/75 bg-muted/25 p-2 text-xs sm:max-w-sm">
            <div className="flex min-w-0 items-center gap-2 rounded-lg bg-background/60 px-2.5 py-2">
              <Clock3 className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
              <span className="min-w-0 truncate text-muted-foreground">{firstArchivedDate ? `${new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric" }).format(firstArchivedDate)} 최근 보관` : "최근 보관 없음"}</span>
            </div>
            <div className="flex items-center justify-end gap-1.5 rounded-lg px-2.5 py-2 text-muted-foreground"><span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />{currentPage} / {Math.max(1, Math.ceil(total / pageSize))} 페이지</div>
          </div>
          <div className="flex flex-col gap-3 border-t border-border pt-3 sm:flex-row sm:items-end sm:justify-between">
            <fieldset className="min-w-0">
              <legend className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><CalendarDays className="size-3.5" aria-hidden="true" />기간 필터</legend>
              <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
                {PERIOD_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => changePeriod(option.value)}
                    aria-pressed={period === option.value}
                    className={`min-h-9 shrink-0 rounded-full border px-3.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${period === option.value ? "border-primary bg-primary text-primary-foreground shadow-sm" : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"}`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </fieldset>
            <label className="flex shrink-0 items-center gap-2 text-xs font-medium text-muted-foreground">
              한 번에
              <select
                value={pageSize}
                onChange={(event) => setPageSize(Number(event.target.value))}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="페이지당 표시할 기록 수"
              >
                <option value={12}>12개</option>
                <option value={24}>24개</option>
                <option value={48}>48개</option>
              </select>
            </label>
          </div>
        </CardHeader>
        <CardContent className="p-3 pt-1 sm:p-6 sm:pt-2">
          <div className="mb-3 flex items-center justify-between gap-3 px-1 text-xs text-muted-foreground">
            <span>{period === "all" ? "전체 기록" : PERIOD_OPTIONS.find((option) => option.value === period)?.label} · {jobs.length}개 표시</span>
            {loading && <span role="status">기록을 불러오는 중…</span>}
          </div>
          {!jobs.length && !loading ? <div className="rounded-xl border border-dashed p-6 text-center"><Video className="mx-auto size-6 text-muted-foreground" aria-hidden="true" /><p className="mt-2 text-sm font-medium">이 기간에는 보관된 스윙이 없습니다.</p><p className="mt-1 text-xs text-muted-foreground">기간을 넓히면 이전 기록을 다시 볼 수 있습니다.</p></div> : (
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4">
              {jobs.map((job) => {
                const quality = qualityFor(job);
                const title = job.shot?.originalName || job.shot?.media?.filename || job.jobId;
                const thumbnailUrl = thumbnailFor(job);
                return (
                  <article key={job.jobId} className="group relative overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition hover:-translate-y-0.5 hover:border-primary/55 hover:shadow-lg hover:shadow-black/15">
                    <button className="block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring" onClick={() => openJob(job.jobId)} aria-label={`${title} 분석 열기`}>
                      <div className="relative grid aspect-[4/3] place-items-center overflow-hidden border-b bg-muted/45 text-muted-foreground sm:aspect-video">
                        {thumbnailUrl ? <img src={thumbnailUrl} alt="" className="size-full object-cover transition duration-300 group-hover:scale-[1.03]" loading="lazy" /> : <>
                          <Film className="size-7 opacity-75 sm:size-8" aria-hidden="true" />
                          <ImageOff className="absolute bottom-2 right-2 size-3.5 opacity-45" aria-label="썸네일 준비 중" />
                        </>}
                        <span className="absolute bottom-2 left-2 rounded-md border border-white/10 bg-background/85 px-1.5 py-1 text-[10px] font-semibold text-foreground backdrop-blur-sm">{job.videoStored ? "영상" : "결과만"}</span>
                      </div>
                      <div className="min-w-0 p-2.5 sm:p-3">
                        <span className="mb-1.5 block truncate text-sm font-semibold leading-tight">{title}</span>
                        <span className="flex items-center justify-between gap-1.5"><span className="truncate text-[11px] text-muted-foreground">{dateLabel(job)}</span><span className={`hidden shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold sm:inline ${quality.className}`}>{quality.label}</span></span>
                      </div>
                    </button>
                    <Button variant="outline" fullWidth={false} className="absolute right-1.5 top-1.5 grid size-8 place-items-center !border-white/10 !p-0 bg-background/85 text-muted-foreground opacity-0 backdrop-blur-sm hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100 sm:right-2 sm:top-2" aria-label={`${title} 삭제`} title="기록 삭제" onClick={() => deleteJob(job.jobId)}><Trash2 className="size-3.5" aria-hidden="true" /></Button>
                  </article>
                );
              })}
            </div>
          )}
          <nav className="mt-4 flex items-center justify-between gap-2 border-t border-border pt-3" aria-label="보관 기록 페이지">
            <Button variant="outline" fullWidth={false} className="min-h-10 rounded-xl px-3 py-2 text-sm" disabled={loading || currentPage === 1} onClick={goPreviousPage}><ChevronLeft className="mr-1 size-4" aria-hidden="true" />이전</Button>
            <span className="rounded-lg bg-muted px-2.5 py-2 text-xs font-semibold text-muted-foreground">{currentPage} 페이지</span>
            <Button variant="outline" fullWidth={false} className="min-h-10 rounded-xl px-3 py-2 text-sm" disabled={loading || !nextCursor} onClick={goNextPage}>다음<ChevronRight className="ml-1 size-4" aria-hidden="true" /></Button>
          </nav>
        </CardContent>
      </Card>
    </main>
  );
}
