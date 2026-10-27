// Compare decoded RGB pixels, not prompts or similarity scores.
export function pixelProof(original,result){
 if(original.length!==result.length||original.length%4)throw Error('Proof view needs images with identical pixel dimensions.');
 const heatmap=new Uint8ClampedArray(original.length);let changed=0,maxDelta=0;
 for(let i=0;i<original.length;i+=4){const delta=Math.max(Math.abs(original[i]-result[i]),Math.abs(original[i+1]-result[i+1]),Math.abs(original[i+2]-result[i+2]));maxDelta=Math.max(maxDelta,delta);if(delta)changed++;heatmap[i]=delta?255:Math.round(original[i]*.18);heatmap[i+1]=delta?Math.max(20,130-delta):Math.round(original[i+1]*.18);heatmap[i+2]=delta?30:Math.round(original[i+2]*.18);heatmap[i+3]=255;}
 return {heatmap,changed,total:original.length/4,maxDelta,percent:100*changed/(original.length/4)};
}
