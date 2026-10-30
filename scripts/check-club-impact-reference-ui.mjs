import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = await mkdtemp(join(tmpdir(), 'club-impact-ui-'));
try {
  const outfile = join(dir, 'test.cjs');
  await build({ stdin: { contents: `import {ClubObservation} from './src/components/analysis/ClubObservation';
    import {createElement} from 'react'; import {renderToStaticMarkup} from 'react-dom/server';
    export const render=props=>renderToStaticMarkup(createElement(ClubObservation,props));`,
    resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, platform: 'node', format: 'cjs', outfile,
    define: { 'import.meta.env': '{}', 'process.env.NODE_ENV': '"production"' }, logLevel: 'silent' });
  const { render } = await import(outfile);
  const videoSha256 = 'a'.repeat(64), frameIndex = 3, timeMs = 100;
  const impact = { videoSha256, candidate: { frameIndex, timeMs } };
  const reference = { videoSha256, frameIndex, timeMs };
  const level = { heightFraction: .5, backswingMs: 20, downswingMs: 80, direction: 'steeper' };
  const sidecar = { status: 'succeeded', trackingQuality: { ambiguousClubHandleFrames: 0 },
    observations: { levels: [level], impactReference: reference } };
  const props = { jobId: 'job', sidecar, impactReview: impact, impactLoading: false,
    playable: true, onSeek() {}, onResult() {}, onRetryImpact() {} };
  assert.match(render(props), /내려올 때 더 세워져 보임/);
  const legacy = render({ ...props, sidecar: { ...sidecar, observations: { levels: [level] } } });
  assert.doesNotMatch(legacy, /내려올 때 더 세워져 보임/);
  assert.match(legacy, /임팩트 기준.*다시 계산/);
  const changed = render({ ...props, impactReview: { ...impact, candidate: { frameIndex: 2, timeMs: 67 } } });
  assert.doesNotMatch(changed, /내려올 때 더 세워져 보임/);
  assert.match(changed, /기준이 현재 후보와 달라/);
  const otherVideo = render({ ...props, impactReview: { ...impact, videoSha256: 'b'.repeat(64) } });
  assert.doesNotMatch(otherVideo, /내려올 때 더 세워져 보임/);
  const waiting = render({ ...props, impactReview: null, impactLoading: true });
  assert.doesNotMatch(waiting, /내려올 때 더 세워져 보임/);
  assert.match(waiting, /임팩트 후보를 확인하는 중/);
  const failed = render({ ...props, impactReview: null });
  assert.doesNotMatch(failed, /내려올 때 더 세워져 보임/);
  assert.match(failed, /임팩트 후보 다시 확인/);
  assert.match(render({ ...props, manualImpactDifferent: true }), /직접 선택한.*몸 관찰/);
  console.log('club comparisons require the matching video and impact frame');
} finally { await rm(dir, { recursive: true, force: true }); }
