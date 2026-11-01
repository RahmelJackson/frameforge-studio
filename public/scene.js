import * as THREE from './vendor/three/three.module.js';
import {OrbitControls} from './vendor/three/OrbitControls.js';
import {GLTFLoader} from './vendor/three/GLTFLoader.js';
import {SCENE_PRESETS} from './scene-presets.js';
const $=s=>document.querySelector(s),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function api(url,body,method){const r=await fetch(url,body===undefined&&!method?{}:{method:method??'POST',headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)}),v=await r.json().catch(()=>({}));if(!r.ok)throw Error(v.error??'The request failed.');return v;}

// Stand-in kinds. Sizes are metres; every shape stands on the ground at y=0.
export const KINDS={
 building:{label:'Building',icon:'▥',scale:[6,12,6],color:'#8e9894'},
 house:{label:'House',icon:'⌂',scale:[5,4,5],color:'#a39a8e'},
 character:{label:'Person',icon:'◍',scale:[1,1,1],color:'#d6c7a1'},
 car:{label:'Car',icon:'▭',scale:[1,1,1],color:'#7d8fa3'},
 tree:{label:'Tree',icon:'♣',scale:[1,1,1],color:'#7f9a72'},
 wall:{label:'Wall',icon:'▬',scale:[6,3,.3],color:'#9c9c96'},
 box:{label:'Box prop',icon:'■',scale:[1,1,1],color:'#b3a28c'},
 sphere:{label:'Ball prop',icon:'●',scale:[1,1,1],color:'#a5a5b8'}
};
const SIZES={landscape:[1024,576],portrait:[576,1024],square:[768,768]};
const ACCENT='#d6ff00',MAX_TIME=20,SNAP=.15;
const uid=()=>Math.random().toString(36).slice(2,10),deg=THREE.MathUtils.degToRad,r1=v=>Math.round(v*10)/10,r2=v=>Math.round(v*100)/100;
const round=v=>v.toArray().map(r2);
let scene3d,renderer,editCam,shotCam,controls,shotControls,ground,grid,helper,camRig,aimDot,paths;
let doc=null,selected=null,view='edit',saveTimer=null,dragging=null,playing=null,time=0,timelineMax=8,overViewport=false,lastFrame=0;
const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2(),held=new Set(),meshes=new Map(),glbCache=new Map();

// ---------- objects ----------
function material(color){return new THREE.MeshStandardMaterial({color,roughness:.85,metalness:0});}
function build(o){
 const g=new THREE.Group(),m=material(o.color);
 const add=(geo,y=0,x=0,z=0)=>{const mesh=new THREE.Mesh(geo,m);mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;g.add(mesh);return mesh;};
 if(['building','wall','box'].includes(o.kind))add(new THREE.BoxGeometry(1,1,1),.5);
 else if(o.kind==='house'){add(new THREE.BoxGeometry(1,.62,1),.31);const roof=add(new THREE.ConeGeometry(.78,.38,4),.81);roof.rotation.y=Math.PI/4;}
 else if(o.kind==='character'){add(new THREE.CapsuleGeometry(.22,.85,6,12),.65);add(new THREE.SphereGeometry(.15,16,12),1.5);add(new THREE.BoxGeometry(.12,.06,.14),1.52,0,.13);}
 else if(o.kind==='car'){add(new THREE.BoxGeometry(1.8,.6,4.2),.5);add(new THREE.BoxGeometry(1.5,.5,2.1),1.05,0,-.2);for(const [x,z] of [[-.8,1.3],[.8,1.3],[-.8,-1.3],[.8,-1.3]]){const w=add(new THREE.CylinderGeometry(.33,.33,.2,16),.33,x,z);w.rotation.z=Math.PI/2;}}
 else if(o.kind==='tree'){add(new THREE.CylinderGeometry(.15,.2,1.6,10),.8);add(new THREE.ConeGeometry(1.1,2.6,12),2.6);}
 else if(o.kind==='sphere')add(new THREE.SphereGeometry(.5,24,16),.5);
 else if(o.kind==='glb'){const cached=glbCache.get(o.file);if(cached){const c=cached.clone(true);c.traverse(n=>{if(n.isMesh){n.material=m;n.castShadow=n.receiveShadow=true;}});g.add(c);}else add(new THREE.BoxGeometry(1,1,1),.5);}
 g.userData.id=o.id;return g;
}
// Motion: the object's own position is time 0; o.motion holds later keys.
const keysOf=o=>[{time:0,position:o.position,rotation:o.rotation},...(o.motion??[])];
function poseAt(o,t){const ks=keysOf(o);if(ks.length===1||t<=0)return ks[0];const last=ks.at(-1);if(t>=last.time)return last;const i=ks.findIndex(k=>k.time>t),a=ks[i-1],b=ks[i],u=(t-a.time)/(b.time-a.time),dr=((b.rotation-a.rotation)%360+540)%360-180;return {position:a.position.map((v,j)=>v+(b.position[j]-v)*u),rotation:a.rotation+dr*u};}
const heightOf=o=>({character:1.5,car:1,tree:2.4,sphere:.5}[o.kind]??.55)*o.scale[1];
function centerAt(o,t){const p=poseAt(o,t).position;return [p[0],Math.min(heightOf(o)*.85,8),p[2]];}
function apply(o){const g=meshes.get(o.id);if(!g)return;const p=poseAt(o,time);g.position.set(p.position[0],0,p.position[2]);g.rotation.y=deg(p.rotation);g.scale.set(...o.scale);g.traverse(n=>{if(n.isMesh)n.material.color.set(o.color);});}
function applyAll(){for(const o of doc.objects)apply(o);}
function addObject(o){const g=build(o);meshes.set(o.id,g);scene3d.add(g);apply(o);}
function rebuild(){for(const g of meshes.values())scene3d.remove(g);meshes.clear();for(const o of doc.objects)addObject(o);renderOutliner();select(null);drawPaths();}
const duration=()=>Math.max(2,doc.camera.keys.at(-1).time,...doc.objects.flatMap(o=>(o.motion??[]).map(k=>k.time)));

// ---------- camera ----------
function rawCameraAt(keys,t){if(t<=keys[0].time||keys.length===1)return keys[0];const last=keys.at(-1);if(t>=last.time)return last;const i=keys.findIndex(k=>k.time>t),a=keys[i-1],b=keys[i],u=(t-a.time)/(b.time-a.time),s=u*u*(3-2*u),mix=(p,q)=>p.map((v,j)=>v+(q[j]-v)*s);return {position:mix(a.position,b.position),target:mix(a.target,b.target),fov:a.fov+(b.fov-a.fov)*s};}
const sub=(a,b)=>a.map((v,i)=>v-b[i]),add=(a,b)=>a.map((v,i)=>v+b[i]);
function tracked(){const t=doc.camera.track;return t&&doc.objects.find(o=>o.id===t.object)?{mode:t.mode,o:doc.objects.find(o=>o.id===t.object)}:null;}
export function cameraAt(t){const keys=doc.camera.keys,tr=tracked();if(!tr)return rawCameraAt(keys,t);const c=centerAt(tr.o,t);
 if(tr.mode==='look'){const k=rawCameraAt(keys,t);return {...k,target:c};}
 // follow: keep each key's offset from the object, so the camera travels with it
 const rel=keys.map(k=>{const ck=centerAt(tr.o,k.time);return {...k,position:sub(k.position,ck),target:sub(k.target,ck)};}),k=rawCameraAt(rel,t);return {...k,position:add(k.position,c),target:add(k.target,c)};}
function placeShot(k,aspect){shotCam.position.set(...k.position);shotCam.lookAt(new THREE.Vector3(...k.target));shotCam.fov=k.fov;const [w,h]=SIZES[doc.aspect];shotCam.aspect=aspect??w/h;shotCam.updateProjectionMatrix();helper.update();}
function keyIndexAt(t=time){return doc.camera.keys.findIndex(k=>Math.abs(k.time-t)<SNAP);}
function cameraKeyHere(){let i=keyIndexAt();if(i>=0)return doc.camera.keys[i];const ks=doc.camera.keys;if(ks.length>=8){status('A shot can have up to 8 camera keys. Edit an existing one.');return ks.reduce((a,b)=>Math.abs(b.time-time)<Math.abs(a.time-time)?b:a);}
 const base=cameraAt(time),k={time:r1(time),position:base.position.map(r2),target:base.target.map(r2),fov:base.fov};ks.push(k);ks.sort((a,b)=>a.time-b.time);renderKeys();return k;}
// Store a camera pose (absolute) into the key at the current time.
function storeCamera(position,target,save){const k=cameraKeyHere(),tr=tracked();k.position=position.map(r2);if(!(tr&&tr.mode==='look'))k.target=target.map(r2);if(save){renderKeys();drawPaths();changed();}}
function buildRig(){
 const g=new THREE.Group(),dark=new THREE.MeshStandardMaterial({color:'#1d2124',roughness:.5}),acc=new THREE.MeshStandardMaterial({color:ACCENT,emissive:ACCENT,emissiveIntensity:.35,roughness:.6});
 const body=new THREE.Mesh(new THREE.BoxGeometry(.5,.36,.75),dark);g.add(body);
 const lens=new THREE.Mesh(new THREE.CylinderGeometry(.13,.17,.32,20),dark);lens.rotation.x=Math.PI/2;lens.position.z=-.52;g.add(lens);
 const ring=new THREE.Mesh(new THREE.TorusGeometry(.17,.025,8,24),acc);ring.position.z=-.68;g.add(ring);
 for(const z of [.17,-.2]){const reel=new THREE.Mesh(new THREE.CylinderGeometry(.17,.17,.08,22),dark);reel.rotation.z=Math.PI/2;reel.position.set(0,.36,z);g.add(reel);const hub=new THREE.Mesh(new THREE.CylinderGeometry(.05,.05,.1,10),acc);hub.rotation.z=Math.PI/2;hub.position.set(0,.36,z);g.add(hub);}
 const stripe=new THREE.Mesh(new THREE.BoxGeometry(.52,.05,.77),acc);stripe.position.y=-.1;g.add(stripe);
 g.traverse(n=>{if(n.isMesh){n.userData.rig=true;n.castShadow=true;}});return g;
}

// ---------- setup ----------
function init(){
 const canvas=$('#scene-canvas');renderer=new THREE.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(Math.min(2,devicePixelRatio));renderer.shadowMap.enabled=true;renderer.outputColorSpace=THREE.SRGBColorSpace;
 scene3d=new THREE.Scene();scene3d.background=new THREE.Color('#c9cfcc');scene3d.fog=new THREE.Fog('#c9cfcc',80,260);
 scene3d.add(new THREE.HemisphereLight('#ffffff','#7a8079',1.3));const sun=new THREE.DirectionalLight('#ffffff',1.6);sun.position.set(18,30,12);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-40,right:40,top:40,bottom:-40,far:120});scene3d.add(sun);
 ground=new THREE.Mesh(new THREE.PlaneGeometry(400,400),new THREE.MeshStandardMaterial({color:'#b9bfbb',roughness:1}));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene3d.add(ground);
 grid=new THREE.GridHelper(200,100,'#8d958f','#a8afaa');grid.position.y=.01;scene3d.add(grid);
 editCam=new THREE.PerspectiveCamera(50,1,.1,800);editCam.position.set(18,14,22);
 shotCam=new THREE.PerspectiveCamera(40,16/9,.1,800);helper=new THREE.CameraHelper(shotCam);helper.setColors?.(new THREE.Color(ACCENT),new THREE.Color(ACCENT),new THREE.Color('#ffffff'),new THREE.Color('#ffffff'),new THREE.Color('#ffffff'));scene3d.add(helper);
 camRig=buildRig();scene3d.add(camRig);
 aimDot=new THREE.Mesh(new THREE.SphereGeometry(.2,18,12),new THREE.MeshStandardMaterial({color:ACCENT,emissive:ACCENT,emissiveIntensity:.5}));aimDot.userData.aim=true;scene3d.add(aimDot);
 paths=new THREE.Group();scene3d.add(paths);
 controls=new OrbitControls(editCam,canvas);controls.target.set(0,2,0);controls.enableDamping=true;controls.maxPolarAngle=Math.PI*.495;controls.screenSpacePanning=true;
 shotControls=new OrbitControls(shotCam,canvas);shotControls.enabled=false;shotControls.enableDamping=true;shotControls.rotateSpeed=.6;shotControls.screenSpacePanning=true;
 shotControls.addEventListener('end',()=>{if(view==='camera'&&!playing)storeCamera(round(shotCam.position),round(shotControls.target),true);});
 const vp=$('#scene-viewport');vp.addEventListener('pointerenter',()=>overViewport=true);vp.addEventListener('pointerleave',()=>overViewport=false);
 window.addEventListener('keydown',onKey);window.addEventListener('keyup',e=>{const k=e.key.toLowerCase();if(held.delete(k)&&view==='camera'&&!held.size&&!['shift'].includes(k))storeCamera(round(shotCam.position),round(shotControls.target),true);});window.addEventListener('blur',()=>held.clear());
 new ResizeObserver(resize).observe(vp);resize();
 canvas.addEventListener('pointerdown',onDown);canvas.addEventListener('pointermove',onMove);window.addEventListener('pointerup',onUp);
 renderer.setAnimationLoop(frame);
}
function onKey(e){
 if(e.target.closest('input,textarea,select,button'))return;const k=e.key.toLowerCase();
 if(overViewport&&['w','a','s','d','q','e','arrowup','arrowdown','arrowleft','arrowright'].includes(k)){held.add(k);e.preventDefault();return;}
 if(k==='shift'){held.add(k);return;}
 if(overViewport&&k==='f'){frameAll();e.preventDefault();return;}
 if(overViewport&&k===' '){togglePlay();e.preventDefault();return;}
 if(!selected||selected==='camera')return;
 if(e.key==='Delete'||e.key==='Backspace'){remove(selected.id);e.preventDefault();}
 if(k==='r'){const step=e.shiftKey?-15:15;if(time>SNAP&&selected.motion?.length){const m=motionKeyHere(selected);if(m)m.rotation=((m.rotation+step)+540)%360-180;}else selected.rotation=((selected.rotation+step)+540)%360-180;apply(selected);renderInspector();changed();}
}
function viewportSize(){const vp=$('#scene-viewport');return {w:vp.clientWidth,h:vp.clientHeight};}
// Canvas buffer uses on-screen pixels (sharp under interface zoom); overlays use CSS pixels.
function resize(){const box=$('#scene-viewport').getBoundingClientRect();renderer.setSize(box.width,box.height,false);editCam.aspect=box.width/box.height;editCam.updateProjectionMatrix();layoutFrame();}
function layoutFrame(){const frame=$('#scene-frame'),{w:bw,h:bh}=viewportSize(),[w,h]=SIZES[doc?.aspect??'landscape'],r=Math.min(bw/w,bh/h)*.94;frame.style.setProperty('--fw',w*r+'px');frame.style.setProperty('--fh',h*r+'px');frame.hidden=view!=='camera';}
// Opening view: just behind and above the shot camera, so you see the camera and what it frames.
function frameShot(){if(!doc)return;const k=cameraAt(time),cam=new THREE.Vector3(...k.position),tgt=new THREE.Vector3(...k.target),back=cam.clone().sub(tgt);const len=Math.max(4,back.length());back.normalize();const pos=cam.clone().addScaledVector(back,Math.min(14,len*.8)+4);pos.y=Math.max(cam.y+3,pos.y+3);controls.target.copy(cam.clone().lerp(tgt,.55));editCam.position.copy(pos);controls.update();}
function frameAll(){const box=new THREE.Box3();const all=doc?.objects??[];const near=all.filter(o=>Math.max(...o.scale)<=30);for(const o of (near.length?near:all)){const g=meshes.get(o.id);if(g)box.expandByObject(g);}if(box.isEmpty()){editCam.position.set(14,10,18);controls.target.set(0,1.5,0);return;}
 const c=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3()),radius=Math.max(3,Math.min(60,size.length()/2));c.y=Math.min(c.y,radius*.35+1);
 const dir=new THREE.Vector3(.9,.7,1.25).normalize(),dist=radius/Math.sin(deg(editCam.fov)/2)*.9;controls.target.copy(c);editCam.position.copy(c).addScaledVector(dir,dist);controls.update();}

// ---------- views & time ----------
function enterCamera(){const k=cameraAt(time);placeShot(k);shotControls.target.set(...k.target);shotControls.update();}
function setView(v){view=v;controls.enabled=v==='edit';shotControls.enabled=v==='camera';if(v==='camera')enterCamera();for(const x of document.querySelectorAll('[data-view]'))x.setAttribute('aria-pressed',String(x.dataset.view===v));$('#shot-lens').hidden=v!=='camera';syncLens();hint();layoutFrame();}
function hint(){const at=time>SNAP?` · at ${time.toFixed(1)} s, moving things records a key`:'';$('#scene-hint').textContent=view==='camera'?`Looking through the camera · drag to aim · right-drag to slide · scroll to dolly · W A S D move, Q E down/up${at}`:`Drag empty space to orbit · right-drag to pan · scroll to zoom · W A S D fly · F frames everything · drag the camera or the yellow aim dot${at}`;}
const fovToMm=f=>Math.round(12/Math.tan(deg(f)/2)),mmToFov=mm=>Math.round(THREE.MathUtils.radToDeg(2*Math.atan(12/mm))*10)/10;
function syncLens(){if(!doc)return;const mm=fovToMm(cameraAt(time).fov);$('#shot-lens-range').value=String(Math.max(14,Math.min(135,mm)));$('#shot-lens-value').textContent=mm+' mm';}
function setTime(t,{fromPlay=false}={}){time=Math.max(0,Math.min(timelineMax,t));applyAll();if(view==='camera'&&!fromPlay)enterCamera();$('#time-range').value=String(time);$('#time-value').textContent=time.toFixed(1)+' s';if(!fromPlay){hint();syncLens();highlightKeys();if(selected&&selected!=='camera')renderInspector();}}
function togglePlay(){if(playing){playing=null;$('#time-play').textContent='▶ Play';$('#time-play').setAttribute('aria-pressed','false');setTime(time);return;}const end=duration();const from=time>=end-.05?0:time;playing={start:performance.now()-from*1000,end};$('#time-play').textContent='❚❚ Pause';$('#time-play').setAttribute('aria-pressed','true');}
function fly(dt){if(!held.size)return;const cam=view==='camera'?shotCam:editCam,ctl=view==='camera'?shotControls:controls,speed=(held.has('shift')?18:7)*dt,fwd=new THREE.Vector3();cam.getWorldDirection(fwd);fwd.y=0;if(fwd.lengthSq()<1e-6)fwd.set(0,0,-1);fwd.normalize();const right=new THREE.Vector3().crossVectors(fwd,new THREE.Vector3(0,1,0)),move=new THREE.Vector3();
 if(held.has('w')||held.has('arrowup'))move.add(fwd);if(held.has('s')||held.has('arrowdown'))move.sub(fwd);if(held.has('d')||held.has('arrowright'))move.add(right);if(held.has('a')||held.has('arrowleft'))move.sub(right);if(held.has('e'))move.y+=1;if(held.has('q'))move.y-=1;if(!move.lengthSq())return;move.normalize().multiplyScalar(speed);cam.position.add(move);ctl.target.add(move);if(cam.position.y<.2){const d=.2-cam.position.y;cam.position.y+=d;ctl.target.y+=d;}}
function frame(now){
 const dt=Math.min(.1,(now-(lastFrame||now))/1000);lastFrame=now;
 if(!doc){renderer.render(scene3d,editCam);return;}
 if(playing){const t=(performance.now()-playing.start)/1000;setTime(Math.min(t,playing.end),{fromPlay:true});placeShot(cameraAt(time));if(t>=playing.end)togglePlay();}
 else if(view!=='camera')placeShot(cameraAt(time));
 fly(dt);if(view==='camera'&&!playing)shotControls.update();else controls.update();
 const editing=view==='edit';helper.visible=editing;camRig.visible=editing;aimDot.visible=editing;paths.visible=editing;
 if(editing){camRig.position.copy(shotCam.position);camRig.quaternion.copy(shotCam.quaternion);const s=Math.max(1,editCam.position.distanceTo(shotCam.position)/18);camRig.scale.setScalar(s);aimDot.position.set(...cameraAt(time).target);aimDot.scale.setScalar(s);}
 if(view==='camera'){const {w:bw,h:bh}=viewportSize();shotCam.aspect=bw/bh;const [w,h]=SIZES[doc.aspect];const fit=Math.min(bw/w,bh/h);const keep=shotCam.fov;const vertical=2*Math.atan(Math.tan(deg(keep)/2)*(bh/(h*fit*.94)));shotCam.fov=THREE.MathUtils.radToDeg(vertical);shotCam.updateProjectionMatrix();renderer.render(scene3d,shotCam);shotCam.fov=keep;shotCam.updateProjectionMatrix();}
 else renderer.render(scene3d,editCam);
 drawTags();
}
function drawPaths(){if(!paths)return;paths.clear();const line=(pts,color,dashed)=>{if(pts.length<2)return;const geo=new THREE.BufferGeometry().setFromPoints(pts.map(p=>new THREE.Vector3(...p)));const mat=dashed?new THREE.LineDashedMaterial({color,dashSize:.4,gapSize:.25}):new THREE.LineBasicMaterial({color});const l=new THREE.Line(geo,mat);if(dashed)l.computeLineDistances();paths.add(l);};
 const dotGeo=new THREE.SphereGeometry(.14,10,8);
 for(const o of doc.objects){if(!o.motion?.length)continue;const pts=keysOf(o).map(k=>[k.position[0],.06,k.position[2]]);line(pts,ACCENT);for(const p of pts){const d=new THREE.Mesh(dotGeo,new THREE.MeshBasicMaterial({color:ACCENT}));d.position.set(...p);paths.add(d);}}
 line(doc.camera.keys.map(k=>k.position),'#ffffff',true);}
function drawTags(){const layer=$('#scene-tags');if(!$('#scene-labels').checked||!doc||view!=='edit'){layer.replaceChildren();return;}const {w,h}=viewportSize();
 const items=[...doc.objects,{camera:true}];while(layer.children.length>items.length)layer.lastChild.remove();while(layer.children.length<items.length)layer.append(document.createElement('span'));
 items.forEach((o,i)=>{const el=layer.children[i];let p,label,cls;if(o.camera){p=shotCam.position.clone().add(new THREE.Vector3(0,.7*camRig.scale.x,0)).project(editCam);label='Camera';cls='cam'+(selected==='camera'?' on':'');}else{const g=meshes.get(o.id);if(!g){el.hidden=true;return;}const b=new THREE.Box3().setFromObject(g);p=new THREE.Vector3((b.min.x+b.max.x)/2,b.max.y,(b.min.z+b.max.z)/2).project(editCam);label=(o.tag||KINDS[o.kind]?.label||'Model')+(o.motion?.length?' ⟿':'');cls=(selected?.id===o.id?'on ':'')+(o.tag||o.description?'':'untagged');}
  el.hidden=p.z>1;el.className=cls;if(el.textContent!==label)el.textContent=label;el.style.setProperty('--x',((p.x+1)/2*w)+'px');el.style.setProperty('--y',((1-p.y)/2*h)+'px');});}

// ---------- picking & dragging ----------
function hit(e){const r=e.target.getBoundingClientRect();pointer.set(((e.clientX-r.left)/r.width)*2-1,-((e.clientY-r.top)/r.height)*2+1);raycaster.setFromCamera(pointer,view==='camera'?shotCam:editCam);return raycaster;}
const planeAt=y=>new THREE.Plane(new THREE.Vector3(0,1,0),-y);
function motionKeyHere(o,create=false){o.motion??=[];let k=o.motion.find(k=>Math.abs(k.time-time)<SNAP);if(!k&&create){if(o.motion.length>=8){status('An object can have up to 8 motion keys.');return null;}const p=poseAt(o,time);k={time:r1(time),position:p.position.map(r2),rotation:r1(p.rotation)};o.motion.push(k);o.motion.sort((a,b)=>a.time-b.time);}return k;}
function onDown(e){if(view!=='edit'||e.button!==0)return;const ray=hit(e),hits=ray.intersectObjects([camRig,aimDot,...meshes.values()],true);if(!hits.length)return;
 let n=hits[0].object;const start=()=>{controls.enabled=false;e.target.setPointerCapture(e.pointerId);};
 if(n.userData.rig){select('camera');const y=shotCam.position.y,p=ray.ray.intersectPlane(planeAt(y),new THREE.Vector3());if(!p)return;const k=cameraAt(time);dragging={kind:'camera',y,from:[p.x,p.z],pos:[...k.position],target:[...k.target]};start();return;}
 if(n.userData.aim){select('camera');const k=cameraAt(time),y=k.target[1],p=ray.ray.intersectPlane(planeAt(y),new THREE.Vector3());if(!p)return;dragging={kind:'aim',y,from:[p.x,p.z],pos:[...k.position],target:[...k.target]};start();return;}
 while(n&&!n.userData.id)n=n.parent;const o=doc.objects.find(o=>o.id===n.userData.id);select(o);const p=ray.ray.intersectPlane(planeAt(0),new THREE.Vector3()),cur=poseAt(o,time).position;
 dragging={kind:'object',o,offset:p?[cur[0]-p.x,cur[2]-p.z]:[0,0],key:time>SNAP?undefined:null};start();}
function onMove(e){if(!dragging)return;const d=dragging,p=hit(e).ray.intersectPlane(planeAt(d.kind==='object'?0:d.y),new THREE.Vector3());if(!p)return;
 if(d.kind==='object'){const x=r1(p.x+d.offset[0]),z=r1(p.z+d.offset[1]);if(d.key===undefined)d.key=motionKeyHere(d.o,true);if(d.key===null)d.o.position=[x,0,z];else if(d.key)d.key.position=[x,0,z];apply(d.o);d.moved=true;return;}
 const dx=p.x-d.from[0],dz=p.z-d.from[1];
 if(d.kind==='camera'){const pos=[d.pos[0]+dx,d.pos[1],d.pos[2]+dz],tgt=[d.target[0]+dx,d.target[1],d.target[2]+dz];storeCamera(pos,tgt,false);}
 else storeCamera(d.pos,[d.target[0]+dx,d.target[1],d.target[2]+dz],false);d.moved=true;}
function onUp(){const d=dragging;if(!d)return;dragging=null;controls.enabled=view==='edit';if(!d.moved)return;
 if(d.kind==='object'&&d.key){const ks=keysOf(d.o),i=ks.indexOf(d.key),prev=ks[i-1];if(prev&&['character','car'].includes(d.o.kind)){const dx=d.key.position[0]-prev.position[0],dz=d.key.position[2]-prev.position[2];if(Math.hypot(dx,dz)>.2){const heading=r1(THREE.MathUtils.radToDeg(Math.atan2(dx,dz)));d.key.rotation=heading;if(i===1&&!d.o.motion.slice(1).length)d.o.rotation=heading;apply(d.o);}}}
 renderInspector();renderKeys();drawPaths();changed();}

// ---------- panels ----------
function select(o){selected=o;renderInspector();for(const li of document.querySelectorAll('[data-object]'))li.setAttribute('aria-current',String(o==='camera'?li.dataset.object==='camera':li.dataset.object===o?.id));}
function renderOutliner(){if(doc)$('#scene-empty').hidden=doc.objects.length>0;
 $('#scene-outliner').innerHTML=`<li><button type="button" data-object="camera" aria-current="${selected==='camera'}"><span aria-hidden="true">◧</span><b>Shot camera</b><small>${tracked()?(tracked().mode==='look'?'Looks at ':'Follows ')+esc(tracked().o.tag||KINDS[tracked().o.kind]?.label):doc.camera.keys.length+' key'+(doc.camera.keys.length>1?'s':'')}</small></button></li>`+(doc.objects.map(o=>`<li><button type="button" data-object="${o.id}" aria-current="${selected?.id===o.id}"><span aria-hidden="true">${KINDS[o.kind]?.icon??'◆'}</span><b>${esc(o.tag||KINDS[o.kind]?.label||'Model')}${o.motion?.length?' <i title="Moves over time">⟿</i>':''}</b><small>${esc(o.description||'Not tagged yet')}</small></button></li>`).join('')||'<li class="scene-note">Add a building or a person to start.</li>');
 for(const b of document.querySelectorAll('[data-object]'))b.onclick=()=>select(b.dataset.object==='camera'?'camera':doc.objects.find(o=>o.id===b.dataset.object));}
function trackOptions(){const t=doc.camera.track;return `<option value="">Moves freely</option>`+doc.objects.flatMap(o=>{const name=esc(o.tag||KINDS[o.kind]?.label||'Model');return [`<option value="look:${o.id}" ${t?.object===o.id&&t.mode==='look'?'selected':''}>Keeps ${name} in view</option>`,`<option value="follow:${o.id}" ${t?.object===o.id&&t.mode==='follow'?'selected':''}>Travels with ${name}</option>`];}).join('');}
function setTrack(value){if(!value)delete doc.camera.track;else{const [mode,object]=value.split(':');doc.camera.track={mode,object};}renderOutliner();renderTrack();if(view==='camera')enterCamera();drawPaths();changed();}
function renderTrack(){$('#cam-track').innerHTML=trackOptions();if(selected==='camera')renderInspector();}
function renderInspector(){const box=$('#scene-inspector');
 if(selected==='camera'){const k=cameraAt(time),i=keyIndexAt();box.innerHTML=`<h2>Shot camera</h2><p class="scene-note">Drag the camera body to move it and the yellow dot to aim it. ${time>SNAP?`At ${time.toFixed(1)} s this ${i>=0?'edits key '+(i+1):'adds a new key'}.`:'At 0 s this sets the opening frame.'}</p><div class="scene-grid3"><label>Height<input id="cam-y" type="number" step=".1" min=".2" max="80" value="${r2(k.position[1])}"></label><label>Aim height<input id="cam-ty" type="number" step=".1" min="0" max="80" value="${r2(k.target[1])}"></label><label>Lens mm<input id="cam-mm" type="number" step="1" min="14" max="135" value="${fovToMm(k.fov)}"></label></div><label>Camera behaviour<select id="cam-track-2">${trackOptions()}</select></label><div class="scene-row"><button type="button" id="cam-look">Look through camera</button></div>`;
  $('#cam-y').onchange=e=>{const c=cameraAt(time);storeCamera([c.position[0],Math.max(.2,Number(e.target.value)||1.6),c.position[2]],c.target,true);};
  $('#cam-ty').onchange=e=>{const c=cameraAt(time);storeCamera(c.position,[c.target[0],Math.max(0,Number(e.target.value)||1),c.target[2]],true);};
  $('#cam-mm').onchange=e=>{const kk=cameraKeyHere();kk.fov=mmToFov(Math.max(14,Math.min(135,Number(e.target.value)||35)));renderKeys();syncLens();changed();};
  $('#cam-track-2').onchange=e=>setTrack(e.target.value);$('#cam-look').onclick=()=>setView('camera');return;}
 if(!selected){box.innerHTML='<h2>Select an object</h2><p class="scene-note">Click a stand-in to tag it. The tag and description tell the image model what each grey shape should become. Click the camera to move or aim it.</p>';return;}const o=selected,pose=poseAt(o,time),moving=o.motion?.length;
 box.innerHTML=`<h2>${esc(KINDS[o.kind]?.label??'Model')}</h2><label>Tag<input data-f="tag" maxlength="40" value="${esc(o.tag)}" placeholder="Mira, Hero car, Bakery"></label><label>What it is<textarea data-f="description" maxlength="160" rows="3" placeholder="a young woman in a yellow raincoat holding an umbrella">${esc(o.description)}</textarea></label><div class="scene-grid3"><label>X<input data-p="0" type="number" step=".1" value="${r2(pose.position[0])}"></label><label>Z<input data-p="2" type="number" step=".1" value="${r2(pose.position[2])}"></label><label>Turn°<input data-f="rotation" type="number" step="5" value="${r1(pose.rotation)}"></label></div><div class="scene-grid3"><label>Width<input data-s="0" type="number" step=".1" min=".05" value="${o.scale[0]}"></label><label>Height<input data-s="1" type="number" step=".1" min=".05" value="${o.scale[1]}"></label><label>Depth<input data-s="2" type="number" step=".1" min=".05" value="${o.scale[2]}"></label></div><label class="scene-color">Colour in the layout<input data-f="color" type="color" value="${o.color}"></label>
 <div class="scene-motion"><h3>Motion</h3>${moving?`<ol>${keysOf(o).map((k,i)=>`<li><button type="button" data-mt="${k.time}">${k.time.toFixed(1)} s</button><span>${r1(k.position[0])}, ${r1(k.position[2])}</span>${i?`<button type="button" data-mdel="${i-1}" aria-label="Delete motion key at ${k.time} seconds">✕</button>`:''}</li>`).join('')}</ol><button type="button" id="motion-clear">Stop it moving</button>`:`<p class="scene-note">To make it walk or drive: move the time slider below, then drag it to where it should be at that moment. Its path appears on the ground.</p>`}<button type="button" id="motion-here">${time>SNAP?`Add a key at ${time.toFixed(1)} s`:'Move the time slider to add motion'}</button></div>
 <div class="scene-row"><button type="button" id="obj-dup">Duplicate</button><button type="button" id="obj-track">Camera keeps it in view</button><button type="button" id="obj-del">Remove</button></div>`;
 for(const el of box.querySelectorAll('input,textarea'))el.oninput=()=>{const target=time>SNAP&&moving?motionKeyHere(o,true):null;
  if(el.dataset.f==='rotation'){if(target)target.rotation=Number(el.value);else o.rotation=Number(el.value);}else if(el.dataset.f)o[el.dataset.f]=el.type==='number'?Number(el.value):el.value;
  if(el.dataset.p){const pos=target?target.position:o.position;pos[Number(el.dataset.p)]=Number(el.value);}
  if(el.dataset.s)o.scale[Number(el.dataset.s)]=Math.max(.05,Number(el.value)||.05);apply(o);if(['tag','description'].includes(el.dataset.f)){renderOutliner();renderTrack();}if(el.dataset.p)drawPaths();changed();};
 for(const b of box.querySelectorAll('[data-mt]'))b.onclick=()=>setTime(Number(b.dataset.mt));
 for(const b of box.querySelectorAll('[data-mdel]'))b.onclick=()=>{o.motion.splice(Number(b.dataset.mdel),1);if(!o.motion.length)delete o.motion;apply(o);drawPaths();renderInspector();renderOutliner();highlightKeys();changed();};
 $('#motion-clear')?.addEventListener('click',()=>{delete o.motion;apply(o);drawPaths();renderInspector();renderOutliner();highlightKeys();changed();});
 const here=$('#motion-here');here.disabled=time<=SNAP;here.onclick=()=>{motionKeyHere(o,true);drawPaths();renderInspector();renderOutliner();highlightKeys();changed();};
 $('#obj-track').onclick=()=>{setTrack('look:'+o.id);status('The camera now keeps '+(o.tag||KINDS[o.kind]?.label)+' in view. Change it under Camera.');};
 $('#obj-dup').onclick=()=>{const copy={...structuredClone(o),id:uid(),position:[o.position[0]+2,0,o.position[2]+2]};delete copy.motion;doc.objects.push(copy);addObject(copy);renderOutliner();renderTrack();select(copy);changed();};
 $('#obj-del').onclick=()=>remove(o.id);
}
function remove(id){const g=meshes.get(id);scene3d.remove(g);meshes.delete(id);doc.objects=doc.objects.filter(o=>o.id!==id);if(doc.camera.track?.object===id)delete doc.camera.track;select(null);renderOutliner();renderTrack();drawPaths();changed();}
function create(kind,extra={}){const k=KINDS[kind]??KINDS.box,t=controls.target;const o={id:uid(),kind,tag:'',description:'',position:[r1(t.x),0,r1(t.z)],rotation:0,scale:[...(k.scale)],color:k.color,...extra};doc.objects.push(o);addObject(o);renderOutliner();renderTrack();select(o);changed();return o;}
function status(text){$('#scene-saved').textContent=text;}

// ---------- timeline ----------
function renderKeys(){timelineMax=Math.max(timelineMax,Math.ceil(duration()));$('#time-range').max=String(timelineMax);$('#time-length').value=String(timelineMax);
 $('#scene-keys').innerHTML=doc.camera.keys.map((k,i)=>`<div class="scene-key" data-key="${i}"><button type="button" data-goto="${i}" title="Jump to this key">◆ ${i===0?'Start':'Key '+(i+1)}</button><label>at<input type="number" step=".5" min="0" max="${MAX_TIME}" data-time="${i}" value="${k.time}" ${i===0?'disabled':''}>s</label><label>lens<input type="number" step="1" min="14" max="135" data-mm="${i}" value="${fovToMm(k.fov)}">mm</label>${i?`<button type="button" data-del="${i}" aria-label="Delete key ${i+1}">✕</button>`:''}</div>`).join('');
 for(const el of document.querySelectorAll('[data-time]'))el.onchange=()=>{doc.camera.keys[Number(el.dataset.time)].time=Math.max(.5,Math.min(MAX_TIME,Number(el.value)||1));doc.camera.keys.sort((a,b)=>a.time-b.time);renderKeys();changed();};
 for(const el of document.querySelectorAll('[data-mm]'))el.onchange=()=>{doc.camera.keys[Number(el.dataset.mm)].fov=mmToFov(Math.max(14,Math.min(135,Number(el.value)||35)));syncLens();if(view==='camera')enterCamera();changed();};
 for(const b of document.querySelectorAll('[data-goto]'))b.onclick=()=>setTime(doc.camera.keys[Number(b.dataset.goto)].time);
 for(const b of document.querySelectorAll('[data-del]'))b.onclick=()=>{doc.camera.keys.splice(Number(b.dataset.del),1);renderKeys();drawPaths();changed();};
 highlightKeys();}
function highlightKeys(){if(!doc)return;const i=keyIndexAt();for(const el of document.querySelectorAll('[data-key]'))el.classList.toggle('active',Number(el.dataset.key)===i);
 const marks=[...doc.camera.keys.map(k=>({t:k.time,c:'cam'})),...doc.objects.flatMap(o=>(o.motion??[]).map(k=>({t:k.time,c:selected?.id===o.id?'obj on':'obj'})))];
 $('#time-marks').innerHTML=marks.map(m=>`<i class="${m.c}" data-t="${m.t}"></i>`).join('');for(const el of $('#time-marks').children)el.style.setProperty('--t',(Number(el.dataset.t)/timelineMax*100)+'%');
 const k=keyIndexAt();$('#key-add').textContent=k>=0?`Put camera key ${k+1} where the edit view is`:`＋ Camera key here (${time.toFixed(1)} s) from the edit view`;}

// ---------- saving & loading ----------
function changed(){$('#scene-saved').textContent='Saving…';clearTimeout(saveTimer);saveTimer=setTimeout(save,900);}
async function save(){try{doc.style=$('#scene-style').value;const saved=await api('/api/scenes',doc);doc.id=saved.id;doc.revision=saved.revision;$('#scene-saved').textContent='Saved';const u=new URL(location.href);u.searchParams.set('scene',doc.id);history.replaceState(null,'',u);refreshList(false);}catch(error){$('#scene-saved').textContent=error.message;}}
let list=[];async function refreshList(load=true){list=await api('/api/scenes');$('#scene-select').innerHTML=(doc&&!doc.id?'<option value="">Unsaved scene</option>':'')+list.map(s=>`<option value="${s.id}" ${s.id===doc?.id?'selected':''}>${esc(s.name)}</option>`).join('');if(load){const want=new URLSearchParams(location.search).get('scene');const s=list.find(s=>s.id===want)??list[0];open(s?structuredClone(s):blank());}}
function blank(name='My scene'){return {name,aspect:'landscape',style:'',objects:[],camera:{keys:[{time:0,position:[14,6,18],target:[0,2,0],fov:40}]}};}
function preset(id){const p=SCENE_PRESETS.find(p=>p.id===id)??SCENE_PRESETS[0];const d=blank(p.name);d.aspect=p.aspect;d.style=p.style;const ids=new Map();d.objects=p.objects.map((o,i)=>{const n={...structuredClone(o),id:uid(),color:o.color??KINDS[o.kind]?.color??'#b3a28c'};ids.set(o.ref??i,n.id);delete n.ref;return n;});d.camera.keys=structuredClone(p.keys);if(p.track)d.camera.track={mode:p.track.mode,object:ids.get(p.track.ref)};open(d);changed();$('#scene-presets').open=false;}
function presetMarkup(){return SCENE_PRESETS.map(p=>`<button type="button" data-preset="${p.id}"><b>${esc(p.name)}</b><small>${esc(p.hint)}</small></button>`).join('');}
function open(d){doc=d;time=0;playing=null;timelineMax=Math.max(8,Math.ceil(duration()));if(view==='camera')setView('edit');$('#scene-style').value=d.style??'';for(const b of document.querySelectorAll('[data-aspect]'))b.setAttribute('aria-pressed',String(b.dataset.aspect===d.aspect));rebuild();renderTrack();renderKeys();setTime(0);layoutFrame();refreshListOptions();$('#scene-empty').hidden=d.objects.length>0;requestAnimationFrame(()=>d.objects.length?frameShot():frameAll());}
function refreshListOptions(){if(!doc.id&&!$('#scene-select option[value=""]'))$('#scene-select').insertAdjacentHTML('afterbegin','<option value="" selected>Unsaved scene</option>');}

// ---------- rendering ----------
function atTime(t,fn){const keep=time;time=t;applyAll();try{return fn();}finally{time=keep;applyAll();}}
// Layout boxes for tagged objects, in 0–1 image coordinates, from the shot camera at time 0.
export function layoutBoxes(){return atTime(0,()=>{const [w,h]=SIZES[doc.aspect];placeShot(cameraAt(0),w/h);shotCam.updateMatrixWorld();const out=[];
 for(const o of doc.objects){if(!o.tag&&!o.description)continue;const b=new THREE.Box3().setFromObject(meshes.get(o.id));const pts=[];for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z]){const p=new THREE.Vector3(x,y,z).applyMatrix4(shotCam.matrixWorldInverse);if(p.z>-.05)continue;p.applyMatrix4(shotCam.projectionMatrix);pts.push(p);}
  if(pts.length<2)continue;const xs=pts.map(p=>(p.x+1)/2),ys=pts.map(p=>(1-p.y)/2),x0=Math.max(0,Math.min(...xs)),x1=Math.min(1,Math.max(...xs)),y0=Math.max(0,Math.min(...ys)),y1=Math.min(1,Math.max(...ys));
  if(x1-x0<.01||y1-y0<.01)continue;out.push({objectId:o.id,x:+x0.toFixed(4),y:+y0.toFixed(4),width:+(x1-x0).toFixed(4),height:+(y1-y0).toFixed(4)});}
 return out.slice(0,16);});}
const hideHelpers=()=>{grid.visible=helper.visible=camRig.visible=aimDot.visible=paths.visible=false;};
function renderClay(t,size){const [w,h]=size;const prev=new THREE.Vector2();renderer.getSize(prev);const ratio=renderer.getPixelRatio();renderer.setPixelRatio(1);renderer.setSize(w,h,false);hideHelpers();atTime(t,()=>{placeShot(cameraAt(t),w/h);renderer.render(scene3d,shotCam);});return ()=>{grid.visible=true;renderer.setPixelRatio(ratio);renderer.setSize(prev.x,prev.y,false);};}
async function renderStill(){
 if(!doc.objects.some(o=>o.tag||o.description))throw Error('Tag at least one object so the model knows what it is.');
 await save();if(!doc.id)throw Error('Save the scene first.');
 const size=SIZES[doc.aspect],boxes=layoutBoxes();if(!boxes.length)throw Error('No tagged object is in the camera view at 0 s. Frame the shot so they show.');
 const restore=renderClay(0,size);const blob=await new Promise(r=>renderer.domElement.toBlob(r,'image/png'));restore();
 const asset=await fetch('/api/assets',{method:'POST',body:blob,headers:{'Content-Type':'image/png','X-Frameforge-Source':'scene'}}).then(async r=>{const v=await r.json();if(!r.ok)throw Error(v.error);return v;});
 const result=await api('/api/scenes/'+doc.id+'/still',{asset:asset.name,boxes});
 return {...result,layout:asset.url,boxes};
}
async function renderClip(){
 await save();const total=duration(),size=SIZES[doc.aspect],moves=doc.camera.keys.length>1||doc.objects.some(o=>o.motion?.length)||tracked();
 if(!moves)throw Error('Nothing moves yet. Add a second camera key or give an object motion.');
 if(playing)togglePlay();const canvas=renderer.domElement;const prev=new THREE.Vector2();renderer.getSize(prev);const ratio=renderer.getPixelRatio();renderer.setAnimationLoop(null);renderer.setPixelRatio(1);renderer.setSize(...size,false);hideHelpers();
 // Frames are pushed on a timer (not requestAnimationFrame), so recording also works in a
 // background or hidden window where animation frames pause.
 const stream=canvas.captureStream(0),track=stream.getVideoTracks()[0],type=['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'].find(t=>MediaRecorder.isTypeSupported(t));const rec=new MediaRecorder(stream,{mimeType:type,videoBitsPerSecond:8e6}),chunks=[];rec.ondataavailable=e=>chunks.push(e.data);
 const done=new Promise(r=>rec.onstop=r);rec.start();const start=performance.now(),keep=time;
 await new Promise(resolve=>{const step=()=>{const t=Math.min((performance.now()-start)/1000,total);time=t;applyAll();placeShot(cameraAt(t),size[0]/size[1]);renderer.render(scene3d,shotCam);track.requestFrame?.();if((performance.now()-start)/1000<total+.1)setTimeout(step,1000/30);else resolve();};step();});
 rec.stop();await done;time=keep;applyAll();grid.visible=true;renderer.setPixelRatio(ratio);renderer.setSize(prev.x,prev.y,false);renderer.setAnimationLoop(frame);
 const blob=new Blob(chunks,{type:'video/webm'});const footage=await fetch('/api/footage',{method:'POST',body:blob,headers:{'Content-Type':'video/webm','X-File-Name':encodeURIComponent(doc.name+' layout.webm')}}).then(async r=>{const v=await r.json();if(!r.ok)throw Error(v.error);return v;});
 return {footage,url:'/footage/'+footage.id+'/source.webm',duration:total};
}
let lastStill=null;
function results(){const box=$('#render-results');box.innerHTML=[lastStill?`<article><h3>Image</h3>${lastStill.image?`<img src="${lastStill.image}" alt="Rendered image from the scene">`:`<div class="scene-wait">Rendering on your ComfyUI…</div>`}<div class="scene-row"><a href="${lastStill.layout}" target="_blank" rel="noopener">Grey layout</a><a href="/workflows?job=${lastStill.job.id}">ComfyUI graph</a>${lastStill.asset?`<a href="/create?image=${lastStill.asset}">Animate it</a>`:''}</div></article>`:'',lastClip?`<article><h3>Layout clip</h3><video src="${lastClip.url}" controls muted playsinline></video><div class="scene-row"><a href="${lastClip.url}" download>Download</a><a class="primary" href="/native-workflows?workflow=ltx-layout&video=${encodeURIComponent(lastClip.url)}${lastStill?.image?'&image='+encodeURIComponent(lastStill.image):''}">Finish with Layout to Render →</a></div><p class="scene-note">${lastStill?.image?'The rendered image becomes the styled first frame.':'Make the image first: Layout to Render uses it as the styled first frame.'}</p></article>`:''].join('');}
let lastClip=null;
async function poll(){if(!lastStill||lastStill.image)return;const job=await api('/api/jobs/'+lastStill.job.id).catch(()=>null);if(job?.report?.technicalPass&&job.image){lastStill.image=`/outputs/${job.id}/${job.image}`;try{const a=await api('/api/jobs/'+job.id+'/image-asset',{});lastStill.asset=a.name;}catch{}$('#render-status').textContent='Image ready.';results();return;}if(job&&['failed','technical-failed','verification-blocked','cancelled','needs-attention'].includes(job.status)){$('#render-status').textContent='The render stopped: '+(job.error??job.status);return;}setTimeout(poll,3000);}

function wire(){
 $('#scene-palette').innerHTML=Object.entries(KINDS).map(([k,v])=>`<button type="button" data-kind="${k}"><span aria-hidden="true">${v.icon}</span>${v.label}</button>`).join('');
 for(const b of document.querySelectorAll('[data-kind]'))b.onclick=()=>create(b.dataset.kind);
 for(const b of document.querySelectorAll('[data-view]'))b.onclick=()=>setView(b.dataset.view);
 $('#scene-frame-all').onclick=frameAll;
 $('#shot-lens-range').oninput=e=>{const k=cameraKeyHere();k.fov=mmToFov(Number(e.target.value));$('#shot-lens-value').textContent=e.target.value+' mm';enterCamera();};$('#shot-lens-range').onchange=()=>{renderKeys();changed();};
 $('#scene-preset-list').innerHTML=presetMarkup();$('#scene-empty-list').innerHTML=presetMarkup();for(const b of document.querySelectorAll('[data-preset]'))b.onclick=()=>preset(b.dataset.preset);
 for(const b of document.querySelectorAll('[data-aspect]'))b.onclick=()=>{doc.aspect=b.dataset.aspect;for(const x of document.querySelectorAll('[data-aspect]'))x.setAttribute('aria-pressed',String(x===b));layoutFrame();changed();};
 $('#time-range').oninput=e=>{if(playing)togglePlay();setTime(Number(e.target.value));};
 $('#time-play').onclick=togglePlay;
 $('#time-length').onchange=e=>{timelineMax=Math.max(Math.ceil(duration()),Number(e.target.value));renderKeys();setTime(Math.min(time,timelineMax));};
 $('#cam-track').onchange=e=>setTrack(e.target.value);
 $('#key-add').onclick=()=>{storeCamera(round(editCam.position),round(controls.target),true);select('camera');};
 $('#scene-style').oninput=changed;
 $('#scene-new').onclick=()=>{open(blank());};
 $('#scene-select').onchange=()=>{const s=list.find(s=>s.id===$('#scene-select').value);if(s)open(structuredClone(s));};
 $('#scene-glb').onchange=async e=>{const file=e.target.files?.[0];if(!file)return;try{if(file.size>80*1024**2)throw Error('Use a GLB under 80 MB.');const gltf=await new GLTFLoader().parseAsync(await file.arrayBuffer(),'');const root=gltf.scene;const b=new THREE.Box3().setFromObject(root),s=b.getSize(new THREE.Vector3()),k=1/Math.max(s.x,s.y,s.z);root.scale.setScalar(k);root.position.set(-(b.min.x+b.max.x)/2*k,-b.min.y*k,-(b.min.z+b.max.z)/2*k);const wrap=new THREE.Group();wrap.add(root);glbCache.set(file.name,wrap);create('glb',{file:file.name.slice(0,160),scale:[2,2,2],tag:file.name.replace(/\.glb$/i,'').slice(0,40)});}catch(error){$('#scene-saved').textContent=error.message;}e.target.value='';};
 $('#render-still').onclick=async()=>{const b=$('#render-still');b.disabled=true;$('#render-status').textContent='Rendering the grey layout and sending it to FLUX 3…';try{lastStill=await renderStill();$('#render-status').textContent='Rendering on your ComfyUI. Tagged objects become layout boxes: '+lastStill.boxes.length+'.';results();poll();}catch(error){$('#render-status').textContent=error.message;}finally{b.disabled=false;}};
 $('#render-clip').onclick=async()=>{const b=$('#render-clip');b.disabled=true;$('#render-status').textContent='Recording the camera and object motion in real time…';try{lastClip=await renderClip();$('#render-status').textContent='Layout clip saved ('+lastClip.duration.toFixed(1)+' s).';results();}catch(error){$('#render-status').textContent=error.message;}finally{b.disabled=false;}};
}
init();wire();refreshList().catch(error=>{open(blank());$('#scene-saved').textContent=error.message;});
