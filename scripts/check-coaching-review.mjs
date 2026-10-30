import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const dir = await mkdtemp(join(tmpdir(), 'coaching-review-'));
try {
  const outfile = join(dir, 'test.cjs');
  await build({ stdin: { contents: `export * from './src/api/coachingReview';
    import {CoachingReview,CoachingObservation,PelvisContourOverlay} from './src/components/analysis/CoachingReview';
    import {AnalysisVideoPlayer} from './src/components/analysis/AnalysisVideoPlayer';
    import {createElement} from 'react'; import {renderToStaticMarkup} from 'react-dom/server';
    export const render=(name,props)=>renderToStaticMarkup(createElement({CoachingReview,CoachingObservation,PelvisContourOverlay,AnalysisVideoPlayer}[name],props));`,
    resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, platform: 'node', format: 'cjs', outfile,
    define: { 'import.meta.env': '{}', 'process.env.NODE_ENV': '"production"' }, logLevel: 'silent' });
  const { parseCoachingReview, requestCoachingReview, render } = await import(outfile);
  const points = [100,134,168,500,560,620,680,740,800,860,920,980,1040,1100].map(timeMs => ({timeMs,x: timeMs < 600 ? .3 : .34,y:.6,referenceX:.31,referenceY:.61}));
  const evidence = { addressMs:100,startMs:500,endMs:1100,focusMs:860,impactMs:1000,width:270,height:480,
    cameraMotion:'translation_corrected',ballDirection:'right',baselineX:.3,baselineY:.6,noisePx:2,shiftPx:10.8,observation:'toward_ball',points };
  const result = {ok:true,jobId:'job',version:'dtl-coaching-review-v1',status:'ready',diagnosisStatus:'unvalidated',reason:null,
    summary:'검사한 구간에서 골반 뒤쪽 윤곽이 시작 기준선보다 추정한 공 방향에 보입니다.',evidence};
  const parsed = parseCoachingReview(result,'job',1000,100);
  assert.equal(parsed.evidence.endMs, 920, 'legacy replay must stop at the last measured pre-impact frame');
  assert.equal(evidence.endMs, 1100, 'normalization must not mutate the source response');
  assert.throws(()=>parseCoachingReview({...result,evidence:{...evidence,addressMs:300}},'job',1000,100), 'reject an observation for a different starting scene');
  assert.equal(parseCoachingReview({...result,evidence:{...evidence,endMs:920}},'job',1000,100).evidence.endMs, 920);
  for (const patch of [{jobId:'other'},{version:'old'},{diagnosisStatus:'confirmed'},{status:'confirmed'},{summary:''},{evidence:null},
    {evidence:{...evidence,impactMs:1200}},{evidence:{...evidence,baselineX:NaN}},{evidence:{...evidence,focusMs:980}},
    {evidence:{...evidence,points:[...points,points[0]]}},{evidence:{...evidence,points:[null]}},
    {evidence:{...evidence,cameraMotion:'unknown'}},{evidence:{...evidence,points:points.map(p=>({...p,referenceX:NaN}))}},{evidence:{...evidence,noisePx:-1}},{evidence:{...evidence,ballDirection:'unknown'}}]) {
    assert.throws(()=>parseCoachingReview({...result,...patch},'job',1000,100));
  }
  const unavailable={...result,status:'unavailable',reason:'SILHOUETTE_UNRELIABLE',evidence:null};
  assert.equal(parseCoachingReview(unavailable,'job',1000,100).status,'unavailable');
  assert.equal(parseCoachingReview({...unavailable,reason:'CAMERA_BACKGROUND_AMBIGUOUS'},'job',1000,100).reason,'CAMERA_BACKGROUND_AMBIGUOUS');
  assert.throws(()=>parseCoachingReview({...unavailable,evidence},'job',1000,100));
  const props={result,playable:true,onEvidence(){},onSeek(){}};
  const missingAddress = render('CoachingReview',{jobId:'job',candidatePending:false,analysisReady:true,playable:true,onResult(){},onEvidence(){},onSeek(){}});
  assert.match(missingAddress,/준비 자세 후보 없음/); assert.match(missingAddress,/준비 자세를 선택하면 골반 관찰을 시작/);
  assert.match(render('CoachingReview',{jobId:'job',addressMs:0,candidatePending:false,analysisReady:true,playable:true,onResult(){},onEvidence(){},onSeek(){}}),/준비 자세 후보 · 0\.00초/);
  assert.match(render('CoachingReview',{jobId:'job',addressMs:0,candidatePending:false,analysisReady:true,playable:true,onResult(){},onEvidence(){},onSeek(){}}),/처음에는 1분 정도 걸릴 수 있어요/);
  assert.match(render('CoachingReview',{jobId:'job',addressMs:100,candidatePending:false,playable:true,onResult(){},onEvidence(){},onSeek(){}}),/영상이 잘리거나 반복되면 구간이 틀릴 수/);
  assert.match(render('CoachingReview',{jobId:'job',addressMs:100,candidatePending:false,playable:true,onResult(){},onEvidence(){},onSeek(){}}),/공은 직접 감지하지 않고 준비 자세로 방향을 추정/);
  assert.match(render('CoachingReview',{jobId:'job',addressMs:100,candidatePending:false,analysisReady:false,analysisError:'failed',onRetryAnalysis(){},playable:true,onResult(){},onEvidence(){},onSeek(){}}),/분석 결과 다시 불러오기/);
  assert.match(render('CoachingReview',{jobId:'job',addressMs:100,impactFrameIndex:3,candidatePending:false,playable:true,onResult(){},onEvidence(){},onSeek(){}}),/직접 선택한 장면/);
  const html=render('CoachingObservation',props);
  assert.match(html,/근거 구간 천천히 보기/);assert.match(html,/화면상 윤곽만으로 얼리 익스텐션이나 교정 필요성을 확정하지 않습니다/);
  assert.match(html,/추정 공 방향: 화면 오른쪽/);assert.match(html,/공 위치를 확인할 수 없다면 이 관찰을 해석하지 마세요/);
  assert.match(html,/배경이 움직이면 기준선이 어긋날 수 있어요/);
  assert.match(render('CoachingObservation',{...props,result:{...result,evidence:{...evidence,ballDirection:'left'}}}),/추정 공 방향: 화면 왼쪽/);
  assert.match(html,/영상에서도 이동이 보인다면 아래 교습 원리와 연습/);
  const selectedHtml=render('CoachingObservation',{...props,selectedImpact:true});
  assert.match(selectedHtml,/임팩트 기준은 직접 선택한 장면/);
  assert.doesNotMatch(selectedHtml,/임팩트는 모델의 후보/);
  assert.doesNotMatch(html,/checkbox|연습 전과 비교|기준으로 저장|진단 완료|교정 성공/);
  assert.match(render('CoachingObservation',{...props,playable:false}),/disabled=""/);
  assert.match(render('CoachingObservation',{...props,contourStatus:'other'}),/이 장면은 윤곽을 측정하지 않았어요/);
  assert.match(render('CoachingObservation',{...props,contourStatus:'unverified'}),/표시된 장면을 확인하지 못해 선을 보류/);
  assert.match(render('CoachingObservation',{...props,contourStatus:'unverified',canRetryContour:true,onRetryContour(){}}),/선 다시 확인/);
  assert.doesNotMatch(render('CoachingObservation',{...props,contourStatus:'unverified',canRetryContour:false,onRetryContour(){}}),/선 다시 확인/);
  assert.match(render('CoachingObservation',{...props,contourStatus:'shown'}),/영상이 멈춘 측정 장면에서만/);
  const neutral=render('CoachingObservation',{...props,result:{...result,evidence:{...evidence,observation:'no_clear_shift'}}});
  assert.match(neutral,/스윙 전체가 좋다는 판정은 아닙니다/);
  assert.match(neutral,/배경이 움직이면 기준선이 어긋날 수 있어요/);
  assert.doesNotMatch(render('CoachingObservation',{...props,result:unavailable}),/근거 구간 천천히 보기/);
  assert.match(render('PelvisContourOverlay',{evidence,timeMs:860}),/stroke="#34d399"/);
  assert.match(render('PelvisContourOverlay',{evidence,timeMs:860.9}),/stroke="#34d399"/,'allow sub-frame timestamp rounding');
  assert.doesNotMatch(render('PelvisContourOverlay',{evidence,timeMs:876.667}),/stroke="#34d399"/,'do not draw a sample on a different frame');
  assert.doesNotMatch(render('PelvisContourOverlay',{evidence,timeMs:2000}),/stroke="#34d399"/,'never carry stale contour outside sampled frames');
  assert.match(render('PelvisContourOverlay',{evidence,timeMs:860}),/x1="0.31"/);
  assert.doesNotMatch(render('PelvisContourOverlay',{evidence,timeMs:2000}),/stroke="#fbbf24"/);
  const similarity={...evidence,cameraMotion:'similarity_corrected',points:points.map(p=>({...p,referenceTop:[.30,.45],referenceBottom:[.32,.75]}))};
  assert.equal(parseCoachingReview({...result,evidence:similarity},'job',1000,100).evidence.endMs,920);
  assert.throws(()=>parseCoachingReview({...result,evidence:{...evidence,cameraMotion:'similarity_corrected'}},'job',1000,100));
  assert.throws(()=>parseCoachingReview({...result,excludedFrames:[{timeMs:NaN,reason:'bad'}]},'job',1000,100));
  const guidePoints=Array.from({length:25},(_,i)=>({timeMs:100+i*40,x:.4+i*.002,y:.4}));
  const guide={version:'movement-guide-v1',status:'ready',width:270,height:480,impactMs:1000,
    tracks:{pelvis:{baseline:guidePoints[0],points:guidePoints,focusTimeMs:900,phase:'before'}}};
  assert.equal(parseCoachingReview({...result,movementGuide:guide},'job',1000,100).movementGuide.impactMs,1000);
  assert.throws(()=>parseCoachingReview({...result,movementGuide:{...guide,impactMs:1050}},'job',1000,100),'reject an overlay for a different impact');
  assert.match(render('PelvisContourOverlay',{evidence:similarity,timeMs:860}),/x1="0.3" x2="0.32"/);
  assert.doesNotMatch(render('PelvisContourOverlay',{evidence:{...similarity,points:similarity.points.filter(p=>p.timeMs!==860)},timeMs:860}),/stroke="#fbbf24"/,'do not bridge excluded frames');
  const coverageUnavailable=render('CoachingObservation',{...props,result:{...unavailable,reason:'PHASE_COVERAGE_INSUFFICIENT'}});
  assert.match(coverageUnavailable,/장면이 부족/);
  assert.match(coverageUnavailable,/임팩트 탭에서 타격 장면을 확인/);
  assert.doesNotMatch(coverageUnavailable,/촬영해 주세요/);
  assert.match(render('CoachingObservation',{...props,result:{...unavailable,reason:'BALL_DIRECTION_UNCLEAR'}}),/준비 자세로 공 방향을 추정하기 어렵습니다/);
  assert.match(render('CoachingObservation',{...props,result:{...unavailable,reason:'CAMERA_MOTION_OR_BACKGROUND_UNCLEAR'}}),/준비 자세 후보가 다르면 위에서 바꿔/);
  assert.match(render('CoachingObservation',{...props,result:{...unavailable,reason:'VIDEO_TIMING_UNAVAILABLE'}}),/영상과 분석 프레임의 시각/);
  const backgroundAmbiguous=render('CoachingObservation',{...props,result:{...unavailable,reason:'CAMERA_BACKGROUND_AMBIGUOUS'}});
  assert.match(backgroundAmbiguous,/배경 보정에 따라 골반 위치가 달라져 관찰을 보류/);
  assert.doesNotMatch(backgroundAmbiguous,/근거 구간 천천히 보기/);
  const heightUncertain=render('CoachingObservation',{...props,result:{...unavailable,reason:'PELVIS_HEIGHT_UNCERTAIN'}});
  assert.match(heightUncertain,/윤곽을 잰 높이가 달라 비교를 보류/);
  assert.doesNotMatch(heightUncertain,/근거 구간 천천히 보기/);
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
  const requests=[], releases=[];
  globalThis.fetch=async(_url,options)=>{
    const body=JSON.parse(await options.body.text());requests.push(body);
    await new Promise(done=>releases.push(done));
    const response=body.impactFrameIndex === undefined ? result : {...result,evidence:{...evidence,impactMs:1100}};
    return {ok:true,status:200,text:async()=>JSON.stringify(response)};
  };
  try {
    const automatic=requestCoachingReview('job',100,1000,'a'.repeat(64));
    const selected=requestCoachingReview('job',100,1100,'a'.repeat(64),8);
    await new Promise(done=>setTimeout(done,0));
    assert.equal(requests.length,1,'selected review waits while this video is still being observed');
    releases.shift()();await automatic;await new Promise(done=>setTimeout(done,0));
    assert.equal(requests.length,2);assert.equal(requests[1].impactFrameIndex,8);
    assert.equal(requests[1].comparisonMs,1020);assert.equal(requests[1].impactMs,undefined);
    releases.shift()();assert.equal((await selected).evidence.impactMs,1100);
    await assert.rejects(requestCoachingReview('job',100,1100,'a'.repeat(64),-1));
  } finally {globalThis.fetch=originalFetch;}
  let crossJobCalls=0, releaseFirst;
  globalThis.fetch=async(url)=>{
    crossJobCalls++;
    if(crossJobCalls===1)await new Promise(done=>releaseFirst=done);
    return {ok:true,status:200,text:async()=>JSON.stringify({...result,jobId:url.includes('/job2/')?'job2':'job'})};
  };
  try {
    const first=requestCoachingReview('job',100,1000,'a'.repeat(64));
    const second=requestCoachingReview('job2',100,1000,'a'.repeat(64));
    await new Promise(done=>setTimeout(done,0));assert.equal(crossJobCalls,1,'the Pi observer also serializes different videos');
    releaseFirst();await first;assert.equal((await second).jobId,'job2');assert.equal(crossJobCalls,2);
  } finally {globalThis.fetch=originalFetch;}
  const originalSetTimeout=globalThis.setTimeout, originalClearTimeout=globalThis.clearTimeout;
  const timers=[];let networkCalls=0;
  globalThis.setTimeout=(fn,delay,...args)=>{if(delay!==60000)return originalSetTimeout(fn,delay,...args);const timer={fn};timers.push(timer);return timer;};
  globalThis.clearTimeout=timer=>{if(!timers.includes(timer))originalClearTimeout(timer);};
  globalThis.fetch=async(_url,options)=>{
    networkCalls++;
    if(networkCalls===1)return new Promise((_,reject)=>options.signal.addEventListener('abort',()=>reject(new Error('aborted'))));
    return {ok:true,status:200,text:async()=>JSON.stringify({...result,evidence:{...evidence,impactMs:1100}})};
  };
  try {
    const stalled=requestCoachingReview('job',100,1000,'a'.repeat(64));
    const selected=requestCoachingReview('job',100,1100,'a'.repeat(64),8);
    timers[0].fn();
    await assert.rejects(stalled,/시간이 초과/);
    assert.equal((await selected).evidence.impactMs,1100,'a timed-out request must not block a new selection');
    assert.equal(networkCalls,2);
  } finally {globalThis.fetch=originalFetch;globalThis.setTimeout=originalSetTimeout;globalThis.clearTimeout=originalClearTimeout;}
  const gatefile=join(dir,'readiness.mjs');
  await build({stdin:{contents:`export {CoachingReview} from './src/components/analysis/CoachingReview';export {begin,effects} from 'react';`,resolveDir:process.cwd(),loader:'tsx'},
    bundle:true,platform:'node',format:'esm',outfile:gatefile,define:{'import.meta.env':'{}'},logLevel:'silent',plugins:[{name:'coaching-readiness-harness',setup(b){
      b.onResolve({filter:/^react(?:\/jsx-runtime)?$/},args=>({path:args.path,namespace:'readiness'}));
      b.onResolve({filter:/\.\/CoachingLesson$/},()=>({path:'lesson',namespace:'readiness'}));
      b.onLoad({filter:/.*/,namespace:'readiness'},args=>({contents:args.path==='lesson'
        ? 'export const CoachingLesson=()=>null;'
        : args.path==='react/jsx-runtime' ? 'export const jsx=()=>null,jsxs=()=>null,Fragment="fragment";'
        : `let slots=[],cursor=0;export let effects=[];export function begin(){cursor=0;effects=[];}
           export function useState(initial){const i=cursor++;if(!(i in slots))slots[i]=initial;return [slots[i],v=>{slots[i]=typeof v==='function'?v(slots[i]):v;}];}
           export function useEffect(effect){effects.push(effect);}`}));
    }}]});
  const gate=await import(gatefile);const gateRequests=[];let finishGate;
  const gateResult=new Promise(resolve=>{finishGate=resolve;});
  globalThis.fetch=async(_url,options)=>{gateRequests.push(JSON.parse(await options.body.text()));return {ok:true,status:200,text:async()=>JSON.stringify(unavailable)};};
  try {
    const gateProps={jobId:'job',videoSha256:'a'.repeat(64),addressMs:200,impactMs:1000,candidatePending:false,analysisReady:false,playable:true,
      onResult:value=>{if(value)finishGate(value);},onEvidence(){},onSeek(){}};
    const runGate=props=>{gate.begin();gate.CoachingReview(props);for(const effect of gate.effects)effect();};
    runGate(gateProps);await new Promise(setImmediate);assert.equal(gateRequests.length,0,'do not request a provisional address');
    runGate({...gateProps,analysisReady:true,candidatePending:true});await new Promise(setImmediate);assert.equal(gateRequests.length,0,'wait for the impact candidate');
    runGate({...gateProps,analysisReady:true,addressMs:undefined});await new Promise(setImmediate);assert.equal(gateRequests.length,0,'do not invent an address');
    runGate({...gateProps,analysisReady:true,addressMs:100});await gateResult;
    assert.deepEqual(gateRequests.map(request=>request.addressMs),[100],'request once with the loaded address');
  } finally {globalThis.fetch=originalFetch;}
  console.log('coaching contract, identity, evidence scope, unavailable UI, replay controls and duplicate-request checks passed');
} finally { await rm(dir,{recursive:true,force:true}); }
