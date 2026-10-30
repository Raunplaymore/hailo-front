import { client } from "./client";
import { parseMovementGuide, type MovementGuide } from "./movementGuide";

export type CoachingEvidence = {
  addressMs: number; startMs: number; endMs: number; focusMs: number; impactMs: number;
  width: number; height: number; ballDirection: "left" | "right";
  baselineX: number; baselineY: number; noisePx: number; shiftPx: number;
  cameraMotion: "static" | "translation_corrected" | "similarity_corrected";
  observation: "toward_ball" | "no_clear_shift";
  points: { timeMs: number; x: number; y: number; referenceX: number; referenceY: number; referenceTop?: [number, number]; referenceBottom?: [number, number] }[];
};
export type CoachingReview = {
  ok: true; jobId: string; version: "dtl-coaching-review-v1";
  status: "ready" | "unavailable"; diagnosisStatus: "unvalidated";
  reason: string | null; summary: string; evidence: CoachingEvidence | null;
  movementGuide?: MovementGuide | null;
  excludedFrames?: { timeMs: number; reason: string }[];
};

export function parseCoachingReview(raw: unknown, jobId: string, impactMs: number, addressMs: number): CoachingReview {
  const value = raw as CoachingReview;
  const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
  const unit = (v: unknown): v is number => finite(v) && v > 0 && v < 1;
  const e = value?.evidence;
  if (!value || value.ok !== true || value.version !== "dtl-coaching-review-v1" || value.jobId !== jobId
    || value.diagnosisStatus !== "unvalidated" || !["ready", "unavailable"].includes(value.status)
    || typeof value.summary !== "string" || !value.summary.trim()
    || !(value.reason === null || typeof value.reason === "string")
    || (value.status === "unavailable" && e !== null)
    || (value.excludedFrames !== undefined && (!Array.isArray(value.excludedFrames) || value.excludedFrames.length > 14
      || !value.excludedFrames.every(p => p && finite(p.timeMs) && p.timeMs >= 0 && p.timeMs <= 30000 && typeof p.reason === "string")))) throw new Error("코칭 근거를 확인하지 못했습니다. 다시 시도해 주세요.");
  if (value.status === "ready" && (!e
    || ![e.addressMs, e.startMs, e.endMs, e.focusMs, e.impactMs, e.width, e.height, e.noisePx, e.shiftPx].every(finite)
    || e.addressMs < 0 || e.addressMs < addressMs - 50 || e.addressMs > addressMs + 118
    || e.addressMs >= e.startMs || e.startMs >= e.endMs || e.endMs > 30000
    || e.focusMs < e.startMs || e.focusMs > e.impactMs - 40 || e.focusMs > e.endMs
    || Math.abs(e.impactMs - impactMs) > 1 || e.startMs < e.impactMs - 650 || e.endMs > e.impactMs + 200
    || e.width <= 0 || e.height <= 0 || e.width > 1920 || e.height > 1920 || e.noisePx < 0
    || !unit(e.baselineX) || !unit(e.baselineY) || !["left", "right"].includes(e.ballDirection)
    || !["static", "translation_corrected", "similarity_corrected"].includes(e.cameraMotion)
    || !["toward_ball", "no_clear_shift"].includes(e.observation)
    || !Array.isArray(e.points) || e.points.length < 6 || e.points.length > 18
    || !e.points.every((p, i) => p && finite(p.timeMs) && p.timeMs >= 0 && p.timeMs <= 30000
      && (e.cameraMotion !== "similarity_corrected" || [p.referenceTop, p.referenceBottom].every(v => Array.isArray(v) && v.length === 2 && v.every(unit)))
      && unit(p.x) && unit(p.y) && unit(p.referenceX) && unit(p.referenceY) && (!i || p.timeMs > e.points[i - 1].timeMs))
    || !e.points.some(p => p.timeMs === e.focusMs))) throw new Error("근거 장면과 분석 결과가 일치하지 않습니다.");
  const measuredEnd = e && value.status === "ready"
    ? Math.max(...e.points.filter(p => p.timeMs >= e.startMs && p.timeMs <= e.impactMs - 40).map(p => p.timeMs))
    : null;
  const evidence = e && measuredEnd !== null && measuredEnd < e.endMs ? { ...e, endMs: measuredEnd } : e;
  if (evidence && evidence.focusMs > evidence.endMs) throw new Error("근거 장면과 분석 결과가 일치하지 않습니다.");
  const movementGuide = parseMovementGuide(value.movementGuide);
  if (movementGuide?.status === "ready" && Math.abs(movementGuide.impactMs! - impactMs) > 1) {
    throw new Error("움직임 확인 장면과 분석 기준이 일치하지 않습니다.");
  }
  if (movementGuide?.status === "ready" && Object.values(movementGuide.tracks ?? {}).some(track =>
    track && (track.baseline.timeMs < Math.max(0, addressMs - 106) || track.baseline.timeMs > addressMs + 190))) {
    throw new Error("움직임 확인 장면과 분석 기준이 일치하지 않습니다.");
  }
  return { ...value, evidence, movementGuide };
}

// The Pi observer handles one request at a time; reopening still rechecks file freshness.
const pending = new Map<string, Promise<CoachingReview>>();
let lastPending: Promise<CoachingReview> | null = null;
export function requestCoachingReview(jobId: string, addressMs: number, impactMs: number, videoSha256: string, impactFrameIndex?: number): Promise<CoachingReview> {
  if (!jobId || !Number.isFinite(addressMs) || !Number.isFinite(impactMs) || addressMs < 0
    || impactMs - addressMs < 230 || impactMs > 30000 || !/^[a-f0-9]{64}$/.test(videoSha256)
    || (impactFrameIndex !== undefined && (!Number.isSafeInteger(impactFrameIndex) || impactFrameIndex < 0))) {
    return Promise.reject(new Error("준비 자세와 임팩트 후보의 간격을 확인할 수 없습니다."));
  }
  const key = JSON.stringify([jobId, addressMs, impactMs, videoSha256, impactFrameIndex]);
  const current = pending.get(key);
  if (current) return current;
  const body = new Blob([JSON.stringify({ mode: "coaching", addressMs, comparisonMs: impactMs - 80,
    viewpoint: "down_the_line", videoSha256, ...(impactFrameIndex === undefined ? {} : { impactFrameIndex }) })], { type: "application/json" });
  const run = () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);
    return client.post(`/api/analyze/${encodeURIComponent(jobId)}/practice-review`, body, controller.signal)
      .then(raw => parseCoachingReview(raw, jobId, impactMs, addressMs))
      .catch(error => { if (controller.signal.aborted) throw new Error("분석 시간이 초과됐습니다. 다시 시도해 주세요."); throw error; })
      .finally(() => clearTimeout(timeout));
  };
  const prior = lastPending;
  const work = prior ? prior.catch(() => undefined).then(run) : run();
  pending.set(key, work);
  lastPending = work;
  const clear = () => { pending.delete(key); if (lastPending === work) lastPending = null; };
  void work.then(clear, clear);
  return work;
}
