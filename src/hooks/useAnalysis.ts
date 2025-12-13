import { useEffect, useState } from "react";
import { AnalysisResult, JobStatus, Shot } from "../types/shots";
import { fetchAnalysisResult, fetchAnalysisStatus } from "../api/shots";

type UseAnalysisResult = {
  analysis: AnalysisResult | null;
  status: JobStatus;
  isLoading: boolean;
  error: string | null;
};

const POLL_INTERVAL_MS = 1800;

export function useAnalysis(selected: Shot | null): UseAnalysisResult {
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(selected?.analysis ?? null);
  const [status, setStatus] = useState<JobStatus>(selected?.analysis?.status ?? selected?.status ?? "idle");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;

    const existingAnalysis = selected?.analysis ?? null;
    const jobId = existingAnalysis?.jobId ?? selected?.jobId ?? selected?.id;
    setAnalysis(existingAnalysis);
    setStatus(existingAnalysis?.status ?? selected?.status ?? "idle");
    setError(null);

    if (!jobId) {
      setIsLoading(false);
      return () => undefined;
    }

    const poll = async () => {
      try {
        const { status: nextStatus, analysis: statusAnalysis, errorMessage } = await fetchAnalysisStatus(jobId);
        if (cancelled) return;

        setStatus(nextStatus);
        if (statusAnalysis) {
          setAnalysis(statusAnalysis);
        }

        if (nextStatus === "succeeded") {
          const result = await fetchAnalysisResult(jobId);
          if (cancelled) return;
          setAnalysis(result);
          setIsLoading(false);
          return;
        }

        if (nextStatus === "failed") {
          setIsLoading(false);
          setError(errorMessage ?? "분석이 실패했습니다.");
          return;
        }

        timer = window.setTimeout(poll, POLL_INTERVAL_MS);
      } catch (err) {
        if (cancelled) return;
        console.warn("useAnalysis: status polling failed", err);
        setError("분석 상태를 불러오지 못했습니다.");
        setIsLoading(false);
      }
    };

    // 이미 분석 데이터가 있으면 상태를 보여주고, 필요 시 결과 재조회
    if (existingAnalysis && existingAnalysis.jobId === jobId) {
      if (existingAnalysis.status === "succeeded" || existingAnalysis.status === "failed") {
        setIsLoading(false);
        return () => undefined;
      }
    }

    setIsLoading(true);
    poll();

    return () => {
      cancelled = true;
      if (timer) {
        window.clearTimeout(timer);
      }
    };
  }, [selected?.id, selected?.analysis, selected?.jobId, selected?.status]);

  return { analysis, status, isLoading, error };
}
