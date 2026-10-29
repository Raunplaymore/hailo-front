import type { AnalysisResult } from "@/types/shots";
import { API_BASE, client } from "./client";

export type VideoClock = {
  jobId: string;
  timingRevision: 3;
  videoSha256: string;
  frameTimesMs: number[];
};

export type ImpactReview = VideoClock & {
  status: "reference_candidate";
  inputScopeConfirmed: boolean;
  candidate: { frameIndex: number; timeMs: number };
};

export function validateVideoClock(raw: any, jobId: string): VideoClock {
  const times = raw?.frameTimesMs;
  if (raw?.ok !== true || raw.jobId !== jobId || raw.timingRevision !== 3
    || !/^[a-f0-9]{64}$/.test(raw.videoSha256 ?? "") || !Array.isArray(times) || times.length < 4 || times.length > 7200
    || times[0] !== 0 || !times.every((t: unknown, i: number) => typeof t === "number" && Number.isFinite(t) && t >= 0 && t <= 30000 && (i === 0 || t > times[i - 1]))) {
    throw new Error("영상의 프레임 시각을 확인하지 못했습니다. 다시 시도해 주세요.");
  }
  return raw as VideoClock;
}

export function validateImpactReview(raw: any, jobId: string): ImpactReview {
  const { frameTimesMs: times } = validateVideoClock(raw, jobId);
  const index = raw?.candidate?.frameIndex;
  if (raw.status !== "reference_candidate"
    || raw.modelSha256 !== "70b338b519565f870ed1fce044a0453f828773e53b9fa9d024391b3b4cf57733"
    || raw.publicValue !== null || raw.automaticCoachingReady !== false || raw.appliedToPrimary !== false
    || raw.inputScopeConfirmed !== false || raw.requiresHumanConfirmation !== true
    || !Number.isInteger(index) || index < 0 || index >= times.length || times[index] !== raw.candidate.timeMs) {
    throw new Error("검수 후보 응답을 확인할 수 없습니다. 다시 시도해 주세요.");
  }
  return raw as ImpactReview;
}

export async function requestVideoClock(jobId: string, signal: AbortSignal): Promise<VideoClock> {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(jobId)) throw new Error("영상 식별 정보를 확인할 수 없습니다.");
  return validateVideoClock(await client.get(`/api/analyze/${encodeURIComponent(jobId)}/video-clock`, { signal }), jobId);
}

export async function requestImpactReview(jobId: string): Promise<ImpactReview> {
  const body = new Blob([JSON.stringify({ automatic: true })], { type: "application/json" });
  return validateImpactReview(await client.post(`/api/analyze/${encodeURIComponent(jobId)}/impact-review`, body), jobId);
}

export function impactReviewVideoUrl(jobId: string, videoSha256?: string, originalQuality = false): string {
  const query = new URLSearchParams();
  if (videoSha256) query.set("v", videoSha256);
  if (originalQuality) query.set("quality", "original");
  const suffix = query.toString();
  return `${API_BASE}/api/analyze/${encodeURIComponent(jobId)}/review-video${suffix ? `?${suffix}` : ""}`;
}

export function frameIndexAtOrBefore(times: number[], timeMs: number): number | null {
  if (!times.length || !Number.isFinite(timeMs) || timeMs < times[0]) return null;
  let index = 0;
  while (index + 1 < times.length && times[index + 1] <= timeMs) index++;
  return index;
}

export function frameIndexForPresentedTime(times: number[], currentTimeMs: number, presentedTimeMs: number): number | null {
  const index = frameIndexAtOrBefore(times, currentTimeMs);
  if (index === null || !Number.isFinite(presentedTimeMs)) return null;
  const distance = Math.abs(times[index] - presentedTimeMs);
  if (distance > 2 || (index > 0 && Math.abs(times[index - 1] - presentedTimeMs) <= distance + 0.001)
    || (index + 1 < times.length && Math.abs(times[index + 1] - presentedTimeMs) <= distance + 0.001)) return null;
  return index;
}

export function withImpactCandidate(events: AnalysisResult["events"] | undefined, review: ImpactReview | null, enabled: boolean): AnalysisResult["events"] | undefined {
  if (!enabled) return events;
  return { ...events, impact: review ? {
    timeMs: review.candidate.timeMs, frame: review.candidate.frameIndex,
    quality: "reference", source: "pose-tcn-v1",
  } : undefined };
}
