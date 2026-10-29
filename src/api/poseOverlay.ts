import type { OverlayPoseFrame } from "@/types/shots";
import type { VideoClock } from "./impactReview";
import { client } from "./client";

export type PoseOverlay = { status: "ready" | "unavailable"; poseFrames: OverlayPoseFrame[] };

export function parsePoseOverlay(raw: unknown, jobId: string, review: VideoClock): PoseOverlay {
  const value = raw as {ok?: unknown; jobId?: unknown; videoSha256?: unknown; status?: unknown; timeSource?: unknown; poseFrames?: unknown};
  const frames = value?.poseFrames;
  if (!value || value.ok !== true || value.jobId !== jobId || value.videoSha256 !== review.videoSha256
    || value.timeSource !== "video_pts" || (value.status !== "ready" && value.status !== "unavailable")
    || !Array.isArray(frames) || frames.length > review.frameTimesMs.length
    || (value.status === "ready" ? !frames.length : frames.length !== 0)
    || !frames.every((frame, i) => frame && Number.isSafeInteger(frame.frame) && frame.frame >= 0
      && frame.frame < review.frameTimesMs.length && (!i || frame.frame > frames[i - 1].frame)
      && frame.timeMs === review.frameTimesMs[frame.frame] && frame.keypoints && typeof frame.keypoints === "object"
      && !Array.isArray(frame.keypoints) && Object.entries(frame.keypoints).every(([name, point]) =>
        /^(nose|(left|right)_(shoulder|elbow|wrist|hip|knee|ankle))$/.test(name)
        && Array.isArray(point) && point.length === 3 && point.every(v => typeof v === "number" && Number.isFinite(v))
        && point[2] >= 0 && point[2] <= 1))
    || (value.status === "ready" && !frames.some(frame => Object.keys(frame.keypoints).length > 0))) {
    throw new Error("영상과 자세 표시의 시각이 일치하지 않습니다.");
  }
  return {status: value.status as PoseOverlay["status"], poseFrames: frames as OverlayPoseFrame[]};
}

const pending = new Map<string, Promise<unknown>>();
export function requestPoseOverlay(jobId: string, review: VideoClock): Promise<PoseOverlay> {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(jobId) || !/^[a-f0-9]{64}$/.test(review.videoSha256)) {
    return Promise.reject(new Error("영상 식별 정보를 확인할 수 없습니다."));
  }
  const key = `${jobId}:${review.videoSha256}`;
  let work = pending.get(key);
  if (!work) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 35000);
    work = client.get(`/api/analyze/${encodeURIComponent(jobId)}/pose-overlay?v=${review.videoSha256}`, {signal: controller.signal})
      .catch(error => { if (controller.signal.aborted) throw new Error("자세 표시 준비 시간이 초과됐습니다."); throw error; })
      .finally(() => clearTimeout(timeout));
    pending.set(key, work);
    const clear = () => { if (pending.get(key) === work) pending.delete(key); };
    void work.then(clear, clear);
  }
  return work.then(raw => parsePoseOverlay(raw, jobId, review));
}
