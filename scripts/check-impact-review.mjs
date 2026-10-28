import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const dir = await mkdtemp(join(tmpdir(), 'impact-review-'));
try {
  const outfile = join(dir, 'review.mjs');
  await build({entryPoints: ['src/api/impactReview.ts'], bundle: true, platform: 'node', format: 'esm', outfile, define: {'import.meta.env': '{}'}, logLevel: 'silent'});
  const {validateImpactReview, withImpactCandidate, impactReviewVideoUrl} = await import(outfile);
  const valid = {ok: true, jobId: 'job', status: 'reference_candidate', timingRevision: 3, modelSha256: '70b338b519565f870ed1fce044a0453f828773e53b9fa9d024391b3b4cf57733', videoSha256: 'a'.repeat(64), inputScopeConfirmed: false, publicValue: null, automaticCoachingReady: false, appliedToPrimary: false, requiresHumanConfirmation: true, frameTimesMs: [0, 33, 67, 100], candidate: {frameIndex: 2, timeMs: 67}};
  assert.equal(validateImpactReview(valid, 'job'), valid);
  assert.equal(impactReviewVideoUrl('job'), '/api/analyze/job/review-video');
  assert.equal(impactReviewVideoUrl('job', valid.videoSha256), `/api/analyze/job/review-video?v=${valid.videoSha256}`);
  assert.equal(impactReviewVideoUrl('job', valid.videoSha256, true), `/api/analyze/job/review-video?v=${valid.videoSha256}&quality=original`);
  assert.equal(impactReviewVideoUrl('job', undefined, true), '/api/analyze/job/review-video?quality=original');
  for (const changed of [{jobId: 'other'}, {timingRevision: 2}, {timingRevision: undefined}, {inputScopeConfirmed: true}, {videoSha256: 'invalid'}, {automaticCoachingReady: true}, {publicValue: 67}, {frameTimesMs: [0, 33, 30, 100]}, {frameTimesMs: [0, 33, 67, 30001]}, {frameTimesMs: Array.from({length:7201},(_,i)=>i),candidate:{frameIndex:2,timeMs:2}}, {candidate: {frameIndex: 4, timeMs: 100}}, {candidate: {frameIndex: 2, timeMs: 66}}, {modelSha256: 'other'}]) {
    assert.throws(() => validateImpactReview({...valid, ...changed}, 'job'));
  }
  const legacy={top:{timeMs:100},impact:{timeMs:2976,quality:'confirmed'}};
  const selected=withImpactCandidate(legacy,valid,true);
  assert.equal(selected.impact.timeMs,67);
  assert.equal(selected.impact.quality,'reference');
  assert.equal(selected.impact.source,'pose-tcn-v1');
  assert.equal(legacy.impact.timeMs,2976,'historical result must not be overwritten');
  assert.equal(withImpactCandidate(legacy,null,true).impact,undefined,'pending/failure must never fall back to legacy impact');
  assert.equal(withImpactCandidate(legacy,null,false),legacy,'non-review callers stay compatible');
  const uiBundle=join(dir,'review-ui.cjs');
  await build({stdin:{contents:`import {renderToStaticMarkup} from 'react-dom/server'; import {createElement} from 'react'; import {ImpactReview} from './src/components/analysis/ImpactReview.tsx'; export const render=(props)=>renderToStaticMarkup(createElement(ImpactReview,props));`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,platform:'node',format:'cjs',outfile:uiBundle,define:{'process.env.NODE_ENV':'"production"'},logLevel:'silent'});
  const {render}=await import(uiBundle);
  const base={timeMs:67,onSeek:()=>{},onRetry:()=>{},error:null};
  const loading=render({...base,review:null,loading:true});
  assert.match(loading,/자동 계산 대기/);
  assert.doesNotMatch(loading,/후보 찾기|checked=/);
  const ready=render({...base,review:valid,loading:false});
  assert.match(ready,/0.067/); assert.match(ready,/후보로 이동/);
  assert.match(ready,/스윙 한 번을 촬영한 영상 기준/);
  assert.match(ready,/잘렸거나 여러 스윙이 이어지거나 연습 동작이면 후보가 틀릴 수/);
  const unavailableVideo=render({...base,review:valid,loading:false,playable:false});
  assert.equal((unavailableVideo.match(/disabled=""/g)||[]).length,3,'all seek controls stay disabled without playable video');
  const failed=render({...base,review:null,loading:false,error:'입력 부족'});
  assert.match(failed,/판정 보류/);assert.match(failed,/다시 시도/);
  const playerBundle=join(dir,'analysis-player.cjs');
  await build({stdin:{contents:`import {renderToStaticMarkup} from 'react-dom/server'; import {createElement} from 'react'; import {AnalysisPlayer} from './src/components/analysis/AnalysisPlayer.tsx'; export const render=()=>renderToStaticMarkup(createElement(AnalysisPlayer,{jobId:'job',videoUrl:'/video',isModalOpen:true}));`,resolveDir:process.cwd(),loader:'tsx'},
    bundle:true,platform:'node',format:'cjs',outfile:playerBundle,define:{'import.meta.env':'{}','process.env.NODE_ENV':'"production"'},logLevel:'silent',
    plugins:[{name:'stub-impact',setup(build){build.onResolve({filter:/^@\/hooks\/useImpactReview$/},()=>({path:'impact-stub',namespace:'test'}));build.onLoad({filter:/.*/,namespace:'test'},()=>({contents:'export const useImpactReview = () => globalThis.__impactReviewFixture;',loader:'js'}));}}]});
  const player=await import(playerBundle);
  globalThis.__impactReviewFixture={review:null,loading:true,error:null,retry(){}};
  assert.match(player.render(), /src="\/api\/analyze\/job\/review-video"/);
  globalThis.__impactReviewFixture={review:valid,loading:false,error:null,retry(){}};
  assert.ok(player.render().includes(`src="/api/analyze/job/review-video?v=${valid.videoSha256}"`), 'player must bind its video to the impact source');
  delete globalThis.__impactReviewFixture;
  console.log('automatic impact response, selection and UI-state checks passed');
} finally { await rm(dir, {recursive: true, force: true}); }
