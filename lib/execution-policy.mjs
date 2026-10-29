import nativeOpenGraphs from '../workflows/native/open-graphs.json' with {type:'json'};
import {createHash} from 'node:crypto';
import {NATIVE_WORKFLOWS} from '../public/native-catalog.js';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';

export const OPEN_WORKFLOW_IDS=[...NATIVE_WORKFLOWS.filter(w=>w.openWeightsReviewed).map(w=>w.id),'ltx-vfx','flux3-image','minimax-h3-local','sam-image','wan-i2v','wan-camera','z-image','qwen-edit'];
const nodes=new Set('CheckpointLoaderSimple SAM3_Detect MaskToImage PrimitiveString PrimitiveBoundingBox UNETLoader CLIPLoader DualCLIPLoader VAELoader LoadImage LoadImageMask CLIPTextEncode Wan22ImageToVideoLatent ModelSamplingSD3 KSampler KSamplerAdvanced VAEDecode VAEEncode CreateVideo SaveVideo SaveImage LoraLoaderModelOnly LoraLoader ConditioningZeroOut ModelSamplingAuraFlow EmptySD3LatentImage EmptyHunyuanLatentVideo EmptyLatentImage TextEncodeQwenImageEditPlus CFGNorm ImageScale WanCameraImageToVideo WanCameraEmbedding WanFirstLastFrameToVideo WanImageToVideo ImageCrop ImageCompositeMasked SetLatentNoiseMask ImageUpscaleWithModel UpscaleModelLoader ImageScaleBy ConditioningSetMask ConditioningCombine ConditioningConcat'.split(' '));
export function policyError(message){const error=Error('Open weights only: '+message);error.statusCode=403;return error;}
export function assertOpenWorkflow(id){if(!OPEN_WORKFLOW_IDS.includes(id))throw policyError('choose a reviewed local graph. Partner templates are disabled.');}
export function assertOpenInput(context,input={}){
 if(!['images','create','video-tools','audio'].includes(context)||!input||typeof input!=='object'||Array.isArray(input))throw policyError('choose a supported local task.');
 if(input.provider==='cloud')throw policyError('partner/cloud generation handoffs are disabled in this local-only profile.');
 if(context==='images'&&!['select','create','cinema','edit','relight','inpaint','upscale'].includes(input.tool??'create'))throw policyError('this image pipeline has not been audited for the strict profile. Use a reviewed image creation/edit graph.');
 if(context==='create'&&!['wan5b','camera','keyframes'].includes(input.engine??'wan5b'))throw policyError('choose a reviewed Wan generation engine.');
 if(context==='video-tools'&&(!['finish','shorts','story','reframe'].includes(input.tool??'finish')||String(input.narration??'').trim()||input.reframeRecovery))throw policyError('use ordinary local finishing with an existing soundtrack; model-based video processors and Windows narration need separate dependency review.');
 if(context==='audio'&&(!['speech','transcribe'].includes(input.tool)||input.lipSync===true||input.tool==='transcribe'&&!['small',undefined].includes(input.asrModel)))throw policyError('the audited audio routes are Kokoro narration and Whisper small transcription. Other speech pipelines require separate review.');
}
export function assertOpenGraph(graph,models){
 const native=nativeOpenGraphs.find(e=>e.sha256===createHash('sha256').update(JSON.stringify(graph)).digest('hex'));if(native)return {profile:'open-weights-only',nodeTypes:[...new Set(graph.nodes.map(n=>n.type))],modelNames:native.modelNames,verification:'Exact pinned native graph; original model terms, byte integrity and media provenance still apply.'};
 const names=new Set(models.map(m=>m.name));const list=Array.isArray(graph?.nodes)?graph.nodes:Object.values(graph??{});
 if(!list.length)throw policyError('a nonempty reviewed graph is required.');
 const loaderKeys={CheckpointLoaderSimple:['ckpt_name'],UNETLoader:['unet_name'],CLIPLoader:['clip_name'],DualCLIPLoader:['clip_name1','clip_name2'],VAELoader:['vae_name'],LoraLoader:['lora_name'],LoraLoaderModelOnly:['lora_name'],UpscaleModelLoader:['model_name']};
 for(const node of list){const type=node.type??node.class_type;if(!nodes.has(type))throw policyError('unreviewed or partner node '+String(type)+'.');if(loaderKeys[type]){const count=loaderKeys[type].length,values=Array.isArray(node.widgets_values)?node.widgets_values.slice(0,count):loaderKeys[type].map(key=>node.inputs?.[key]);for(const value of values){if(typeof value!=='string'||!names.has(value.split(/[\\/]/).at(-1)))throw policyError('model '+String(value)+' is absent from the reviewed source manifest.');}if(values.length!==count)throw policyError('a loader is missing its model selection.');}}
 return {profile:'open-weights-only',nodeTypes:[...new Set(list.map(n=>n.type??n.class_type))],modelNames:[...new Set(list.flatMap(n=>(n.widgets_values??Object.values(n.inputs??{})).filter(v=>typeof v==='string'&&names.has(v.split(/[\\/]/).at(-1))).map(v=>v.split(/[\\/]/).at(-1))))],verification:'Reviewed node types and model source names; actual installed model bytes and imported-media provenance require separate verification.'};
}
export class ExecutionPolicy{
 constructor({file,locked=false}){this.file=file;this.locked=locked;this.openWeightsOnly=locked;}
 get enabled(){return this.locked||this.openWeightsOnly;}
 async open(){try{const value=JSON.parse(await readFile(this.file,'utf8'));this.openWeightsOnly=this.locked||value.openWeightsOnly===true;}catch(error){if(error.code!=='ENOENT')throw error;}return this;}
 describe(){return {openWeightsOnly:this.enabled,locked:this.locked,profile:this.enabled?'open-weights-only':'all-workflows',reviewedWorkflows:OPEN_WORKFLOW_IDS,audio:['Kokoro narration','Whisper transcription'],note:'Open weights describes model availability, not an OSI license for every model or automatic contest eligibility. Model terms and imported-media rights still apply.'};}
 async set(value){if(typeof value!=='boolean')throw Error('Choose an open-weights setting.');if(this.locked&&!value)throw policyError('this launcher locks the profile. Restart with the ordinary launcher to use other providers.');await mkdir(path.dirname(this.file),{recursive:true});await writeFile(this.file,JSON.stringify({openWeightsOnly:value},null,2)+'\n');this.openWeightsOnly=value;return this.describe();}
}
