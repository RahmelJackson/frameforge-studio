export const SEGMENT_MODEL='sam3.1_multiplex_fp16.safetensors';
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
