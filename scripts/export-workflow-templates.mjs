import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {buildWorkflow,buildCameraWorkflow} from '../lib/workflow.mjs';
import {buildImageWorkflow,normalizeImage} from '../lib/images.mjs';
import {apiToCanvas} from '../public/workflow-graph.js';
const info=await(await fetch(process.env.COMFY_URL??'http://127.0.0.1:8188/object_info')).json();
const r={aspect:'landscape',length:'preview',preset:'locked',prompt:'A quiet observatory at dusk. A slow cinematic shot.',seed:1,steps:12,fps:24,look:{},cameraPose:'Zoom In',cameraSpeed:1};
const graphs={'wan-i2v':buildWorkflow(r,'choose-your-image.png','Frameforge/video'),'wan-camera':buildCameraWorkflow(r,'choose-your-image.png','Frameforge/camera'),'z-image':buildImageWorkflow(normalizeImage({tool:'create',prompt:'An observatory at dusk',seed:1,aspect:'landscape'})), 'qwen-edit':buildImageWorkflow(normalizeImage({tool:'edit',prompt:'Change the lighting to warm sunset',seed:1,aspect:'landscape',asset:'11111111-1111-4111-8111-111111111111.png'}),{asset:'11111111-1111-4111-8111-111111111111.png'})};
await mkdir('workflows/local',{recursive:true});
for(const [id,api] of Object.entries(graphs)){const canvas=apiToCanvas(api,info);await writeFile('workflows/local/'+id+'.json',JSON.stringify(canvas,null,2)+'\n');}
const lock=JSON.parse(await readFile('setup/models.lock.json','utf8')),images=JSON.parse(await readFile('setup/image-models.lock.json','utf8'));
const extras=[...JSON.parse(await readFile('setup/video-edit-models.lock.json','utf8')),...JSON.parse(await readFile('setup/round12-models.lock.json','utf8'))];
const advanced=JSON.parse(await readFile('setup/advanced-models.lock.json','utf8')).filter(m=>['vace14','sdxl','canny','photomaker'].includes(m.group)).map(m=>({repo:m.repository,revision:m.revision,path:m.filename,name:m.path.split('/').at(-1),directory:m.path.split('/').at(-2),bytes:m.bytes,sha256:m.sha256}));
const models=[...lock.files.map(m=>({...m,repo:lock.repository,revision:lock.revision,path:'split_files/'+m.directory+'/'+m.name})),...[...images,...extras].map(m=>({...m,name:m.path.split('/').at(-1)})),...advanced].map(m=>({...m,url:`https://huggingface.co/${m.repo}/resolve/${m.revision}/${m.path}`,licenseUrl:`https://huggingface.co/${m.repo}/tree/${m.revision}`,destination:'models/'+m.directory+'/'+m.name}));
await writeFile('workflows/models.json',JSON.stringify(models,null,2)+'\n');
console.log('Exported four ComfyUI canvas workflows and pinned model download metadata. No inference submitted.');

