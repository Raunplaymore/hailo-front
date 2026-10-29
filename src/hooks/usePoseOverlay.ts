import { useEffect, useState } from "react";
import type { VideoClock } from "@/api/impactReview";
import { requestPoseOverlay, type PoseOverlay } from "@/api/poseOverlay";

export function usePoseOverlay(jobId?: string, review?: VideoClock | null) {
  const [state, setState] = useState<{jobId?: string; review?: VideoClock | null; pose: PoseOverlay | null; loading: boolean; error: string | null}>({pose:null,loading:false,error:null});
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    if (!jobId || !review) { setState({pose:null,loading:false,error:null}); return; }
    setState({jobId,review,pose:null,loading:true,error:null});
    requestPoseOverlay(jobId, review).then(
      pose => { if (!cancelled) setState({jobId,review,pose,loading:false,error:null}); },
      error => { if (!cancelled) setState({jobId,review,pose:null,loading:false,error:error instanceof Error ? error.message : "자세 표시를 준비하지 못했습니다."}); },
    );
    return () => { cancelled = true; };
  }, [jobId, review, attempt]);
  const current = state.jobId === jobId && state.review === review ? state : {pose:null,loading:Boolean(jobId && review),error:null};
  return {...current, retry: () => setAttempt(n => n + 1)};
}
