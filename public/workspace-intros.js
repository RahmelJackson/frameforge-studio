// Goal pickers at the top of each section. Instead of a wall of tools, each
// section opens with "What do you want to do?" and a handful of plain-language
// goals that lead to the exact tool or template, with the full tools below.
const introductions={
 images:{label:'Images',title:'What do you want to do with images?',copy:'Pick a goal. Each one opens the right tool with the steps explained. Every image tool is still below.',start:'#image-form',goals:[
  ['/templates?template=create-image','Make a picture from words','Describe it, get a still','art-image.svg'],
  ['/templates?template=edit-image','Change one thing in a photo','Background, outfit or light','art-edit.svg'],
  ['/templates?template=restyle-image','Give it a new style','Painting, illustration, film look','art-style.svg'],
  ['/templates?template=remove-background','Cut out a person or product','Clean transparent edge','art-cutout.svg'],
  ['/images?view=characters','Keep a character consistent','Save a face, reuse it everywhere','art-drama.svg'],
  ['/templates?template=photo-to-3d','Turn a photo into a 3D prop','Use it in the 3D scene','art-scene3d.svg']]},
 create:{label:'Video',title:'What kind of video are you making?',copy:'Pick a goal. Produce makes a whole video from one idea; the others make one shot at a time. Every video tool is still below.',start:'#shot-form',goals:[
  ['/produce','A whole video from one idea','Shots, voice, captions and a cut','art-produce.svg'],
  ['/templates?template=animate-image','Bring a still to life','One picture becomes a clip','art-animate.svg'],
  ['/templates?template=performance-transfer','Move a character with my moves','Your clip drives the motion','art-motion.svg'],
  ['/scene','Block the shot in 3D first','Stand-ins and a camera move','art-scene3d.svg'],
  ['/templates?template=talking-photo','Make a photo talk','A portrait plus a voice','art-talk.svg'],
  ['/templates?template=seamless-loop','Make a seamless loop','For GIFs and backgrounds','art-loop.svg']]},
 'video-tools':{label:'Video · edit & finish',title:'What do you want to fix or change?',copy:'Bring a clip and pick a goal. Every edit and finishing tool is still below.',start:'#video-tool-form',goals:[
  ['/templates?template=upscale-video','Make it sharper and smoother','Upscale and add frames','art-upscale.svg'],
  ['/templates?template=character-replace','Replace a person','Keep the motion, swap who it is','art-replace.svg'],
  ['/video-tools?tool=reframe','Fit another screen','16:9 to vertical and back','art-phone.svg'],
  ['/video-tools?tool=relight','Change the light','Warmer, darker, golden hour','art-style.svg'],
  ['/video-tools?tool=extend','Make the clip longer','Continue before or after','art-animate.svg'],
  ['/video-tools?tool=segment','Change just one subject','Track it with SAM, then edit','art-cutout.svg']]},
 audio:{label:'Audio',title:'What should it sound like?',copy:'Pick a goal. Voices, subtitles and music all run on your own computer. Every audio tool is still below.',start:'#audio-form',goals:[
  ['/audio?tool=speech','Narrate a script','Type it, pick a voice','art-talk.svg'],
  ['/audio?tool=transcribe','Subtitles from a recording','Editable, timed captions','art-sound.svg'],
  ['/audio?tool=dub','Dub into another language','Translate, revoice, keep timing','art-drama.svg'],
  ['/audio?tool=lipsync','Lip-sync a face to a voice','Mouth follows the words','art-phone.svg'],
  ['/templates?template=music-bed','Compose a music bed','Background music from a mood','art-music.svg'],
  ['/templates?template=sound-effects','Add sound effects','Footsteps, rain, whooshes','art-loop.svg']]},
 workflows:{label:'Library',title:'Looking for something specific?',copy:'Start with the result you want. Each workflow explains its inputs, models, downloads and ComfyUI graph before you run it.',start:'#workflow-search',goals:[
  ['/templates','Browse templates','Ready-to-run starting points','art-image.svg'],
  ['/produce','Make a whole video','Produce plans and renders it','art-produce.svg'],
  ['/recipes','Follow a creative recipe','Chain subjects, motion and shots','art-motion.svg'],
  ['/short-film','Cut a short film','From selected takes to a rough cut','art-drama.svg'],
  ['/setup#workflow-models','Get the models I need','Plug-and-play download bundles','art-upscale.svg'],
  ['/native-workflows','Open a ComfyUI graph','Every graph Studio runs, editable','art-edit.svg']]},
 advanced:{label:'Advanced',title:'Specialist tools',copy:'For when you want more control. Most people never need these, but they are here when you do.',start:'#advanced-content',goals:[
  ['/scene','Block a scene in 3D','Tagged stand-ins become the shot','art-scene3d.svg'],
  ['/advanced?section=3d','3D props and multiview','Geometry and turnarounds','art-cutout.svg'],
  ['/advanced?section=selection','Precise selections','SAM masks for images and video','art-replace.svg'],
  ['/creator?tab=characters','Train a character LoRA','FLUX 3 LoRA on your GPU','art-drama.svg']]}
};
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function workspaceIntro(page,params=new URLSearchParams()){
 const key=page==='library'&&params.get('collection')!=='saved'?'workflows':page,c=introductions[key];if(!c)return '';
 return `<section class="creative-page-title goal-picker" aria-label="${esc(c.label)}: what do you want to do?" data-workspace-intro="${key}"><div class="goal-picker-head"><div><p class="creative-title-kicker">${esc(c.label)} · start here</p><h1>${esc(c.title)}</h1><p class="goal-picker-copy">${esc(c.copy)}</p></div><div class="goal-picker-actions"><button type="button" data-find-tool>Not sure? Ask the Guide</button><a href="${c.start}" class="intro-start">All tools ↓</a><button class="creative-intro-toggle" type="button" aria-expanded="true">Hide starting ideas ↑</button></div></div><div class="creative-ideas goal-grid" aria-label="Goals">${c.goals.map(([href,title,copy,art])=>`<a href="${href}"><img src="/explore-art/${art}" alt="" loading="lazy"><span><strong>${esc(title)}</strong><small>${esc(copy)}</small></span></a>`).join('')}</div></section>`;
}
export const WORKSPACE_GOALS=introductions;
