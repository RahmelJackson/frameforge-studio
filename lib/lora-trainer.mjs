// Runs one FLUX 3 Klein LoRA training job at a time with the isolated diffusers
// trainer (scripts/setup-trainer.mjs). Datasets come from the same export as
// the downloadable package; the finished LoRA is copied into ComfyUI's loras.
import {spawn} from 'node:child_process';
import {access,copyFile,mkdir,readFile,writeFile,rename,stat} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import {characterDataset} from './character-dataset.mjs';
import {trainerPaths} from './trainer-paths.mjs';

const now=()=>new Date().toISOString();
export function trainingArgs({script,dataset,output,trigger,steps,resolution}){
 return [script,'--pretrained_model_name_or_path=black-forest-labs/flux-3-image-klein-base','--dataset_name='+dataset,'--caption_column=text','--instance_prompt='+trigger,'--output_dir='+output,'--mixed_precision=bf16','--resolution='+resolution,'--train_batch_size=1','--gradient_checkpointing','--cache_latents','--rank=16','--lora_alpha=16','--optimizer=AdamW','--use_8bit_adam','--learning_rate=1e-4','--lr_scheduler=constant','--lr_warmup_steps=0','--max_train_steps='+steps,'--checkpointing_steps='+Math.max(250,Math.round(steps/4)),'--validation_prompt='+trigger+' in soft daylight, portrait','--validation_epochs=25','--seed=0'];
}
// tqdm writes "Steps:  42%|####  | 630/1500 [..]" with carriage returns.
export function parseProgress(text){const all=[...String(text).matchAll(/Steps:[^\n\r]*?(\d+)\/(\d+)/g)];if(!all.length)return null;const [,step,total]=all.at(-1);return {step:Number(step),total:Number(total)};}
export function huggingFaceSignedIn(env=process.env){if(env.HF_TOKEN||env.HUGGING_FACE_HUB_TOKEN)return Promise.resolve(true);const home=env.HF_HOME??path.join(os.homedir(),'.cache','huggingface');return access(path.join(home,'token')).then(()=>true,()=>false);}

export class LoraTrainer{
 constructor({root,data,loras,busy=()=>false,spawnProcess=spawn,signedIn=huggingFaceSignedIn}){Object.assign(this,{root,data,loras,busy,spawnProcess,signedIn});this.file=path.join(data,'training','runs.json');this.runs=[];this.child=null;}
 async open(){await mkdir(path.dirname(this.file),{recursive:true});try{this.runs=JSON.parse(await readFile(this.file,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}for(const r of this.runs)if(['preparing','training'].includes(r.status)){r.status='interrupted';r.error='Studio restarted while this run was training. Start it again.';}await this.persist();return this;}
 async persist(){const tmp=this.file+'.tmp';await writeFile(tmp,JSON.stringify(this.runs,null,1));await rename(tmp,this.file);}
 running(){return this.runs.some(r=>['preparing','training'].includes(r.status));}
 async status(){const paths=trainerPaths(this.root);let installed=true;try{await access(paths.python);await access(paths.script);await access(paths.receipt);}catch{installed=false;}return {installed,signedIn:await this.signedIn(),running:this.running(),runs:this.runs.slice(0,20),base:'black-forest-labs/flux-3-image-klein-base',note:'One run at a time on your GPU. ComfyUI loading of FLUX 3 LoRAs is not verified yet.'};}
 async start({character,steps=1500,resolution=768}){
  if(this.running())throw Error('A LoRA is already training. Wait for it or cancel it.');
  if(this.busy())throw Error('A render is running. Training needs the whole GPU; start it when renders finish.');
  steps=Number(steps);resolution=Number(resolution);if(!Number.isInteger(steps)||steps<200||steps>4000)throw Error('Choose 200–4000 training steps.');if(![512,768,1024].includes(resolution))throw Error('Choose 512, 768 or 1024 resolution.');
  const status=await this.status();if(!status.installed)throw Error('Install the LoRA trainer first (Settings → this button installs it into runtime/trainer-env).');if(!status.signedIn)throw Error('Accept the FLUX 3 Klein base terms on Hugging Face, then sign in once with "hf auth login" so the trainer can download it.');
  const id=randomUUID(),dir=path.join(this.data,'training',id),packet=await characterDataset(character,this.data,'flux3-klein-character');
  for(const f of packet.files){const target=path.join(dir,...f.name.split('/'));await mkdir(path.dirname(target),{recursive:true});if(f.path)await copyFile(f.path,target);else await writeFile(target,f.text);}
  const run={id,characterId:character.id,name:character.name,trigger:character.trigger,steps,resolution,status:'training',step:0,total:steps,log:'',createdAt:now(),updatedAt:now(),lora:null,error:null};
  this.runs.unshift(run);this.runs=this.runs.slice(0,50);await this.persist();
  const paths=trainerPaths(this.root),args=['-m','accelerate.commands.launch','--num_processes=1','--mixed_precision=bf16',...trainingArgs({script:paths.script,dataset:path.join(dir,'dataset','train'),output:path.join(dir,'output'),trigger:character.trigger,steps,resolution})];
  let child;try{child=this.spawnProcess(paths.python,args,{cwd:dir,windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,PYTHONUNBUFFERED:'1',PYTHONIOENCODING:'utf-8'}});}catch(error){run.status='failed';run.error=error.message;await this.persist();throw error;}
  this.child=child;let saved=Date.now();
  const append=chunk=>{run.log=(run.log+String(chunk).replace(/\x1b\[[0-9;]*m/g,'')).slice(-8000);const p=parseProgress(run.log);if(p){run.step=p.step;run.total=p.total;}run.updatedAt=now();if(Date.now()-saved>5000){saved=Date.now();void this.persist();}};
  child.stdout.on('data',append);child.stderr.on('data',append);
  const finish=async(code,error)=>{if(run.finished)return;run.finished=true;this.child=null;if(error)run.log+='\n'+error.message;
   if(run.status==='cancelling'){run.status='cancelled';}
   else if(code===0){const weights=path.join(dir,'output','pytorch_lora_weights.safetensors');try{await stat(weights);const name=character.trigger+'_flux3_klein_'+id.slice(0,8)+'.safetensors';const loras=typeof this.loras==='function'?this.loras():this.loras;await mkdir(loras,{recursive:true});await copyFile(weights,path.join(loras,name));run.lora={name,folder:'loras'};run.status='completed';run.step=run.total;}catch(e){run.status='failed';run.error='Training ended without a LoRA file: '+e.message;}}
   else{run.status='failed';run.error=/out of memory|CUDA out of memory/i.test(run.log)?'The GPU ran out of memory. Try 512 resolution or close other GPU apps.':/401|403|gated|access to model/i.test(run.log)?'Hugging Face refused the base model. Accept its terms and sign in with "hf auth login".':'Training stopped (exit '+code+'). See the log.';}
   run.updatedAt=now();await this.persist();};
  child.once('error',error=>void finish(1,error));child.once('close',code=>void finish(code));
  return run;
 }
 async cancel(id){const run=this.runs.find(r=>r.id===id);if(!run)throw Error('Training run not found.');if(!['training','preparing'].includes(run.status))return run;run.status='cancelling';await this.persist();const pid=this.child?.pid;if(pid){if(process.platform==='win32')spawn('taskkill',['/PID',String(pid),'/T','/F'],{windowsHide:true});else this.child.kill('SIGTERM');}return run;}
}
