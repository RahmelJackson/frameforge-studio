import {readdir,readFile,lstat,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import {writeZip} from '../lib/workflow-exports.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const roots=['lib','public','scripts','setup','workflows','tests','skills','assets'];
const top=['MODEL-WORKFLOW-PLAN.md','INTEGRATION-UPGRADE.md','server.mjs','package.json','plugin.json','mcp.json','.agents/plugins/marketplace.json','LICENSE','.gitignore','.gitattributes','config.example.json','DISTRIBUTION-README.md','GITHUB-SETUP.md','THIRD-PARTY-NOTICES.md','BUILD-LOOP.md','REMAINING-CHECKLIST.md','REVIEW-FIXES.md','MCP-GUIDE.md','OPEN-WEIGHTS.md','CHALLENGE-CHECKLIST.md','COMFY-HUB-COMPARISON.md','DEMO-SCRIPT.md','MCP-CLIENT-ACCEPTANCE.md','ASSISTANT-CONNECTIONS.md','WORKSPACE-GUIDE.md','PLUGIN-GUIDE.md','PLUGIN-ACCEPTANCE.md'];
const allowedArt=new Set(['observatory-preview.jpg','portrait-preview.jpg','product-preview.jpg','observatory-concept.png','portrait-concept.png','product-concept.png','compass.svg','moon.svg','character.svg','knight.svg','robot.svg','bicycle.svg','mcp-observatory.png','mcp-portrait.png','mcp-product.png','observatory-motion.mp4','observatory-motion.json']);
export async function sourceInventory(directory=root){
 const files=[];
 async function visit(relative){if(relative.split('/').includes('__pycache__')||relative==='scripts/judge-demo'||relative.startsWith('scripts/judge-demo/'))return;const full=path.join(directory,relative),info=await lstat(full);if(info.isSymbolicLink())throw Error('Source package refuses junction/symlink: '+relative);if(info.isDirectory()){for(const name of await readdir(full))await visit(relative+'/'+name);return;}
  // The old demonstration JPEG is not part of the public source release.
  if(['scripts/move-storage-to-d.ps1','scripts/move-desktop-models-to-d.ps1','scripts/research-reference-mode.mjs','public/sample.jpg','setup/comfy-engine-source.zip','setup/image-model-paths.yaml'].includes(relative))return;
  if(!/\.(mjs|js|json|html|css|svg|png|jpg|py|ps1|md|txt|woff2)$/.test(relative)&&!['.gitignore','.gitattributes','LICENSE','setup/latentsync-notices/LICENSE','workflows/upstream/LICENSE','workflows/bonus/LICENSE','public/explore-art/observatory-motion.mp4'].includes(relative)&&!/^tests\/fixtures\/(reference\.(jpg|webp))$/.test(relative))throw Error('Unexpected source file type: '+relative);
  if(/(?:^|\/)(?:node_modules|__pycache__|\.git|data|runtime|evidence|backups|models|dist)(?:\/|$)/i.test(relative))throw Error('Private/runtime directory inside source roots: '+relative);
  if(relative.startsWith('public/explore-art/')&&!allowedArt.has(path.basename(relative)))throw Error('Unreviewed public artwork: '+relative);
  if(/\.(png|jpg|svg)$/.test(relative)&&!relative.startsWith('public/explore-art/')&&!/^tests\/fixtures\/(?:(reference|wide|broken)\.png|reference\.jpg)$/.test(relative)&&!['public/text-frame.svg','assets/frameforge.svg','assets/studio-cover.png','assets/studio-workflows.png'].includes(relative))throw Error('Review media before packaging: '+relative);
  if(relative.endsWith('.woff2')&&relative!=='public/fonts/InterVariable.woff2')throw Error('Unreviewed font: '+relative);
  if(info.size>20*1024**2)throw Error('Large binary in source: '+relative);
  const data=await readFile(full);if(!/\.(png|jpg|svg)$/.test(relative)&&/(?:-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----|gh[pousr]_[A-Za-z0-9]{30,}|sk-[A-Za-z0-9_-]{30,}|(?:api[_-]?key|token|password)\s*[=:]\s*["'][A-Za-z0-9_-]{24,}["'])/i.test(data.toString()))throw Error('Possible credential in '+relative+'; review it before sharing.');
  files.push({name:relative.replaceAll('\\','/'),file:full,bytes:info.size,sha256:createHash('sha256').update(data).digest('hex')});
 }
 for(const folder of roots)await visit(folder);for(const name of top){const before=files.length;try{await visit(name);}catch(error){if(name!=='DISTRIBUTION-README.md'||error.code!=='ENOENT')throw error;await visit('README.md');}if(files.length!==before+1)throw Error('Missing source metadata.');if(name==='DISTRIBUTION-README.md')files.at(-1).name='README.md';}
 // Keep the legacy sample URL usable with a project-owned illustration. PNG
 // bytes are decoded by image content, including in Pillow and the browser.
 const sample=files.find(f=>f.name==='public/explore-art/observatory-concept.png');if(!sample)throw Error('Missing original sample illustration.');files.push({...sample,name:'public/sample.jpg'});
 return files.sort((a,b)=>a.name.localeCompare(b.name));
}
export async function packageSource(){const files=await sourceInventory();await mkdir(path.join(root,'dist'),{recursive:true});const stamp=new Date().toISOString().replace(/[:.]/g,'-');const manifest={version:1,created:new Date().toISOString(),files:files.map(({name,bytes,sha256})=>({name,bytes,sha256})),excluded:['private deployments','models','runtime','data','evidence','backups','personal config','credentials','git history'],license:'MIT for original project code; third-party files retain their own licenses.',destination:'RahmelJackson/frameforge-studio',publication:'Clean source snapshot for the public repository. See GITHUB-SETUP.md and third-party notices.'};const manifestFile=path.join(root,'dist','source-manifest.json');await writeFile(manifestFile,JSON.stringify(manifest,null,2));const output=path.join(root,'dist','frameforge-source-'+stamp+'.zip');await writeZip([...files.map(({name,file,sha256})=>({name,path:file,sha256})),{name:'source-manifest.json',path:manifestFile}],output);return {output,files:files.length,sourceBytes:files.reduce((n,f)=>n+f.bytes,0)};}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)console.log(JSON.stringify(await packageSource(),null,2));
