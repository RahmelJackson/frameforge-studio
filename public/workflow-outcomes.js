// Each graph appears once. Model and draft variants belong to a task, not another card.
export const OUTCOMES=[
 {id:'select-object',title:'Select an object',category:'image',symbol:'⊡',summary:'Click, box or name an object with SAM, then refine its mask before editing.',input:'An image + a selection hint',output:'A PNG mask',variants:['sam-image']},
 {id:'create-image',title:'Create an image',category:'image',symbol:'◇',summary:'Turn a written idea into a still, concept or first storyboard frame.',input:'A prompt',output:'A new image',variants:['z-image','seedream-create']},
 {id:'edit-image',title:'Edit an image',category:'image',symbol:'◐',summary:'Change a picture with words. Compare the edited copy with your original.',input:'An image + a change request',output:'An edited image',variants:['qwen-edit','provider:flux3-video:local','seedream-edit']},
 {id:'animate-image',title:'Animate an image',category:'video',symbol:'▷',summary:'Give a still image movement. Choose a silent local preview, local audio model or hosted generation.',input:'A still + an action prompt',output:'A moving shot',variants:['wan-i2v','provider:minimax-h3:local','seedance-i2v','seedance-draft','provider:flux3-video:default']},
 {id:'atmosphere-vfx',title:'Add atmosphere & VFX',category:'video',symbol:'✦',summary:'Use the LTX sample to build a shot with violet smoke and atmospheric movement.',input:'A starting image + an effect prompt',output:'An LTX video with audio',variants:['provider:ltx-vfx:default']},
 {id:'camera-move',title:'Direct a camera move',category:'video',symbol:'↗',summary:'Use dedicated camera conditioning to guide direction and speed.',input:'An image + camera direction',output:'A camera-guided shot',variants:['wan-camera']},
 {id:'text-video',title:'Make a video from words',category:'video',symbol:'T',summary:'Describe a scene and action without providing a starting image.',input:'A scene and action brief',output:'A generated video',variants:['seedance-t2v']},
 {id:'keyframes',title:'Connect two keyframes',category:'video',symbol:'⇥',summary:'Generate movement between a first image and a target ending image.',input:'Start + end images',output:'A transition clip',variants:['seedance-frames','provider:minimax-h3:default']},
 {id:'reference-video',title:'Guide motion with references',category:'video',symbol:'≋',summary:'Use reference media for appearance and movement guidance.',input:'Reference media + a brief',output:'A reference-guided clip',variants:['seedance-reference']},
 {id:'edit-video',title:'Edit a video with words',category:'video',symbol:'✎',summary:'Ask for one focused change to existing footage.',input:'A clip + an edit request',output:'A newly generated edit',variants:['seedance-edit']},
 {id:'extend-video',title:'Continue a video',category:'video',symbol:'→',summary:'Generate the next moment, then inspect the join in your editor.',input:'A clip + what happens next',output:'A continuation segment',variants:['seedance-extend']},
 {id:'shot-sequence',title:'Generate a shot sequence',category:'video',symbol:'▤',summary:'Describe and time several shots using the native storyboard controls.',input:'Shot descriptions + timings',output:'A generated sequence',variants:['kling-video']},
 {id:'inpaint',title:'Replace a painted region',category:'image',symbol:'◌',summary:'Paint the area to change. The local masked pipeline preserves untouched pixels.',input:'An image + mask + prompt',output:'A selectively edited image',variants:['tool:inpaint']},
 {id:'extend-image',title:'Extend an image’s edges',category:'image',symbol:'⊞',summary:'Add room around a still. Generate only the new borders while keeping the existing picture.',input:'An image + new canvas size + continuation prompt',output:'A wider or taller still',variants:['tool:canvas-outpaint']},
 {id:'relight-image',title:'Relight a still',category:'image',symbol:'☼',summary:'Choose light direction, color and brightness. Compare the scene after the edit.',input:'An image + lighting choices',output:'A relit still',variants:['tool:relight']},
 {id:'upscale-image',title:'Enhance image detail',category:'image',symbol:'↗',summary:'Use Real-ESRGAN at 2× or 4× to enlarge a still. Inspect invented texture.',input:'An image',output:'A larger enhanced image',variants:['tool:image-upscale']},
 {id:'smooth-video',title:'Smooth video motion',category:'video',symbol:'≈',summary:'Generate intermediate frames with FILM or RIFE, retaining duration and audio. Review occlusions.',input:'A short video',output:'A clip with twice the frames',variants:['tool:interpolate']},
 {id:'follow-subject',title:'Follow a subject',category:'video',symbol:'⊡',summary:'Track a selected subject and crop the existing footage around it. No missing edges are generated.',input:'A clip + subject selection',output:'A subject-following crop',variants:['tool:reframe']},
 {id:'narrated-storyboard',title:'Build a narrated storyboard',category:'video',symbol:'▥',summary:'Assemble stills, captions and narration into a draft explainer or short film.',input:'Stills + script',output:'A narrated storyboard video',variants:['tool:story']},
 {id:'speech',title:'Read a script aloud',category:'audio',symbol:'♪',summary:'Turn a script into local narration, then send the audio to a film or clip.',input:'A script + voice choice',output:'A speech recording',variants:['tool:speech']},
 {id:'transcribe',title:'Create subtitles from speech',category:'audio',symbol:'T',summary:'Transcribe a recording, review the words and export timed subtitles.',input:'An audio or video recording',output:'Transcript + subtitles',variants:['tool:transcribe']},
 {id:'dub',title:'Translate & dub dialogue',category:'audio',symbol:'文',summary:'Transcribe, translate and generate replacement dialogue. Review timing and translation.',input:'A recording + target language',output:'Translated dialogue',variants:['tool:dub']}
];
export const TOOL_VARIANTS={
 inpaint:{label:'Canvas · local masked image pipeline',url:'/images?view=canvas&tool=inpaint',reviewed:true},
 'canvas-outpaint':{label:'Canvas · local masked edge generation',url:'/images?view=canvas&tool=inpaint&action=extend',reviewed:true},
 relight:{label:'Local image relighting',url:'/images?tool=relight',reviewed:true},
 'image-upscale':{label:'Real-ESRGAN',url:'/images?tool=upscale',reviewed:true},
 interpolate:{label:'FILM / RIFE',url:'/video-tools?tool=interpolate'},
 reframe:{label:'Local subject tracker',url:'/video-tools?tool=reframe',reviewed:true},
 story:{label:'Local storyboard assembly',url:'/video-tools?tool=story',reviewed:true},
 speech:{label:'Local speech processor',url:'/audio?tool=speech&start=speech',reviewed:true},
 transcribe:{label:'Local transcription processor',url:'/audio?tool=transcribe&start=transcribe',reviewed:true},
 dub:{label:'Local dubbing pipeline',url:'/audio?tool=dub&start=dub'}
};
export function outcomeCatalog(catalog,providers,{query='',category='all',location='all',openOnly=false}={}){
 const words=query.toLowerCase().trim().split(/\s+/).filter(Boolean);
 return OUTCOMES.map(task=>({...task,options:task.variants.flatMap(key=>{
  if(key.startsWith('tool:')){const t=TOOL_VARIANTS[key.slice(5)];return t&&(!openOnly||t.reviewed)?[{key,label:t.label,execution:'local',search:t.label,url:t.url}]:[];}
  if(!key.startsWith('provider:')){const w=catalog.find(w=>w.id===key);return w?[{key,label:w.model+(w.id==='seedance-draft'?' · draft preview':''),execution:w.execution,search:JSON.stringify(w)}]:[];}
  const [,id,variant]=key.split(':'),w=providers.find(w=>w.id===id);if(!w)return [];
  const f=variant==='local'||w.execution==='local'?w.featured:w;if(!f||variant==='local'&&f.execution!=='local')return [];
  return [{key,label:f.model,execution:f.execution,search:[f.model,f.title,f.summary,f.input,f.output].filter(Boolean).join(' '),verification:f.execution==='local'?f.verification:null}];
 }).filter(v=>(!openOnly||v.execution==='local')&&(location==='all'||v.execution===location)&&words.every(word=>(task.title+' '+task.summary+' '+v.label+' '+v.search).toLowerCase().includes(word)))})).filter(t=>t.options.length&&(category==='all'||category===t.category));
}
