import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
// Pinned FLUX 3 Klein LoRA trainer (diffusers DreamBooth script) and where it lives.
export const DIFFUSERS_COMMIT='86ef420b17363c28e36ebad6b58555e9aa8feda2';
export const TRAINER_SCRIPT='train_dreambooth_lora_flux3_klein.py';
// Upstream requirements_flux3_klein.txt at the pinned commit, minus torchvision
// (provided by the engine environment).
export const TRAINER_REQUIREMENTS=['accelerate>=0.31.0','transformers>=4.57.0','ftfy','tensorboard','Jinja2','peft>=0.11.1','sentencepiece','bitsandbytes','prodigyopt','datasets>=3.1.0'];
export function trainerPaths(base=root){const env=path.join(base,'runtime','trainer-env');return {env,python:path.join(env,process.platform==='win32'?'Scripts/python.exe':'bin/python'),script:path.join(base,'runtime','trainers',TRAINER_SCRIPT),receipt:path.join(base,'runtime','trainers','receipt.json')};}
