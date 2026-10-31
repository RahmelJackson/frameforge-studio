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
const uid=()=>Math.random().toString(36).slice(2,10);
let shotControls,activeKey=0,overViewport=false,lastFrame=0;const held=new Set();
let scene3d,renderer,editCam,shotCam,controls,ground,grid,helper,raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
let doc=null,selected=null,view='edit',saveTimer=null,dragging=null,playing=null;
const meshes=new Map(),glbCache=new Map();

function material(color){return new THREE.MeshStandardMaterial({color,roughness:.85,metalness:0});}
function build(o){
 const g=new THREE.Group(),m=material(o.color);
 const add=(geo,y=0,x=0,z=0)=>{const mesh=new THREE.Mesh(geo,m);mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;g.add(mesh);return mesh;};
 if(['building','wall','box'].includes(o.kind))add(new THREE.BoxGeometry(1,1,1),.5);
 else if(o.kind==='house'){add(new THREE.BoxGeometry(1,.62,1),.31);const roof=add(new THREE.ConeGeometry(.78,.38,4),.81);roof.rotation.y=Math.PI/4;}
 else if(o.kind==='character'){add(new THREE.CapsuleGeometry(.22,.85,6,12),.65);add(new THREE.SphereGeometry(.15,16,12),1.5);}
 else if(o.kind==='car'){add(new THREE.BoxGeometry(1.8,.6,4.2),.5);add(new THREE.BoxGeometry(1.5,.5,2.1),1.05,0,-.2);for(const [x,z] of [[-.8,1.3],[.8,1.3],[-.8,-1.3],[.8,-1.3]]){const w=add(new THREE.CylinderGeometry(.33,.33,.2,16),.33,x,z);w.rotation.z=Math.PI/2;}}
 else if(o.kind==='tree'){add(new THREE.CylinderGeometry(.15,.2,1.6,10),.8);add(new THREE.ConeGeometry(1.1,2.6,12),2.6);}
 else if(o.kind==='sphere')add(new THREE.SphereGeometry(.5,24,16),.5);
 else if(o.kind==='glb'){const cached=glbCache.get(o.file);if(cached){const c=cached.clone(true);c.traverse(n=>{if(n.isMesh){n.material=m;n.castShadow=n.receiveShadow=true;}});g.add(c);}else add(new THREE.BoxGeometry(1,1,1),.5);}
 g.userData.id=o.id;return g;
}
function apply(o){const g=meshes.get(o.id);g.position.set(o.position[0],0,o.position[2]);g.rotation.y=THREE.MathUtils.degToRad(o.rotation);g.scale.set(...o.scale);g.traverse(n=>{if(n.isMesh)n.material.color.set(o.color);});}
function addObject(o){const g=build(o);meshes.set(o.id,g);scene3d.add(g);apply(o);}
function rebuild(){for(const g of meshes.values())scene3d.remove(g);meshes.clear();for(const o of doc.objects)addObject(o);renderOutliner();select(null);}

function init(){
 const canvas=$('#scene-canvas');renderer=new THREE.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(Math.min(2,devicePixelRatio));renderer.shadowMap.enabled=true;renderer.outputColorSpace=THREE.SRGBColorSpace;
 scene3d=new THREE.Scene();scene3d.background=new THREE.Color('#c9cfcc');scene3d.fog=new THREE.Fog('#c9cfcc',60,180);
 scene3d.add(new THREE.HemisphereLight('#ffffff','#7a8079',1.3));const sun=new THREE.DirectionalLight('#ffffff',1.6);sun.position.set(18,30,12);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-40,right:40,top:40,bottom:-40,far:120});scene3d.add(sun);
 ground=new THREE.Mesh(new THREE.PlaneGeometry(400,400),new THREE.MeshStandardMaterial({color:'#b9bfbb',roughness:1}));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene3d.add(ground);
 grid=new THREE.GridHelper(200,100,'#8d958f','#a8afaa');grid.position.y=.01;scene3d.add(grid);
 editCam=new THREE.PerspectiveCamera(50,1,.1,800);editCam.position.set(18,14,22);
 shotCam=new THREE.PerspectiveCamera(40,16/9,.1,800);helper=new THREE.CameraHelper(shotCam);scene3d.add(helper);
 controls=new OrbitControls(editCam,canvas);controls.target.set(0,2,0);controls.enableDamping=true;controls.maxPolarAngle=Math.PI*.495;controls.screenSpacePanning=true;
 shotControls=new OrbitControls(shotCam,canvas);shotControls.enabled=false;shotControls.enableDamping=true;shotControls.rotateSpeed=.6;shotControls.screenSpacePanning=true;shotControls.addEventListener('change',()=>{if(view==='camera'&&!playing)storeShot(false);});shotControls.addEventListener('end',()=>{if(view==='camera')storeShot(true);});
 const vp=$('#scene-viewport');vp.addEventListener('pointerenter',()=>overViewport=true);vp.addEventListener('pointerleave',()=>overViewport=false);
 window.addEventListener('keydown',e=>{if(e.target.closest('input,textarea,select')||!overViewport)return;const k=e.key.toLowerCase();if(['w','a','s','d','q','e','arrowup','arrowdown','arrowleft','arrowright'].includes(k)){held.add(k);e.preventDefault();}else if(k==='shift')held.add(k);});window.addEventListener('keyup',e=>{const k=e.key.toLowerCase();if(held.delete(k)&&view==='camera'&&!held.size)storeShot(true);});window.addEventListener('blur',()=>held.clear());
 new ResizeObserver(resize).observe($('#scene-viewport'));resize();
 canvas.addEventListener('pointerdown',onDown);canvas.addEventListener('pointermove',onMove);window.addEventListener('pointerup',onUp);
 window.addEventListener('keydown',e=>{if(e.target.closest('input,textarea,select')||!selected)return;if(e.key==='Delete'||e.key==='Backspace'){remove(selected.id);e.preventDefault();}if(e.key==='r'||e.key==='R'){selected.rotation=((selected.rotation+(e.shiftKey?-15:15))+540)%360-180;apply(selected);renderInspector();changed();}});
 renderer.setAnimationLoop(frame);
}
function resize(){const box=$('#scene-viewport').getBoundingClientRect();renderer.setSize(box.width,box.height,false);editCam.aspect=box.width/box.height;editCam.updateProjectionMatrix();layoutFrame();}
function layoutFrame(){const frame=$('#scene-frame'),box=$('#scene-viewport').getBoundingClientRect(),[w,h]=SIZES[doc?.aspect??'landscape'],r=Math.min(box.width/w,box.height/h)*.94;frame.style.setProperty('--fw',w*r+'px');frame.style.setProperty('--fh',h*r+'px');frame.hidden=view!=='camera';}
function cameraAt(t){const keys=doc.camera.keys;if(t<=keys[0].time||keys.length===1)return keys[0];const last=keys.at(-1);if(t>=last.time)return last;const i=keys.findIndex(k=>k.time>t),a=keys[i-1],b=keys[i],u=(t-a.time)/(b.time-a.time),s=u*u*(3-2*u),mix=(p,q)=>p.map((v,j)=>v+(q[j]-v)*s);return {position:mix(a.position,b.position),target:mix(a.target,b.target),fov:a.fov+(b.fov-a.fov)*s};}
function enterCamera(){const k=doc.camera.keys[activeKey]??doc.camera.keys[0];placeShot(k);shotControls.target.set(...k.target);shotControls.update();}
function setView(v){view=v;controls.enabled=v==='edit';shotControls.enabled=v==='camera';if(v==='camera')enterCamera();for(const x of document.querySelectorAll('[data-view]'))x.setAttribute('aria-pressed',String(x.dataset.view===v));$('#scene-hint').textContent=v==='camera'?`Looking through the camera · drag to aim · right-drag to slide · scroll to dolly · W A S D to move, Q E down/up · changes save to key ${activeKey+1}`:'Drag empty space to orbit · right-drag to pan · scroll to zoom · W A S D to fly · drag an object to move it · R rotates · Delete removes';const lens=$('#shot-lens');lens.hidden=v!=='camera';syncLens();layoutFrame();renderKeys();}
const fovToMm=f=>Math.round(12/Math.tan(THREE.MathUtils.degToRad(f)/2)),mmToFov=mm=>Math.round(THREE.MathUtils.radToDeg(2*Math.atan(12/mm))*10)/10;
function syncLens(){const k=doc?.camera.keys[activeKey];if(!k)return;const mm=fovToMm(k.fov);$('#shot-lens-range').value=String(Math.max(14,Math.min(135,mm)));$('#shot-lens-value').textContent=mm+' mm';}
let storeTimer=0;function storeShot(save){const k=doc?.camera.keys[activeKey];if(!k)return;k.position=round(shotCam.position);k.target=round(shotControls.target);if(save){clearTimeout(storeTimer);storeTimer=setTimeout(()=>{renderKeys();changed();},150);}}
function placeShot(k,aspect){shotCam.position.set(...k.position);shotCam.lookAt(new THREE.Vector3(...k.target));shotCam.fov=k.fov;const [w,h]=SIZES[doc.aspect];shotCam.aspect=aspect??w/h;shotCam.updateProjectionMatrix();helper.update();}
function fly(dt){if(!held.size)return;const cam=view==='camera'?shotCam:editCam,ctl=view==='camera'?shotControls:controls,speed=(held.has('shift')?18:7)*dt,fwd=new THREE.Vector3();cam.getWorldDirection(fwd);fwd.y=0;if(fwd.lengthSq()<1e-6)fwd.set(0,0,-1);fwd.normalize();const right=new THREE.Vector3().crossVectors(fwd,new THREE.Vector3(0,1,0)),move=new THREE.Vector3();
 if(held.has('w')||held.has('arrowup'))move.add(fwd);if(held.has('s')||held.has('arrowdown'))move.sub(fwd);if(held.has('d')||held.has('arrowright'))move.add(right);if(held.has('a')||held.has('arrowleft'))move.sub(right);if(held.has('e'))move.y+=1;if(held.has('q'))move.y-=1;if(!move.lengthSq())return;move.normalize().multiplyScalar(speed);cam.position.add(move);ctl.target.add(move);if(cam.position.y<.2){const d=.2-cam.position.y;cam.position.y+=d;ctl.target.y+=d;}if(view==='camera')storeShot(false);}
function frame(time){
 const dt=Math.min(.1,(time-(lastFrame||time))/1000);lastFrame=time;
 if(playing){const t=(performance.now()-playing.start)/1000;placeShot(cameraAt(t));if(t>playing.end){playing=null;if(view==='camera')enterCamera();}}else if(doc&&view!=='camera')placeShot(doc.camera.keys[activeKey]??cameraAt(0));
 fly(dt);if(view==='camera'&&!playing)shotControls.update();else controls.update();helper.visible=view==='edit';
 if(view==='camera'){const box=$('#scene-viewport').getBoundingClientRect();shotCam.aspect=box.width/box.height;const [w,h]=SIZES[doc.aspect];const fit=Math.min(box.width/w,box.height/h);const keep=shotCam.fov;const vertical=2*Math.atan(Math.tan(THREE.MathUtils.degToRad(keep)/2)*(box.height/(h*fit*.94)));shotCam.fov=THREE.MathUtils.radToDeg(vertical);shotCam.updateProjectionMatrix();renderer.render(scene3d,shotCam);shotCam.fov=keep;shotCam.updateProjectionMatrix();}
 else renderer.render(scene3d,editCam);
 drawTags();
}
function drawTags(){const layer=$('#scene-tags');if(!$('#scene-labels').checked||!doc||view!=='edit'){layer.replaceChildren();return;}const box=$('#scene-viewport').getBoundingClientRect();
 while(layer.children.length>doc.objects.length)layer.lastChild.remove();while(layer.children.length<doc.objects.length)layer.append(document.createElement('span'));
 doc.objects.forEach((o,i)=>{const el=layer.children[i],g=meshes.get(o.id);if(!g){el.hidden=true;return;}const b=new THREE.Box3().setFromObject(g),p=new THREE.Vector3((b.min.x+b.max.x)/2,b.max.y,(b.min.z+b.max.z)/2).project(editCam);el.hidden=p.z>1;el.className=(selected?.id===o.id?'on ':'')+(o.tag||o.description?'':'untagged');const label=o.tag||KINDS[o.kind]?.label||'Model';if(el.textContent!==label)el.textContent=label;el.style.setProperty('--x',((p.x+1)/2*box.width)+'px');el.style.setProperty('--y',((1-p.y)/2*box.height)+'px');});}

function hit(e){const r=e.target.getBoundingClientRect();pointer.set(((e.clientX-r.left)/r.width)*2-1,-((e.clientY-r.top)/r.height)*2+1);raycaster.setFromCamera(pointer,view==='camera'?shotCam:editCam);return raycaster;}
function onDown(e){if(view!=='edit'||e.button!==0)return;const ray=hit(e),hits=ray.intersectObjects([...meshes.values()],true);if(!hits.length){return;}let n=hits[0].object;while(n&&!n.userData.id)n=n.parent;const o=doc.objects.find(o=>o.id===n.userData.id);select(o);const p=ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),0),new THREE.Vector3());dragging={o,offset:p?[o.position[0]-p.x,o.position[2]-p.z]:[0,0]};controls.enabled=false;e.target.setPointerCapture(e.pointerId);}
function onMove(e){if(!dragging)return;const p=hit(e).ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),0),new THREE.Vector3());if(!p)return;dragging.o.position=[Math.round((p.x+dragging.offset[0])*10)/10,0,Math.round((p.z+dragging.offset[1])*10)/10];apply(dragging.o);dragging.moved=true;}
function onUp(){if(dragging){if(dragging.moved){renderInspector();changed();}dragging=null;controls.enabled=true;}}

function select(o){selected=o;renderInspector();for(const li of document.querySelectorAll('[data-object]'))li.setAttribute('aria-current',String(li.dataset.object===o?.id));}
function renderOutliner(){if(doc)$('#scene-empty').hidden=doc.objects.length>0;$('#scene-outliner').innerHTML=doc.objects.map(o=>`<li><button type="button" data-object="${o.id}" aria-current="${selected?.id===o.id}"><span aria-hidden="true">${KINDS[o.kind]?.icon??'◆'}</span>${esc(o.tag||KINDS[o.kind]?.label||'Model')}<small>${esc(o.description||'Not tagged yet')}</small></button></li>`).join('')||'<li class="scene-note">Add a building or a person to start.</li>';for(const b of document.querySelectorAll('[data-object]'))b.onclick=()=>select(doc.objects.find(o=>o.id===b.dataset.object));}
function renderInspector(){const box=$('#scene-inspector');if(!selected){box.innerHTML='<h2>Select an object</h2><p class="scene-note">Click a stand-in to tag it. The tag and description tell the image model what each grey shape should become.</p>';return;}const o=selected;
 box.innerHTML=`<h2>${esc(KINDS[o.kind]?.label??'Model')}</h2><label>Tag<input data-f="tag" maxlength="40" value="${esc(o.tag)}" placeholder="Mira, Hero car, Bakery"></label><label>What it is<textarea data-f="description" maxlength="160" rows="3" placeholder="a young woman in a yellow raincoat holding an umbrella">${esc(o.description)}</textarea></label><div class="scene-grid3"><label>X<input data-p="0" type="number" step=".1" value="${o.position[0]}"></label><label>Z<input data-p="2" type="number" step=".1" value="${o.position[2]}"></label><label>Turn°<input data-f="rotation" type="number" step="5" value="${o.rotation}"></label></div><div class="scene-grid3"><label>Width<input data-s="0" type="number" step=".1" min=".05" value="${o.scale[0]}"></label><label>Height<input data-s="1" type="number" step=".1" min=".05" value="${o.scale[1]}"></label><label>Depth<input data-s="2" type="number" step=".1" min=".05" value="${o.scale[2]}"></label></div><label class="scene-color">Colour in the layout<input data-f="color" type="color" value="${o.color}"></label><div class="scene-row"><button type="button" id="obj-dup">Duplicate</button><button type="button" id="obj-del">Remove</button></div>`;
 for(const el of box.querySelectorAll('input,textarea'))el.oninput=()=>{if(el.dataset.f){o[el.dataset.f]=el.type==='number'?Number(el.value):el.value;}if(el.dataset.p)o.position[Number(el.dataset.p)]=Number(el.value);if(el.dataset.s)o.scale[Number(el.dataset.s)]=Math.max(.05,Number(el.value)||.05);apply(o);if(['tag','description'].includes(el.dataset.f))renderOutliner();changed();};
 $('#obj-dup').onclick=()=>{const copy={...structuredClone(o),id:uid(),position:[o.position[0]+2,0,o.position[2]+2]};doc.objects.push(copy);addObject(copy);renderOutliner();select(copy);changed();};
 $('#obj-del').onclick=()=>remove(o.id);
}
function remove(id){const g=meshes.get(id);scene3d.remove(g);meshes.delete(id);doc.objects=doc.objects.filter(o=>o.id!==id);select(null);renderOutliner();changed();}
function create(kind,extra={}){const k=KINDS[kind]??KINDS.box,t=controls.target;const o={id:uid(),kind,tag:'',description:'',position:[Math.round(t.x*10)/10,0,Math.round(t.z*10)/10],rotation:0,scale:[...(k.scale)],color:k.color,...extra};doc.objects.push(o);addObject(o);renderOutliner();select(o);changed();return o;}

function renderKeys(){$('#scene-keys').innerHTML=doc.camera.keys.map((k,i)=>`<div class="scene-key${i===activeKey?' active':''}"><strong>Key ${i+1}</strong><label>at<input type="number" step=".5" min="0" max="20" data-time="${i}" value="${k.time}" ${i===0?'disabled':''}>s</label><label>lens<input type="number" step="1" min="10" max="100" data-fov="${i}" value="${k.fov}">°</label><button type="button" data-goto="${i}" title="Look through the camera at this key and adjust it">Look</button><button type="button" data-set="${i}" title="Move this key to where the edit view is">Use edit view</button>${i?`<button type="button" data-del="${i}" aria-label="Delete key ${i+1}">✕</button>`:''}</div>`).join('');
 for(const el of document.querySelectorAll('[data-time]'))el.onchange=()=>{doc.camera.keys[Number(el.dataset.time)].time=Math.max(.5,Math.min(20,Number(el.value)||1));doc.camera.keys.sort((a,b)=>a.time-b.time);renderKeys();changed();};
 for(const el of document.querySelectorAll('[data-fov]'))el.onchange=()=>{doc.camera.keys[Number(el.dataset.fov)].fov=Math.max(10,Math.min(100,Number(el.value)||40));syncLens();if(view==='camera')enterCamera();changed();};
 for(const b of document.querySelectorAll('[data-goto]'))b.onclick=()=>{activeKey=Number(b.dataset.goto);setView('camera');};
 for(const b of document.querySelectorAll('[data-set]'))b.onclick=()=>{doc.camera.keys[Number(b.dataset.set)]={...doc.camera.keys[Number(b.dataset.set)],...viewKey()};changed();};
 for(const b of document.querySelectorAll('[data-del]'))b.onclick=()=>{doc.camera.keys.splice(Number(b.dataset.del),1);activeKey=Math.min(activeKey,doc.camera.keys.length-1);renderKeys();changed();};
}
const round=v=>v.toArray().map(n=>Math.round(n*100)/100);
function viewKey(){return view==='camera'?{position:round(shotCam.position),target:round(shotControls.target),fov:doc.camera.keys[activeKey]?.fov??40}:{position:round(editCam.position),target:round(controls.target),fov:doc.camera.keys.at(-1)?.fov??40};}

function changed(){$('#scene-saved').textContent='Saving…';clearTimeout(saveTimer);saveTimer=setTimeout(save,900);}
async function save(){try{doc.style=$('#scene-style').value;const saved=await api('/api/scenes',doc);doc.id=saved.id;doc.revision=saved.revision;$('#scene-saved').textContent='Saved';const u=new URL(location.href);u.searchParams.set('scene',doc.id);history.replaceState(null,'',u);refreshList(false);}catch(error){$('#scene-saved').textContent=error.message;}}
let list=[];async function refreshList(load=true){list=await api('/api/scenes');$('#scene-select').innerHTML=(doc&&!doc.id?'<option value="">Unsaved scene</option>':'')+list.map(s=>`<option value="${s.id}" ${s.id===doc?.id?'selected':''}>${esc(s.name)}</option>`).join('');if(load){const want=new URLSearchParams(location.search).get('scene');const s=list.find(s=>s.id===want)??list[0];open(s?structuredClone(s):blank());}}
function blank(name='My scene'){return {name,aspect:'landscape',style:'',objects:[],camera:{keys:[{time:0,position:[14,6,18],target:[0,2,0],fov:40}]}};}
function preset(id){const p=SCENE_PRESETS.find(p=>p.id===id)??SCENE_PRESETS[0];const d=blank(p.name);d.aspect=p.aspect;d.style=p.style;d.objects=p.objects.map(o=>({...structuredClone(o),id:uid(),color:o.color??KINDS[o.kind]?.color??'#b3a28c'}));d.camera.keys=structuredClone(p.keys);open(d);const t=p.keys[0].target,c=p.keys[0].position;editCam.position.set(c[0]+10,c[1]+8,c[2]+10);controls.target.set(...t);changed();$('#scene-presets').open=false;}
function presetMarkup(){return SCENE_PRESETS.map(p=>`<button type="button" data-preset="${p.id}"><b>${esc(p.name)}</b><small>${esc(p.hint)}</small></button>`).join('');}
function open(d){doc=d;activeKey=0;if(view==='camera')setView('edit');$('#scene-style').value=d.style??'';for(const b of document.querySelectorAll('[data-aspect]'))b.setAttribute('aria-pressed',String(b.dataset.aspect===d.aspect));rebuild();renderKeys();layoutFrame();refreshListOptions();$('#scene-empty').hidden=d.objects.length>0;}
function refreshListOptions(){if(!doc.id&&!$('#scene-select option[value=""]'))$('#scene-select').insertAdjacentHTML('afterbegin','<option value="" selected>Unsaved scene</option>');}

// Layout boxes for tagged objects, in 0–1 image coordinates, from the shot camera at time 0.
export function layoutBoxes(){const [w,h]=SIZES[doc.aspect];placeShot(cameraAt(0),w/h);shotCam.updateMatrixWorld();const out=[];
 for(const o of doc.objects){if(!o.tag&&!o.description)continue;const b=new THREE.Box3().setFromObject(meshes.get(o.id));const pts=[];for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z]){const p=new THREE.Vector3(x,y,z).applyMatrix4(shotCam.matrixWorldInverse);if(p.z>-.05)continue;p.applyMatrix4(shotCam.projectionMatrix);pts.push(p);}
  if(pts.length<2)continue;const xs=pts.map(p=>(p.x+1)/2),ys=pts.map(p=>(1-p.y)/2),x0=Math.max(0,Math.min(...xs)),x1=Math.min(1,Math.max(...xs)),y0=Math.max(0,Math.min(...ys)),y1=Math.min(1,Math.max(...ys));
  if(x1-x0<.01||y1-y0<.01)continue;out.push({objectId:o.id,x:+x0.toFixed(4),y:+y0.toFixed(4),width:+(x1-x0).toFixed(4),height:+(y1-y0).toFixed(4)});}
 return out.slice(0,16);}
function renderClay(t,size){const [w,h]=size;const prev=new THREE.Vector2();renderer.getSize(prev);const ratio=renderer.getPixelRatio();renderer.setPixelRatio(1);renderer.setSize(w,h,false);grid.visible=false;helper.visible=false;placeShot(cameraAt(t),w/h);renderer.render(scene3d,shotCam);return ()=>{grid.visible=true;renderer.setPixelRatio(ratio);renderer.setSize(prev.x,prev.y,false);};}
async function renderStill(){
 if(!doc.objects.some(o=>o.tag||o.description))throw Error('Tag at least one object so the model knows what it is.');
 await save();if(!doc.id)throw Error('Save the scene first.');
 const size=SIZES[doc.aspect],boxes=layoutBoxes();if(!boxes.length)throw Error('No tagged object is in the camera view. Frame the shot so they show.');
 const restore=renderClay(0,size);const blob=await new Promise(r=>renderer.domElement.toBlob(r,'image/png'));restore();
 const asset=await fetch('/api/assets',{method:'POST',body:blob,headers:{'Content-Type':'image/png','X-Frameforge-Source':'scene'}}).then(async r=>{const v=await r.json();if(!r.ok)throw Error(v.error);return v;});
 const result=await api('/api/scenes/'+doc.id+'/still',{asset:asset.name,boxes});
 return {...result,layout:asset.url,boxes};
}
async function renderClip(){
 await save();const keys=doc.camera.keys,duration=Math.max(2,keys.at(-1).time),size=SIZES[doc.aspect];
 if(keys.length<2)throw Error('Add a second camera key so the camera moves.');
 const canvas=renderer.domElement;const prev=new THREE.Vector2();renderer.getSize(prev);const ratio=renderer.getPixelRatio();renderer.setAnimationLoop(null);renderer.setPixelRatio(1);renderer.setSize(...size,false);grid.visible=false;helper.visible=false;
 const stream=canvas.captureStream(24),type=['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'].find(t=>MediaRecorder.isTypeSupported(t));const rec=new MediaRecorder(stream,{mimeType:type,videoBitsPerSecond:8e6}),chunks=[];rec.ondataavailable=e=>chunks.push(e.data);
 const done=new Promise(r=>rec.onstop=r);rec.start();const start=performance.now();
 await new Promise(resolve=>{const step=()=>{const t=(performance.now()-start)/1000;placeShot(cameraAt(Math.min(t,duration)),size[0]/size[1]);renderer.render(scene3d,shotCam);if(t<duration+.1)requestAnimationFrame(step);else resolve();};step();});
 rec.stop();await done;grid.visible=true;renderer.setPixelRatio(ratio);renderer.setSize(prev.x,prev.y,false);renderer.setAnimationLoop(frame);
 const blob=new Blob(chunks,{type:'video/webm'});const footage=await fetch('/api/footage',{method:'POST',body:blob,headers:{'Content-Type':'video/webm','X-File-Name':encodeURIComponent(doc.name+' layout.webm')}}).then(async r=>{const v=await r.json();if(!r.ok)throw Error(v.error);return v;});
 return {footage,url:'/footage/'+footage.id+'/source.webm',duration};
}
let lastStill=null;
function results(){const box=$('#render-results');box.innerHTML=[lastStill?`<article><h3>Image</h3>${lastStill.image?`<img src="${lastStill.image}" alt="Rendered image from the scene">`:`<div class="scene-wait">Rendering on your ComfyUI…</div>`}<div class="scene-row"><a href="${lastStill.layout}" target="_blank" rel="noopener">Grey layout</a><a href="/workflows?job=${lastStill.job.id}">ComfyUI graph</a>${lastStill.asset?`<a href="/create?image=${lastStill.asset}">Animate it</a>`:''}</div></article>`:'',lastClip?`<article><h3>Layout clip</h3><video src="${lastClip.url}" controls muted playsinline></video><div class="scene-row"><a href="${lastClip.url}" download>Download</a><a class="primary" href="/native-workflows?workflow=ltx-layout&video=${encodeURIComponent(lastClip.url)}${lastStill?.image?'&image='+encodeURIComponent(lastStill.image):''}">Finish with Layout to Render →</a></div><p class="scene-note">${lastStill?.image?'The rendered image becomes the styled first frame.':'Make the image first: Layout to Render uses it as the styled first frame.'}</p></article>`:''].join('');}
let lastClip=null;
async function poll(){if(!lastStill||lastStill.image)return;const job=await api('/api/jobs/'+lastStill.job.id).catch(()=>null);if(job?.report?.technicalPass&&job.image){lastStill.image=`/outputs/${job.id}/${job.image}`;try{const a=await api('/api/jobs/'+job.id+'/image-asset',{});lastStill.asset=a.name;}catch{}$('#render-status').textContent='Image ready.';results();return;}if(job&&['failed','technical-failed','verification-blocked','cancelled','needs-attention'].includes(job.status)){$('#render-status').textContent='The render stopped: '+(job.error??job.status);return;}setTimeout(poll,3000);}

function wire(){
 $('#scene-palette').innerHTML=Object.entries(KINDS).map(([k,v])=>`<button type="button" data-kind="${k}"><span aria-hidden="true">${v.icon}</span>${v.label}</button>`).join('');
 for(const b of document.querySelectorAll('[data-kind]'))b.onclick=()=>create(b.dataset.kind);
 for(const b of document.querySelectorAll('[data-view]'))b.onclick=()=>setView(b.dataset.view);
 $('#shot-lens-range').oninput=e=>{const k=doc.camera.keys[activeKey];k.fov=mmToFov(Number(e.target.value));$('#shot-lens-value').textContent=e.target.value+' mm';placeShot(k);};$('#shot-lens-range').onchange=()=>{renderKeys();changed();};
 $('#scene-preset-list').innerHTML=presetMarkup();$('#scene-empty-list').innerHTML=presetMarkup();for(const b of document.querySelectorAll('[data-preset]'))b.onclick=()=>preset(b.dataset.preset);
 for(const b of document.querySelectorAll('[data-aspect]'))b.onclick=()=>{doc.aspect=b.dataset.aspect;for(const x of document.querySelectorAll('[data-aspect]'))x.setAttribute('aria-pressed',String(x===b));layoutFrame();changed();};
 $('#key-add').onclick=()=>{const last=doc.camera.keys.at(-1);doc.camera.keys.push({time:Math.min(20,last.time+3),...viewKey()});activeKey=doc.camera.keys.length-1;renderKeys();changed();};
 $('#key-play').onclick=()=>{setView('camera');playing={start:performance.now(),end:doc.camera.keys.at(-1).time+.3};};
 $('#scene-style').oninput=changed;
 $('#scene-new').onclick=()=>{open(blank());};
 $('#scene-select').onchange=()=>{const s=list.find(s=>s.id===$('#scene-select').value);if(s)open(structuredClone(s));};
 $('#scene-glb').onchange=async e=>{const file=e.target.files?.[0];if(!file)return;try{if(file.size>80*1024**2)throw Error('Use a GLB under 80 MB.');const gltf=await new GLTFLoader().parseAsync(await file.arrayBuffer(),'');const root=gltf.scene;const b=new THREE.Box3().setFromObject(root),s=b.getSize(new THREE.Vector3()),k=1/Math.max(s.x,s.y,s.z);root.scale.setScalar(k);root.position.set(-(b.min.x+b.max.x)/2*k,-b.min.y*k,-(b.min.z+b.max.z)/2*k);const wrap=new THREE.Group();wrap.add(root);glbCache.set(file.name,wrap);create('glb',{file:file.name.slice(0,160),scale:[2,2,2],tag:file.name.replace(/\.glb$/i,'').slice(0,40)});}catch(error){$('#scene-saved').textContent=error.message;}e.target.value='';};
 $('#render-still').onclick=async()=>{const b=$('#render-still');b.disabled=true;$('#render-status').textContent='Rendering the grey layout and sending it to FLUX 3…';try{lastStill=await renderStill();$('#render-status').textContent='Rendering on your ComfyUI. Tagged objects become layout boxes: '+lastStill.boxes.length+'.';results();poll();}catch(error){$('#render-status').textContent=error.message;}finally{b.disabled=false;}};
 $('#render-clip').onclick=async()=>{const b=$('#render-clip');b.disabled=true;$('#render-status').textContent='Recording the camera move in real time…';try{lastClip=await renderClip();$('#render-status').textContent='Layout clip saved ('+lastClip.duration.toFixed(1)+' s).';results();}catch(error){$('#render-status').textContent=error.message;}finally{b.disabled=false;}};
}
init();wire();refreshList().catch(error=>{open(blank());$('#scene-saved').textContent=error.message;});
