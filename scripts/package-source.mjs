import {readdir,readFile,lstat,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import {writeZip} from '../lib/workflow-exports.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const roots=['lib','public','scripts','setup','workflows','tests'];
const top=['server.mjs','package.json','LICENSE','.gitignore','.gitattributes','config.example.json','DISTRIBUTION-README.md','GITHUB-SETUP.md','THIRD-PARTY-NOTICES.md','BUILD-LOOP.md','REMAINING-CHECKLIST.md'];
const allowedArt=new Set(['observatory-concept.png','portrait-concept.png','product-concept.png','compass.svg','moon.svg','character.svg','knight.svg','robot.svg','bicycle.svg']);
export async function sourceInventory(directory=root){
 const files=[];
 async function visit(relative){if(relative.split('/').includes('__pycache__'))return;const full=path.join(directory,relative),info=await lstat(full);if(info.isSymbolicLink())throw Error('Source package refuses junction/symlink: '+relative);if(info.isDirectory()){for(const name of await readdir(full))await visit(relative+'/'+name);return;}
  // The old demonstration JPEG is not part of the public source release.
  if(['public/sample.jpg','setup/comfy-engine-source.zip','setup/image-model-paths.yaml'].includes(relative))return;
  if(!/\.(mjs|js|json|html|css|svg|png|py|ps1|md|txt)$/.test(relative)&&!['.gitignore','.gitattributes','LICENSE','setup/latentsync-notices/LICENSE','workflows/upstream/LICENSE'].includes(relative)&&!/^tests\/fixtures\/(reference\.(jpg|webp))$/.test(relative))throw Error('Unexpected source file type: '+relative);
  if(/(?:^|\/)(?:node_modules|__pycache__|\.git|data|runtime|evidence|backups|models|dist)(?:\/|$)/i.test(relative))throw Error('Private/runtime directory inside source roots: '+relative);
  if(relative.startsWith('public/explore-art/')&&!allowedArt.has(path.basename(relative)))throw Error('Unreviewed public artwork: '+relative);
  if(/\.(png|svg)$/.test(relative)&&!relative.startsWith('public/explore-art/')&&!/^tests\/fixtures\/(reference|wide|broken)\.png$/.test(relative)&&relative!=='public/text-frame.svg')throw Error('Review media before packaging: '+relative);
  if(info.size>20*1024**2)throw Error('Large binary in source: '+relative);
  const data=await readFile(full);if(!/\.(png|svg)$/.test(relative)&&/(?:-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----|gh[pousr]_[A-Za-z0-9]{30,}|sk-[A-Za-z0-9_-]{30,}|(?:api[_-]?key|token|password)\s*[=:]\s*["'][A-Za-z0-9_-]{24,}["'])/i.test(data.toString()))throw Error('Possible credential in '+relative+'; review it before sharing.');
  files.push({name:relative.replaceAll('\\','/'),file:full,bytes:info.size,sha256:createHash('sha256').update(data).digest('hex')});
 }
 for(const folder of roots)await visit(folder);for(const name of top){const before=files.length;try{await visit(name);}catch(error){if(name!=='DISTRIBUTION-README.md'||error.code!=='ENOENT')throw error;await visit('README.md');}if(files.length!==before+1)throw Error('Missing source metadata.');if(name==='DISTRIBUTION-README.md')files.at(-1).name='README.md';}
 // Keep the legacy sample URL usable with a project-owned illustration. PNG
 // bytes are decoded by image content, including in Pillow and the browser.
 const sample=files.find(f=>f.name==='public/explore-art/observatory-concept.png');if(!sample)throw Error('Missing original sample illustration.');files.push({...sample,name:'public/sample.jpg'});
 return files.sort((a,b)=>a.name.localeCompare(b.name));
}
export async function packageSource(){const files=await sourceInventory();await mkdir(path.join(root,'dist'),{recursive:true});const stamp=new Date().toISOString().replace(/[:.]/g,'-');const manifest={version:1,created:new Date().toISOString(),files:files.map(({name,bytes,sha256})=>({name,bytes,sha256})),excluded:['models','runtime','data','evidence','backups','personal config','credentials','git history'],license:'MIT for original project code; third-party files retain their own licenses.',destination:'RahmelJackson/frameforge-studio',publication:'Clean source snapshot for the public repository. See GITHUB-SETUP.md and third-party notices.'};const manifestFile=path.join(root,'dist','source-manifest.json');await writeFile(manifestFile,JSON.stringify(manifest,null,2));const output=path.join(root,'dist','frameforge-source-'+stamp+'.zip');await writeZip([...files.map(({name,file,sha256})=>({name,path:file,sha256})),{name:'source-manifest.json',path:manifestFile}],output);return {output,files:files.length,sourceBytes:files.reduce((n,f)=>n+f.bytes,0)};}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)console.log(JSON.stringify(await packageSource(),null,2));
