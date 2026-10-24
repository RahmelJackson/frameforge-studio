export function normalizePose(input){
  if(!['portrait','landscape','square'].includes(input.aspect)||!Array.isArray(input.points)||input.points.length!==18)throw Error('Choose a format and eighteen body joints.');
  const points=input.points.map(p=>{if(p===null)return null;if(!Array.isArray(p)||p.length!==2||p.some(v=>!Number.isFinite(v)||v<0||v>1))throw Error('Keep each body joint inside the picture.');return [...p];});
  if(points.filter(Boolean).length<8||![1,2,5,8,11].every(i=>points[i]))throw Error('Keep the neck, shoulders and hips visible in the guide.');
  if(Math.hypot(points[2][0]-points[5][0],points[2][1]-points[5][1])<.04)throw Error('Separate the shoulders so the body pose is visible.');
  return {aspect:input.aspect,points};
}
