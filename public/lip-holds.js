export function parseLipHolds(text){
  if(!String(text).trim())return [];
  return String(text).split(/[\n,;]+/).filter(x=>x.trim()).map(value=>{
    const match=value.trim().match(/^(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)$/);
    if(!match)throw Error('Use covered-mouth ranges like 0.80-1.20, one per line.');
    return {start:Number(match[1]),end:Number(match[2])};
  });
}
export const formatLipHolds=ranges=>(ranges??[]).map(r=>String(r.start)+'-'+String(r.end)).join('\n');
