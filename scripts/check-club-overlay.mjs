import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as esbuild from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
const source = fs.readFileSync('src/components/analysis/AnalysisPlayer.tsx', 'utf8');
const start = source.indexOf('function OverlaySvg('), end = source.indexOf('\nfunction jointColor', start);
const { code } = await esbuild.transform(source.slice(start, end), { loader: 'tsx', jsx: 'transform' });
const context = vm.createContext({ React, CLUB_TRAIL_MIN_CONFIDENCE: .3,
  smoothClubTrailPaths: () => [], handTrailSegments: () => [], SKELETON_LINKS: [], EVENT_LABELS: {} });
vm.runInContext(code, context);
const point = { x: .2, y: .4, confidence: .8 };
const render = (frame, timeMs = 100) => renderToStaticMarkup(React.createElement(context.OverlaySvg, {
  clubFrames: [frame], poseFrames: [], timeMs, layers: { club: true },
}));
const frame = { timeMs: 100, head: point, handle: { ...point, x: .5 } };
assert.match(render(frame), /<line /);
assert.doesNotMatch(render(frame, 151), /<line /, 'stale shaft must disappear');
assert.doesNotMatch(render({ ...frame, handle: undefined }), /<line /);
assert.doesNotMatch(render({ ...frame, handle: { ...point, confidence: .1 } }), /<line /);
assert.doesNotMatch(render({ ...frame, head: { ...point, x: NaN } }), /<line /);
const choose = source.slice(source.indexOf('  const clubOverlay ='), source.indexOf('  const visibleClub ='));
vm.runInContext(`function choose(overlay, clubSidecar) { ${choose} return clubOverlay; }`, context);
const primary = { clubFrames: [] }, side = { clubFrames: [frame], clubTimeSource: 'video_pts' };
assert.equal(context.choose(primary, { status: 'succeeded', overlay: side }), side);
assert.equal(context.choose(primary, { status: 'failed', overlay: side }), primary);
assert.equal(context.choose(primary, { status: 'succeeded', overlay: { clubFrames: [frame] } }), primary);
console.log('club overlay selection and rendered shaft guards passed');
