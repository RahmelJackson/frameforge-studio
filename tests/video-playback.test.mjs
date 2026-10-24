import test from 'node:test';import assert from 'node:assert/strict';import {singleVideoPlayers} from '../public/video-playback.js';
class Video{
 constructor(){this.attrs=new Map();this.isConnected=true;this.paused=true;this.ended=false;this.currentTime=0;this.loads=0;this.plays=0;}
 set src(v){this.attrs.set('src',v);}get src(){return this.attrs.get('src');}
 hasAttribute(k){return this.attrs.has(k);}getAttribute(k){return this.attrs.get(k)??null;}removeAttribute(k){this.attrs.delete(k);}
 pause(){this.paused=true;}load(){this.loads++;}async play(){this.paused=false;this.plays++;this.onplay?.();}
}
test('Storyboard previews do not load decoders until requested; switching clips and film unloads prior sources',async()=>{
 const controller=singleVideoPlayers(),videos=Array.from({length:4},()=>new Video()),buttons=videos.map(()=>({}));videos.forEach((v,i)=>controller.attach(v,'/'+i+'.mp4','/'+i+'.jpg',buttons[i]));assert.equal(videos.filter(v=>v.hasAttribute('src')).length,0);assert.ok(videos.every(v=>v.preload==='none'));
 for(let i=0;i<4;i++){await buttons[i].onclick();assert.equal(videos.filter(v=>v.hasAttribute('src')).length,1);assert.equal(videos[i].src,'/'+i+'.mp4');assert.equal(videos[i].paused,false);for(let j=0;j<i;j++)assert.equal(videos[j].paused,true);}
 assert.ok(videos.every((v,i)=>v.poster==='/'+i+'.jpg'));controller.dispose();assert.equal(videos.filter(v=>v.hasAttribute('src')).length,0);
});
test('Reload resets the decoder, completed playback can restart, and detached players release their sources',async()=>{
 const controller=singleVideoPlayers(),video=new Video(),button={};controller.attach(video,'/film.mp4','/poster.jpg',button);await controller.play(video);const before=video.loads;await controller.reload(video);assert.ok(video.loads>before);video.ended=true;video.currentTime=8;await controller.play(video);assert.equal(video.currentTime,0);video.isConnected=false;controller.prune();assert.equal(video.hasAttribute('src'),false);assert.equal(video.paused,true);
});
test('A cancelled earlier play request cannot overwrite the current player status',async()=>{
 const notices=[],controller=singleVideoPlayers(v=>notices.push(v)),a=new Video(),b=new Video();let fail;a.play=()=>new Promise((resolve,reject)=>{fail=reject;});controller.attach(a,'/a.mp4','/a.jpg',{});controller.attach(b,'/b.mp4','/b.jpg',{});const old=controller.play(a);await controller.play(b);fail(Error('Aborted by switching clips'));await old;assert.equal(notices.length,1);assert.match(notices[0],/Playback started/);assert.equal(a.hasAttribute('src'),false);assert.equal(b.src,'/b.mp4');
});
