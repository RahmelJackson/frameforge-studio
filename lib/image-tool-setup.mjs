import {readFile} from 'node:fs/promises';import path from 'node:path';
import {normalizeImage,buildImageWorkflow,IMAGE_TOOLS} from './images.mjs';
import {apiToCanvas} from '../public/workflow-graph.js';
import {modelDependencies} from './workflow-catalog.mjs';
export async function imageToolSetup(root,tool){
 if(!['create','cinema','edit','relight','inpaint','upscale','views','character','face-swap','character-swap','identity-pose'].includes(tool))throw Object.assign(Error('Use the complete setup page for this image processor.'),{statusCode:400});
 const placeholder='11111111-1111-4111-8111-111111111111.png',request=normalizeImage({tool,prompt:'Check required models',asset:placeholder,reference:placeholder,mask:placeholder,seed:1}),api=buildImageWorkflow(request,{asset:placeholder,reference:placeholder,mask:tool==='inpaint'?placeholder:null},'Frameforge/setup');
 const [info,lock]=await Promise.all(['workflows/node-schemas.json','workflows/models.json'].map(f=>readFile(path.join(root,f),'utf8').then(JSON.parse))),graph=apiToCanvas(api,info);
 return {id:'image-tool:'+tool,name:IMAGE_TOOLS.find(t=>t.id===tool).name,execution:'local',graph,...modelDependencies(graph,lock),requirements:'Files and nodes for this exact image tool. Install them in your own ComfyUI model folders. No input image is needed for this setup check.'};
}
