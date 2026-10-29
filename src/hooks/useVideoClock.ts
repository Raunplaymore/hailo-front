import { useEffect, useState } from "react";
import { requestVideoClock, type VideoClock } from "@/api/impactReview";

export function useVideoClock(jobId?: string, enabled = false) {
  const [state, setState] = useState<{jobId?: string; clock: VideoClock | null; loading: boolean; error: string | null}>({clock:null,loading:false,error:null});
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!jobId || !enabled) { setState({clock:null,loading:false,error:null}); return; }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 35000);
    let cancelled = false;
    setState({jobId,clock:null,loading:true,error:null});
    requestVideoClock(jobId, controller.signal).then(
      clock => { if (!cancelled) setState({jobId,clock,loading:false,error:null}); },
      error => { if (!cancelled) setState({jobId,clock:null,loading:false,error:controller.signal.aborted ? "영상 시각 확인 시간이 초과됐습니다." : error instanceof Error ? error.message : "영상 시각을 확인하지 못했습니다."}); },
    ).finally(() => clearTimeout(timeout));
    return () => { cancelled = true; clearTimeout(timeout); controller.abort(); };
  }, [jobId, enabled, attempt]);
  const current = enabled && state.jobId === jobId ? state : {clock:null,loading:Boolean(jobId && enabled),error:null};
  return {...current, retry: () => setAttempt(n => n + 1)};
}
