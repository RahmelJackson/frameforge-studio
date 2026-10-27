// Pixel geometry shared by the browser editor and its boundary tests.
export const MAX_EDIT_PIXELS=4_000_000;
export function checkedSize(width,height,limit=MAX_EDIT_PIXELS){
 if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<16||height<16||width*height>limit)throw Error('Keep the canvas between 16 pixels per edge and four megapixels.');
 return {width,height};
}
export function canvasExtension(width,height,edges){
 checkedSize(width,height);const [left,top,right,bottom]=['left','top','right','bottom'].map(k=>Number(edges[k]??0));
 if([left,top,right,bottom].some(v=>!Number.isSafeInteger(v)||v<0||v>2048)||left+top+right+bottom===0)throw Error('Add 1 to 2048 pixels to at least one edge.');
 return {...checkedSize(width+left+right,height+top+bottom),left,top,right,bottom};
}
export function canvasRectangle(a,b,width,height){
 checkedSize(width,height);if(![...a,...b].every(Number.isFinite))throw Error('Choose a rectangle on the image.');
 const x=Math.floor(Math.max(0,Math.min(width-1,a[0],b[0]))),y=Math.floor(Math.max(0,Math.min(height-1,a[1],b[1])));
 return {x,y,width:Math.max(1,Math.ceil(Math.min(width,Math.max(a[0],b[0])))-x),height:Math.max(1,Math.ceil(Math.min(height,Math.max(a[1],b[1])))-y)};
}
export function layerHistory(layers,layer){
 if(!layer||typeof layer.name!=='string'||!/^[a-f0-9-]{36}\.(png|jpg|webp)$/.test(layer.name))throw Error('Use an image saved in this studio.');
 const next=layers.filter(l=>l.name!==layer.name).concat({name:layer.name,label:String(layer.label??'Image').slice(0,100),jobId:/^[a-f0-9-]{36}$/.test(layer.jobId??'')?layer.jobId:null,comparisonAsset:/^[a-f0-9-]{36}\.(png|jpg|webp)$/.test(layer.comparisonAsset??'')?layer.comparisonAsset:null});
 return next.slice(-12);
}
