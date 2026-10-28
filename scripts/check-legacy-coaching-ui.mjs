import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build } from "esbuild";

const dir = await mkdtemp(join(tmpdir(), "legacy-coaching-ui-"));
try {
  const outfile = join(dir, "view.cjs");
  await build({
    stdin: { contents: `import {createElement} from 'react'; import {renderToStaticMarkup} from 'react-dom/server';
      import {KeyMetrics} from './src/components/analysis/KeyMetrics';
      import {CoachSummary} from './src/components/analysis/CoachSummary';
      export const render=(name,props)=>renderToStaticMarkup(createElement({KeyMetrics,CoachSummary}[name],props));`,
      resolveDir: process.cwd(), loader: "tsx" },
    bundle: true, platform: "node", format: "cjs", outfile,
    define: { "process.env.NODE_ENV": '"production"' }, logLevel: "silent",
  });
  const { render } = await import(outfile);
  const old = {
    status: "succeeded", events: { impact: { timeMs: 1500 } },
    metrics: { shaftPlane: { label: "neutral", angleDeg: 49 }, backswing: { label: "adequate" },
      swingPlaneDetail: { label: "inside-out" }, impactStability: "stable", tempo: { ratio: "3:1" } },
    eventValidation: { status: "usable", eventQuality: { impact: { status: "confirmed" } },
      metricEvidence: Object.fromEntries(["shaft", "backswing", "path", "impactStability", "tempo"].map(key => [key, { status: "confirmed" }])) },
  };
  const original = JSON.stringify(old);
  const metrics = render("KeyMetrics", { analysis: old });
  assert.match(metrics, /49\.0° · 기존 2D 추정/);
  assert.match(metrics, /1500 ms · 기존 후보/);
  assert.doesNotMatch(metrics, />확정<|백스윙 크기 적정|중립 기울기|관측 확인/);
  assert.equal(JSON.stringify(old), original, "display must not rewrite archived analysis");

  const coach = render("CoachSummary", { findings: [{ key: "shaft_flat", category: "shaft_plane", severity: "medium",
    confidence: 0.9, evidence: "기존 측정", action: "기존 자동 제안" }] });
  assert.match(coach, /과거 코칭 기록/);
  assert.match(coach, /교정의 근거로 검증되지 않았습니다/);
  assert.match(coach, /이전 시스템의 제안/);
  assert.doesNotMatch(coach, /확정 교정과|아래 연습 하나만 천천히 반복/);

  const library = await readFile("src/components/library/LibraryApp.tsx", "utf8");
  assert.match(library, /<details[^>]*>[\s\S]*기존 분석 기록 · 연구 참고용[\s\S]*<KeyMetrics[\s\S]*<CoachSummary/);
  assert.match(library, /onWatchEvidence=\{selected\.videoStored \?/);
  const app = await readFile("src/App.tsx", "utf8");
  assert.match(app, /onWatchEvidence=\{selectedVideoUrl \?/);
  console.log("legacy coaching and metric evidence display checks passed");
} finally {
  await rm(dir, { recursive: true, force: true });
}
