import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Exercise the actual upload callback with a history request that never finishes.
const app = await readFile('src/App.tsx', 'utf8');
const body = app.match(/onUpload=\{async \(file\) => \{([\s\S]*?)\n          \}\}/)?.[1];
assert.ok(body, 'upload callback must be covered');
const events = [];
const shot = {id: 'uploaded', jobId: 'job', status: 'queued'};
const AsyncFunction = Object.getPrototypeOf(async function() {}).constructor;
const run = new AsyncFunction('file', 'upload', 'settings', 'selectShot', 'setSelectedSession', 'setActiveTab', 'refreshShots', body);
await Promise.race([
  run({}, {start: async () => shot}, {},
    value => {assert.equal(value, shot); events.push('selected');},
    value => assert.equal(value, null),
    value => {assert.equal(value, 'analysis'); events.push('analysis');},
    options => {assert.deepEqual(options, {silent: true}); events.push('history'); return new Promise(() => {});}),
  new Promise((_, reject) => {const timer = setTimeout(() => reject(new Error('navigation waited for history')), 1000); timer.unref();}),
]);
assert.deepEqual(events, ['selected', 'analysis', 'history']);
assert.match(app, /const upload = useUpload\(\);/, 'do not request history twice');
const storedBody = app.match(/const startStoredAnalysis = \(shot: Shot, force = false\) => \{([\s\S]*?)\n  \};/)?.[1];
assert.ok(storedBody);
const startStored = new Function('shot', 'force', 'settings', 'createAnalysisJobFromFile', 'createAnalysisJobForStoredUpload', storedBody);
const calls = [];
const camera = (filename, options) => { calls.push(['camera', filename, options]); return 'camera-job'; };
const stored = (filename, options) => { calls.push(['upload', filename, options]); return 'upload-job'; };
const options = {club:'iron', viewpoint:'down_the_line', handedness:'right'};
assert.equal(startStored({filename:'camera.mp4',sourceType:'camera',jobId:'camera-job-id',metaPath:'/meta'}, false, options, camera, stored), 'camera-job');
assert.equal(startStored({filename:'upload.mov',sourceType:'upload'}, true, options, camera, stored), 'upload-job');
assert.equal(calls[0][2].metaPath, '/meta'); assert.equal(calls[0][2].jobId, 'camera-job-id'); assert.equal(calls[1][2].force, true);
const retryBody = app.match(/const handleAnalyzeShot = async \(shot: Shot\) => \{([\s\S]*?)\n  \};/)?.[1];
assert.ok(retryBody);
const retry = new AsyncFunction('shot', 'setAnalyzingId', 'setAnalyzeError', 'startStoredAnalysis', 'selectShot', 'setSelectedSession', 'setActiveTab', 'refreshShots', retryBody);
const oldShot = {id:'old',jobId:'old-job',status:'failed',analysis:{status:'failed'},errorMessage:'old error'};
const retryEvents=[];
await retry(oldShot, () => {}, () => {}, async () => ({jobId:'new-job',status:'queued'}),
  selected => {assert.equal(selected.jobId,'new-job');assert.equal(selected.analysis,null);assert.equal(selected.errorMessage,null);retryEvents.push('selected');},
  () => {}, tab => {assert.equal(tab,'analysis');retryEvents.push('analysis');}, () => {retryEvents.push('history');return new Promise(() => {});});
assert.deepEqual(retryEvents,['selected','analysis','history']);
let retryError='';
await retry(oldShot, () => {}, value => {if (value) retryError=value;}, async () => {throw new Error('server unavailable');},
  () => assert.fail('failed retry must not select a new job'), () => {}, () => assert.fail('failed retry must not navigate'), () => assert.fail('failed retry must not refresh'));
assert.equal(retryError,'server unavailable');
const dir = await mkdtemp(join(tmpdir(), 'upload-check-'));
try {
  const outfile = join(dir, 'ui.cjs');
  await build({stdin: {contents: `import {renderToStaticMarkup} from 'react-dom/server'; import {createElement} from 'react'; import {UploadCard} from './src/components/upload/UploadCard.tsx'; export const render=props=>renderToStaticMarkup(createElement(UploadCard,props));`, resolveDir: process.cwd(), loader: 'tsx'}, bundle: true, platform: 'node', format: 'cjs', outfile, define: {'process.env.NODE_ENV': '"production"'}, logLevel: 'silent'});
  const {render} = await import(outfile);
  const base = {message: '', activeFilename: 'swing.mov', onUpload: () => {}};
  const idle = render({...base, status: 'idle'});
  assert.doesNotMatch(idle, /업로드 대기|선택한 파일이 여기에|메시지가 여기에/);
  assert.equal((idle.match(/<button/g) || []).length, 1, 'one upload action');
  assert.match(render({...base, status: 'uploading'}), /업로드 중/);
  const success = render({...base, status: 'succeeded'});
  assert.match(success, /업로드 완료/);
  assert.doesNotMatch(success, /업로드 대기/);
  assert.match(success, /영상 선택 및 업로드/);
  const failed = render({...base, status: 'failed', message: '업로드 실패: 서버 연결 실패'});
  assert.match(failed, /role="alert"/);
  assert.match(failed, /업로드 실패: 서버 연결 실패/);
  assert.match(failed, /다시 선택해 업로드/);
  const needsCheck = render({...base, status: 'failed', needsRecordCheck: true, onReviewRecords: () => {}, message: '영상은 이미 저장됐을 수 있습니다.'});
  assert.match(needsCheck, /role="alert"/);
  assert.match(needsCheck, /기록 확인 필요/);
  assert.match(needsCheck, /영상은 이미 저장됐을 수 있습니다/);
  assert.match(needsCheck, /기록 확인하기/);
  assert.doesNotMatch(needsCheck, /다시 선택해 업로드/);

  const hookFile = join(dir, 'upload-hook.mjs');
  await build({stdin:{contents:`export {useUpload} from './src/hooks/useUpload'; export {begin,reset} from 'react';`,resolveDir:process.cwd(),loader:'tsx'},
    bundle:true,platform:'node',format:'esm',outfile:hookFile,define:{'import.meta.env':'{}'},plugins:[{name:'hook-harness',setup(b){
      b.onResolve({filter:/^react$/},()=>({path:'react',namespace:'harness'}));
      b.onLoad({filter:/.*/,namespace:'harness'},()=>({contents:`let slots=[],cursor=0; export const begin=()=>{cursor=0;}; export const reset=()=>{slots=[];cursor=0;}; export const useState=initial=>{const i=cursor++;if(!(i in slots))slots[i]=initial;return [slots[i],v=>{slots[i]=typeof v==='function'?v(slots[i]):v;}];};`}));
    }}],logLevel:'silent'});
  const {useUpload,begin,reset}=await import(hookFile);
  const video = new File(['video'], 'swing.mp4', {type:'video/mp4'});
  const requests=[];
  const exercise = async response => {
    requests.length=0; globalThis.fetch=async url=>{requests.push(String(url));return response(url);};
    reset(); begin(); const hook=useUpload(); await hook.start(video); begin(); return useUpload();
  };
  let hook=await exercise(()=>{throw new TypeError('connection lost');});
  assert.equal(hook.needsRecordCheck,true); assert.match(hook.message,/완료됐는지 확인할 수 없습니다/); assert.equal(requests.length,1);
  hook=await exercise(()=>({ok:false,status:503,statusText:'Unavailable',text:async()=>'{"message":"unavailable"}'}));
  assert.equal(hook.needsRecordCheck,true); assert.equal(requests.length,1);
  hook=await exercise(()=>({ok:true,status:200,text:async()=>'<html>unexpected</html>'}));
  assert.equal(hook.needsRecordCheck,true); assert.equal(requests.length,1,'HTML response must not cause a second upload');
  hook=await exercise(()=>({ok:false,status:400,statusText:'Bad Request',text:async()=>'{"message":"invalid"}'}));
  assert.equal(hook.needsRecordCheck,false); assert.match(hook.message,/업로드 실패/);
  hook=await exercise(url=>String(url).endsWith('/api/analyze')
    ? {ok:false,status:404,statusText:'Not Found',text:async()=>'{"message":"missing route"}'}
    : {ok:true,status:200,text:async()=>'{"ok":true,"jobId":"job","filename":"swing.mp4","status":"queued"}'});
  assert.equal(hook.status,'succeeded'); assert.equal(requests.length,2,'a missing route still permits the legacy fallback');
  console.log('upload navigation with blocked history and upload status UI checks passed');
} finally {await rm(dir, {recursive: true, force: true});}
