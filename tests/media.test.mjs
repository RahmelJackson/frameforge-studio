import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const config=JSON.parse(readFileSync(path.join(root,'config.local.json'),'utf8'));
test('Media verifier accepts a real encoded clip and rejects mismatched requirements',()=>{
  const run=spawnSync(config.python,[path.join(root,'tests/media_check.py')],{cwd:root,encoding:'utf8',windowsHide:true,timeout:60000});
  assert.equal(run.status,0,run.stdout+run.stderr);
});
