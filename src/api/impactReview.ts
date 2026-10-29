import type { AnalysisResult } from "@/types/shots";
import { API_BASE, client } from "./client";

export type ImpactReview = {
  jobId: string;
  status: "reference_candidate";
  timingRevision: 3;
  videoSha256: string;
  inputScopeConfirmed: boolean;
  candidate: { frameIndex: number; timeMs: number };
  frameTimesMs: number[];
};

export function validateImpactReview(raw: any, jobId: string): ImpactReview {
  const times = raw?.frameTimesMs;
  const index = raw?.candidate?.frameIndex;
  if (raw?.ok !== true || raw.jobId !== jobId || raw.status !== "reference_candidate"
    || raw.timingRevision !== 3
    || raw.modelSha256 !== "70b338b519565f870ed1fce044a0453f828773e53b9fa9d024391b3b4cf57733"
    || raw.publicValue !== null || raw.automaticCoachingReady !== false || raw.appliedToPrimary !== false
    || !/^[a-f0-9]{64}$/.test(raw.videoSha256 ?? "") || raw.inputScopeConfirmed !== false
    || raw.requiresHumanConfirmation !== true || !Array.isArray(times) || times.length < 4 || times.length > 7200
    || !times.every((t: unknown, i: number) => typeof t === "number" && Number.isFinite(t) && t >= 0 && t <= 30000 && (i === 0 || t > times[i - 1]))
    || !Number.isInteger(index) || index < 0 || index >= times.length || times[index] !== raw.candidate.timeMs) {
    throw new Error("검수 후보 응답을 확인할 수 없습니다. 다시 시도해 주세요.");
  }
  return raw as ImpactReview;
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
