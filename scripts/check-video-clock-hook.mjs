import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import * as esbuild from 'esbuild';

const source=await readFile('src/hooks/useVideoClock.ts','utf8');
const compiled=await esbuild.transform(source,{loader:'ts',format:'cjs'});
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function harness(job,enabled) {
  const states=[],effects=[],timers=[];let index=0,resolveRequest,rejectRequest,signal;
  const react={useState(initial){const slot=index++;states[slot]=[initial];return [initial,value=>states[slot].push(value)];},useEffect(fn){effects.push(fn);}};
  const api={requestVideoClock(_job,s){signal=s;return new Promise((resolve,reject)=>{resolveRequest=resolve;rejectRequest=reject;s.addEventListener('abort',()=>reject(new Error('aborted')));});}};
  const module={exports:{}};
  vm.runInNewContext(compiled.code,{module,exports:module.exports,require:name=>name==='react'?react:api,
    AbortController,setTimeout:fn=>{timers.push(fn);return timers.length;},clearTimeout:()=>{}});
  module.exports.useVideoClock(job,enabled);
  return {states,effect:effects[0],timers,get signal(){return signal;},get resolve(){return resolveRequest;},get reject(){return rejectRequest;}};
}
const disabled=harness('job',false);disabled.effect();assert.equal(disabled.signal,undefined,'do not request a clock while the model candidate is available');
const switched=harness('old',true),cleanup=switched.effect();assert.equal(switched.states[0].at(-1).loading,true);
cleanup();assert.equal(switched.signal.aborted,true,'leaving the video cancels the request');
switched.resolve({jobId:'old'});await flush();assert.equal(switched.states[0].length,2,'a stale response must not update a new video');
const timed=harness('job',true);timed.effect();timed.timers[0]();await flush();
assert.equal(timed.signal.aborted,true);assert.match(timed.states[0].at(-1).error,/시간이 초과/);
const ok=harness('job',true);ok.effect();ok.resolve({jobId:'job'});await flush();
assert.equal(ok.states[0].at(-1).clock.jobId,'job');
console.log('manual video clock hook: disabled, video switch, timeout and completion checks passed');
