import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { transform } from 'esbuild';

const source = await readFile('src/components/debug/InferDebugPage.tsx', 'utf8');
const start = source.indexOf('  const updateDirty =');
const end = source.indexOf('  const handleRunLab =');
assert.ok(start >= 0 && end > start);
const { code } = await transform(`${source.slice(start, end)}\nglobalThis.ops = { mutateAnnotation, loadVariant, handleSave };`, { loader: 'ts' });
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const label = { jobId: 'one', schemaVersion: 'swing-tracking-label-v2', updatedAt: 'v1', notes: 'before',
  events: { address: null, takeaway: null, top: null, impact: null, finish: null }, frames: [] };
const frames = { jobId: 'one', frames: [{ frame: 0, timeMs: 0 }] };

function setup() {
  const context = {
    annotation: structuredClone(label), data: structuredClone(frames), jobId: 'one', variant: 'main', isLoading: false,
    loadedJobMismatch: false, dirty: true, error: null, notice: null,
    editRevisionRef: { current: 1 }, dirtyRef: { current: true }, savingRef: { current: false },
    loadRequestRef: { current: 0 }, loadAbortRef: { current: null },
    AbortController, DOMException, Error, URL,
    window: { confirm: () => true, setInterval: () => 1, clearInterval: () => {}, location: { href: 'http://localhost/' }, history: { replaceState: () => {} } },
    fetchInferDebugFramesProgress: async () => ({ status: 'idle' }),
    fetchInferDebugFrames: async () => structuredClone(frames),
    fetchInferDebugAnalysis: async () => null,
    fetchSwingTrackingAnnotation: async () => ({ annotation: structuredClone(label) }),
    fetchSwingTrackingAnnotations: async () => ({ annotations: [] }),
    generateInferDebugMeta: async () => ({}),
    createDraftAnnotation: () => structuredClone(label),
  };
  for (const name of ['dirty', 'notice', 'error', 'data', 'analysis', 'variant', 'jobId', 'isLoading', 'isSaving', 'isGeneratingDebug', 'isPlaying', 'frameProgress', 'labReport', 'selectedIndex', 'annotationCatalog']) {
    const setter = `set${name[0].toUpperCase()}${name.slice(1)}`;
    context[setter] = value => { context[name] = typeof value === 'function' ? value(context[name]) : value; };
  }
  context.setAnnotation = value => { context.annotation = typeof value === 'function' ? value(context.annotation) : value; };
  vm.runInNewContext(code, context);
  return context;
}

const saving = setup();
const saveGate = deferred();
let submitted;
saving.saveSwingTrackingAnnotation = (_jobId, value) => { submitted = structuredClone(value); return saveGate.promise; };
const firstSave = saving.ops.handleSave();
saving.ops.mutateAnnotation(current => ({ ...current, notes: 'edited while saving' }));
saveGate.resolve({ annotation: { ...submitted, updatedAt: 'v2' } });
await firstSave;
assert.equal(saving.annotation.notes, 'edited while saving');
assert.equal(saving.annotation.updatedAt, 'v2');
assert.equal(saving.dirty, true);
assert.match(saving.notice, /아직 저장되지 않았습니다/);
saving.saveSwingTrackingAnnotation = async (_jobId, value) => {
  assert.equal(value.updatedAt, 'v2', 'the next save must use the returned version');
  return { annotation: { ...value, updatedAt: 'v3' } };
};
await saving.ops.handleSave();
assert.equal(saving.annotation.notes, 'edited while saving');
assert.equal(saving.dirty, false);

const conflict = setup();
conflict.saveSwingTrackingAnnotation = async () => { throw new Error('다른 화면에서 라벨이 변경되어 저장하지 못했습니다.'); };
await conflict.ops.handleSave();
assert.equal(conflict.annotation.notes, 'before');
assert.equal(conflict.dirty, true);
assert.match(conflict.error, /다른 화면/);

const cancel = setup();
cancel.jobId = 'other'; cancel.window.confirm = () => false;
await cancel.ops.loadVariant('main');
assert.equal(cancel.jobId, 'one');
assert.equal(cancel.annotation.notes, 'before');
assert.equal(cancel.dirty, true);

for (const fail of [false, true]) {
  const loading = setup();
  loading.dirtyRef.current = false; loading.dirty = false; loading.jobId = 'other';
  const frameGate = deferred();
  loading.fetchInferDebugFrames = () => frameGate.promise;
  const request = loading.ops.loadVariant('main');
  loading.ops.mutateAnnotation(current => ({ ...current, notes: 'edited while loading' }));
  if (fail) frameGate.reject(new Error('synthetic failure')); else frameGate.resolve(structuredClone(frames));
  await request;
  assert.equal(loading.annotation.notes, 'edited while loading');
  assert.equal(loading.jobId, 'one');
  assert.equal(loading.dirty, true);
  assert.match(loading.error, /불러오는 동안 수정한 라벨을 유지/);
}

const switched = setup();
const switchedGate = deferred();
switched.saveSwingTrackingAnnotation = () => switchedGate.promise;
const oldSave = switched.ops.handleSave();
switched.loadRequestRef.current += 1;
switched.annotation = { ...structuredClone(label), jobId: 'two', notes: 'different job' };
switchedGate.resolve({ annotation: { ...structuredClone(label), updatedAt: 'v2' } });
await oldSave;
assert.equal(switched.annotation.jobId, 'two');
assert.equal(switched.annotation.notes, 'different job');
console.log('tracking label save, load and conflict checks passed');
