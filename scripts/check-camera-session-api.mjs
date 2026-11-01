import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = await mkdtemp(join(tmpdir(), 'camera-session-api-'));
try {
  const outfile = join(dir, 'session.mjs');
  await build({entryPoints:['src/api/sessionApi.ts'], bundle:true, platform:'node', format:'esm', outfile, define:{'import.meta.env':'{}'}, logLevel:'silent'});
  const { listSessionFiles, deleteSession } = await import(outfile);
  const requests = [];
  globalThis.fetch = async (url) => { requests.push(String(url)); return {ok:false,status:503,text:async()=>JSON.stringify({error:'camera unavailable'})}; };
  await assert.rejects(listSessionFiles('http://camera.test'));
  assert.equal(requests.length, 1, 'camera failure must not substitute the upload list');
  await assert.rejects(deleteSession('http://camera.test', undefined, 'test.mp4'), /촬영 ID/);
  assert.equal(requests.length, 1, 'a missing session ID must not delete an unrelated upload');
  console.log('camera session failure and missing ID checks passed');
} finally { await rm(dir, {recursive:true, force:true}); }
