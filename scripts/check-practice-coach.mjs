import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const dir = await mkdtemp(join(tmpdir(), 'practice-coach-'));
try {
  const outfile = join(dir, 'practice.cjs');
  await build({ stdin: { contents: `
    export * from './src/api/practiceReview';
    export * from './src/components/analysis/PracticeCoach';
    import { PracticeCoach } from './src/components/analysis/PracticeCoach';
    import { renderToStaticMarkup } from 'react-dom/server';
    import { createElement } from 'react';
    export const render = props => renderToStaticMarkup(createElement(PracticeCoach, props));
  `, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, platform: 'node', format: 'cjs', outfile, define: { 'import.meta.env': '{}', 'process.env.NODE_ENV': '"production"' }, logLevel: 'silent' });
  const { validatePracticeReview, requestPracticeReview, requestPracticePreview, canReviewFrames, parsePracticeBaseline, comparePracticeBaseline, practiceReducer, initialPracticeState, render } = await import(outfile);
  const valid = { ok: true, jobId: 'job', version: 'dtl-posture-review-v1', status: 'review_candidate', message: '2D 변화가 관측됐습니다.', evidence: { address: { timeMs: 100, angleDeg: 35, sampleCount: 3 }, comparison: { timeMs: 1300, angleDeg: 20, sampleCount: 3 }, changeDeg: 15, side: "left" }, practice: { title: '천천히 하프스윙', steps: ['편안한 범위에서 연습하세요.'], checkpoint: '같은 구간을 비교하세요.' }, reasons: [] };
  assert.equal(validatePracticeReview(valid, 'job', 100, 1300), valid);
  assert.equal(canReviewFrames(0, 150), true);
  for (const pair of [[null, 150], [0, null], [-1, 150], [0, 149], [150, 0], [NaN, 500], [0, Infinity], [0, 30_001]]) assert.equal(canReviewFrames(...pair), false);
  for (const changed of [{ ok: false }, { jobId: 'other' }, { version: 'future' }, { status: 'confirmed' }, { message: '' }, { reasons: [null] }, { evidence: undefined }, { evidence: { ...valid.evidence, side: undefined } }, { evidence: { ...valid.evidence, address: { ...valid.evidence.address, sampleCount: 2 } } }, { practice: undefined }, { practice: { ...valid.practice, steps: [] } }, { evidence: { ...valid.evidence, changeDeg: -15 } }, { evidence: { ...valid.evidence, comparison: { ...valid.evidence.comparison, timeMs: 1600 } } }, { evidence: { ...valid.evidence, address: { ...valid.evidence.address, angleDeg: NaN } } }]) assert.throws(() => validatePracticeReview({ ...valid, ...changed }, 'job', 100, 1300));
  const withheld = { ...valid, status: 'withheld', evidence: undefined, practice: undefined };
  assert.equal(validatePracticeReview(withheld, 'job', 100, 1300), withheld);
  assert.throws(() => validatePracticeReview({ ...withheld, practice: valid.practice }, 'job', 100, 1300));
  assert.throws(() => validatePracticeReview({ ...withheld, evidence: valid.evidence }, 'job', 100, 1300));
  const neutral = { ...valid, status: 'no_clear_change', practice: undefined };
  assert.equal(validatePracticeReview(neutral, 'job', 100, 1300), neutral);

  const baseline = { version: valid.version, jobId: 'previous-job', addressMs: 100, comparisonMs: 1300, changeDeg: 18, side: 'left', savedAt: '2026-10-26T12:00:00.000Z' };
  assert.equal(parsePracticeBaseline(baseline), baseline);
  for (const changed of [{version:'old'}, {jobId:''}, {changeDeg:NaN}, {changeDeg:100}, {savedAt:'invalid'}, {addressMs:1400}, {comparisonMs:null}, {side:'unknown'}, {side:undefined}]) assert.equal(parsePracticeBaseline({...baseline,...changed}),null);
  assert.equal(parsePracticeBaseline(null),null);
  assert.equal(parsePracticeBaseline('invalid'),null);
  assert.equal(comparePracticeBaseline(baseline, valid, false),null,'same conditions must be explicitly checked');
  assert.deepEqual(comparePracticeBaseline(baseline, valid, true),{beforeDeg:18,afterDeg:15});
  assert.deepEqual(comparePracticeBaseline(baseline, neutral, true),{beforeDeg:18,afterDeg:15});
  assert.equal(comparePracticeBaseline({...baseline,jobId:'job'}, valid, true),null,'same swing is not progress');
  assert.equal(comparePracticeBaseline(baseline, withheld, true),null,'withheld observations never compare');
  assert.equal(comparePracticeBaseline({...baseline,side:'left'}, {...valid,evidence:{...valid.evidence,side:'right'}}, true),null,'do not compare opposite measured sides');
  assert.equal(comparePracticeBaseline({...baseline,side:undefined}, valid, true),null,'missing side cannot match a known side');
  assert.equal(comparePracticeBaseline({...baseline,version:'old'}, valid, true),null);
  assert.equal(comparePracticeBaseline(baseline, {...valid,evidence:{...valid.evidence,changeDeg:NaN}}, true),null);

  let state = practiceReducer(initialPracticeState, { type: 'select', slot: 'addressMs', timeMs: 100 });
  state = practiceReducer(state, { type: 'select', slot: 'comparisonMs', timeMs: 1300 });
  state = practiceReducer(state, { type: 'start' });
  assert.equal(state.loading, true);
  state = practiceReducer(state, { type: 'result', result: valid });
  state = practiceReducer(state, { type: 'pattern', value: 'yes' });
  assert.equal(state.pattern, 'yes');
  state = practiceReducer(state, { type: 'pattern', value: 'no' });
  assert.equal(state.pattern, 'no');
  state = practiceReducer(state, { type: 'select', slot: 'comparisonMs', timeMs: 1350 });
  assert.equal(state.result, null, 'changing evidence clears old advice');
  assert.equal(state.pattern, null);
  state = practiceReducer({ ...state, result: valid, loading: true }, { type: 'select', slot:'addressMs', timeMs:100 });
  assert.equal(state.result, null);
  assert.equal(state.loading, false);

  let captured;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    captured = { url, body: JSON.parse(await options.body.text()) };
    return { ok: true, status: 200, text: async () => JSON.stringify(valid) };
  };
  try {
    await requestPracticeReview('job', 100, 1300, 'a'.repeat(64));
    assert.equal(captured.url, '/api/analyze/job/practice-review');
    assert.deepEqual(captured.body, { addressMs: 100, comparisonMs: 1300, viewpoint: 'down_the_line', confirmedFrames: true, videoSha256: 'a'.repeat(64) });
    await assert.rejects(() => requestPracticeReview('job', 150, 100));
  } finally { globalThis.fetch = originalFetch; }
  const pending = render({ jobId: 'job', timeMs: 0, playable: false, onCapture: () => null, onSeek() {} });
  assert.match(pending, /영상을 불러온 뒤/);
  assert.match(pending, /disabled=""/);
  assert.doesNotMatch(pending, /checked=""|천천히 하프스윙|신뢰도/);
  const ready = render({ jobId: 'job', timeMs: 1300, playable: true, onCapture: () => 1300, onSeek() {} });
  assert.match(ready, /1.300초/);
  assert.match(ready, /공에 닿기 직전/);
  assert.doesNotMatch(ready, /checked=""/);
  globalThis.fetch = async (_url, options) => {
    const body = JSON.parse(await options.body.text());
    assert.equal(body.mode, 'preview'); assert.equal(body.confirmedFrames, undefined);
    return {ok:true,status:200,text:async()=>JSON.stringify({ok:true,jobId:'job',status:'ready',addressMs:100,comparisonMs:1300})};
  };
  try { assert.equal((await requestPracticePreview('job',0,1300)).status,'ready'); }
  finally { globalThis.fetch=originalFetch; }
  console.log('Practice response, identity, frame order, request, reset/disagreement, local baseline/comparison and initial UI checks passed');
} finally { await rm(dir, { recursive: true, force: true }); }
