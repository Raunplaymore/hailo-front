import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = await mkdtemp(join(tmpdir(), 'club-edge-ui-'));
try {
  const outfile = join(dir, 'test.cjs');
  await build({ stdin: { contents: `import {ClubObservation} from './src/components/analysis/ClubObservation';
    import {createElement} from 'react'; import {renderToStaticMarkup} from 'react-dom/server';
    export const render=props=>renderToStaticMarkup(createElement(ClubObservation,props));`,
    resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, platform: 'node', format: 'cjs', outfile,
    define: { 'import.meta.env': '{}', 'process.env.NODE_ENV': '"production"' }, logLevel: 'silent' });
  const { render } = await import(outfile);
  const level = { heightFraction:.5, backswingMs:600, downswingMs:1000, direction:'pair_uncertain' };
  const impactReference = {videoSha256:'a'.repeat(64),frameIndex:3,timeMs:1200};
  const props = {jobId:'job',playable:true,impactReview:{videoSha256:impactReference.videoSha256,candidate:{frameIndex:3,timeMs:1200}},onSeek(){},onResult(){},sidecar:{status:'succeeded',trackingQuality:{ambiguousClubHeadFrames:0,ambiguousClubHandleFrames:0},observations:{impactReference,levels:[level]}}};
  const legacy = render({...props,sidecar:{...props.sidecar,observations:{impactReference,levels:[{...level,frameEdgeReason:'unverified'}]}}});
  assert.match(legacy,/이전 결과라 클럽이 화면 가장자리에 걸쳤는지 확인하지 못했어요/);
  assert.match(legacy,/클럽 관측 다시 계산/);
  assert.match(legacy,/차이 방향 불확실/);
  const edge = render({...props,sidecar:{...props.sidecar,observations:{impactReference,levels:[{...level,frameEdgeReason:'possible'}]}}});
  assert.match(edge,/화면 가장자리에 걸쳤을 수 있어 방향 비교를 보류/);
  assert.match(edge,/백스윙/); assert.match(edge,/다운스윙/);
  console.log('club edge comparison UI checks passed');
} finally { await rm(dir, {recursive:true,force:true}); }
