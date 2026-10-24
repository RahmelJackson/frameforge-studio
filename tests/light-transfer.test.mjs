import test from 'node:test';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';import path from 'node:path';
test('Illumination-only transfer preserves geometry and material chroma with bounded opposed fields',()=>{
 const r=spawnSync(path.join(process.cwd(),'runtime/engine-env/Scripts/python.exe'),['-X','utf8','tests/light_transfer_check.py'],{encoding:'utf8',timeout:30000,windowsHide:true});assert.equal(r.status,0,r.stdout+r.stderr);
});
