import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import path from 'node:path';
import {prepareProviderPlan,assertProviderPlan} from '../lib/provider-execution.mjs';
const root=new URL('../',import.meta.url).pathname.replace(/^\/([A-Z]:)/,'$1');
test('Masked FLUX native graph crops only the model reference and composites on the unchanged original grid',async()=>{
 const data=await mkdtemp(path.join(tmpdir(),'ff-flux-crop-'));try{await mkdir(path.join(data,'assets'));const asset='11111111-1111-4111-8111-111111111111.png',mask='22222222-2222-4222-8222-222222222222.png';for(const f of [asset,mask])await writeFile(path.join(data,'assets',f),'fixture');
 const p=await prepareProviderPlan({root,data,workflow:'flux3-image',context:'images',engines:[],input:{asset,mask,prompt:'Make the knob blue',seed:0},inspectImage:async()=>({width:1536,height:1024}),inspectMaskRegion:async()=>({box:[100,200,500,600],originalSize:[1536,1024],method:'test'})});
 assert.equal(p.request.tool,'inpaint');assert.deepEqual(p.request.size,[1536,1024]);assert.equal(p.files.length,2);
 const entries=Object.entries(p.api),find=type=>entries.find(([,n])=>n.class_type===type),[originalId,original]=entries.find(([,n])=>n.class_type==='LoadImage'&&n.inputs.image===asset),[cropId,crop]=find('ImageCrop'),[maskId]=entries.find(([,n])=>n.class_type==='LoadImage'&&n.inputs.image===mask),[compositeId,composite]=find('ImageCompositeMasked');
 assert.equal(original.inputs.image,asset);assert.deepEqual(crop.inputs,{image:[originalId,0],x:100,y:200,width:400,height:400});assert.deepEqual(find('ReferenceMultiLatent')[1].inputs['images.image0'],[cropId,0]);assert.deepEqual(composite.inputs.destination,[originalId,0]);assert.deepEqual(find('SaveImage')[1].inputs.images,[compositeId,0]);assert.deepEqual(find('ImageToMask')[1].inputs.image,[maskId,0]);assert.deepEqual(assertProviderPlan(p,p.graph),p.api);
 const bad=structuredClone(p.graph);bad.nodes.find(n=>n.type==='ImageCompositeMasked').widgets_values[0]=101;assert.throws(()=>assertProviderPlan(p,bad),/new provider workflow/);

 }finally{await rm(data,{recursive:true,force:true});}
});
