import { FormEvent, useEffect, useMemo, useState } from "react";
import { Archive, ChevronLeft, RefreshCw, Trash2, Video } from "lucide-react";
import { normalizeAnalysis } from "../../api/shots";
import { AnalysisPlayer } from "../analysis/AnalysisPlayer";
import { CoachSummary } from "../analysis/CoachSummary";
import { KeyMetrics } from "../analysis/KeyMetrics";
import { Button } from "../Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import type { AnalysisResult, JobStatus } from "../../types/shots";

type LibraryJob = {
  jobId: string;
  status?: string;
  archivedAt?: string;
  videoStored: boolean;
  shot?: { media?: { filename?: string }; originalName?: string } | null;
  analysis?: { summary?: string; confidence?: number } | null;
};

type LibraryDetail = LibraryJob & {
  analysis?: unknown;
  progress?: unknown;
  artifacts?: Array<{ artifact?: string; filename?: string }>;
};

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
  const [loading, setLoading] = useState(false);
  const selectedAnalysis = useMemo(() => analysisForLibrary(selected), [selected]);

  const loadJobs = async () => {
    setLoading(true);
    try {
      const result = await libraryRequest<{ jobs: LibraryJob[] }>("/api/library/jobs");
      setJobs(result.jobs || []);
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
        return loadJobs();
      })
      .catch(() => setAuthenticated(false));
  }, []);

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
      await loadJobs();
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
      await loadJobs();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "삭제하지 못했습니다.");
    }
  };

  if (authenticated === null) {
    return <main className="mx-auto flex min-h-screen max-w-xl items-center p-5 text-sm text-muted-foreground">NAS 라이브러리를 확인 중입니다.</main>;
  }

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
    <main className="mx-auto min-h-screen max-w-4xl space-y-4 p-4 pb-10 sm:p-6">
      <header className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-primary/25 bg-primary/10 text-primary"><Archive className="size-5" aria-hidden="true" /></span>
          <div className="min-w-0">
            <h1 className="text-xl font-bold">내 스윙</h1>
            <p className="text-sm text-muted-foreground">NAS에 안전하게 보관된 분석 기록</p>
          </div>
        </div>
        <Button variant="outline" fullWidth={false} className="grid size-11 place-items-center !p-0" aria-label="기록 새로고침" title="기록 새로고침" onClick={loadJobs} disabled={loading}>
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
            />
          ) : <p className="rounded-xl border border-dashed bg-muted/40 p-4 text-sm text-muted-foreground">원본 영상은 없고 분석 결과만 보관되어 있습니다.</p>}
          {selectedAnalysis ? <KeyMetrics analysis={selectedAnalysis} status={selectedAnalysis.status} /> : null}
          {selectedAnalysis ? <CoachSummary summary={selectedAnalysis.summary} comments={selectedAnalysis.coachSummary} findings={selectedAnalysis.coachFindings} /> : (
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
      <Card>
        <CardHeader>
          <CardTitle className="text-base">보관된 스윙</CardTitle>
          <CardDescription>선택하면 분석 레이어와 코칭을 그대로 다시 볼 수 있습니다.</CardDescription>
        </CardHeader>
        <CardContent>
          {!jobs.length && !loading ? <div className="rounded-xl border border-dashed p-6 text-center"><Video className="mx-auto size-6 text-muted-foreground" aria-hidden="true" /><p className="mt-2 text-sm font-medium">아직 보관된 스윙이 없습니다.</p><p className="mt-1 text-xs text-muted-foreground">Pi에서 분석을 완료하면 이곳에서 언제든 다시 볼 수 있습니다.</p></div> : (
            <ul className="space-y-2">
              {jobs.map((job) => (
                <li key={job.jobId} className="flex items-center gap-2 rounded-xl border bg-card p-2 transition-colors hover:bg-muted/40">
                  <button className="min-h-14 min-w-0 flex-1 rounded-lg px-2 py-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => openJob(job.jobId)} aria-label={`${job.shot?.originalName || job.shot?.media?.filename || job.jobId} 분석 열기`}>
                    <span className="mb-1 flex flex-wrap items-center gap-1.5"><span className="block truncate text-sm font-semibold">{job.shot?.originalName || job.shot?.media?.filename || job.jobId}</span><span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${qualityFor(job).className}`}>{qualityFor(job).label}</span></span>
                    <span className="block text-xs text-muted-foreground">{job.archivedAt ? new Date(job.archivedAt).toLocaleString() : job.jobId} · {job.videoStored ? "영상 보관됨" : "분석만 보관됨"}</span>
                  </button>
                  <Button variant="outline" fullWidth={false} className="grid size-11 shrink-0 place-items-center !p-0 text-muted-foreground hover:text-destructive" aria-label={`${job.shot?.originalName || job.jobId} 삭제`} title="기록 삭제" onClick={() => deleteJob(job.jobId)}><Trash2 className="size-4" aria-hidden="true" /></Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
