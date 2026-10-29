import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const dir=await mkdtemp(join(tmpdir(),'pose-overlay-'));
try {
  const outfile=join(dir,'pose.mjs');
  await build({entryPoints:['src/api/poseOverlay.ts'],bundle:true,platform:'node',format:'esm',outfile,define:{'import.meta.env':'{}'},logLevel:'silent'});
  const {parsePoseOverlay,requestPoseOverlay}=await import(outfile);
  const review={videoSha256:'a'.repeat(64),frameTimesMs:[0,33,67,100]};
  const valid={ok:true,jobId:'job',videoSha256:review.videoSha256,status:'ready',timeSource:'video_pts',poseFrames:[
    {frame:0,timeMs:0,keypoints:{left_wrist:[.2,.3,.9]}},{frame:1,timeMs:33,keypoints:{}},
    {frame:2,timeMs:67,keypoints:{left_wrist:[.4,.3,.9]}}]};
  assert.equal(parsePoseOverlay(valid,'job',review).poseFrames[1].keypoints && Object.keys(parsePoseOverlay(valid,'job',review).poseFrames[1].keypoints).length,0);
  for(const changed of [
    {jobId:'other'},{videoSha256:'b'.repeat(64)},{timeSource:'estimated'},{status:'ready',poseFrames:[]},
    {poseFrames:[{frame:1,timeMs:34,keypoints:{}}]},{poseFrames:[{frame:1,timeMs:33,keypoints:{}},{frame:1,timeMs:33,keypoints:{}}]},
    {status:'ready',poseFrames:[{frame:0,timeMs:0,keypoints:{}}]},
    {poseFrames:[{frame:0,timeMs:0,keypoints:{left_wrist:[.2,.3,NaN]}}]},{poseFrames:[{frame:0,timeMs:0,keypoints:{unknown:[.2,.3,.9]}}]},
  ]) assert.throws(()=>parsePoseOverlay({...valid,...changed},'job',review));
  assert.equal(parsePoseOverlay({...valid,status:'unavailable',poseFrames:[]},'job',review).status,'unavailable');
  const longReview={...review,frameTimesMs:Array.from({length:7200},(_,i)=>i*4)};
  const joints=['nose',...['left','right'].flatMap(side=>['shoulder','elbow','wrist','hip','knee','ankle'].map(joint=>`${side}_${joint}`))];
  const densePoints=Object.fromEntries(joints.map(name=>[name,[.2,.3,.9]]));
  const longFrames=longReview.frameTimesMs.map((timeMs,frame)=>({frame,timeMs,keypoints:frame===3599?{}:densePoints}));
  assert.equal(parsePoseOverlay({...valid,poseFrames:longFrames},'job',longReview).poseFrames.length,7200);
  const previous=globalThis.fetch;let calls=0,release;
  try {
    globalThis.fetch=async()=>{calls++;await new Promise(resolve=>{release=resolve;});return new Response(JSON.stringify(valid),{status:200});};
    const first=requestPoseOverlay('job',review),second=requestPoseOverlay('job',{...review,frameTimesMs:[0,34,67,100]});
    assert.equal(calls,1,'same-video in-flight request must be shared');release();
    assert.equal((await first).status,'ready');await assert.rejects(second,/시각이 일치하지/);
  } finally {globalThis.fetch=previous;}
  console.log('pose overlay contract, source clock, gaps and shared-request checks passed');
} finally {await rm(dir,{recursive:true,force:true});}
