// Edits refer to source seconds. Transitions belong to the incoming shot.
export function normalizeEdit(input={},duration=120){
  const start=input.trimStart??0,end=input.trimEnd??null;
  const transition=input.transition??'cut',seconds=input.transitionSeconds??0.5;
  if(typeof start!=='number'||!Number.isFinite(start)||start<0||start>=duration)throw new Error('Start must be inside the source clip.');
  if(end!==null&&(typeof end!=='number'||!Number.isFinite(end)||end<=start||end>duration))throw new Error('End must be after start and within the source clip.');
  if((end??duration)-start<1/24)throw new Error('Keep at least one output frame of the shot.');
  if(!['cut','crossfade'].includes(transition))throw new Error('Choose a cut or crossfade.');
  if(typeof seconds!=='number'||!Number.isFinite(seconds)||seconds<1/24||seconds>2)throw new Error('Crossfade length must be between 0.042 and 2 seconds.');
  return {trimStart:start,trimEnd:end,transition,transitionSeconds:seconds};
}

export function editSignature(shots){return JSON.stringify(shots.map(s=>({id:s.id,jobId:s.jobId,...normalizeEdit(s)})));}
