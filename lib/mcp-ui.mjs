import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
export const STUDIO_UI_URI='ui://frameforge/studio-v1.html';
export const STUDIO_UI_MIME='text/html;profile=mcp-app';
export async function studioUIResource(base){const root=new URL('../public/',import.meta.url),[html,css,js]=await Promise.all(['mcp-app.html','mcp-app.css','mcp-app.js'].map(file=>readFile(fileURLToPath(new URL(file,root)),'utf8')));return {uri:STUDIO_UI_URI,mimeType:STUDIO_UI_MIME,text:html.replace('<link rel="stylesheet" href="/mcp-app.css">','<style>'+css+'</style>').replace('<script type="module" src="/mcp-app.js"></script>','<script type="module">const STUDIO_ORIGIN='+JSON.stringify(base).replaceAll('<','\\u003c')+';\n'+js+'</script>'),_meta:{ui:{prefersBorder:true,csp:{connectDomains:[],resourceDomains:[]}}}};}
