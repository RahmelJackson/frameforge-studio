import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
test('Browser extension covers images and videos and only talks to the configured studio',async()=>{
 globalThis.chrome={runtime:{onInstalled:{addListener(){}}},contextMenus:{onClicked:{addListener(){}}},storage:{sync:{get:async()=>({})}}};
 const ext=await import('../browser-extension/background.js');
 assert.ok(ext.IMAGE_ACTIONS.some(a=>a[0]==='pose')&&ext.IMAGE_ACTIONS.some(a=>/tool=select/.test(a[2])));
 assert.ok(ext.VIDEO_ACTIONS.some(a=>/ltx-adapter-edit&video=\{url\}/.test(a[2]))&&ext.VIDEO_ACTIONS.some(a=>/segment&footage=\{id\}/.test(a[2])));
 assert.equal(await ext.studioUrl(),'http://127.0.0.1:4317');
 const manifest=JSON.parse(await readFile(new URL('../browser-extension/manifest.json',import.meta.url),'utf8'));
 assert.equal(manifest.manifest_version,3);assert.deepEqual(manifest.permissions.sort(),['contextMenus','scripting','storage']);
});
