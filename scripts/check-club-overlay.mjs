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
  POSE_FRAME_MAX_DISTANCE_MS:50, HAND_TRAIL_DURATION_MS:800, HAND_TRAIL_MAX_GAP_MS:120, HAND_TRAIL_MIN_SPACING_MS:16,
  clubTrailSegments: () => [], handTrailSegments: () => [], SKELETON_LINKS: [], EVENT_LABELS: {}, jointColor:()=>"white" });
const helperStart=source.indexOf('function frameBound'), helperEnd=source.indexOf('\nfunction OverlaySvg',helperStart);
assert.ok(helperStart>=0 && helperEnd>helperStart);
const helpers=await esbuild.transform(source.slice(helperStart,helperEnd),{loader:'tsx'});
vm.runInContext(helpers.code,context);
vm.runInContext(code, context);
const point = { x: .2, y: .4, confidence: .8 };
const render = (frame, timeMs = 100) => renderToStaticMarkup(React.createElement(context.OverlaySvg, {
  clubFrames: [frame], poseFrames: [], timeMs, layers: { club: true },
}));
const renderVerified = (frame, timeMs, clubTimeMs) => renderToStaticMarkup(React.createElement(context.OverlaySvg, {
  clubFrames: [frame], poseFrames: [], timeMs, clubTimeMs, layers: { club: true },
}));
const frame = { timeMs: 100, head: point, handle: { ...point, x: .5 } };
assert.match(render(frame), /<line /);
assert.doesNotMatch(render(frame, 151), /<line /, 'stale shaft must disappear');
assert.match(render({ ...frame, headValidUntilMs: 117 },116), /<line /);
assert.doesNotMatch(render({ ...frame, headValidUntilMs: 117 },117), /<line /, 'a known missing head hides the shaft from that frame');
assert.doesNotMatch(render({ ...frame, handleValidUntilMs: 117 },117), /<line /, 'a known missing grip hides the shaft from that frame');
assert.doesNotMatch(renderVerified({ ...frame, headValidUntilMs: 117 },116.9997,117.0007), /<line /, 'sub-microsecond clock rounding must not retain a stale shaft');
assert.doesNotMatch(render({ ...frame, handle: undefined }), /<line /);
assert.doesNotMatch(render({ ...frame, handle: { ...point, confidence: .1 } }), /<line /);
assert.doesNotMatch(render({ ...frame, head: { ...point, x: NaN } }), /<line /);
const chooseStart = source.indexOf('  const clubVideoUnverified ='), chooseEnd = source.indexOf(';', source.indexOf('  const clubOverlay =', chooseStart));
const choose = source.slice(chooseStart, chooseEnd + 1);
vm.runInContext(`function choose(overlay, clubSidecar, candidateVideoHash) { ${choose} return clubOverlay; }`, context);
const primary = { clubFrames: [] }, side = { clubFrames: [frame], clubTimeSource: 'video_pts' };
assert.equal(context.choose(primary, { status: 'succeeded', overlay: side }), side);
assert.equal(context.choose(primary, { status: 'failed', overlay: side }), primary);
assert.equal(context.choose(primary, { status: 'succeeded', overlay: { clubFrames: [frame] } }), primary);
const videoHash='a'.repeat(64), otherHash='b'.repeat(64);
assert.equal(context.choose(primary, {status:'succeeded',pendingOverlay:side,overlayVideoSha256:videoHash}), null, 'an unbound fallback must not show on a video without a candidate');
assert.equal(context.choose(primary, {status:'succeeded',pendingOverlay:side,overlayVideoSha256:videoHash}, otherHash), null, 'a different video cannot show the fallback trajectory');
assert.equal(context.choose(primary, {status:'succeeded',pendingOverlay:side,overlayVideoSha256:videoHash}, videoHash), side, 'a verified matching video may show the saved trajectory');
assert.equal(context.choose(primary, {status:'succeeded',pendingOverlay:side,overlayVideoSha256:null}, videoHash), null, 'malformed video identity must not unlock the overlay');
assert.equal(context.choose(primary, {status:'succeeded',overlay:side,overlayVideoSha256:videoHash}, videoHash), null, 'a missing pending overlay must not fall back to unbound data');
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

context.SKELETON_LINKS=[['left_shoulder','left_elbow']];
const renderPose=keypoints=>renderToStaticMarkup(React.createElement(context.OverlaySvg,{
  pose:{timeMs:100,keypoints},poseFrames:[],clubFrames:[],timeMs:100,layers:{pose:true},
}));
const visible=[.2,.3,.9];
assert.match(renderPose({left_shoulder:visible,left_elbow:[.4,.5,.9]}),/<line /);
assert.doesNotMatch(renderPose({left_shoulder:visible,left_elbow:[.4,.5,.1]}),/<line /,'a low-visibility joint cannot make a bone');
assert.doesNotMatch(renderPose({left_shoulder:visible,left_elbow:[.4,.5]}),/<line /,'unknown visibility cannot make a bone');
assert.doesNotMatch(renderPose({left_shoulder:visible,left_elbow:[NaN,.5,.9]}),/<line /,'invalid coordinates cannot make a bone');
assert.equal(context.nearestAt([{timeMs:0},{timeMs:200}],80),undefined,'a distant pose must not be projected into a gap');
assert.equal(context.nearestAt([{timeMs:0},{timeMs:200}],40).timeMs,0);
const handStart=source.indexOf('function handTrailSegments('), handEnd=source.indexOf('\nfunction clubTrailSegments',handStart);
assert.ok(handStart>=0 && handEnd>handStart);
const handCode=await esbuild.transform(source.slice(handStart,handEnd),{loader:'tsx'});vm.runInContext(handCode.code,context);
context.formatCoordinate=value=>value.toFixed(4);
const handFrames=[{timeMs:0,keypoints:{left_wrist:[.1,.2,.9]}},{timeMs:33,keypoints:{left_wrist:[.2,.2,.1]}},
  {timeMs:66,keypoints:{left_wrist:[.3,.2,.9]}},{timeMs:99,keypoints:{left_wrist:[.4,.2,.9]}}];
assert.equal(JSON.stringify(context.handTrailSegments(handFrames,'left_wrist',99).map(s=>[s.from.timeMs,s.to.timeMs])),'[[66,99]]','a low-visibility wrist must break the trail');
assert.equal(context.handTrailPaths(handFrames,'left_wrist',99).map(p=>p.path).join(' '),'M 0.3000 0.2000 L 0.4000 0.2000','rendered paths must retain the break');
const handsSvg=renderToStaticMarkup(React.createElement(context.OverlaySvg,{poseFrames:handFrames,clubFrames:[],timeMs:99,layers:{hands:true}}));
assert.match(handsSvg,/d="M 0\.3000 0\.2000 L 0\.4000 0\.2000"/,'the player must render only the valid hand segment');
const dense=Array.from({length:9},(_,i)=>({timeMs:i*4,keypoints:{left_wrist:[.1+i*.01,.2,.9]}}));
assert.equal(JSON.stringify(context.handTrailSegments(dense,'left_wrist',32).map(s=>[s.from.timeMs,s.to.timeMs])),'[[0,16],[16,32]]','dense trails retain roughly one point per displayed frame');
dense[2].keypoints={};
assert.equal(JSON.stringify(context.handTrailSegments(dense,'left_wrist',32).map(s=>[s.from.timeMs,s.to.timeMs])),'[[12,28]]','downsampling must not bridge a known gap');
console.log('pose rendering hides low-confidence, invalid and distant observations without bridging hand gaps');

// Exercise the overlay clock separately from the slower playback controls.
const clockStart = source.indexOf('function FrameSyncedOverlays('), clockEnd = source.indexOf('\nfunction ClubTrackingEvidence', clockStart);
assert.ok(clockStart >= 0 && clockEnd > clockStart);
const clockCode = await esbuild.transform(source.slice(clockStart, clockEnd), {loader:'tsx', jsx:'transform'});
const clockSlots = []; let clockCursor = 0, clockEffects = [];
const clockState = initial => { const i=clockCursor++; if (!(i in clockSlots)) clockSlots[i]={value:initial}; return [clockSlots[i].value, value=>{clockSlots[i].value=typeof value==='function'?value(clockSlots[i].value):value;}]; };
const clockEffect = (effect,deps) => { const i=clockCursor++, old=clockSlots[i]; if (!old || deps.some((v,j)=>!Object.is(v,old.deps[j]))) clockEffects.push(()=>{old?.cleanup?.();clockSlots[i]={deps,cleanup:effect()};}); };
const clockReact = {createElement:(type,props,...children)=>({type,props:props||{},children})};
const clockContext=vm.createContext({React:clockReact,useState:clockState,useEffect:clockEffect,useMemo:fn=>fn(),nearestAt:()=>undefined,
  OverlaySvg:()=>null,MovementGuideOverlay:()=>null,PelvisContourOverlay:()=>null,HAND_TRAIL_DURATION_MS:800,CLUB_TRAIL_DURATION_MS:550,POSE_FRAME_MAX_DISTANCE_MS:50});
vm.runInContext(helpers.code,clockContext);
vm.runInContext(clockCode.code, clockContext);
function fakeVideo() {
  const callbacks=new Map(),listeners={}, video={paused:false,seeking:false,callbacks,listeners,nextId:0,
    requestVideoFrameCallback(fn){const id=++this.nextId;callbacks.set(id,fn);return id;},cancelVideoFrameCallback(id){callbacks.delete(id);},
    addEventListener(event,fn){listeners[event]=fn;},removeEventListener(event,fn){if(listeners[event]===fn)delete listeners[event];},
    deliver(ms){const [id,fn]=callbacks.entries().next().value;callbacks.delete(id);fn(0,{mediaTime:ms/1000});},
  }; return video;
}
const clockVideo=fakeVideo(), ref={current:clockVideo}, clockProps={src:'first',videoRef:ref,timeMs:200,overlay:{poseFrames:[],clubFrames:[]},
  playable:true,bounds:{left:0,top:0,width:100,height:100},layers:{pose:true,hands:true,club:true,events:true},contour:null,guideKind:null,movementGuide:null};
function renderClock(){clockCursor=0;clockEffects=[];const node=clockContext.FrameSyncedOverlays(clockProps);clockEffects.forEach(effect=>effect());return node;}
assert.equal(renderClock().props['data-overlay-time-ms'],200);
clockVideo.deliver(700);assert.equal(renderClock().props['data-overlay-time-ms'],700,'overlay must follow the presented frame');
clockVideo.seeking=true;clockVideo.listeners.seeking();assert.equal(renderClock().props['data-overlay-time-ms'],200,'seek clears the old frame');
clockVideo.seeking=false;clockVideo.deliver(800);assert.equal(renderClock().props['data-overlay-time-ms'],800);
clockVideo.paused=true;clockVideo.listeners.pause();assert.equal(renderClock().props['data-overlay-time-ms'],200,'pause uses the playback position until another frame is confirmed');
clockVideo.deliver(850);assert.equal(renderClock().props['data-overlay-time-ms'],850,'a paused video must use its newly presented frame');
clockVideo.paused=false;const late=clockVideo.callbacks.values().next().value;
const nextVideo=fakeVideo();ref.current=nextVideo;clockProps.src='second';renderClock();late(0,{mediaTime:1});
assert.equal(renderClock().props['data-overlay-time-ms'],200,'a callback from the old video cannot update the new overlay');
nextVideo.deliver(900);assert.equal(renderClock().props['data-overlay-time-ms'],900);
clockProps.clubFrameClockVerified=true;
clockProps.clubOverlay={clubFrames:[{timeMs:2051.667,head:point,handle:point},{timeMs:2068.333,head:point,handle:point}]};
nextVideo.deliver(2051.666666667);
let frameNode=renderClock().children[0].children[0];
assert.equal(frameNode.props.clubFrames.length,1,'a verified source frame must survive sub-microsecond clock rounding');
assert.equal(frameNode.props.clubFrames[0].timeMs,2051.667);
clockProps.clubFrameClockVerified=false;
frameNode=renderClock().children[0].children[0];
assert.equal(frameNode.props.clubFrames.length,0,'an unverified timeline must not use the tolerance');
clockProps.clubFrameClockVerified=true;clockProps.timeMs=2051.666666667;nextVideo.listeners.pause();
frameNode=renderClock().children[0].children[0];
assert.equal(frameNode.props.clubFrames.length,0,'an unconfirmed presented frame must not use the tolerance');
clockProps.playable=false;assert.equal(renderClock(),null,'unavailable video must hide overlays');
console.log('overlay clock follows displayed frames, clears stale frames and isolates video switches');

// Exercise contour availability using the real frame-clock mapper and video events.
const impactSource=fs.readFileSync('src/api/impactReview.ts','utf8');
const impactStart=impactSource.indexOf('export function frameIndexAtOrBefore'), impactEnd=impactSource.indexOf('\nexport function withImpactCandidate',impactStart);
assert.ok(impactStart>=0 && impactEnd>impactStart);
vm.runInContext((await esbuild.transform(impactSource.slice(impactStart,impactEnd).replace(/^export /gm,''),{loader:'ts'})).code,clockContext);
let now=1000, nextAnimation=0; const animations=new Map();
clockContext.performance={now:()=>now};
clockContext.requestAnimationFrame=fn=>{const id=++nextAnimation;animations.set(id,fn);return id;};
clockContext.cancelAnimationFrame=id=>animations.delete(id);
const tick=ms=>{now=ms;const callbacks=[...animations.values()];animations.clear();callbacks.forEach(fn=>fn(ms));};
const handlers=new Map();
const contourVideo={paused:true,seeking:false,readyState:2,currentTime:.8601,
  requestVideoFrameCallback:()=>1,cancelVideoFrameCallback(){},
  addEventListener:(event,fn)=>{if(!handlers.has(event))handlers.set(event,new Set());handlers.get(event).add(fn);},
  removeEventListener:(event,fn)=>handlers.get(event)?.delete(fn),
  emit:event=>handlers.get(event)?.forEach(fn=>fn()),
};
const frameRef={current:{video:contourVideo,src:'contour',timeMs:860,expectedDisplayTime:900,duringSeek:true}};
let contourStatus='';
clockSlots.length=0;ref.current=contourVideo;
Object.assign(clockProps,{src:'contour',playable:true,overlay:null,clubOverlay:null,contour:{points:[{timeMs:860}]},
  frameTimes:[0,860,876.667],presentedFrame:frameRef,onContourStatus:status=>{contourStatus=status;}});
const hasContour=node=>Boolean(node && typeof node==='object' && (node.type===clockContext.PelvisContourOverlay || node.children?.some(hasContour)));
assert.equal(hasContour(renderClock()),false,'the playback clock alone cannot authorize a contour');
tick(1001);assert.equal(hasContour(renderClock()),true,'a confirmed measured frame displays its contour');
contourVideo.paused=false;contourVideo.emit('play');assert.equal(hasContour(renderClock()),false,'playing hides the discrete contour');
contourVideo.paused=true;contourVideo.emit('pause');tick(1002);assert.equal(hasContour(renderClock()),true);
contourVideo.seeking=true;contourVideo.emit('seeking');contourVideo.currentTime=.876767;
frameRef.current={video:contourVideo,src:'contour',timeMs:876.667,expectedDisplayTime:900,duringSeek:true};
contourVideo.seeking=false;contourVideo.emit('seeked');tick(1003);
assert.equal(hasContour(renderClock()),false,'an unmeasured neighboring frame has no contour');assert.equal(contourStatus,'other');
contourVideo.seeking=true;contourVideo.emit('seeking');contourVideo.currentTime=.8601;frameRef.current=null;
contourVideo.seeking=false;contourVideo.emit('seeked');tick(2300);
assert.equal(hasContour(renderClock()),false);assert.equal(contourStatus,'unverified','a missing new callback is not an observation');
clockProps.frameTimes=[0,860,861,876.667];frameRef.current={video:contourVideo,src:'contour',timeMs:860,expectedDisplayTime:900,duringSeek:true};
renderClock();tick(2301);assert.equal(hasContour(renderClock()),false);assert.equal(contourStatus,'unverified','an ambiguous source frame is withheld');
contourVideo.requestVideoFrameCallback=undefined;clockProps.src='unsupported';renderClock();
assert.equal(hasContour(renderClock()),false);assert.equal(contourStatus,'unverified','unsupported browsers retain the unannotated video');
console.log('pelvis contour requires a confirmed measured frame and withholds stale, ambiguous and unsupported cases');

// Render the real selector to catch missing levels and accidental repeated cards.
const clubSource = fs.readFileSync('src/components/analysis/ClubObservation.tsx', 'utf8').replace(/^import .*\n/gm, '').replace('export function', 'function');
const clubCode = await esbuild.transform(clubSource, {loader:'tsx', jsx:'transform'});
const clubContext = vm.createContext({React, useState:React.useState, useEffect:React.useEffect, useRef:React.useRef, CLUB_BODY_UNAVAILABLE_MESSAGE:'자세 자료를 확인하지 못해'});
vm.runInContext(clubCode.code, clubContext);
const props = {jobId:'fixture', playable:true, onSeek(){}, onResult(){}, sidecar:{observations:{levels:[.2,.35,.5,.65,.8].map(heightFraction=>({heightFraction, direction:'steeper', backswingMs:1000, downswingMs:1700}))}}};
const clubHtml = renderToStaticMarkup(React.createElement(clubContext.ClubObservation,props));
const coverageProps = { ...props, sidecar: { ...props.sidecar, status:'succeeded', overlay:{clubFrames:[frame]}, sourceFrameCoverage:{status:'verified',missingFrames:1} } };
const missingCoverage = renderToStaticMarkup(React.createElement(clubContext.ClubObservation,coverageProps));
assert.match(missingCoverage,/빠진 프레임 1개/);
const ambiguousHtml = renderToStaticMarkup(React.createElement(clubContext.ClubObservation,{...coverageProps,sidecar:{...coverageProps.sidecar,trackingQuality:{ambiguousClubHeadFrames:5}}}));
assert.match(ambiguousHtml,/헤드 후보가 둘 이상인 5개 장면/);
const noAmbiguousHtml = renderToStaticMarkup(React.createElement(clubContext.ClubObservation,{...coverageProps,sidecar:{...coverageProps.sidecar,trackingQuality:{ambiguousClubHeadFrames:0}}}));
assert.doesNotMatch(noAmbiguousHtml,/헤드 후보가 둘 이상인/);
assert.doesNotMatch(missingCoverage,/헤드 후보가 둘 이상인/,'legacy results must not claim a count');
const unknownCoverage = renderToStaticMarkup(React.createElement(clubContext.ClubObservation,{...coverageProps,sidecar:{...coverageProps.sidecar,sourceFrameCoverage:{status:'unverified'}}}));
assert.match(unknownCoverage,/빠진 프레임은 확인하지 못했어요/);
const fullCoverage = renderToStaticMarkup(React.createElement(clubContext.ClubObservation,{...coverageProps,sidecar:{...coverageProps.sidecar,sourceFrameCoverage:{status:'verified',missingFrames:0}}}));
assert.doesNotMatch(fullCoverage,/빠진 프레임/);
assert.equal((clubHtml.match(/>백스윙/g)||[]).length,1,'only one phase pair should be displayed');
assert.equal((clubHtml.match(/aria-pressed="true"/g)||[]).length,1,'default height selected');
assert.match(clubHtml,/50%/); assert.match(clubHtml,/관측의 한계/);
assert.match(clubHtml,/두 장면이 각각 백스윙과 다운스윙인지/);
assert.match(clubHtml,/노란 선이 실제 클럽과 맞는지 확인하세요/);
assert.match(clubHtml,/추정한 클럽 위치로 비교/);
assert.doesNotMatch(clubHtml,/위치가 달라지면 비교가 불확실/, 'missing sensitivity must not claim a result');
const sensitive = {...props, sidecar:{observations:{levels:[{...props.sidecar.observations.levels[2], sensitiveTo10Px:true}]}}};
const sensitiveHtml = renderToStaticMarkup(React.createElement(clubContext.ClubObservation,sensitive));
assert.match(sensitiveHtml,/위치가 달라지면 비교가 불확실/);
assert.match(sensitiveHtml,/10px 오차를 가정하면 비교가 불확실/);
assert.match(sensitiveHtml,/aria-live="polite"[^>]*>.*위치가 달라지면 비교가 불확실/, 'changes to the warning must reach screen readers');
assert.match(clubHtml,/클럽 관측 다시 계산/);
const emptyHtml = renderToStaticMarkup(React.createElement(clubContext.ClubObservation,{...props,sidecar:{status:'succeeded',observations:{levels:[]}}}));
assert.match(emptyHtml,/클럽 관측 다시 계산/);
const noImpactHtml = renderToStaticMarkup(React.createElement(clubContext.ClubObservation,{...props,sidecar:{status:'succeeded',observations:{levels:[],reason:'IMPACT_CANDIDATE_UNAVAILABLE'}}}));
assert.match(noImpactHtml,/임팩트 후보 없이 계산해 구간 비교를 보류/);
assert.match(noImpactHtml,/영상 일치가 확인되면 표시/);
const noBodyHtml = renderToStaticMarkup(React.createElement(clubContext.ClubObservation,{...props,sidecar:{status:'failed',errorCode:'BODY_UNAVAILABLE'}}));
assert.match(noBodyHtml,/자세 자료를 확인하지 못해/);
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
const interactive = vm.createContext({React:fakeReact, useState, useRef, useEffect, requestClubReview, AbortController, CLUB_BODY_UNAVAILABLE_MESSAGE:'자세 자료를 확인하지 못해'});
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
