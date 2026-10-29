import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp, rm, readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const dir = await mkdtemp(join(tmpdir(), 'list-performance-'));
try {
  const outfile = join(dir, 'hooks.mjs');
  await build({stdin: {contents: `export {useShots} from './src/hooks/useShots'; export {useAnalysis} from './src/hooks/useAnalysis'; export {begin,effects,reset} from 'react';`, resolveDir: process.cwd(), loader: 'tsx'}, bundle: true, platform: 'node', format: 'esm', outfile, define: {'import.meta.env': '{}'}, plugins: [{name: 'hook-harness', setup(b) {
    b.onResolve({filter: /^react$/}, () => ({path: 'react', namespace: 'harness'}));
    b.onLoad({filter: /.*/, namespace: 'harness'}, () => ({contents: `let slots=[],cursor=0; export const effects=[]; export const begin=()=>{cursor=0;effects.length=0;}; export const reset=()=>{slots=[];begin();}; export const useState=initial=>{const i=cursor++;if(!(i in slots))slots[i]=initial;return [slots[i],v=>{slots[i]=typeof v==='function'?v(slots[i]):v;}];}; export const useRef=initial=>{const i=cursor++;return slots[i]??=( {current:initial} );}; export const useCallback=f=>f; export const useEffect=f=>effects.push(f);`}));
  }}], logLevel: 'silent'});
  const {useShots, useAnalysis, begin, effects, reset} = await import(outfile);
  const requests = [];
  let release;
  globalThis.fetch = async url => {requests.push(String(url)); await new Promise(resolve => {release = resolve;}); return {ok: true, status: 200, text: async () => JSON.stringify({ok:true, files:[{filename:'done.mov',jobId:'done',status:'succeeded'},{filename:'active.mov',jobId:'active',status:'running'}]})};};
  begin(); let hook = useShots();
  const first = hook.refresh(); await hook.refresh();
  assert.equal(requests.length,1,'overlapping list requests must be skipped');
  release(); await first;
  assert.equal(requests.length, 2, 'an explicit refresh during a request must be coalesced, not lost');
  release(); await new Promise(setImmediate);
  begin(); hook=useShots();
  assert.equal(hook.shots.length,2); assert.equal(hook.shots[0].analysis,null);
  const update=hook.refresh({silent:true,activeOnly:true});
  assert.match(requests[2],/summary=true/); assert.match(requests[2],/jobIds=active/);
  release(); await update;
  begin(); hook=useShots(); assert.equal(hook.shots.length,2,'active refresh must keep completed history');
  requests.length=0;
  globalThis.fetch=async url=>{requests.push(String(url));return {ok:false,status:503,text:async()=>JSON.stringify({message:'connection failed'})};};
  await hook.refresh(); begin(); hook=useShots();
  assert.equal(hook.shots.length,2,'failed refresh must preserve existing history');
  assert.match(hook.error,/영상 목록을 불러오지 못했습니다/);
  assert.equal(requests.length,1,'503 must not trigger extra legacy requests');
  requests.length=0;
  globalThis.fetch=async url=>{requests.push(String(url));return String(url).includes('/detail') ? {ok:false,status:404,text:async()=>JSON.stringify({message:'missing route'})} : {ok:true,status:200,text:async()=>JSON.stringify([{filename:'legacy.mov'}])};};
  await hook.refresh({silent:true}); begin(); hook=useShots();
  assert.equal(hook.shots[0].filename,'legacy.mov','404 retains the legacy API fallback');
  assert.equal(hook.error,null,'successful retry clears the stale error');
  assert.equal(requests.length,2);
  // Completed status contains the result: no second result request is needed.
  requests.length=0;
  globalThis.fetch=async url=>{requests.push(String(url));return {ok:true,status:200,text:async()=>JSON.stringify(String(url).endsWith('/club-review')
    ? {ok:true,jobId:'done',sidecar:null}
    : {jobId:'done',status:'done',analysis:{jobId:'done',status:'succeeded',analysisVersion:'hailo-coach-service7-v16',events:{impact:{timeMs:2905}},metrics:{tempo:{}}}})};};
  reset(); useAnalysis({id:'done',jobId:'done',filename:'done.mov',status:'succeeded',analysis:null});
  const cleanups=effects.map(effect=>effect());
  await new Promise(setImmediate);
  assert.deepEqual(requests,['/api/analyze/done','/api/analyze/done/club-review'], 'one primary result and one read-only check for an existing sidecar');
  cleanups.forEach(cleanup=>cleanup?.());
  const app=await readFile('src/App.tsx','utf8');
  assert.match(app,/activeOnly: true/);
  assert.doesNotMatch(app,/return status === "succeeded" && Boolean\(shot.analysis\)/);
  console.log('summary list, one in-flight request, active-only merge, single result fetch and bounded sidecar check passed');
} finally {await rm(dir,{recursive:true,force:true});}
