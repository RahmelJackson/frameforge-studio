import {TASKS,taskURL} from './studio-journeys.js';
import {availableCloud} from './workflow-panel.js';
import {onlineURL} from './online-handoff.js';
const extra={image:['product-shot','cover-image','keyframes','characters','boards'],video:['video-extend','video-motion'],idea:['director','timeline']};
const localGraphs={'image-create':'z-image','image-edit':'qwen-edit','product-shot':'qwen-edit','cover-image':'qwen-edit','image-animate':'wan-i2v'};
export function workflowOptions(material){return [...TASKS.filter(t=>t.start===material),...TASKS.filter(t=>t.start!==material&&(extra[material]??[]).includes(t.id))];}
export function recommendWorkflow({material='image',taskId,location='studio'}={}){
 const choices=workflowOptions(material),task=choices.find(t=>t.id===taskId)??choices[0];if(!task)return null;
 if(['ltx-vfx','flux3-edit','h3-animate'].includes(task.id)){
  if(!['studio','comfy','cloud','civitai'].includes(location))location='studio';
  return {task,location,available:location!=='civitai',url:taskURL(task),workflow:task.id,setup:taskURL(task),why:location==='civitai'?'These exact local graphs do not transfer into Civitai’s generator. Choose local ComfyUI or the recipe’s Cloud alternative.':location==='cloud'?'Open this recipe and choose its matching Cloud alternative. Review the model, inputs and credits in your account before running.':'Open the exact graph, model downloads and input package. Check local setup, then run it in compatible ComfyUI.',requires:location==='cloud'?'Your Comfy Cloud account and credits. No API key is collected here.':'Compatible ComfyUI, the listed model files, sufficient memory and applicable model permissions.'};
 }
 const route=new URL(taskURL(task),'http://localhost'),context=route.pathname.slice(1),input=Object.fromEntries(route.searchParams),cloud=availableCloud(context,input),cloudTask=cloud[0]??null;
 if(!['studio','comfy','cloud','civitai'].includes(location))location='studio';
 const portable=context==='create'||context==='images'&&['create','cinema','edit','relight','inpaint','upscale'].includes(input.tool)||context==='video-tools'&&['restyle','motion','extend','interpolate'].includes(input.tool);
 const unavailable=location==='cloud'&&!cloudTask||location==='comfy'&&!portable||location==='civitai'&&task.id!=='image-create';
 if(location!=='studio')route.searchParams.set('provider',location);
 const workflow=location==='cloud'?cloudTask:localGraphs[task.id]??null;
 const url=!unavailable&&location==='cloud'?onlineURL('cloud',cloudTask):!unavailable&&location==='civitai'?onlineURL('civitai'):route.pathname+route.search;
 const why=unavailable?location==='civitai'?'This Civitai handoff prepares new image prompts. This tool’s masks, reference inputs, video or audio processing do not transfer through it.':location==='cloud'?'There is no matching Cloud graph for this task yet. Choose the local studio or browse the supported Cloud recipes.':'This task uses studio planning or processing without a portable ComfyUI graph. Choose the local studio to use it.':location==='civitai'?'Prepare an image brief, then choose an available model and generate on Civitai. This does not import a ComfyUI graph.':location==='cloud'?'Prepare a graph without a local engine. Import it in Comfy Cloud and add reference media there when the starter needs it.':location==='comfy'?(context==='video-tools'?'Prepare the ComfyUI processing stage and input files here. The studio’s complete finishing and sound steps stay in the studio.':'Prepare your graph and input package here, then open it in your own ComfyUI editor.'):'Open the tool with a short guide. Add your inputs and review settings before running.';
 return {task,location,available:!unavailable,url,workflow,setup:workflow?'/library?collection=workflows&workflow='+workflow:null,why,requires:location==='civitai'?'A Civitai account, an available generation model and any required Buzz. No token is stored or credits spent here.':location==='cloud'?'Your Comfy Cloud account and credits. No local model, GPU or Cloud key is required here.':location==='comfy'?'Your own ComfyUI installation and the workflow’s required model files.':'The studio’s local tool and any required models. Workflow setup links explain the downloads.'};
}
