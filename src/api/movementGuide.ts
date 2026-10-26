export type GuidePoint = { timeMs: number; x: number; y: number };
export type GuideTrack = { baseline: GuidePoint; points: GuidePoint[]; focusTimeMs: number; phase: "before" | "after" | "near" };
export type MovementGuide = { version: "movement-guide-v1"; status: "ready" | "unavailable"; width?: number; height?: number; impactMs?: number; tracks?: Partial<Record<"head" | "pelvis", GuideTrack>> };
export type GuideKind = "head" | "pelvis";

export function parseMovementGuide(raw: unknown): MovementGuide | null {
  const g = raw as MovementGuide;
  const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
  const point = (p: GuidePoint) => p && finite(p.timeMs) && p.timeMs >= 0 && p.timeMs <= 30250 && finite(p.x) && finite(p.y) && p.x > .02 && p.x < .98 && p.y > .02 && p.y < .98;
  if (!g || g.version !== "movement-guide-v1") return null;
  if (g.status === "unavailable") return { version: g.version, status: g.status };
  if (g.status !== "ready" || !finite(g.width) || !finite(g.height) || g.width <= 0 || g.height <= 0 || g.width > 16384 || g.height > 16384 || !finite(g.impactMs) || g.impactMs <= 0 || g.impactMs > 30000 || !g.tracks) return null;
  const tracks = Object.entries(g.tracks);
  if (!tracks.length || tracks.some(([kind, t]) => !["head", "pelvis"].includes(kind) || !t || !point(t.baseline) || t.baseline.timeMs >= g.impactMs! || !Array.isArray(t.points) || t.points.length < 6 || t.points.length > 1200 || !t.points.every((p, i) => point(p) && p.timeMs >= t.baseline.timeMs && p.timeMs <= g.impactMs! + 250 && (!i || p.timeMs > t.points[i-1].timeMs)) || !t.points.some(p => p.timeMs === t.focusTimeMs) || t.phase !== (t.focusTimeMs < g.impactMs!-40 ? "before" : t.focusTimeMs > g.impactMs!+40 ? "after" : "near") || t.focusTimeMs < g.impactMs! - 500 || t.focusTimeMs > g.impactMs! + 200)) return null;
  return g;
}

export function guidePointAt(track: GuideTrack, timeMs: number): GuidePoint | null {
  const nearest = track.points.reduce<GuidePoint | null>((a, b) => !a || Math.abs(b.timeMs-timeMs) < Math.abs(a.timeMs-timeMs) ? b : a, null);
  return nearest && Math.abs(nearest.timeMs-timeMs) <= 50 ? nearest : null;
}


export function guideSegments(track: GuideTrack, timeMs: number): [GuidePoint, GuidePoint][] {
  const recent = track.points.filter(p => p.timeMs <= timeMs && p.timeMs >= timeMs-500);
  return recent.slice(1).flatMap((p,i) => p.timeMs-recent[i].timeMs <= 100 ? [[recent[i],p] as [GuidePoint,GuidePoint]] : []);
}
