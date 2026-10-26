import { parseMovementGuide, type MovementGuide } from "./movementGuide";
import { client } from "./client";

export type PracticeReview = {
  ok: true;
  jobId: string;
  version: "dtl-posture-review-v1";
  status: "review_candidate" | "no_clear_change" | "withheld";
  message: string;
  evidence?: {
    address: { timeMs: number; angleDeg: number; sampleCount: number };
    comparison: { timeMs: number; angleDeg: number; sampleCount: number };
    changeDeg: number;
    side: "left" | "right";
  };
  practice?: { title: string; steps: string[]; checkpoint: string };
  reasons: string[];
};

export function canReviewFrames(addressMs: number | null, comparisonMs: number | null): boolean {
  return typeof addressMs === "number" && typeof comparisonMs === "number"
    && Number.isFinite(addressMs) && Number.isFinite(comparisonMs)
    && addressMs >= 0 && comparisonMs - addressMs >= 150 && comparisonMs <= 30_000;
}

export function validatePracticeReview(raw: unknown, jobId: string, addressMs: number, comparisonMs: number): PracticeReview {
  const value = raw as PracticeReview;
  const finite = (number: unknown) => typeof number === "number" && Number.isFinite(number);
  const sample = (point: any, selected: number) => point
    && finite(point.timeMs) && Math.abs(point.timeMs - selected) <= 100
    && finite(point.angleDeg) && point.angleDeg >= 0 && point.angleDeg <= 90
    && Number.isInteger(point.sampleCount) && point.sampleCount >= 3;
  if (!value || value.ok !== true || value.jobId !== jobId || value.version !== "dtl-posture-review-v1"
    || !["review_candidate", "no_clear_change", "withheld"].includes(value.status)
    || typeof value.message !== "string" || !value.message.trim()
    || !Array.isArray(value.reasons) || !value.reasons.every((reason) => typeof reason === "string")
    || !canReviewFrames(addressMs, comparisonMs)) {
    throw new Error("자세 비교 응답을 확인할 수 없습니다. 다시 시도해 주세요.");
  }
  if (value.status === "withheld" && value.evidence != null) {
    throw new Error("판단을 보류한 결과에는 관측 수치를 표시할 수 없습니다.");
  }
  if (value.status !== "withheld" && (!value.evidence
    || !["left", "right"].includes(value.evidence.side ?? "")
    || !sample(value.evidence.address, addressMs) || !sample(value.evidence.comparison, comparisonMs)
    || !finite(value.evidence.changeDeg) || Math.abs(value.evidence.changeDeg) > 90
    || Math.abs(value.evidence.changeDeg - (value.evidence.address.angleDeg - value.evidence.comparison.angleDeg)) > 0.3)) {
    throw new Error("선택한 장면과 자세 비교 결과가 일치하지 않습니다.");
  }
  if (value.status === "review_candidate" && (!value.practice
    || typeof value.practice.title !== "string" || !value.practice.title.trim()
    || !Array.isArray(value.practice.steps) || value.practice.steps.length < 1
    || !value.practice.steps.every((step) => typeof step === "string" && step.trim())
    || typeof value.practice.checkpoint !== "string" || !value.practice.checkpoint.trim())) {
    throw new Error("연습 안내를 확인할 수 없습니다. 다시 시도해 주세요.");
  }
  if (value.status !== "review_candidate" && value.practice != null) {
    throw new Error("판단을 보류한 결과에는 교정 연습을 표시할 수 없습니다.");
  }
  return value;
}

export async function requestPracticeReview(jobId: string, addressMs: number, comparisonMs: number, videoSha256?: string): Promise<PracticeReview> {
  if (!canReviewFrames(addressMs, comparisonMs)) throw new Error("어드레스와 그 이후의 임팩트 직전 장면을 선택해 주세요.");
  const body = new Blob([JSON.stringify({ addressMs, comparisonMs, viewpoint: "down_the_line", confirmedFrames: true, ...(videoSha256 ? { videoSha256 } : {}) })], { type: "application/json" });
  const raw = await client.post(`/api/analyze/${encodeURIComponent(jobId)}/practice-review`, body);
  return validatePracticeReview(raw, jobId, addressMs, comparisonMs);
}

export type PracticeBaseline = {
  version: "dtl-posture-review-v1";
  jobId: string;
  addressMs: number;
  comparisonMs: number;
  changeDeg: number;
  savedAt: string;
  side: "left" | "right";
};

export function parsePracticeBaseline(raw: unknown): PracticeBaseline | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as PracticeBaseline;
  if (value.version !== "dtl-posture-review-v1" || typeof value.jobId !== "string" || !value.jobId.trim()
    || !canReviewFrames(value.addressMs, value.comparisonMs)
    || typeof value.changeDeg !== "number" || !Number.isFinite(value.changeDeg) || Math.abs(value.changeDeg) > 90
    || typeof value.savedAt !== "string" || !Number.isFinite(Date.parse(value.savedAt))
    || (value.side !== "left" && value.side !== "right")) return null;
  return value;
}

export function comparePracticeBaseline(baseline: PracticeBaseline | null, result: PracticeReview | null, sameConditions: boolean): { beforeDeg: number; afterDeg: number } | null {
  if (!sameConditions || !baseline || !parsePracticeBaseline(baseline) || !result || !["review_candidate", "no_clear_change"].includes(result.status)
    || !result.evidence || baseline.jobId === result.jobId || baseline.version !== result.version
    || !Number.isFinite(result.evidence.changeDeg) || Math.abs(result.evidence.changeDeg) > 90
    || baseline.side !== result.evidence.side) return null;
  return { beforeDeg: baseline.changeDeg, afterDeg: result.evidence.changeDeg };
}


export type PracticePreview = { ok: true; jobId: string; status: "ready" | "unavailable"; addressMs?: number; comparisonMs?: number; movementGuide?: MovementGuide | null };
export async function requestPracticePreview(jobId: string, addressMs: number, comparisonMs: number, videoSha256?: string): Promise<PracticePreview> {
  if (!canReviewFrames(addressMs, comparisonMs)) return { ok: true, jobId, status: "unavailable" };
  const body = new Blob([JSON.stringify({ mode: "preview", addressMs, comparisonMs, viewpoint: "down_the_line", ...(videoSha256 ? { videoSha256 } : {}) })], { type: "application/json" });
  const value = await client.post(`/api/analyze/${encodeURIComponent(jobId)}/practice-review`, body) as PracticePreview;
  if (!value || value.ok !== true || value.jobId !== jobId || !["ready", "unavailable"].includes(value.status)
    || (value.status === "ready" && (!canReviewFrames(value.addressMs ?? null, value.comparisonMs ?? null)
      || Math.abs(value.addressMs! - Math.max(100, addressMs)) > 150 || Math.abs(value.comparisonMs! - comparisonMs) > 100))) throw new Error("비교 장면을 준비하지 못했습니다.");
  return { ...value, movementGuide: parseMovementGuide(value.movementGuide) };
}
