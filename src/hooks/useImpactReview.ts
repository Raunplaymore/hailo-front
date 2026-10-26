import { useEffect, useState } from "react";
import { ImpactReview, requestImpactReview } from "@/api/impactReview";

export function useImpactReview(jobId?: string) {
  const [state, setState] = useState<{jobId?: string; review: ImpactReview | null; loading: boolean; error: string | null}>({review: null, loading: false, error: null});
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    if (!jobId) { setState({review: null, loading: false, error: null}); return; }
    setState({jobId, review: null, loading: true, error: null});
    requestImpactReview(jobId).then(
      (review) => { if (!cancelled) setState({jobId, review, loading: false, error: null}); },
      (error) => { if (!cancelled) setState({jobId, review: null, loading: false, error: error instanceof Error ? error.message : "임팩트 후보를 계산하지 못했습니다."}); },
    );
    return () => { cancelled = true; };
  }, [jobId, attempt]);
  const current = state.jobId === jobId ? state : {review: null, loading: Boolean(jobId), error: null};
  return { ...current, retry: () => setAttempt((n) => n + 1) };
}
