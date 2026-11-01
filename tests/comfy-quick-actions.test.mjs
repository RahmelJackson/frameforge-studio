import test from 'node:test';
import assert from 'node:assert/strict';
import {mediaOf,actionsFor,IMAGE_ACTIONS,VIDEO_ACTIONS} from '../assets/comfyui-frameforge/web/quick-actions.js';
test('ComfyUI quick actions only offer saved or preview PNG/MP4/WebM media and open the matching Studio tool',()=>{
 assert.equal(mediaOf({images:[{filename:'a.jpg',type:'output'}]}),null);
 assert.equal(mediaOf({images:[{filename:'a.png',type:'input'}]}),null);
 assert.deepEqual(mediaOf({images:[{filename:'ComfyUI_00001_.png',subfolder:'',type:'temp'}]}),{filename:'ComfyUI_00001_.png',subfolder:'',type:'temp'});
 assert.equal(actionsFor(mediaOf({images:[{filename:'x.png',type:'output'}]})),IMAGE_ACTIONS);
 assert.equal(actionsFor(mediaOf({images:[{filename:'x.mp4',type:'output'}]})),VIDEO_ACTIONS);
 const asset='11111111-1111-1111-1111-111111111111.png';assert.equal(IMAGE_ACTIONS.find(a=>a.id==='animate').path(asset),'/create?image='+asset+'#shot-form');
 assert.match(IMAGE_ACTIONS.find(a=>a.id==='prop').path(asset),/image=%2Fassets%2F/);
 assert.ok(VIDEO_ACTIONS.every(a=>a.path('22222222-2222-2222-2222-222222222222').includes('footage=22222222')));
});
