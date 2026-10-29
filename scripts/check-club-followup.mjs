import assert from 'node:assert/strict';
import {readFile, mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {pathToFileURL} from 'node:url';
import * as esbuild from 'esbuild';

const dir = await mkdtemp(path.join(tmpdir(), 'club-followup-'));
const originalFetch = globalThis.fetch, originalTimeout = globalThis.setTimeout;
try {
  const outfile = path.join(dir, 'shots.mjs');
  await esbuild.build({entryPoints:['src/api/shots.ts'], bundle:true, platform:'node', format:'esm', outfile,
    define:{'import.meta.env.VITE_BACK_BASE_URL':'""','import.meta.env.VITE_API_BASE':'""',
      'import.meta.env.VITE_BACK_BASE_URL_LOCAL':'""','import.meta.env.VITE_API_BASE_LOCAL':'""'}, logLevel:'silent'});
  const {waitForExistingClubReview} = await import(pathToFileURL(outfile).href);
  globalThis.setTimeout = (fn, _ms, ...args) => originalTimeout(fn, 0, ...args);
  const calls = [], replies = [null, {status:'running'}, {status:'succeeded', observations:{revision:1,automaticCoachingReady:false,levels:[]}}];
  globalThis.fetch = async (url, options) => {
    calls.push({url,method:options?.method ?? 'GET'});
    return new Response(JSON.stringify({ok:true,jobId:'job',sidecar:replies.shift()}), {status:200});
  };
  const result = await waitForExistingClubReview('job', new AbortController().signal, true);
  assert.equal(result?.status, 'succeeded');
  assert.equal(calls.length, 3);
  assert.ok(calls.every(call => call.method === 'GET' && call.url === '/api/analyze/job/club-review'));
  let legacyCalls = 0;
  globalThis.fetch = async () => {legacyCalls++;return new Response(JSON.stringify({ok:true,jobId:'job',sidecar:null}), {status:200});};
  assert.equal(await waitForExistingClubReview('job', new AbortController().signal), null);
  assert.equal(legacyCalls, 1, 'a record without a scheduled sidecar gets only one read');
  globalThis.fetch = async () => new Response(JSON.stringify({ok:true,jobId:'other',sidecar:{status:'succeeded'}}), {status:200});
  await assert.rejects(waitForExistingClubReview('job', new AbortController().signal), /다른 영상/);
  globalThis.fetch = async () => new Response('null', {status:200});
  await assert.rejects(waitForExistingClubReview('job', new AbortController().signal), /다른 영상/);
  globalThis.fetch = async () => new Response(JSON.stringify({ok:true,jobId:'job',sidecar:[]}), {status:200});
  await assert.rejects(waitForExistingClubReview('job', new AbortController().signal), /관측 작업 상태/);
  globalThis.fetch = async () => new Response(JSON.stringify({ok:true,jobId:'job',sidecar:{}}), {status:200});
  await assert.rejects(waitForExistingClubReview('job', new AbortController().signal), /관측 작업 상태/);
  const controller = new AbortController(); let cancelledCalls = 0;
  globalThis.fetch = async () => {cancelledCalls++;controller.abort();return new Response(JSON.stringify({ok:true,jobId:'job',sidecar:{status:'succeeded'}}), {status:200});};
  assert.equal(await waitForExistingClubReview('job', controller.signal), null);
  assert.equal(cancelledCalls, 1);
  let failures = 0;
  globalThis.fetch = async () => ++failures < 3 ? new Response('{}', {status:503}) : new Response(JSON.stringify({ok:true,jobId:'job',sidecar:{status:'failed'}}), {status:200});
  assert.equal((await waitForExistingClubReview('job', new AbortController().signal))?.status, 'failed');
  assert.equal(failures, 3);
  failures = 0;
  globalThis.fetch = async () => {failures++;return new Response('{}', {status:503});};
  await assert.rejects(waitForExistingClubReview('job', new AbortController().signal));
  assert.equal(failures, 3, 'persistent network errors must stop the follow-up');
  let empty = 0;
  globalThis.fetch = async () => {empty++;return new Response(JSON.stringify({ok:true,jobId:'job',sidecar:null}), {status:200});};
  assert.equal(await waitForExistingClubReview('job', new AbortController().signal, true), null);
  assert.equal(empty,90, 'waiting for an unscheduled sidecar must be bounded');

  const source = await readFile('src/hooks/useAnalysis.ts', 'utf8');
  const compiled = await esbuild.transform(source, {loader:'ts',format:'cjs'});
  const flush = () => new Promise(resolve => setImmediate(resolve));
  const createHarness = async (selected, result) => {
    const values = [], effects = []; let cursor = 0, waitCalls = 0, latestCalls = 0, waitForStart, finish;
    const pending = new Promise(resolve => {finish = resolve;});
    const react = {
      useState(initial) {const index=cursor++;values[index]=initial;return [initial, value=>{values[index]=typeof value==='function'?value(values[index]):value;}];},
      useEffect(effect) {effects.push(effect);},
    };
    const api = {
      fetchAnalysisStatus: async () => ({status:'succeeded',analysis:result}),
      fetchAnalysisResult: async () => {latestCalls++;return {...result,summary:'updated primary'};},
      waitForExistingClubReview: async (_job, _signal, start) => {waitCalls++;waitForStart=start;return pending;},
    };
    const module = {exports:{}};
    vm.runInNewContext(compiled.code, {module,exports:module.exports,require:name=>name==='react'?react:api,
      AbortController,console,window:{setTimeout,clearTimeout}});
    module.exports.useAnalysis(selected);
    const cleanup=effects[0]();
    await flush();
    return {values,finish,cleanup,get waitCalls(){return waitCalls;},get waitForStart(){return waitForStart;},get latestCalls(){return latestCalls;}};
  };
  const base = {jobId:'job',status:'succeeded',analysisVersion:'hailo-coach-v16',dtlClubPointsV2:null};
  const fresh = await createHarness({id:'job',jobId:'job',status:'queued'},base);
  assert.equal(fresh.waitCalls,1,'new uploads must follow the already scheduled club result');
  assert.equal(fresh.waitForStart,true);
  fresh.finish({status:'succeeded'});await flush();await flush();
  assert.equal(fresh.values[0].dtlClubPointsV2.status,'succeeded');
  assert.equal(fresh.values[0].summary,'updated primary');
  fresh.cleanup();
  const cancelled = await createHarness({id:'job',jobId:'job',status:'queued'},base);
  cancelled.cleanup();cancelled.finish({status:'succeeded'});await flush();
  assert.equal(cancelled.latestCalls,0,'switching videos must stop the old update');
  assert.equal(cancelled.values[0].dtlClubPointsV2,null);
  const old = await createHarness({id:'job',jobId:'job',status:'succeeded'},base);
  assert.equal(old.waitCalls,1);assert.equal(old.waitForStart,false,'do not poll indefinitely for legacy records without a scheduled sidecar');
  old.cleanup();old.finish(null);
  const running = await createHarness({id:'job',jobId:'job',status:'succeeded'},{...base,dtlClubPointsV2:{status:'running'}});
  assert.equal(running.waitCalls,1);running.cleanup();running.finish(null);
  const completed = await createHarness({id:'job',jobId:'job',status:'queued'},{...base,dtlClubPointsV2:{status:'succeeded'}});
  assert.equal(completed.waitCalls,0);completed.cleanup();
  console.log('club follow-up reads existing results only, validates identity and stops on video switch');
} finally {
  globalThis.fetch=originalFetch;globalThis.setTimeout=originalTimeout;
  await rm(dir,{recursive:true,force:true});
}
