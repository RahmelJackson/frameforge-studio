export const SEGMENT_MODEL='sam3.1_multiplex_fp16.safetensors';
export function normalizeImageSelection(input){
 const method=input.segmentMethod??'text',threshold=Number(input.segmentThreshold??(method==='text'?.65:.5));
 if(!['text','points','box'].includes(method)||!Number.isFinite(threshold)||threshold<.05||threshold>.95)throw Error('Choose text, points or a box, with a selection threshold from 0.05 to 0.95.');
 const r={segmentMethod:method,segmentThreshold:threshold};
 if(method==='text'){const target=String(input.prompt??'').trim();if(!target||target.length>160)throw Error('Describe one visible object in up to 160 characters.');}
 if(method==='points')r.segmentPoints=normalizeSegmentPoints(input.segmentPoints);
 if(method==='box'){const b=input.segmentBox;if(!b||!['x','y','width','height'].every(k=>Number.isFinite(b[k]))||b.x<0||b.y<0||b.width<=0||b.height<=0||b.x+b.width>1.000001||b.y+b.height>1.000001)throw Error('Draw a box completely inside the source image.');r.segmentBox={x:b.x,y:b.y,width:b.width,height:b.height};}
 return r;
}
export function buildImageSelectionWorkflow(r,names,prefix){
 const [width,height]=r.size??[768,768],n=(class_type,inputs)=>({class_type,inputs});
 const graph={'1':n('CheckpointLoaderSimple',{ckpt_name:SEGMENT_MODEL}),'2':n('LoadImage',{image:names.asset}),'3':n('SAM3_Detect',{model:['1',0],image:['2',0],threshold:r.segmentThreshold??.5,refine_iterations:1,individual_masks:false}),'4':n('MaskToImage',{mask:['3',0]}),'20':n('SaveImage',{images:['4',0],filename_prefix:prefix})};
 if(r.segmentMethod==='points'){for(const [label,key] of [[1,'positive_coords'],[0,'negative_coords']]){const id=label?'6':'7';graph[id]=n('PrimitiveString',{value:JSON.stringify(normalizeSegmentPoints(r.segmentPoints).filter(p=>p.label===label).map(p=>({x:Math.round(p.x*(width-1)),y:Math.round(p.y*(height-1))})))});graph['3'].inputs[key]=[id,0];}}
 else if(r.segmentMethod==='box'){const b=r.segmentBox;graph['8']=n('PrimitiveBoundingBox',{x:Math.round(b.x*width),y:Math.round(b.y*height),width:Math.max(1,Math.round(b.width*width)),height:Math.max(1,Math.round(b.height*height))});graph['3'].inputs.bboxes=['8',0];graph['6']=n('PrimitiveString',{value:JSON.stringify([{x:Math.round((b.x+b.width/2)*(width-1)),y:Math.round((b.y+b.height/2)*(height-1))}])});graph['3'].inputs.positive_coords=['6',0];}
 else{graph['5']=n('CLIPTextEncode',{clip:['1',1],text:r.prompt});graph['3'].inputs.conditioning=['5',0];}
 return graph;
}
export function normalizeSegmentPoints(points){
  if(!Array.isArray(points)||!points.length||points.length>16||points.some(p=>!p||![p.x,p.y].every(v=>Number.isFinite(v)&&v>=0&&v<=1)||![0,1].includes(p.label))||!points.some(p=>p.label===1))throw Error('Choose 1–16 points inside the picture, including at least one point to keep.');
  if(points.some((p,i)=>points.some((q,j)=>i!==j&&p.label!==q.label&&Math.hypot(p.x-q.x,p.y-q.y)<.005)))throw Error('Keep and exclude points must be in different places.');
  return points.map(({x,y,label})=>({x,y,label}));
}
export function buildSegmentWorkflow(r,names,prefix){
  const n=(class_type,inputs)=>({class_type,inputs}),[width,height]=r.prepared.size;
  const coords=label=>JSON.stringify(normalizeSegmentPoints(r.segmentPoints).filter(p=>p.label===label).map(p=>({x:Math.round(p.x*(width-1)),y:Math.round(p.y*(height-1))})));
  return {
    '1':n('LoadVideo',{file:names.video}),'2':n('GetVideoComponents',{video:['1',0]}),
    '3':n('CheckpointLoaderSimple',{ckpt_name:SEGMENT_MODEL}),
    '4':n('ImageFromBatch',{image:['2',0],batch_index:0,length:1}),
    '5':n('SAM3_Detect',{model:['3',0],image:['4',0],positive_coords:coords(1),negative_coords:coords(0),threshold:.5,refine_iterations:1,individual_masks:false}),
    '6':n('SAM3_VideoTrack',{images:['2',0],model:['3',0],initial_mask:['5',0],detection_threshold:.5,max_objects:1,detect_interval:1}),
    '7':n('SAM3_TrackToMask',{track_data:['6',0],object_indices:''}),
    '8':n('MaskToImage',{mask:['7',0]}),'20':n('CreateVideo',{images:['8',0],fps:r.prepared.fps}),
    '21':n('SaveVideo',{video:['20',0],filename_prefix:prefix,format:'mp4',codec:'h264'})
  };
}
export function segmentReadiness(info){const graph=buildSegmentWorkflow({segmentPoints:[{x:.5,y:.5,label:1}],prepared:{size:[512,288],fps:16}},{video:'test.mp4'},'test'),missingNodes=[...new Set(Object.values(graph).map(n=>n.class_type))].filter(n=>!info[n]),missingModels=info.CheckpointLoaderSimple?.input?.required?.ckpt_name?.[0]?.includes(SEGMENT_MODEL)?[]:[SEGMENT_MODEL];return {ready:!missingNodes.length&&!missingModels.length,missingNodes,missingModels};}
