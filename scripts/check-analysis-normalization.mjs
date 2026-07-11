import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import * as esbuild from "esbuild";

const tempDir = await mkdtemp(join(tmpdir(), "pi-web-analysis-"));
const bundlePath = join(tempDir, "shots-api.mjs");

try {
  await esbuild.build({
    entryPoints: ["src/api/shots.ts"],
    bundle: true,
    platform: "node",
    format: "esm",
    outfile: bundlePath,
    define: {
      "import.meta.env.VITE_BACK_BASE_URL": '""',
      "import.meta.env.VITE_API_BASE": '""',
      "import.meta.env.VITE_BACK_BASE_URL_LOCAL": '""',
      "import.meta.env.VITE_API_BASE_LOCAL": '""',
    },
    logLevel: "silent",
  });

  const { normalizeAnalysis } = await import(pathToFileURL(bundlePath).href);

  const raw = {
    jobId: "sample-v10",
    status: "succeeded",
    analysisVersion: "hailo-coach-service7-v10",
    events: {
      addressMs: 0,
      topMs: 352,
      impactMs: 527,
      finishMs: 718,
    },
    metrics: {
      tempo: {
        backswingMs: 352,
        downswingMs: 175,
        ratio: 2.01,
      },
      shaftPlane: {
        label: "flat",
        confidence: 0.27,
        angleDeg: 15.3,
        addressAngleDeg: 22.8,
        sampleCount: 51,
      },
      backswing: {
        label: "adequate",
        score: 0.61,
        handTravelRatio: 0.13,
      },
      trackingQuality: {
        label: "weak",
        score: 0.11,
        frames: 65,
        clubHeadFrames: 4,
        clubHandleFrames: 0,
        clubFrames: 51,
      },
      fusion: {
        releaseTiming: {
          label: "late_proxy",
          confidence: 0.36,
          source: "tempo_shaft_impact_proxy",
          evidence: ["flat_shaft", "impact_unstable", "fast_transition"],
          comment: "다운스윙에서 클럽 릴리스가 늦어지는 패턴입니다.",
        },
        transitionTiming: {
          label: "fast",
          confidence: 0.46,
          backswingMs: 352,
          downswingMs: 175,
          ratio: 2.01,
        },
      },
    },
    coachFindings: [
      {
        key: "pattern_late_club_release",
        category: "pattern",
        severity: "high",
        confidence: 0.36,
        priority: "1순위 패턴",
        evidence: "템포와 샤프트 플레인에서 릴리스 지연 신호가 같이 보입니다.",
        interpretation: "클럽이 몸 뒤에 남으면 임팩트 타이밍이 늦어질 수 있습니다.",
        action: "전환 구간에서 손보다 몸 회전 리듬을 먼저 정리하세요.",
        drill: "하프스윙 펌프 드릴 5회 후 실제 스윙 1회",
        checkpoint: "임팩트 직전 손과 클럽헤드가 공 앞에서 같이 지나가는지 확인",
        caution: "트래킹 품질이 낮아 반복 촬영에서 같은 패턴인지 확인하세요.",
        theory: "전환-릴리스 패턴: 빠른 전환, 낮은 샤프트, 임팩트 불안정의 조합을 우선 교정합니다.",
      },
      {
        key: "pattern_stuck_inside_release",
        category: "pattern",
        severity: "high",
        confidence: 0.55,
        priority: "1순위 패턴",
        evidence: "낮은 샤프트, inside-out 경로, 임팩트 불안정이 함께 나타납니다.",
        interpretation: "클럽이 몸 뒤에 남아 안쪽에서 늦게 들어오면 방향 편차가 커질 수 있습니다.",
        action: "그립과 클럽헤드가 오른쪽 허벅지 앞 공간을 지나가게 만드세요.",
        drill: "허리 높이 펌프 드릴",
        checkpoint: "손과 클럽헤드가 몸 앞 공간에 보이는지 확인",
        caution: "공/페이스 데이터가 없어 반복 확인용 참고 신호입니다.",
        theory: "인사이드-스턱 릴리스 패턴: 낮은 샤프트와 inside-out 경로, 임팩트 흔들림이 같이 보일 때 클럽이 몸 뒤에 남는 보상을 봅니다.",
      },
    ],
    confidence: 0.12,
    progress: {
      stage: "fusion_succeeded",
      stageLabel: "융합 분석 완료",
      message: "body/club 융합 분석 결과를 정리했습니다.",
      analysisPath: "infer",
    },
  };

  const normalized = normalizeAnalysis(raw, raw.jobId, "succeeded");

  assert.equal(normalized.analysisVersion, "hailo-coach-service7-v10");
  assert.equal(normalized.events.impact?.timeMs, 527);
  assert.equal(normalized.metrics.tempo?.ratio, "2.01:1");
  assert.equal(normalized.metrics.fusion?.releaseTiming?.label, "late_proxy");
  assert.deepEqual(normalized.metrics.fusion?.releaseTiming?.evidence, [
    "flat_shaft",
    "impact_unstable",
    "fast_transition",
  ]);
  assert.equal(normalized.metrics.fusion?.transitionTiming?.ratio, 2.01);
  assert.equal(normalized.coachFindings?.[0]?.key, "pattern_late_club_release");
  assert.equal(normalized.coachFindings?.[0]?.priority, "1순위 패턴");
  assert.equal(normalized.coachFindings?.[0]?.confidence, 0.36);
  assert.match(normalized.coachFindings?.[0]?.caution ?? "", /트래킹 품질/);
  assert.match(normalized.coachFindings?.[0]?.theory ?? "", /전환-릴리스 패턴/);
  assert.equal(normalized.coachFindings?.[1]?.key, "pattern_stuck_inside_release");
  assert.match(normalized.coachFindings?.[1]?.action ?? "", /오른쪽 허벅지 앞 공간/);
  assert.equal(normalized.coachFindings?.[1]?.drill, "허리 높이 펌프 드릴");
  assert.match(normalized.coachFindings?.[1]?.checkpoint ?? "", /몸 앞 공간/);
  assert.match(normalized.coachFindings?.[1]?.theory ?? "", /인사이드-스턱 릴리스 패턴/);
  assert.equal(normalized.progress?.stage, "fusion_succeeded");

  console.log("analysis normalization check passed");
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
