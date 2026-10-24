import { readFile } from 'node:fs/promises';

export function historyError(messages){
  const failure=Array.isArray(messages)?messages.find(row=>Array.isArray(row)&&row[0]==='execution_error')?.[1]:null;
  if(failure&&typeof failure==='object')return `ComfyUI ${failure.node_type??'render'} (node ${failure.node_id??'unknown'}): ${failure.exception_type??'Error'}: ${String(failure.exception_message??'Render failed.').trim()}`.slice(0,2000);
  return JSON.stringify(messages??[]).slice(-2000);
}
export class ComfyClient {
  constructor(url) {
    const parsed = new URL(url);
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(parsed.hostname) || parsed.protocol !== 'http:') throw new Error('This studio connects to a local HTTP ComfyUI server only.');
    this.url = parsed.origin;
  }
  async request(path, options = {}) {
    const response = await fetch(this.url + path, { ...options, signal: options.signal ?? AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`ComfyUI ${response.status}: ${(await response.text()).slice(0, 2000)}`);
    return response;
  }
  async json(path, data) {
    return (await this.request(path, data === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })).json();
  }
  async releaseIdle(){
    const queue=await this.json('/queue');
    if(queue.queue_running?.length||queue.queue_pending?.length)throw new Error('ComfyUI is busy. Wait before starting the lip-sync comparison.');
    // /free acknowledges with an empty body; it is not a JSON endpoint.
    await this.request('/free',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({unload_models:true,free_memory:true})});
  }
  async upload(path, name) {
    const body = new FormData();
    body.append('image', new Blob([await readFile(path)]), name);
    body.append('type', 'input');
    body.append('overwrite', 'false');
    return (await this.request('/upload/image', { method: 'POST', body })).json();
  }
  async output(ref) {
    if (!ref.filename || ref.type !== 'output') throw new Error('ComfyUI did not return a saved output.');
    return this.request('/view?' + new URLSearchParams({ filename: ref.filename, subfolder: ref.subfolder ?? '', type: 'output' }), { signal: AbortSignal.timeout(120000) });
  }
  async cancel(promptId) {
    if (!promptId) throw new Error('The render has no acknowledged engine ID. Inspect it before cancelling.');
    const queue = await this.json('/queue');
    const running = (queue.queue_running ?? []).some(item => item[1] === promptId);
    const pending = (queue.queue_pending ?? []).some(item => item[1] === promptId);
    // Both endpoints target the owned ID even if the queue changes after this read.
    if (pending) await this.request('/queue', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({delete:[promptId]}) });
    if (running || pending) await this.request('/interrupt', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({prompt_id:promptId}) });
    return { requested:running || pending };
  }
}

export function findVideos(outputs) {
  const refs = [];
  for (const output of Object.values(outputs ?? {})) {
    for (const key of ['images', 'videos', 'gifs']) {
      for (const ref of output[key] ?? []) {
        if (ref.type === 'output' && /\.(mp4|webm)$/i.test(ref.filename ?? '')) refs.push(ref);
      }
    }
  }
  return refs;
}

export function findImages(outputs) {
  return Object.values(outputs??{}).flatMap(output=>(output.images??[]).filter(ref=>ref.type==='output'&&/\.png$/i.test(ref.filename??'')));
}
