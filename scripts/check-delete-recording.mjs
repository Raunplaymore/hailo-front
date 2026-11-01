import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const dir=await mkdtemp(join(tmpdir(),'delete-recording-'));
try {
 const outfile=join(dir,'delete.mjs');
 await build({entryPoints:['src/api/deleteRecording.ts'],bundle:true,platform:'node',format:'esm',outfile,define:{'import.meta.env':'{}'},logLevel:'silent'});
 const {deleteRecording}=await import(outfile);
 let sessions, entries, failure, requests;
 function reset() {sessions=[{jobId:'session_1',videoFile:'video.mp4',status:'recorded'}];entries=[{filename:'video.mp4'}];failure='';requests=[];}
 globalThis.fetch=async (url,options={})=>{
   const u=new URL(String(url),'http://backend.test'), method=options.method||'GET';requests.push(`${method} ${u.pathname}`);
   const json=(data,status=200)=>({ok:status<400,status,json:async()=>data,text:async()=>JSON.stringify(data)});
   if(u.pathname==='/api/session/list')return failure==='camera-list'?json({},503):failure==='bad-camera-list'?json({ok:true}):json({sessions});
   if(u.pathname==='/api/files'&&method==='GET')return failure==='backend-list'?json({},503):failure==='bad-backend-list'?json({}):json(entries);
   if(u.pathname==='/api/files/video.mp4'&&method==='DELETE'){if(failure==='backend-delete')return json({},500);entries=[];return json({ok:true});}
   if(u.pathname==='/api/session/session_1'&&method==='DELETE'){if(failure==='camera-delete')return json({error:'denied'},500);sessions=[];return json({ok:true});}
   throw Error(`unexpected ${method} ${u.pathname}`);
 };
 reset();await deleteRecording('video.mp4','http://camera.test',undefined,'session_1');
 assert.deepEqual(requests,['GET /api/session/list','GET /api/files','DELETE /api/files/video.mp4','DELETE /api/session/session_1']);
 reset();failure='backend-delete';await assert.rejects(deleteRecording('video.mp4','http://camera.test'),/분석 기록/);assert.ok(!requests.includes('DELETE /api/session/session_1'));
 reset();failure='backend-list';await assert.rejects(deleteRecording('video.mp4','http://camera.test'));assert.ok(!requests.some(r=>r.startsWith('DELETE')));
 reset();failure='camera-list';await assert.rejects(deleteRecording('video.mp4','http://camera.test'));assert.ok(!requests.some(r=>r.startsWith('DELETE')));
 for(const invalid of ['bad-camera-list','bad-backend-list']){reset();failure=invalid;await assert.rejects(deleteRecording('video.mp4','http://camera.test'));assert.ok(!requests.some(r=>r.startsWith('DELETE')));}
 reset();sessions[0].status='running';await assert.rejects(deleteRecording('video.mp4','http://camera.test'),/촬영 중/);assert.ok(!requests.some(r=>r.startsWith('DELETE')));
 reset();failure='camera-delete';await assert.rejects(deleteRecording('video.mp4','http://camera.test'),/영상은 삭제됐지만/);assert.equal(entries.length,0);failure='';requests=[];await deleteRecording('video.mp4','http://camera.test',undefined,'session_1');assert.deepEqual(requests,['GET /api/session/list','GET /api/files','DELETE /api/session/session_1']);
 reset();entries=[];await deleteRecording('video.mp4','http://camera.test',undefined,'session_1');assert.ok(!requests.includes('DELETE /api/files/video.mp4'));
 reset();sessions=[];await deleteRecording('video.mp4','http://camera.test');assert.ok(!requests.some(r=>r.startsWith('DELETE /api/session/')));
 reset();sessions.push({...sessions[0],jobId:'session_2'});await assert.rejects(deleteRecording('video.mp4','http://camera.test'));assert.ok(!requests.some(r=>r.startsWith('DELETE')));
 console.log('coordinated recording deletion: linked, missing, active, duplicate, failure and retry checks passed');
}finally{await rm(dir,{recursive:true,force:true});}
