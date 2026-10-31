import {normalizeFilm,normalizeFilmShots} from './film.mjs';
const time=seconds=>({OTIO_SCHEMA:'RationalTime.1',value:seconds*24,rate:24});
const range=(start,duration)=>({OTIO_SCHEMA:'TimeRange.1',start_time:time(start),duration:time(duration)});
const track=(name,kind,children)=>({OTIO_SCHEMA:'Track.1',name,kind,children,source_range:null,effects:[],markers:[],metadata:{}});
function clip(name,file,start,duration,available,metadata={}){return {OTIO_SCHEMA:'Clip.2',name,source_range:range(start,duration),media_references:{DEFAULT_MEDIA:{OTIO_SCHEMA:'ExternalReference.1',target_url:file,available_range:range(0,available),metadata:{}}},active_media_reference_key:'DEFAULT_MEDIA',effects:[],markers:[],metadata:{frameforge:metadata}};}
export function editingTimeline(project,media,audio=[]){
 const shots=normalizeFilmShots(project.shots),film=normalizeFilm(project.film);if(!shots.length)throw Error('Add a saved clip before exporting a timeline.');
 const lookup=new Map(media.map(v=>[v.jobId,v])),selected=shots.map(s=>{const m=lookup.get(s.jobId);if(!m||!Number.isFinite(m.duration)||m.duration<=0)throw Error('A timeline source is unavailable.');const end=s.trimEnd??m.duration;if(end>m.duration+.001)throw Error('Trim ends outside the source.');return {...s,media:m,length:end-s.trimStart};});
 const fades=selected.map((s,i)=>i&&s.transition==='crossfade'?s.transitionSeconds:0),children=[],sound=[];let duration=0;
 for(let i=0;i<selected.length;i++){
  const s=selected[i],incoming=fades[i]/2,outgoing=(fades[i+1]??0)/2,length=s.length-incoming-outgoing;
  if(length<1/24||fades[i]>s.length||fades[i+1]>s.length)throw Error('Shorten the transitions so they do not overlap inside a shot.');
  if(i&&fades[i]){const transition={OTIO_SCHEMA:'Transition.1',name:'Cross dissolve',transition_type:'SMPTE_Dissolve',in_offset:time(incoming),out_offset:time(incoming),metadata:{}};children.push(transition);sound.push(structuredClone(transition));}
  const metadata={jobId:s.jobId,sourceSha256:s.media.sha256,volume:s.volume,fadeIn:s.fadeIn,fadeOut:s.fadeOut,scene:s.scene,notes:s.notes};
  children.push(clip(s.title,s.media.file,s.trimStart+incoming,length,s.media.duration,metadata));
  sound.push(s.media.audio===false?{OTIO_SCHEMA:'Gap.1',source_range:range(0,length),effects:[],markers:[],metadata:{},name:'Silent source'}:clip(s.title,s.media.file,s.trimStart+incoming,length,s.media.duration,metadata));duration+=length;
 }
 const tracks=[track('Picture','Video',children),track('Source audio','Audio',sound)],warnings=[];
 for(const t of film.tracks){
  if(t.type!=='wav'){warnings.push('Narration text is in project.json; synthesize it or keep the rendered reference mix.');continue;}
  const a=audio.find(a=>a.id===t.audio);if(!a)throw Error('A saved WAV soundtrack is unavailable.');const end=Math.min(duration,t.end);if(end<=t.start)continue;
  const pieces=t.start?[{OTIO_SCHEMA:'Gap.1',source_range:range(0,t.start),effects:[],markers:[],metadata:{},name:'Track offset'}]:[];let left=end-t.start,offset=t.trimStart;
  while(left>.00001){const length=Math.min(left,a.duration-offset);if(length<=0)throw Error('The soundtrack trim is outside its WAV.');pieces.push(clip(t.label,a.file,offset,length,a.duration,{volume:t.volume,fadeIn:t.fadeIn,fadeOut:t.fadeOut}));left-=length;if(!t.loop&&left>.001)throw Error('The soundtrack is shorter than its selected timeline range.');offset=0;}
  tracks.push(track(t.label,'Audio',pieces));
 }
 if(film.overlays.length)warnings.push('Image overlays are included as files with placement in project.json; recreate their composition in your editor.');
 if(film.texts.length)warnings.push('Titles and captions are timeline markers; bottom captions also have subtitles.srt. Font styling is in project.json.');
 if(selected.some(s=>s.volume!==1||s.fadeIn||s.fadeOut)||film.tracks.length)warnings.push('Volumes and audio fades are preserved as Frameforge metadata; editor support varies. Check the mix after import.');
 const markers=film.texts.map(t=>({OTIO_SCHEMA:'Marker.2',name:t.text,color:'GREEN',marked_range:range(t.start,t.end-t.start),metadata:{frameforge:{position:t.position,fontSize:t.fontSize}}}));
 const timeline={OTIO_SCHEMA:'Timeline.1',name:project.name,global_start_time:time(0),tracks:{OTIO_SCHEMA:'Stack.1',name:'Frameforge film',children:tracks,source_range:null,effects:[],markers,metadata:{}},metadata:{frameforge:{schema:1,projectId:project.id,aspect:film.aspect,duration,warnings:[...new Set(warnings)]}}};
 const stamp=n=>{const ms=Math.round(n*1000);return String(Math.floor(ms/3600000)).padStart(2,'0')+':'+String(Math.floor(ms/60000)%60).padStart(2,'0')+':'+String(Math.floor(ms/1000)%60).padStart(2,'0')+','+String(ms%1000).padStart(3,'0');};
 const subtitles=film.texts.filter(t=>t.position==='bottom').map((t,i)=>`${i+1}\n${stamp(t.start)} --> ${stamp(t.end)}\n${t.text}\n`).join('\n');
 return {timeline,duration,subtitles,warnings:timeline.metadata.frameforge.warnings};
}
