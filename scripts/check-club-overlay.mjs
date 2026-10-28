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

// Render the real selector to catch missing levels and accidental repeated cards.
const clubSource = fs.readFileSync('src/components/analysis/ClubObservation.tsx', 'utf8').replace(/^import .*\n/gm, '').replace('export function', 'function');
const clubCode = await esbuild.transform(clubSource, {loader:'tsx', jsx:'transform'});
const clubContext = vm.createContext({React, useState:React.useState, useEffect:React.useEffect, useRef:React.useRef});
vm.runInContext(clubCode.code, clubContext);
const props = {jobId:'fixture', onSeek(){}, onResult(){}, sidecar:{observations:{levels:[.2,.35,.5,.65,.8].map(heightFraction=>({heightFraction, direction:'steeper', backswingMs:1000, downswingMs:1700}))}}};
const clubHtml = renderToStaticMarkup(React.createElement(clubContext.ClubObservation,props));
assert.equal((clubHtml.match(/>백스윙/g)||[]).length,1,'only one phase pair should be displayed');
assert.equal((clubHtml.match(/aria-pressed="true"/g)||[]).length,1,'default height selected');
assert.match(clubHtml,/50%/); assert.match(clubHtml,/관측의 한계/);
assert.match(clubHtml,/두 장면에서 노란 선이 실제 클럽과 맞는지 먼저 확인하세요/);
assert.match(clubHtml,/클럽 관측 다시 계산/);
const emptyHtml = renderToStaticMarkup(React.createElement(clubContext.ClubObservation,{...props,sidecar:{status:'succeeded',observations:{levels:[]}}}));
assert.match(emptyHtml,/클럽 관측 다시 계산/);
assert.doesNotMatch(source,/scrollIntoView/,'changing scenes must not move the document');
console.log('compact height selector and stationary scene navigation passed');
