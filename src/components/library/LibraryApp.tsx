import { FormEvent, useEffect, useState } from "react";
import { Button } from "../Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";

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
    <main className="mx-auto min-h-screen max-w-3xl space-y-4 p-4 sm:p-6">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Hailo Swing Library</h1>
          <p className="text-sm text-muted-foreground">NAS에 보관된 완료 분석 기록</p>
        </div>
        <Button variant="outline" onClick={loadJobs} disabled={loading}>{loading ? "불러오는 중" : "새로고침"}</Button>
      </header>
      {error && <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      {selected && (
        <Card>
          <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
            <div>
              <CardTitle className="text-base">{selected.shot?.originalName || selected.shot?.media?.filename || selected.jobId}</CardTitle>
              <CardDescription>{selected.archivedAt ? new Date(selected.archivedAt).toLocaleString() : selected.jobId}</CardDescription>
            </div>
            <Button variant="outline" onClick={() => setSelected(null)}>닫기</Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {selected.videoStored ? (
              <video className="w-full rounded-lg bg-black" controls playsInline src={`/api/library/jobs/${encodeURIComponent(selected.jobId)}/video`} />
            ) : <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">원본 영상은 없고 분석 결과만 보관되어 있습니다.</p>}
            <section>
              <h2 className="mb-2 text-sm font-semibold">분석 결과</h2>
              <pre className="max-h-96 overflow-auto rounded-md bg-muted p-3 text-xs leading-5">{JSON.stringify(selected.analysis, null, 2)}</pre>
            </section>
            <Button variant="destructive" onClick={() => deleteJob(selected.jobId)}>이 기록 삭제</Button>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader><CardTitle className="text-base">완료된 스윙</CardTitle></CardHeader>
        <CardContent>
          {!jobs.length ? <p className="text-sm text-muted-foreground">아직 NAS에 보관된 스윙이 없습니다.</p> : (
            <ul className="space-y-2">
              {jobs.map((job) => (
                <li key={job.jobId} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                  <button className="min-w-0 text-left" onClick={() => openJob(job.jobId)}>
                    <span className="block truncate text-sm font-semibold">{job.shot?.originalName || job.shot?.media?.filename || job.jobId}</span>
                    <span className="block text-xs text-muted-foreground">{job.archivedAt ? new Date(job.archivedAt).toLocaleString() : job.jobId} · {job.videoStored ? "영상 보관됨" : "분석만 보관됨"}</span>
                  </button>
                  <Button variant="outline" size="sm" onClick={() => deleteJob(job.jobId)}>삭제</Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
