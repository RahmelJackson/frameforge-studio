// Shot writer: a small local language model (Gemma, Qwen, Llama… through Ollama or LM Studio)
// turns a production's story beats into what each model actually needs:
//  - visual: a wordless picture description for the image and video models,
//  - narration: a spoken line sized to the shot length,
//  - stock: two or three plain nouns for a stock-footage search.
// Image models are bad at text and literal about instructions ("open with the question…" gets
// lettered onto the frame), so the language work happens here and only pictures go to ComfyUI.
// Without a local model, productions fall back to the built-in rules.
import {describeAssistantConnection,listAssistantModels,localModelJSON,normalizeAssistantConnection} from './assistant-connection.mjs';

// Small instruction models that do this well on CPU, best first.
export const WRITER_PREFERENCE=[/gemma-?3n?/i,/gemma/i,/qwen/i,/llama-?3/i,/phi/i,/mistral/i,/granite/i];
const NOT_CHAT=/embed|vision-only|whisper|rerank|clip|bge|nomic/i;

export function pickWriterModel(models=[],preferred=''){
 const names=models.map(m=>typeof m==='string'?m:m?.name).filter(n=>typeof n==='string'&&!NOT_CHAT.test(n));
 if(preferred&&names.includes(preferred))return preferred;
 for(const re of WRITER_PREFERENCE){const hit=names.filter(n=>re.test(n)).sort((a,b)=>sizeRank(a)-sizeRank(b))[0];if(hit)return hit;}
 return null;
}
// Prefer the smaller variant (1b–4b) of a family: it is quick on CPU and plenty for short prompts.
function sizeRank(name){const m=/(\d+(?:\.\d+)?)b\b/i.exec(name);if(!m)return 5;const b=Number(m[1]);return b<1?3:b<=4?b:10+b;}

export const SHOT_SCHEMA={type:'object',additionalProperties:false,required:['shots'],properties:{shots:{type:'array',items:{type:'object',additionalProperties:false,required:['visual','narration','stock'],properties:{visual:{type:'string'},narration:{type:'string'},stock:{type:'string'}}}}}};

// The main subject named in the idea ("Life as a city pigeon" → "city pigeon").
export function mainSubject(subject){return String(subject??'').replace(/^\s*(?:a\s+day\s+in\s+the\s+life\s+of|(?:my\s+)?life\s+as)\s+(?:an?|the)?\s*/i,'').replace(/[.!?]+$/,'').trim().slice(0,80);}
// Every shot must show the subject; small models drift to props and hands otherwise.
export function keepSubject(visual,subject){const main=mainSubject(subject);if(!main)return visual;const words=main.toLowerCase().split(/\s+/).filter(w=>w.length>3).map(w=>w.replace(/(ies|es|s)$/,''));if(!words.length||words.some(w=>visual.toLowerCase().includes(w)))return visual;return `With the ${main} clearly in frame: ${visual}`;}
export function writerMessages(p){
 const shots=p.frames.map((f,i)=>`${i+1}. "${f.title}" (${f.targetDuration} s): ${String(f.prompt??'').replace(/^Context:[^.]*\.\s*/,'')}`).join('\n');
 const system=['You write shot lists for a short AI-generated video.',
  'For every numbered beat return one shot with:',
  '- visual: one or two sentences describing only what the camera sees (subject, action, setting, light). Concrete and physical. Never mention words, letters, titles, signs, captions, questions, the audience or the viewer, because the image model would draw them as text.',
  '- narration: one natural spoken sentence for that beat, at most the given word budget. Plain words, no stage directions, no emoji.',
  '- stock: two or three plain nouns a stock-footage site would match (for example "honeybee flower"). No verbs or adjectives.',
  'The MAIN SUBJECT must be visible and named in every visual. Keep the same characters and setting across shots. Return JSON only.'].join('\n');
 const user=`Idea: ${p.subject}\nMAIN SUBJECT (in every shot): ${mainSubject(p.subject)||p.subject}\nFormat: ${p.format}\nLook: ${p.look}\nBeats (word budget = seconds × 2.5):\n${shots}\nReturn exactly ${p.frames.length} shots in order.`;
 return [{role:'system',content:system},{role:'user',content:user}];
}

const clean=(v,max)=>String(v??'').replace(/[\u0000-\u001f]+/g,' ').replace(/\s+/g,' ').trim().slice(0,max);
const LETTERING=/\b(words?|letters?|titles?|signs?|captions?|text|questions?|audience|viewers?|typography|subtitles?)\b/gi;
export function parseShots(value,frames,subject=''){
 const list=Array.isArray(value?.shots)?value.shots:Array.isArray(value)?value:null;
 if(!list||list.length<frames.length)throw Error('The writer model returned '+(list?.length??0)+' of '+frames.length+' shots.');
 return frames.map((f,i)=>{const s=list[i]??{};
  const visual=keepSubject(clean(s.visual,600).replace(LETTERING,'detail'),subject);
  const words=Math.max(4,Math.round(f.targetDuration*2.5)+2);
  const narration=clean(s.narration,400).split(' ').slice(0,words).join(' ');
  const stock=clean(s.stock,60).toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu,'').split(' ').filter(Boolean).slice(0,3).join(' ');
  if(visual.length<12)throw Error('The writer model left shot '+(i+1)+' empty.');
  return {visual,narration,stock};});
}

// Returns async (production) => {model, shots} or null when no local model is installed.
export function createShotWriter({fetcher=fetch,getConnection=()=>({}),preferred=()=>''}={}){
 return async function write(p){
  const connection=normalizeAssistantConnection(getConnection()),description=describeAssistantConnection(connection);
  const available=await listAssistantModels(fetcher,connection);if(!available.connected)return null;
  const model=pickWriterModel(available.models,preferred());if(!model)return null;
  const messages=writerMessages(p),ollama=description.protocol==='ollama';
  // Ollama runs it on the CPU and unloads it right after, so ComfyUI keeps the whole GPU.
  let thinking=false;if(ollama){try{const info=await localModelJSON(fetcher,connection,'/api/show',{body:{model},timeout:5000});if(info.remote_host||info.remote_model)return null;thinking=Array.isArray(info.capabilities)&&info.capabilities.includes('thinking');}catch{}}
  const body=ollama?{model,stream:false,...(thinking?{think:false}:{}),format:connection.structuredOutput?SHOT_SCHEMA:'json',keep_alive:0,options:{temperature:.5,num_ctx:4096,num_predict:900,num_gpu:0},messages}
   :{model,stream:false,temperature:.5,max_tokens:900,messages,...(connection.structuredOutput?{response_format:{type:'json_schema',json_schema:{name:'shot_list',strict:true,schema:SHOT_SCHEMA}}}:{})};
  const result=await localModelJSON(fetcher,connection,ollama?'/api/chat':'/chat/completions',{body,timeout:180000});
  const content=ollama?result.message?.content:result.choices?.[0]?.message?.content;
  let value;try{value=JSON.parse(String(content??'').replace(/^\s*```(?:json)?\s*/,'').replace(/\s*```\s*$/,''));}catch{throw Error(model+' did not return a JSON shot list.');}
  return {model,shots:parseShots(value,p.frames,p.subject)};
 };
}
