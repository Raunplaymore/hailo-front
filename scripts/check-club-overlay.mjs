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
  clubTrailSegments: () => [], handTrailSegments: () => [], SKELETON_LINKS: [], EVENT_LABELS: {} });
vm.runInContext(code, context);
const point = { x: .2, y: .4, confidence: .8 };
const render = (frame, timeMs = 100) => renderToStaticMarkup(React.createElement(context.OverlaySvg, {
  clubFrames: [frame], poseFrames: [], timeMs, layers: { club: true },
}));
const frame = { timeMs: 100, head: point, handle: { ...point, x: .5 } };
assert.match(render(frame), /<line /);
assert.doesNotMatch(render(frame, 151), /<line /, 'stale shaft must disappear');
assert.match(render({ ...frame, headValidUntilMs: 117 },116), /<line /);
assert.doesNotMatch(render({ ...frame, headValidUntilMs: 117 },117), /<line /, 'a known missing head hides the shaft from that frame');
assert.doesNotMatch(render({ ...frame, handleValidUntilMs: 117 },117), /<line /, 'a known missing grip hides the shaft from that frame');
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

const trailSource = source.slice(source.indexOf('function clubTrailSegments('));
const trailCode = await esbuild.transform(trailSource, {loader:'tsx'});
const trailContext = vm.createContext({CLUB_TRAIL_MIN_CONFIDENCE:.3, CLUB_TRAIL_MAX_GAP_MS:120});
vm.runInContext(trailCode.code, trailContext);
const seen = x => ({x, y:.4, confidence:.9});
const gapFrames = [{timeMs:0,head:seen(.1),handle:seen(.1)}, {timeMs:16,handle:seen(.2)},
  {timeMs:32,head:seen(.3),handle:seen(.3)}, {timeMs:48,head:seen(.4),handle:seen(.4)}];
const groups = (frames,key) => JSON.stringify(trailContext.clubTrailSegments(frames,key).map(group=>group.map(p=>p.timeMs)));
assert.equal(groups(gapFrames,'head'),'[[0],[32,48]]','a known missing head must break the trajectory');
assert.equal(groups(gapFrames,'handle'),'[[0,16,32,48]]','a missing head must not break the observed grip');
const unknown = [{timeMs:0,head:seen(.1)},{timeMs:16,head:{x:.2,y:.4}},
  {timeMs:32,head:{x:.25,y:.4,confidence:NaN}},{timeMs:48,head:seen(.4)}];
assert.equal(groups(unknown,'head'),'[[0],[48]]','unknown confidence is not an observed point');
assert.equal(groups([{timeMs:0,head:seen(.1)},{timeMs:121,head:seen(.2)}],'head'),'[[0],[121]]');
const markedFrames = [{timeMs:0,head:seen(.1),handle:seen(.1)},
  {timeMs:32,head:seen(.3),handle:seen(.3),headBreakBefore:true}, {timeMs:48,head:seen(.4),handle:seen(.4)}];
assert.equal(groups(markedFrames,'head'),'[[0],[32,48]]','a server-marked gap must break the head trail even without a row');
assert.equal(groups(markedFrames,'handle'),'[[0,32,48]]','a head-only gap does not break the grip trail');
markedFrames[1].handleBreakBefore=true;
assert.equal(groups(markedFrames,'handle'),'[[0],[32,48]]','a gap in both detections breaks both trails');
context.clubTrailSegments = trailContext.clubTrailSegments; context.smoothPathFromPoints = trailContext.smoothPathFromPoints;
const gapSvg=renderToStaticMarkup(React.createElement(context.OverlaySvg,{clubFrames:gapFrames.map(row=>({...row,handle:undefined})),poseFrames:[],timeMs:48,layers:{club:true}}));
assert.equal((gapSvg.match(/<circle /g)||[]).length,1,'an isolated observation remains visible as a point');
assert.equal((gapSvg.match(/<path /g)||[]).length,2,'the head path has two strokes and no bridge over the gap');
assert.match(gapSvg,/M 0\.3000 0\.4000/);
console.log('club trails show missing observations as gaps and keep isolated points');

// Render the real selector to catch missing levels and accidental repeated cards.
const clubSource = fs.readFileSync('src/components/analysis/ClubObservation.tsx', 'utf8').replace(/^import .*\n/gm, '').replace('export function', 'function');
const clubCode = await esbuild.transform(clubSource, {loader:'tsx', jsx:'transform'});
const clubContext = vm.createContext({React, useState:React.useState, useEffect:React.useEffect, useRef:React.useRef});
vm.runInContext(clubCode.code, clubContext);
const props = {jobId:'fixture', playable:true, onSeek(){}, onResult(){}, sidecar:{observations:{levels:[.2,.35,.5,.65,.8].map(heightFraction=>({heightFraction, direction:'steeper', backswingMs:1000, downswingMs:1700}))}}};
const clubHtml = renderToStaticMarkup(React.createElement(clubContext.ClubObservation,props));
assert.equal((clubHtml.match(/>백스윙/g)||[]).length,1,'only one phase pair should be displayed');
assert.equal((clubHtml.match(/aria-pressed="true"/g)||[]).length,1,'default height selected');
assert.match(clubHtml,/50%/); assert.match(clubHtml,/관측의 한계/);
assert.match(clubHtml,/두 장면이 각각 백스윙과 다운스윙인지/);
assert.match(clubHtml,/노란 선이 실제 클럽과 맞는지 확인하세요/);
assert.match(clubHtml,/클럽 관측 다시 계산/);
const emptyHtml = renderToStaticMarkup(React.createElement(clubContext.ClubObservation,{...props,sidecar:{status:'succeeded',observations:{levels:[]}}}));
assert.match(emptyHtml,/클럽 관측 다시 계산/);
const noVideo = renderToStaticMarkup(React.createElement(clubContext.ClubObservation,{...props,playable:false}));
assert.equal((noVideo.match(/disabled=""/g)||[]).length,2,'scene controls require a playable video');
assert.doesNotMatch(source,/scrollIntoView/,'changing scenes must not move the document');
console.log('compact height selector and stationary scene navigation passed');

// Exercise the selector's state through a refresh without a browser dependency.
const slots = []; let cursor = 0, effects = [], dirty = false, resolveRefresh, rejectRefresh;
const fakeReact = { createElement: (type, props, ...children) => ({ type, props: props || {}, children: children.flat(Infinity) }) };
const useState = initial => { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], value => { const next = typeof value === 'function' ? value(slots[i]) : value; if (!Object.is(slots[i], next)) { slots[i] = next; dirty = true; } }]; };
const useRef = initial => { const i = cursor++; if (!(i in slots)) slots[i] = {current:initial}; return slots[i]; };
const useEffect = (effect, deps) => { const i = cursor++; if (!slots[i] || deps.some((value, index) => !Object.is(value, slots[i][index]))) { slots[i] = deps; effects.push(effect); } };
const requestClubReview = () => new Promise((resolve, reject) => { resolveRefresh = resolve; rejectRefresh = reject; });
const interactive = vm.createContext({React:fakeReact, useState, useRef, useEffect, requestClubReview, AbortController});
vm.runInContext(clubCode.code, interactive);
const seeks = [];
const first = {status:'succeeded', observations:{levels:[{heightFraction:.5,direction:'steeper',backswingMs:1000,downswingMs:1700}]}};
const second = {status:'succeeded', observations:{levels:[{heightFraction:.5,direction:'steeper',backswingMs:1200,downswingMs:1800}]}};
const live = {jobId:'fixture', sidecar:first, playable:true, onSeek:ms=>seeks.push(ms), onResult:value=>{live.sidecar=value;}};
function rerender() { let tree; do { cursor=0; effects=[]; dirty=false; tree=interactive.ClubObservation(live); effects.forEach(effect=>effect()); } while (dirty); return tree; }
function nodes(node) { return node && typeof node === 'object' ? [node, ...node.children.flatMap(nodes)] : []; }
function text(node) { return typeof node === 'string' || typeof node === 'number' ? String(node) : node?.children?.map(text).join('') || ''; }
function button(tree, label) { const item=nodes(tree).find(node=>node.type==='button' && text(node).includes(label)); assert.ok(item, `missing button ${label}`); return item; }
let tree = rerender(); button(tree,'백스윙').props.onClick(); tree=rerender();
assert.equal(button(tree,'백스윙').props['aria-pressed'],true); assert.deepEqual(seeks,[1000]);
let pending = button(tree,'클럽 관측 다시 계산').props.onClick(); tree=rerender();
assert.equal(button(tree,'백스윙').props['aria-pressed'],true,'old selection remains while calculating');
rejectRefresh(new Error('failed')); await pending; tree=rerender();
assert.equal(button(tree,'백스윙').props['aria-pressed'],true,'failed refresh keeps the previous selection');
assert.match(text(tree),/이전 결과는 유지됩니다/);
pending=button(tree,'클럽 관측 다시 계산').props.onClick(); resolveRefresh(second); await pending; tree=rerender();
assert.equal(button(tree,'백스윙').props['aria-pressed'],false,'new results must not mark the old video scene as selected');
assert.deepEqual(seeks,[1000],'refresh does not move the video without a user action');
button(tree,'백스윙').props.onClick(); tree=rerender(); assert.deepEqual(seeks,[1000,1200]);
live.sidecar={...second,observations:{levels:[{...second.observations.levels[0],backswingMs:1400}]}}; tree=rerender();
assert.equal(button(tree,'백스윙').props['aria-pressed'],false,'an externally replaced observation also clears selection');
button(tree,'백스윙').props.onClick(); tree=rerender(); assert.deepEqual(seeks,[1000,1200,1400]);
live.playable=false; tree=rerender(); assert.equal(button(tree,'백스윙').props.disabled,true);
button(tree,'50%').props.onClick(); tree=rerender();
assert.equal(button(tree,'백스윙').props['aria-pressed'],false,'changing height without playable video clears the old phase');
assert.deepEqual(seeks,[1000,1200,1400],'height selection must not seek an unplayable video');
console.log('club selection stays consistent when observations refresh or fail');
