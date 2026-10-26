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
  console.log('upload navigation with blocked history and upload status UI checks passed');
} finally {await rm(dir, {recursive: true, force: true});}
