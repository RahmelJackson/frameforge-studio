import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {workspaceConfig} from '../lib/workspace-paths.mjs';
import {ComfyClient} from '../lib/comfy.mjs';
import {setupDoctor} from '../lib/setup-doctor.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),config=workspaceConfig(root),argv=process.argv.slice(2);
const index=argv.indexOf('--workflow'),workflow=index>=0?argv[index+1]:undefined;
if(index>=0&&!workflow)throw Error('Supply a workflow ID after --workflow.');
const python=config.python??path.join(root,'runtime','media-env',...(process.platform==='win32'?['Scripts','python.exe']:['bin','python']));
const report=await setupDoctor({root,python,comfy:new ComfyClient(process.env.COMFY_URL??config.comfyUrl??'http://127.0.0.1:8188'),workflow,mode:workflow?'local':'browse'});
if(argv.includes('--json'))console.log(JSON.stringify(report,null,2));
else{console.log('Frameforge setup check\n');for(const check of report.checks)console.log((check.state==='ready'?'READY':check.state==='optional'?'OPTIONAL':'ACTION NEEDED')+' · '+check.label+'\n  '+check.detail);console.log('\n'+report.actions+'\nOpen /welcome or /setup in your running Studio for guided help.');}
process.exitCode=report.blocking?1:0;
