export type GuidePoint = { timeMs: number; x: number; y: number };
export type GuideTrack = { baseline: GuidePoint; points: GuidePoint[]; focusTimeMs: number; phase: "before" | "after" | "near" };
export type GuideKind = "head" | "pelvis";
export type PartialGuideTrack = GuideTrack & { focusKind: "near_impact"; missingTimes: number[] };
export type MovementGuide = { version: "movement-guide-v1"; coverageRevision?: 1; status: "ready" | "unavailable"; width?: number; height?: number; impactMs?: number; tracks?: Partial<Record<GuideKind, GuideTrack>>; partialTracks?: Partial<Record<GuideKind, PartialGuideTrack>> };

export function parseMovementGuide(raw: unknown): MovementGuide | null {
  const g = raw as MovementGuide;
  const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
  const point = (p: GuidePoint) => p && finite(p.timeMs) && p.timeMs >= 0 && p.timeMs <= 30250 && finite(p.x) && finite(p.y) && p.x > .02 && p.x < .98 && p.y > .02 && p.y < .98;
  if (!g || g.version !== "movement-guide-v1") return null;
  if (g.status === "unavailable" && g.partialTracks === undefined) return { version: g.version, status: g.status };
  if (g.coverageRevision !== 1) return { version: g.version, status: "unavailable" };
  if (!["ready", "unavailable"].includes(g.status) || !finite(g.width) || !finite(g.height) || g.width <= 0 || g.height <= 0 || g.width > 16384 || g.height > 16384 || !finite(g.impactMs) || g.impactMs <= 0 || g.impactMs > 30000) return null;
  const entries = (value: unknown) => value && typeof value === "object" && !Array.isArray(value) ? Object.entries(value) : null;
  const tracks = g.tracks === undefined ? [] : entries(g.tracks);
  const partial = g.partialTracks === undefined ? [] : entries(g.partialTracks);
  if (!tracks || !partial || (g.status === "ready" ? !tracks.length : tracks.length > 0 || !partial.length)
      || tracks.some(([kind]) => partial.some(([other]) => kind === other))) return null;
  const valid = (kind: string, value: unknown, isPartial: boolean) => {
    if (!["head", "pelvis"].includes(kind) || !value || typeof value !== "object" || Array.isArray(value)) return false;
    const t = value as PartialGuideTrack;
    if (!point(t.baseline) || t.baseline.timeMs >= g.impactMs! || !Array.isArray(t.points) || t.points.length < 6 || t.points.length > 1200
        || !t.points.every((p, i) => point(p) && p.timeMs >= t.baseline.timeMs && p.timeMs <= g.impactMs! + 250 && (!i || p.timeMs > t.points[i-1].timeMs))
        || !t.points.some(p => p.timeMs === t.focusTimeMs) || t.phase !== (t.focusTimeMs < g.impactMs!-40 ? "before" : t.focusTimeMs > g.impactMs!+40 ? "after" : "near")
        || t.focusTimeMs < g.impactMs! - 500 || t.focusTimeMs > g.impactMs! + 200) return false;
    if (!isPartial) return !("missingTimes" in t) && !("focusKind" in t);
    const pointTimes = new Set(t.points.map(p => p.timeMs));
    return t.focusKind === "near_impact" && t.focusTimeMs <= g.impactMs! && g.impactMs! - t.focusTimeMs <= 50
      && Array.isArray(t.missingTimes) && t.missingTimes.length <= 1200
      && t.missingTimes.every((time, i) => finite(time) && time >= t.baseline.timeMs && time <= g.impactMs! + 250
        && (!i || time > t.missingTimes[i-1]) && !pointTimes.has(time));
  };
  if (tracks.some(([kind, t]) => !valid(kind, t, false)) || partial.some(([kind, t]) => !valid(kind, t, true))) return null;
  return g;
}

export function guidePointAt(track: GuideTrack | PartialGuideTrack, timeMs: number): GuidePoint | null {
  if (!Number.isFinite(timeMs) || ("missingTimes" in track && (!track.points.length || timeMs < track.baseline.timeMs || timeMs > track.points[track.points.length-1].timeMs))) return null;
  const nearest = track.points.reduce<GuidePoint | null>((a, b) => !a || Math.abs(b.timeMs-timeMs) < Math.abs(a.timeMs-timeMs) ? b : a, null);
  if (!nearest || Math.abs(nearest.timeMs-timeMs) > 50) return null;
  return "missingTimes" in track && track.missingTimes.some(t => Math.abs(t-timeMs) <= Math.abs(nearest.timeMs-timeMs)) ? null : nearest;
}

export function guideSegments(track: GuideTrack | PartialGuideTrack, timeMs: number): [GuidePoint, GuidePoint][] {
  const recent = track.points.filter(p => p.timeMs <= timeMs && p.timeMs >= timeMs-500);
  return recent.slice(1).flatMap((p,i) => p.timeMs-recent[i].timeMs <= 100
    && (!("missingTimes" in track) || !track.missingTimes.some(t => t > recent[i].timeMs && t < p.timeMs))
    ? [[recent[i],p] as [GuidePoint,GuidePoint]] : []);
}
