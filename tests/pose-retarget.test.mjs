import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {normalizeVideoTool} from '../lib/video-tools.mjs';

test('Target body fitting is optional, image-bound and confined to detected pose guides',()=>{
  const sourceJob=randomUUID(),poseTarget=randomUUID()+'.png',input={tool:'pose-guide',sourceJob,poseTarget,poseFraming:'full'};
  assert.equal(normalizeVideoTool(input).poseTarget,poseTarget);
  assert.equal(normalizeVideoTool({...input,poseTarget:null}).poseTarget,null);
  assert.equal(normalizeVideoTool({tool:'pose-guide',sourceJob}).poseTarget,null);
  for(const value of ['', '../target.png', 'https://example.com/body.png', {}, randomUUID()+'.mp4'])assert.throws(()=>normalizeVideoTool({...input,poseTarget:value}));
  assert.throws(()=>normalizeVideoTool({...input,tool:'finish'}));
});

test('Target-relative lengths and driver directions reconstruct independently; missing joints and tampering fail',()=>{
  const result=spawnSync(path.join(process.cwd(),'runtime/engine-env/Scripts/python.exe'),['-X','utf8','tests/pose_retarget_check.py'],{encoding:'utf8',timeout:30000,windowsHide:true});
  assert.equal(result.status,0,result.stdout+result.stderr);
});
