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

  const { normalizeAnalysis, requestClubReview } = await import(pathToFileURL(bundlePath).href);

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

  const partial = normalizeAnalysis({
    jobId: "partial-reference-events",
    status: "succeeded",
    events: { addressMs: 0, topMs: 1835, impactMs: 2369, finishMs: 2569 },
    metrics: { tempo: { backswingMs: null, downswingMs: null, ratio: null, status: "withheld" } },
    eventValidation: {
      status: "partial",
      codes: ["CLUB_IMPACT_REFERENCE_ONLY"],
      warnings: ["POSE_EVENT_SOURCE_DIVERGENCE"],
      eventQuality: {
        address: { status: "reference", confidence: 0.7, source: "pose_phase_decoder" },
        top: { status: "reference", confidence: 0.7, source: "pose_phase_decoder" },
        impact: { status: "reference", confidence: 0.55, source: "pose_club_bracket" },
        finish: { status: "reference", confidence: 0.7, source: "pose_phase_decoder" },
      },
      metricAvailability: { tempo: "withheld", impact: "withheld", path: "withheld" },
    },
  }, "partial-reference-events", "succeeded");
  assert.equal(partial.eventValidation?.status, "partial");
  assert.deepEqual(partial.eventValidation?.codes, ["CLUB_IMPACT_REFERENCE_ONLY"]);
  assert.deepEqual(partial.eventValidation?.warnings, ["POSE_EVENT_SOURCE_DIVERGENCE"]);
  assert.equal(partial.events.impact?.quality, "reference");
  assert.equal(partial.events.impact?.confidence, 0.55);
  assert.equal(partial.events.impact?.source, "pose_club_bracket");
  assert.equal(partial.metrics.tempo, undefined, "withheld tempo must not leak a stale ratio");

  const v14 = normalizeAnalysis({
    jobId: "v14-evidence",
    status: "succeeded",
    analysisVersion: "hailo-coach-service7-v14",
    events: { addressMs: 0, topMs: 567, impactMs: 1167, finishMs: 1300 },
    metrics: {
      tempo: { backswingMs: 567, downswingMs: 600, ratio: 0.94, status: "reference" },
      swingPlane: { label: "withheld", confidence: 0 },
      impactStability: { label: "withheld", score: null },
      ball: { launchDirection: "unknown", launchAngle: null, speedRelative: "unknown", status: "withheld" },
    },
    eventValidation: {
      status: "usable",
      metricAvailability: {
        tempo: "reference",
        impactStability: "withheld",
        path: "withheld",
        ball: "withheld",
      },
      metricEvidence: {
        tempo: {
          status: "reference",
          reasons: ["POSE_EVENT_TIMING_REFERENCE_ONLY"],
          source: "pose_phase_decoder",
        },
        impactStability: {
          status: "withheld",
          reasons: ["SINGLE_SWING_SPREAD_IS_NOT_REPEATABILITY"],
        },
      },
    },
    analysisQuality: {
      label: "observation_coverage",
      score: 0.48,
      meaning: "정답 확률이 아닙니다.",
      components: {
        clubObservationCoverage: 0.31,
        eventPathCoverage: 0.78,
        poseCoverage: 1,
      },
    },
  }, "v14-evidence", "succeeded");
  assert.equal(v14.eventValidation?.metricEvidence?.tempo?.status, "reference");
  assert.deepEqual(v14.eventValidation?.metricEvidence?.impactStability?.reasons, [
    "SINGLE_SWING_SPREAD_IS_NOT_REPEATABILITY",
  ]);
  assert.equal(v14.analysisQuality?.score, 0.48);
  assert.equal(v14.metrics.impactStability, "withheld");

  const sideOverlay = { coordinateSpace: "normalized", clubTimeSource: "video_pts", poseFrames: [], clubFrames: [{ timeMs: 17, head: { x: .2, y: .3, confidence: .8 } }] };
  const side = normalizeAnalysis({ dtlClubPointsV2: { status: "succeeded", overlay: sideOverlay } }, "side");
  assert.equal(side.dtlClubPointsV2.overlay.clubTimeSource, "video_pts");
  const ambiguous = normalizeAnalysis({dtlClubPointsV2:{status:'succeeded',trackingQuality:{label:'reference',ambiguousClubHeadFrames:5}}},'ambiguous');
  assert.equal(ambiguous.dtlClubPointsV2.trackingQuality.ambiguousClubHeadFrames, 5);
  const grip = normalizeAnalysis({dtlClubPointsV2:{status:'succeeded',trackingQuality:{label:'reference',ambiguousClubHandleFrames:3}}},'ambiguous-grip');
  assert.equal(grip.dtlClubPointsV2.trackingQuality.ambiguousClubHandleFrames, 3);
  for (const invalid of [-1, 1.5, true, '3', null, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    const value = normalizeAnalysis({dtlClubPointsV2:{status:'succeeded',trackingQuality:{label:'reference',ambiguousClubHeadFrames:invalid}}},'invalid-ambiguous');
    assert.equal(value.dtlClubPointsV2.trackingQuality.ambiguousClubHeadFrames, null);
    const badGrip = normalizeAnalysis({dtlClubPointsV2:{status:'succeeded',trackingQuality:{label:'reference',ambiguousClubHandleFrames:invalid}}},'invalid-grip');
    assert.equal(badGrip.dtlClubPointsV2.trackingQuality.ambiguousClubHandleFrames, null);
  }
  assert.equal(side.dtlClubPointsV2.overlay.clubFrames[0].timeMs, 17);
  assert.equal(side.dtlClubPointsV2.overlayVideoSha256, undefined, 'legacy sidecars keep their existing behavior');
  const unbound = normalizeAnalysis({dtlClubPointsV2:{status:'succeeded',overlay:null,pendingOverlay:sideOverlay,overlayVideoSha256:'a'.repeat(64),
    observations:{revision:1,status:'withheld',automaticCoachingReady:false,reason:'IMPACT_CANDIDATE_UNAVAILABLE',levels:[]}}},'unbound');
  assert.equal(unbound.dtlClubPointsV2.overlayVideoSha256, 'a'.repeat(64));
  assert.equal(unbound.dtlClubPointsV2.overlay, null);
  assert.equal(unbound.dtlClubPointsV2.pendingOverlay.clubTimeSource, 'video_pts');
  assert.equal(unbound.dtlClubPointsV2.observations.reason, 'IMPACT_CANDIDATE_UNAVAILABLE');
  const badBinding = normalizeAnalysis({dtlClubPointsV2:{status:'succeeded',overlay:sideOverlay,overlayVideoSha256:'bad'}},'bad');
  assert.equal(badBinding.dtlClubPointsV2.overlayVideoSha256, null, 'invalid binding must remain blocked');
  assert.equal(normalizeAnalysis({dtlClubPointsV2:{status:'failed',errorCode:'BODY_UNAVAILABLE'}},'missing').dtlClubPointsV2.errorCode,'BODY_UNAVAILABLE');
  assert.equal(normalizeAnalysis({dtlClubPointsV2:{status:'failed',errorCode:'other'}},'unknown').dtlClubPointsV2.errorCode,null);
  const marked = normalizeAnalysis({ dtlClubPointsV2: { status: "succeeded", overlay: { ...sideOverlay,
    clubFrames: [{...sideOverlay.clubFrames[0], headBreakBefore:true, handleBreakBefore:true, headValidUntilMs:25, handleValidUntilMs:26},
      {timeMs:33,head:{x:.2,y:.3,confidence:.8},headBreakBefore:"true",headValidUntilMs:"40",handleValidUntilMs:NaN}] } } }, "marked");
  assert.equal(marked.dtlClubPointsV2.overlay.clubFrames[0].headBreakBefore,true);
  assert.equal(marked.dtlClubPointsV2.overlay.clubFrames[0].handleBreakBefore,true);
  assert.equal(marked.dtlClubPointsV2.overlay.clubFrames[1].headBreakBefore,undefined);
  assert.equal(marked.dtlClubPointsV2.overlay.clubFrames[0].headValidUntilMs,25);
  assert.equal(marked.dtlClubPointsV2.overlay.clubFrames[0].handleValidUntilMs,26);
  assert.equal(marked.dtlClubPointsV2.overlay.clubFrames[1].headValidUntilMs,undefined);
  assert.equal(marked.dtlClubPointsV2.overlay.clubFrames[1].handleValidUntilMs,undefined);
  const boundCoverage = {status:'succeeded',overlayVideoSha256:'a'.repeat(64),pendingOverlay:sideOverlay};
  const covered = normalizeAnalysis({dtlClubPointsV2:{...boundCoverage,sourceFrameCoverage:{status:'verified',missingFrames:1}}},'covered');
  assert.equal(covered.dtlClubPointsV2.sourceFrameCoverage.status,'verified');
  assert.equal(covered.dtlClubPointsV2.sourceFrameCoverage.missingFrames,1);
  for (const value of [undefined,{status:'verified',missingFrames:-1},{status:'verified',missingFrames:7201},{status:'verified',missingFrames:true},{status:'unknown',missingFrames:0}]) {
    assert.equal(normalizeAnalysis({dtlClubPointsV2:{...boundCoverage,sourceFrameCoverage:value}},'bad-coverage').dtlClubPointsV2.sourceFrameCoverage.status,'unverified');
  }
  for (const invalid of [{...boundCoverage,overlayVideoSha256:undefined},{...boundCoverage,overlayVideoSha256:'bad'},
    {...boundCoverage,pendingOverlay:null},{...boundCoverage,pendingOverlay:{...sideOverlay,clubTimeSource:undefined}}]) {
    assert.equal(normalizeAnalysis({dtlClubPointsV2:{...invalid,sourceFrameCoverage:{status:'verified',missingFrames:1}}},'unbound-coverage').dtlClubPointsV2.sourceFrameCoverage.status,'unverified');
  }
  const legacy = normalizeAnalysis({ dtlClubPointsV2: { status: "succeeded", overlay: { ...sideOverlay, clubTimeSource: undefined } } }, "legacy");
  assert.equal(legacy.dtlClubPointsV2.overlay.clubTimeSource, undefined);
  const observation = { revision: 1, edgeCheck: "bbox-v1", status: "research_observation", automaticCoachingReady: false, levels: [{
    status: "observation", heightFraction: .5, backswing: { timeMs: 100, head: {frameEdge:false}, handle: {frameEdge:false} }, downswing: { timeMs: 300, head: {frameEdge:false}, handle: {frameEdge:false} }, inclinationDifferenceDeg: 10,
    sensitivity: [{ endpointRadiusPx: 5, differenceBoundsDeg: [5, 15], direction: "steeper" }],
  }] };
  const observed = normalizeAnalysis({ dtlClubPointsV2: { status: "succeeded", observations: observation } }, "observed");
  assert.equal(observed.dtlClubPointsV2.observations.levels[0].downswingMs, 300);
  assert.equal(observed.dtlClubPointsV2.observations.levels[0].direction, 'steeper');
  assert.equal(observed.dtlClubPointsV2.observations.levels[0].sensitiveTo10Px, undefined, 'older responses do not claim ten-pixel stability');
  const impactReference = { videoSha256:'a'.repeat(64), frameIndex:12, timeMs:400 };
  const bound = value => normalizeAnalysis({dtlClubPointsV2:{observations:{...observation,impactReference:value}}},'bound').dtlClubPointsV2.observations;
  assert.deepEqual(bound(impactReference).impactReference, impactReference);
  for (const bad of [null, {...impactReference,videoSha256:'bad'}, {...impactReference,frameIndex:-1},
    {...impactReference,frameIndex:7200}, {...impactReference,timeMs:NaN}, {...impactReference,timeMs:30001}]) {
    assert.equal(bound(bad).impactReference, undefined, 'invalid impact provenance must not unlock a comparison');
  }
  assert.equal(bound({...impactReference,timeMs:200}).levels.length, 0, 'downswing comparison must precede its recorded impact');
  const edgeLevel = input => normalizeAnalysis({dtlClubPointsV2:{observations:input}}, 'edge').dtlClubPointsV2.observations.levels[0];
  assert.equal(edgeLevel({...observation,edgeCheck:undefined}).direction, 'pair_uncertain');
  assert.equal(edgeLevel({...observation,edgeCheck:undefined}).frameEdgeReason, 'unverified');
  const edgePoint = structuredClone(observation); edgePoint.levels[0].backswing.head.frameEdge = true;
  assert.equal(edgeLevel(edgePoint).direction, 'pair_uncertain');
  assert.equal(edgeLevel(edgePoint).frameEdgeReason, 'possible');
  const unknownPoint = structuredClone(observation); delete unknownPoint.levels[0].downswing.handle.frameEdge;
  assert.equal(edgeLevel(unknownPoint).direction, 'pair_uncertain');
  const edgeCandidate = structuredClone(observation); edgeCandidate.levels[0].sensitivity[0].frameEdgeRisk = true;
  assert.equal(edgeLevel(edgeCandidate).direction, 'pair_uncertain');
  const edgeOverlay = normalizeAnalysis({dtlClubPointsV2:{status:'succeeded',overlay:{...sideOverlay,
    clubFrames:[{timeMs:17,head:{x:.2,y:.3,frameEdge:true},handle:{x:.4,y:.3,frameEdge:false}}]}}},'edge-overlay');
  assert.equal(edgeOverlay.dtlClubPointsV2.overlay.clubFrames[0].head.frameEdge,true);
  assert.equal(edgeOverlay.dtlClubPointsV2.overlay.clubFrames[0].handle.frameEdge,false);
  observation.levels[0].sensitivity.push({ endpointRadiusPx: 10, differenceBoundsDeg: [-5, 20], direction: 'unresolved', pairAvailabilityStable: true });
  assert.equal(normalizeAnalysis({dtlClubPointsV2:{observations:observation}}, 'sensitive').dtlClubPointsV2.observations.levels[0].sensitiveTo10Px, true);
  observation.levels[0].sensitivity[1] = { endpointRadiusPx: 10, differenceBoundsDeg: [-5, 20], direction: 'pair_uncertain', pairAvailabilityStable: false };
  assert.equal(normalizeAnalysis({dtlClubPointsV2:{observations:observation}}, 'pair').dtlClubPointsV2.observations.levels[0].sensitiveTo10Px, true);
  observation.levels[0].sensitivity[1] = { endpointRadiusPx: 10, differenceBoundsDeg: [5, 20], direction: 'unresolved', pairAvailabilityStable: true };
  assert.equal(normalizeAnalysis({dtlClubPointsV2:{observations:observation}}, 'bad-range').dtlClubPointsV2.observations.levels[0].sensitiveTo10Px, undefined);
  observation.levels[0].sensitivity[1] = { endpointRadiusPx: 10, differenceBoundsDeg: [3, 20], direction: 'steeper', pairAvailabilityStable: true };
  assert.equal(normalizeAnalysis({dtlClubPointsV2:{observations:observation}}, 'stable').dtlClubPointsV2.observations.levels[0].sensitiveTo10Px, undefined);
  assert.equal(normalizeAnalysis({ dtlClubPointsV2: { observations: { ...observation, automaticCoachingReady: true } } }, "unsafe").dtlClubPointsV2.observations, null);
  observation.levels[0].sensitivity[0].differenceBoundsDeg = [-5,15];
  assert.equal(normalizeAnalysis({ dtlClubPointsV2: { observations: observation } }, "inconsistent").dtlClubPointsV2.observations.levels.length, 0);
  const originalFetch = globalThis.fetch;
  try {
    let calls=0;
    globalThis.fetch = async (_url, options) => {
      calls++;
      return new Response(JSON.stringify(options.method === "POST" ? { ok: true } : { ok: true, jobId: "review", sidecar: { status: "succeeded" } }));
    };
    assert.equal((await requestClubReview("review", new AbortController().signal)).status,"succeeded");
    assert.equal(calls,2);
    const aborted=new AbortController();aborted.abort();
    await assert.rejects(requestClubReview("review",aborted.signal),/Aborted/);assert.equal(calls,2);
    globalThis.fetch = async () => new Response(JSON.stringify({ok:true,jobId:"other",sidecar:{status:"succeeded"}}));
    await assert.rejects(requestClubReview("review",new AbortController().signal),/다른 영상/);
    let sentBody;
    globalThis.fetch = async (_url, options) => {
      if (options.method === "POST") { sentBody = JSON.parse(await options.body.text()); return new Response(JSON.stringify({ok:true,refreshId:"new"})); }
      return new Response(JSON.stringify({ok:true,jobId:"review",refresh:{id:"new",status:"succeeded"},sidecar:{status:"succeeded"}}));
    };
    assert.equal((await requestClubReview("review",new AbortController().signal,true)).status,"succeeded");
    assert.equal(sentBody.refresh,true);
    let polls=0;
    globalThis.fetch = async (_url, options) => {
      if (options.method === "POST") return new Response(JSON.stringify({ok:true,refreshId:"new"}));
      polls++;
      return new Response(JSON.stringify({ok:true,jobId:"review",refresh:{id:"new",status:polls === 1 ? "running" : "succeeded"},sidecar:{status:"succeeded",processingMs:polls}}));
    };
    assert.equal((await requestClubReview("review",new AbortController().signal,true)).processingMs,2);
    assert.equal(polls,2,'old succeeded sidecar must not end an active refresh');
    for (const status of ["failed","interrupted"]) {
      globalThis.fetch = async (_url, options) => new Response(JSON.stringify(options.method === "POST" ? {ok:true,refreshId:"new"} : {ok:true,jobId:"review",refresh:{id:"new",status},sidecar:{status:"succeeded"}}));
      await assert.rejects(requestClubReview("review",new AbortController().signal,true),/다시 계산하지 못했습니다/);
    }
    globalThis.fetch = async (_url,options) => new Response(JSON.stringify(options.method === "POST" ? {ok:true,refreshId:"new"} : {ok:true,jobId:"review",refresh:{id:"new",status:"failed",errorCode:"BODY_UNAVAILABLE"},sidecar:{status:"succeeded"}}));
    await assert.rejects(requestClubReview("review",new AbortController().signal,true),/자세 자료를 확인하지 못해/);
    globalThis.fetch = async (_url,options) => new Response(JSON.stringify(options.method === "POST" ? {ok:true} : {ok:true,jobId:"review",sidecar:{status:"failed",errorCode:"BODY_UNAVAILABLE"}}));
    await assert.rejects(requestClubReview("review",new AbortController().signal),/자세 자료를 확인하지 못해/);
    globalThis.fetch = async (_url, options) => new Response(JSON.stringify(options.method === "POST" ? {ok:true,refreshId:"new"} : {ok:true,jobId:"review",refresh:{id:"other",status:"succeeded"},sidecar:{status:"succeeded"}}));
    await assert.rejects(requestClubReview("review",new AbortController().signal,true),/다른 관측 작업/);
    globalThis.fetch = async () => new Response(JSON.stringify({ok:true,sidecar:{status:"succeeded"}}));
    await assert.rejects(requestClubReview("review",new AbortController().signal,true),/다시 계산할 수 없습니다/);
  } finally { globalThis.fetch=originalFetch; }
  console.log("analysis normalization check passed");
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
