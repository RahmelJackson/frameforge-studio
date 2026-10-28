export const WORKSPACES=[
 {id:'home',url:'/',icon:'⌂',name:'Explore',hint:'Home & Civitai inspiration',pages:['home','explore'],summary:'Choose a result, find a workflow or explore inspiration.',start:'Pick a starting point below. Nothing generates until you review the controls.',tabs:[]},
 {id:'library',url:'/library',icon:'▦',name:'Library',hint:'Distinct tasks & model choices',pages:['library','workflows'],summary:'Choose a task, compare its models and inspect the exact ComfyUI graph.',start:'Start with what you want to make. Each task contains its local and Cloud model options. My work holds your saved creations.',tabs:[{id:'workflows',url:'/library',label:'Workflows',hint:'Different tasks, model options, graphs and downloads'},{id:'library',url:'/library?collection=saved',label:'My work',hint:'Find, review and reuse saved results'}]},
 {id:'images',url:'/images',icon:'◇',name:'Images',hint:'Create, edit & keep references',pages:['images','continuity'],summary:'Make a still, edit an image or organize references for the next shot.',start:'Bring a prompt or a picture. Start with one image, inspect the result, then animate it in Video.',tabs:[{id:'images',url:'/images',label:'Create & edit',hint:'Generate, change, relight or enlarge'},{id:'boards',url:'/images?view=boards',label:'Moodboards',hint:'Collect a visual direction'},{id:'characters',url:'/images?view=characters',label:'Characters',hint:'Save original identity references'},{id:'continuity',url:'/continuity',label:'Scene references',hint:'Keep people, places and props together'}]},
 {id:'video',url:'/create',icon:'▷',name:'Video',hint:'Shots, edits & films',pages:['create','video-tools','short-film','director','film','recipes'],summary:'Create a single shot or carry a film from its story through generation, review and the final edit.',start:'For one clip, start with Generate or Edit & finish. For a film, begin with Story, direct its shots, then arrange them in Timeline.',tabs:[{id:'create',url:'/create',label:'Generate',hint:'Words or a still → a moving shot'},{id:'video-tools',url:'/video-tools',label:'Edit & finish',hint:'Footage → a refined clip'}]},
 {id:'audio',url:'/audio',icon:'♪',name:'Audio',hint:'Voice, subtitles & dialogue',pages:['audio'],summary:'Create speech, transcribe recordings, translate dialogue and prepare lip sync.',start:'Choose a task below. Use a short script for narration or bring a recording for transcription and dubbing.',tabs:[]}
];
export function workspaceFor(page){return WORKSPACES.find(g=>g.pages.includes(page))??null;}
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export function filmTabURL(url,context={}){const u=new URL(url,'http://localhost');for(const key of ['project','plan','shot']){u.searchParams.delete(key);if(uuid.test(context[key]??''))u.searchParams.set(key,context[key]);}return u.pathname+u.search;}
export function workspaceTab(page,params=new URLSearchParams()){
 const group=workspaceFor(page),view=params.get('view');if(page==='audio'){const tool=params.get('tool')??'speech';return group.tabs.find(t=>t.tools?.includes(tool))?.id??'voice';}
 return group?.tabs.find(t=>t.page===page&&t.panel===view)?.id??group?.tabs.find(t=>t.page===page&&t.view===view)?.id??page;
}

// One navigation model for page links and in-page panels. The same labels appear
// in the tabs, breadcrumbs and links, and every legacy panel remains reachable.
WORKSPACES.find(g=>g.id==='images').tabs=[
 {id:'images',page:'images',panel:'make',url:'/images',label:'Create & edit',hint:'Generate or change a still'},
 {id:'canvas',page:'images',panel:'canvas',url:'/images?view=canvas',label:'Canvas',hint:'Paint, box or extend an image'},
 {id:'image-library',page:'images',panel:'collection',url:'/images?view=collection',label:'Saved images',hint:'Review and reuse your stills'},
 {id:'boards',page:'images',panel:'boards',url:'/images?view=boards',label:'Moodboards',hint:'Arrange visual references'},
 {id:'characters',page:'images',panel:'characters',url:'/images?view=characters',label:'Characters',hint:'Save identity references'},
 {id:'sets',page:'images',panel:'sets',url:'/images?view=sets',label:'Photo sets',hint:'Render a small image series'},
 {id:'continuity',url:'/continuity',label:'Scene references',hint:'People, places, props and style'}
];
WORKSPACES.find(g=>g.id==='video').tabs=[
 {id:'recipes',url:'/recipes',label:'Creative recipes',hint:'Connected productions, subjects, motions and variations'},
 {id:'create',page:'create',view:'studio',url:'/create',label:'Generate',hint:'Words or a still into a moving shot'},
 {id:'video-tools',page:'video-tools',view:'edit',url:'/video-tools',label:'Edit & finish',hint:'Trim, crop, captions and sound'},
 {id:'video-library',page:'create',view:'gallery',url:'/create?view=gallery',label:'Saved clips',hint:'Generated takes and saved results'},
 {id:'edited-clips',page:'video-tools',view:'library',url:'/video-tools?view=library',label:'Edited clips',hint:'Your processed footage'},
 {id:'compare',page:'create',view:'compare',url:'/create?view=compare',label:'Compare takes',hint:'Review clips side by side'},
 {id:'queue',page:'create',view:'queue',url:'/create?view=queue',label:'Make variations',hint:'Plan sequential local renders'},
 {id:'assets',page:'create',view:'assets',url:'/create?view=assets',label:'References',hint:'Saved source media and recipes'},
 {id:'checks',page:'create',view:'checks',url:'/create?view=checks',label:'Checks',hint:'Inspect verification reports'},
 {id:'storyboard',page:'video-tools',view:'story',url:'/video-tools?view=story',label:'Narrated storyboard',hint:'Stills, narration and captions'},
 {id:'story-plan',page:'create',view:'story',url:'/create?view=story',label:'Story planner',hint:'Plan a sequence of shots'},
 {id:'projects',page:'create',view:'projects',url:'/create?view=projects',label:'All film projects',hint:'Your saved film collections'},
 {id:'guide',page:'create',view:'guide',url:'/create?view=guide',label:'Video help',hint:'Learn the generation controls'},
 {id:'short-film',url:'/short-film',label:'Story',hint:'Script, storyboard and selected takes'},
 {id:'director',url:'/director',label:'Director',hint:'Detailed production shot plans',aria:'Director'},
 {id:'film',url:'/film',label:'Timeline',hint:'Trims, transitions, sound and export'}
];
WORKSPACES.find(g=>g.id==='audio').tabs=[
 {id:'voice',page:'audio',audioGroup:'voice',tools:['speech','expressive','convert'],url:'/audio?tool=speech',label:'Voice',hint:'Narration, expression and conversion'},
 {id:'dialogue',page:'audio',audioGroup:'dialogue',tools:['dialogue'],url:'/audio?tool=dialogue',label:'Dialogue',hint:'Assign voices and pauses'},
 {id:'words',page:'audio',audioGroup:'words',tools:['transcribe','dub','separate','caption'],url:'/audio?tool=transcribe',label:'Transcribe & dub',hint:'Words, subtitles and translation'},
 {id:'lips',page:'audio',audioGroup:'lips',tools:['lipsync'],url:'/audio?tool=lipsync',label:'Lip sync',hint:'Match face footage to speech'}
 ];
 export const IMAGE_TOOL_GROUPS=[
 {label:'Make',ids:['create','cinema']},
 {label:'Change',ids:['edit','select','inpaint','upscale','relight']},
 {label:'Characters & references',ids:['character','continuity','face-anchor','prop-place']},
 {label:'Labs · experimental & research',ids:['style-board','views','identity-pose','face-neural','face-match','face-swap','character-swap']}
];
export function groupedImageTools(tools){const used=new Set();const groups=IMAGE_TOOL_GROUPS.map(g=>({label:g.label,tools:g.ids.flatMap(id=>{const t=tools.find(t=>t.id===id);if(t)used.add(id);return t?[t]:[];})}));const extra=tools.filter(t=>!used.has(t.id));if(extra.length)groups.push({label:'More tools',tools:extra});return groups.filter(g=>g.tools.length);}

export const VIDEO_STEPS=['recipes','create','video-tools','short-film','director','film'];
export function workspaceTabGroups(group,page,params=new URLSearchParams()){if(group.id!=='video')return [{label:group.name+' tools',tabs:group.tabs}];const main=VIDEO_STEPS.map(id=>group.tabs.find(t=>t.id===id));return [{label:'Video steps',tabs:main}];}
