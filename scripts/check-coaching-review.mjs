import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const dir = await mkdtemp(join(tmpdir(), 'coaching-review-'));
try {
  const outfile = join(dir, 'test.cjs');
  await build({ stdin: { contents: `export * from './src/api/coachingReview';
    import {CoachingObservation,PelvisContourOverlay} from './src/components/analysis/CoachingReview';
    import {AnalysisVideoPlayer} from './src/components/analysis/AnalysisVideoPlayer';
    import {createElement} from 'react'; import {renderToStaticMarkup} from 'react-dom/server';
    export const render=(name,props)=>renderToStaticMarkup(createElement({CoachingObservation,PelvisContourOverlay,AnalysisVideoPlayer}[name],props));`,
    resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, platform: 'node', format: 'cjs', outfile,
    define: { 'import.meta.env': '{}', 'process.env.NODE_ENV': '"production"' }, logLevel: 'silent' });
  const { parseCoachingReview, requestCoachingReview, render } = await import(outfile);
  const points = [100,134,168,500,560,620,680,740,800,860,920,980,1040,1100].map(timeMs => ({timeMs,x: timeMs < 600 ? .3 : .34,y:.6,referenceX:.31,referenceY:.61}));
  const evidence = { addressMs:100,startMs:500,endMs:1100,focusMs:860,impactMs:1000,width:270,height:480,
    cameraMotion:'translation_corrected',ballDirection:'right',baselineX:.3,baselineY:.6,noisePx:2,shiftPx:10.8,observation:'toward_ball',points };
  const result = {ok:true,jobId:'job',version:'dtl-coaching-review-v1',status:'ready',diagnosisStatus:'unvalidated',reason:null,
    summary:'공에 닿기 전, 골반 뒤쪽 윤곽이 시작 기준선보다 공 쪽에 보입니다.',evidence};
  const parsed = parseCoachingReview(result,'job',1000);
  assert.equal(parsed.evidence.endMs, 920, 'legacy replay must stop at the last measured pre-impact frame');
  assert.equal(evidence.endMs, 1100, 'normalization must not mutate the source response');
  assert.equal(parseCoachingReview({...result,evidence:{...evidence,endMs:920}},'job',1000).evidence.endMs, 920);
  for (const patch of [{jobId:'other'},{version:'old'},{diagnosisStatus:'confirmed'},{status:'confirmed'},{summary:''},{evidence:null},
    {evidence:{...evidence,impactMs:1200}},{evidence:{...evidence,baselineX:NaN}},{evidence:{...evidence,focusMs:980}},
    {evidence:{...evidence,points:[...points,points[0]]}},{evidence:{...evidence,points:[null]}},
    {evidence:{...evidence,cameraMotion:'unknown'}},{evidence:{...evidence,points:points.map(p=>({...p,referenceX:NaN}))}},{evidence:{...evidence,noisePx:-1}},{evidence:{...evidence,ballDirection:'unknown'}}]) {
    assert.throws(()=>parseCoachingReview({...result,...patch},'job',1000));
  }
  const unavailable={...result,status:'unavailable',reason:'SILHOUETTE_UNRELIABLE',evidence:null};
  assert.equal(parseCoachingReview(unavailable,'job',1000).status,'unavailable');
  assert.throws(()=>parseCoachingReview({...unavailable,evidence},'job',1000));
  const props={result,playable:true,onEvidence(){},onSeek(){}};
  const html=render('CoachingObservation',props);
  assert.match(html,/근거 구간 천천히 보기/);assert.match(html,/원인이나 교정 필요성을 확정하지 않습니다/);
  assert.match(html,/영상에서도 이동이 보인다면 아래 교습 원리와 연습/);
  assert.doesNotMatch(html,/checkbox|연습 전과 비교|기준으로 저장|진단 완료|교정 성공/);
  assert.match(render('CoachingObservation',{...props,playable:false}),/disabled=""/);
  const neutral=render('CoachingObservation',{...props,result:{...result,evidence:{...evidence,observation:'no_clear_shift'}}});
  assert.match(neutral,/스윙 전체가 좋다는 판정은 아닙니다/);
  assert.doesNotMatch(render('CoachingObservation',{...props,result:unavailable}),/근거 구간 천천히 보기/);
  assert.match(render('PelvisContourOverlay',{evidence,timeMs:860}),/stroke="#34d399"/);
  assert.doesNotMatch(render('PelvisContourOverlay',{evidence,timeMs:2000}),/stroke="#34d399"/,'never carry stale contour outside sampled frames');
  assert.match(render('PelvisContourOverlay',{evidence,timeMs:860}),/x1="0.31"/);
  assert.doesNotMatch(render('PelvisContourOverlay',{evidence,timeMs:2000}),/stroke="#fbbf24"/);
  const similarity={...evidence,cameraMotion:'similarity_corrected',points:points.map(p=>({...p,referenceTop:[.30,.45],referenceBottom:[.32,.75]}))};
  assert.equal(parseCoachingReview({...result,evidence:similarity},'job',1000).evidence.endMs,920);
  assert.throws(()=>parseCoachingReview({...result,evidence:{...evidence,cameraMotion:'similarity_corrected'}},'job',1000));
  assert.throws(()=>parseCoachingReview({...result,excludedFrames:[{timeMs:NaN,reason:'bad'}]},'job',1000));
  assert.match(render('PelvisContourOverlay',{evidence:similarity,timeMs:860}),/x1="0.3" x2="0.32"/);
  assert.doesNotMatch(render('PelvisContourOverlay',{evidence:{...similarity,points:similarity.points.filter(p=>p.timeMs!==860)},timeMs:860}),/stroke="#fbbf24"/,'do not bridge excluded frames');
  assert.match(render('CoachingObservation',{...props,result:{...unavailable,reason:'PHASE_COVERAGE_INSUFFICIENT'}}),/장면이 부족/);
  const player=render('AnalysisVideoPlayer',{src:'/video.mp4',videoRef:{current:null},mediaRef:{current:null},currentTimeMs:0,onTimeChange(){},reviewRange:{startMs:500,endMs:1100},onClearReview(){}});
  assert.match(player,/0.5배 반복/);assert.match(player,/전체 영상 보기/);
  let count=0, resolve;
  const originalFetch=globalThis.fetch;
  globalThis.fetch=async(url,options)=>{
    count++;const body=JSON.parse(await options.body.text());
    assert.equal(body.mode,'coaching');assert.equal(body.videoSha256,'a'.repeat(64));
    assert.equal(body.confirmedFrames,undefined);assert.equal(body.impactMs,undefined);
    await new Promise(done=>resolve=done);
    return {ok:true,status:200,text:async()=>JSON.stringify(result)};
  };
  try {
    const a=requestCoachingReview('job',100,1000,'a'.repeat(64));
    const b=requestCoachingReview('job',100,1000,'a'.repeat(64));
    assert.equal(a,b,'duplicate mounts share in-flight work');
    await new Promise(done=>setTimeout(done,0));assert.equal(count,1);resolve();await a;
    const c=requestCoachingReview('job',100,1000,'a'.repeat(64));
    await new Promise(done=>setTimeout(done,0));assert.equal(count,2,'reopening rechecks server freshness');resolve();await c;
    await assert.rejects(requestCoachingReview('job',100,200,'a'.repeat(64)));
  } finally {globalThis.fetch=originalFetch;}
  console.log('coaching contract, identity, evidence scope, unavailable UI, replay controls and duplicate-request checks passed');
} finally { await rm(dir,{recursive:true,force:true}); }
