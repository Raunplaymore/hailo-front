import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import vm from 'node:vm';import {transform} from 'esbuild';
const source=await readFile('src/components/debug/InferDebugPage.tsx','utf8');const start=source.indexOf('  useEffect(() => {\n    if (!archiveWatch) return;');const end=source.indexOf('  }, [archiveWatch]);',start);assert.ok(start>=0&&end>start);
const {code}=await transform(source.slice(start,end)+'  }, [archiveWatch]);',{loader:'ts'});
async function check(sequence){let notice='',timer,clean;const context={archiveWatch:{jobId:'job1',updatedAt:'v1'},fetchSwingTrackingAnnotation:async()=>{const v=sequence.shift();if(v instanceof Error)throw v;return v;},setArchiveNotice:v=>notice=v,window:{setTimeout:fn=>{timer=fn;return 1},clearTimeout:()=>{timer=null}},useEffect:fn=>{clean=fn()}};vm.runInNewContext(code,context);await new Promise(setImmediate);return{notice,run:async()=>{const fn=timer;assert.ok(fn);timer=null;fn();await new Promise(setImmediate);return notice},cleanup:()=>clean?.()};}
const value=state=>({annotation:{updatedAt:'v1'},archive:{state}});
let p=await check([value('pending'),value('failed')]);assert.match(p.notice,/확인/);assert.match(await p.run(),/실패/);p.cleanup();
p=await check([value('stored')]);assert.match(p.notice,/별도 검증/);p.cleanup();
p=await check([value('disabled')]);assert.match(p.notice,/설정되지/);p.cleanup();
p=await check([{annotation:{updatedAt:'v2'},archive:{state:'stored'}}]);assert.match(p.notice,/변경/);p.cleanup();
p=await check([new Error('offline'),value('retrying')]);assert.match(p.notice,/확인하지 못/);assert.match(await p.run(),/다시 시도/);p.cleanup();
console.log('tracking archive status: pending, failure, stale revision and offline checks passed');
