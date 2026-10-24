export const POSES={
  standing:[[.5,.14],[.5,.24],[.38,.26],[.32,.4],[.28,.53],[.62,.26],[.68,.4],[.72,.53],[.43,.54],[.42,.73],[.4,.92],[.57,.54],[.58,.73],[.6,.92],[.475,.13],[.525,.13],[.45,.15],[.55,.15]],
  raised:[[.5,.14],[.5,.24],[.38,.26],[.25,.18],[.23,.04],[.62,.26],[.68,.4],[.72,.53],[.43,.54],[.42,.73],[.4,.92],[.57,.54],[.58,.73],[.6,.92],[.475,.13],[.525,.13],[.45,.15],[.55,.15]],
  seated:[[.5,.14],[.5,.24],[.38,.26],[.32,.4],[.36,.52],[.62,.26],[.68,.4],[.64,.52],[.43,.54],[.26,.65],[.25,.88],[.57,.54],[.74,.65],[.75,.88],[.475,.13],[.525,.13],[.45,.15],[.55,.15]]
};
export function bodyPoseEditor(onSaved,notice){
 const $=s=>document.querySelector(s),canvas=$('#body-pose-canvas'),ctx=canvas.getContext('2d'),limbs=[[1,2],[1,5],[2,3],[3,4],[5,6],[6,7],[1,8],[8,9],[9,10],[1,11],[11,12],[12,13],[1,0],[0,14],[14,16],[0,15],[15,17]];let points=structuredClone(POSES.standing),drag=null;
 function draw(){const sizes={portrait:[288,512],landscape:[512,288],square:[384,384]};[canvas.width,canvas.height]=sizes[$('#image-aspect').value];ctx.fillStyle='#000';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.lineWidth=5;ctx.strokeStyle='#a9df6a';for(const [a,b]of limbs){ctx.beginPath();ctx.moveTo(points[a][0]*canvas.width,points[a][1]*canvas.height);ctx.lineTo(points[b][0]*canvas.width,points[b][1]*canvas.height);ctx.stroke();}for(const [x,y]of points){ctx.beginPath();ctx.arc(x*canvas.width,y*canvas.height,6,0,Math.PI*2);ctx.fillStyle='#fff';ctx.fill();}}
 const point=e=>{const box=canvas.getBoundingClientRect();return [Math.max(.01,Math.min(.99,(e.clientX-box.left)/box.width)),Math.max(.01,Math.min(.99,(e.clientY-box.top)/box.height))];};
 canvas.onpointerdown=e=>{const p=point(e);let distance=.07;for(let i=0;i<points.length;i++){const d=Math.hypot(p[0]-points[i][0],p[1]-points[i][1]);if(d<distance){drag=i;distance=d;}}if(drag!==null){canvas.setPointerCapture(e.pointerId);e.preventDefault();}};
 canvas.onpointermove=e=>{if(drag!==null){points[drag]=point(e);draw();}};canvas.onpointerup=canvas.onpointercancel=()=>{drag=null;};
 $('#body-pose-preset').onchange=()=>{points=structuredClone(POSES[$('#body-pose-preset').value]);draw();};
 $('#save-body-pose').onclick=async()=>{const button=$('#save-body-pose');button.disabled=true;try{const response=await fetch('/api/body-pose',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({points,aspect:$('#image-aspect').value})}),result=await response.json();if(!response.ok)throw Error(result.error);onSaved(result);notice('Body pose saved as the selected guide. Inspect pose, anatomy and likeness separately.');}catch(e){notice(e.message);}finally{button.disabled=false;}};
 return {draw};
}
