import { useEffect, useState } from "react";
import { AnalysisResult, JobStatus, Shot } from "../types/shots";
import { fetchAnalysisResult, fetchAnalysisStatus, waitForExistingClubReview } from "../api/shots";

type UseAnalysisResult = {
  analysis: AnalysisResult | null;
  status: JobStatus;
  isLoading: boolean;
  error: string | null;
  retry: () => void;
};

const POLL_INTERVAL_MS = 1800;

const isInferStyleAnalysis = (analysis: AnalysisResult | null | undefined) => {
  if (!analysis) return false;
  const version = String(analysis.analysisVersion || "").toLowerCase();
  if (version.includes("service7") || version.includes("hailo-coach") || version.includes("infer")) {
    return true;
  }
  return Boolean(
    analysis.metrics?.shaftPlane ||
      analysis.metrics?.trackingQuality ||
      analysis.metrics?.backswing ||
      analysis.metrics?.body ||
      analysis.metrics?.club ||
      analysis.metrics?.fusion
  );
};

export function useAnalysis(selected: Shot | null): UseAnalysisResult {
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(selected?.analysis ?? null);
  const [status, setStatus] = useState<JobStatus>(selected?.analysis?.status ?? selected?.status ?? "idle");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    const clubAbort = new AbortController();

    const providedAnalysis = selected?.analysis ?? null;
    const statusHint = selected?.status ?? providedAnalysis?.status;
    const fallbackId =
      statusHint && statusHint !== "idle" && statusHint !== "not-analyzed"
        ? selected?.id
        : undefined;
    const jobId = selected?.jobId ?? providedAnalysis?.jobId ?? fallbackId;
    const existingAnalysis = providedAnalysis?.jobId === jobId ? providedAnalysis : null;
    setAnalysis(existingAnalysis);
    setStatus(existingAnalysis?.status ?? selected?.status ?? "idle");
    setError(null);

    if (!jobId || (!existingAnalysis && (selected?.status === "not-analyzed" || selected?.status === "idle"))) {
      setIsLoading(false);
      return () => undefined;
    }

    const followClub = (result: AnalysisResult | null) => {
      const clubStatus = result?.dtlClubPointsV2?.status;
      if (!result || (clubStatus && !["queued", "running"].includes(clubStatus))) return;
      const waitForStart = ["queued", "running"].includes(statusHint || "");
      void waitForExistingClubReview(jobId, clubAbort.signal, waitForStart).then(async (sidecar) => {
        if (!sidecar || cancelled) return;
        const latest = await fetchAnalysisResult(jobId).catch(() => null);
        if (cancelled) return;
        setAnalysis(current => current?.jobId === jobId
          ? { ...(latest?.jobId === jobId ? latest : current), dtlClubPointsV2: sidecar }
          : current);
      }).catch(error => { if (!cancelled) console.warn("club review status failed", error); });
    };

    const poll = async () => {
      try {
        const { status: nextStatus, analysis: statusAnalysis, errorMessage } = await fetchAnalysisStatus(jobId);
        if (cancelled) return;

        setStatus(nextStatus);
        if (statusAnalysis) {
          setAnalysis(statusAnalysis);
        }

        if (nextStatus === "succeeded") {
          const result = statusAnalysis ?? await fetchAnalysisResult(jobId);
          if (cancelled) return;
          setAnalysis(result);
          setIsLoading(false);
          followClub(result);
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

    // 이미 service7/infer 분석 데이터가 있으면 상태를 보여주고, 없으면 재조회
    if (existingAnalysis && existingAnalysis.jobId === jobId) {
      if (
        (existingAnalysis.status === "succeeded" || existingAnalysis.status === "failed") &&
        isInferStyleAnalysis(existingAnalysis)
      ) {
        setIsLoading(false);
        if (existingAnalysis.status === "succeeded") followClub(existingAnalysis);
        return () => { cancelled = true; clubAbort.abort(); };
      }
    }

    setIsLoading(true);
    poll();

    return () => {
      cancelled = true;
      clubAbort.abort();
      if (timer) {
        window.clearTimeout(timer);
      }
    };
  }, [selected?.id, selected?.analysis, selected?.jobId, selected?.status, attempt]);

  return { analysis, status, isLoading, error, retry: () => setAttempt(value => value + 1) };
}
