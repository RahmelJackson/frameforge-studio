import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
export const STUDIO_UI_ART=['mcp-observatory.png','mcp-portrait.png','mcp-product.png'];
export const STUDIO_UI_MEDIA=['observatory-motion.mp4'];
export const LEGACY_STUDIO_UI_URI='ui://frameforge/studio-v1.html';
export const PREVIOUS_STUDIO_UI_URI='ui://frameforge/studio-v3.html';
export const STUDIO_UI_URI='ui://frameforge/studio-v4.html';
export const STUDIO_UI_MIME='text/html;profile=mcp-app';
export async function legacyStudioUIResource(base){const root=new URL('../public/',import.meta.url),[html,css,js]=await Promise.all(['mcp-app.html','mcp-app.css','mcp-app.js'].map(file=>readFile(fileURLToPath(new URL(file,root)),'utf8')));const artwork=Object.fromEntries(await Promise.all(STUDIO_UI_ART.map(async name=>[name,'data:image/png;base64,'+(await readFile(new URL('explore-art/'+name,root))).toString('base64')]))),media=Object.fromEntries(await Promise.all(STUDIO_UI_MEDIA.map(async name=>[name,'data:video/mp4;base64,'+(await readFile(new URL('explore-art/'+name,root))).toString('base64')])));let text=html.replace('<link rel="stylesheet" href="/mcp-app.css">','<style>'+css+'</style>').replace('<script type="module" src="/mcp-app.js"></script>','<script type="module">const STUDIO_ORIGIN='+JSON.stringify(base).replaceAll('<','\\u003c')+';\nconst STUDIO_ART='+JSON.stringify(artwork)+';\nconst STUDIO_MEDIA='+JSON.stringify(media)+';\n'+js+'</script>');for(const [name,data] of Object.entries(artwork)){text=text.replaceAll('src="/explore-art/'+name+'"','src="'+data+'"');text=text.replaceAll('poster="/explore-art/'+name+'"','poster="'+data+'"');}return {uri:LEGACY_STUDIO_UI_URI,mimeType:STUDIO_UI_MIME,text,_meta:{ui:{prefersBorder:true,csp:{connectDomains:[],resourceDomains:[]}}}};}

export async function studioUIResource(base,{embedURL}={}){
 const root=new URL('../public/',import.meta.url),[html,css,js,poster]=await Promise.all([
  ...['mcp-studio.html','mcp-studio.css','mcp-studio.js'].map(file=>readFile(new URL(file,root),'utf8')),
  readFile(new URL('explore-art/mcp-observatory.png',root))
 ]);
 const literal=value=>JSON.stringify(value).replaceAll('<','\\u003c');
 const text=html.replace('<link rel="stylesheet" href="/mcp-studio.css">','<style>'+css+'</style>')
  .replace('<script type="module" src="/mcp-studio.js"></script>','<script type="module">const STUDIO_ORIGIN='+literal(base)+';const STUDIO_EMBED_ORIGIN='+literal(embedURL??base)+';\n'+js+'</script>')
  .replace('src="/explore-art/mcp-observatory.png"','src="data:image/png;base64,'+poster.toString('base64')+'"');
 const frames=[embedURL??base];
 return {uri:STUDIO_UI_URI,mimeType:STUDIO_UI_MIME,text,_meta:{ui:{prefersBorder:false,csp:{connectDomains:[],resourceDomains:[],frameDomains:frames}},'openai/widgetCSP':{connect_domains:[],resource_domains:[],frame_domains:frames,redirect_domains:[base]},'openai/ui':{availableDisplayModes:['fullscreen','inline']}}};
}
