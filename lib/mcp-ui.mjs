import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
export const STUDIO_UI_ART=['mcp-observatory.png','mcp-portrait.png','mcp-product.png'];
export const STUDIO_UI_MEDIA=['observatory-motion.mp4'];
export const LEGACY_STUDIO_UI_URI='ui://frameforge/studio-v1.html';
export const PREVIOUS_STUDIO_UI_URI='ui://frameforge/studio-v3.html';
export const STUDIO_UI_URI='ui://frameforge/studio-v8.html';
export const STUDIO_UI_MIME='text/html;profile=mcp-app';
export async function legacyStudioUIResource(base){const root=new URL('../public/',import.meta.url),[html,css,js]=await Promise.all(['mcp-app.html','mcp-app.css','mcp-app.js'].map(file=>readFile(fileURLToPath(new URL(file,root)),'utf8')));const helper=(await readFile(new URL('mcp-workflow-inputs.js',root),'utf8')).replace(/^export /gm,'');const script=helper+'\n'+js.replace(/^import .*mcp-workflow-inputs\.js.*\r?\n/m,'');const artwork=Object.fromEntries(await Promise.all(STUDIO_UI_ART.map(async name=>[name,'data:image/png;base64,'+(await readFile(new URL('explore-art/'+name,root))).toString('base64')]))),media=Object.fromEntries(await Promise.all(STUDIO_UI_MEDIA.map(async name=>[name,'data:video/mp4;base64,'+(await readFile(new URL('explore-art/'+name,root))).toString('base64')])));let text=html.replace('<link rel="stylesheet" href="/mcp-app.css">','<style>'+css+'</style>').replace('<script type="module" src="/mcp-app.js"></script>','<script type="module">const STUDIO_ORIGIN='+JSON.stringify(base).replaceAll('<','\\u003c')+';\nconst STUDIO_ART='+JSON.stringify(artwork)+';\nconst STUDIO_MEDIA='+JSON.stringify(media)+';\n'+script+'</script>');for(const [name,data] of Object.entries(artwork)){text=text.replaceAll('src="/explore-art/'+name+'"','src="'+data+'"');text=text.replaceAll('poster="/explore-art/'+name+'"','poster="'+data+'"');}return {uri:LEGACY_STUDIO_UI_URI,mimeType:STUDIO_UI_MIME,text,_meta:{ui:{prefersBorder:true,csp:{connectDomains:[],resourceDomains:[]}}}};}

export async function studioUIResource(base){
 const native=await legacyStudioUIResource(base);
 // The host renders this document itself. Never nest the website or require
 // loopback network/frame permissions: every operation uses tools/call.
 native.text=native.text.replace('const STUDIO_ORIGIN=','const STUDIO_NATIVE=true;const STUDIO_ORIGIN=');
 return {...native,uri:STUDIO_UI_URI,_meta:{ui:{prefersBorder:false,csp:{connectDomains:[],resourceDomains:['https://image.civitai.com'],frameDomains:[]}},'openai/widgetPrefersBorder':false,'openai/widgetCSP':{connect_domains:[],resource_domains:['https://image.civitai.com'],frame_domains:[],redirect_domains:[base,'https://civitai.com','https://cloud.comfy.org','https://huggingface.co','https://github.com','https://docs.comfy.org','https://www.comfy.org']},'openai/ui':{availableDisplayModes:['fullscreen','inline']}}};
}
