import {randomUUID} from 'node:crypto';
// A local screenplay breakdown, with source text retained beside every editable brief.
export function breakDownScript(script){
  if(typeof script!=='string'||!script.trim()||script.length>20000)throw new Error('Paste a script of 1–20,000 characters.');
  const blocks=script.trim().replace(/^(?:INT\.|EXT\.|INT\/EXT\.|I\/E\.|SCENE\s+\d|#\s).*$/gim,line=>'\n\n'+line+'\n\n').split(/\n\s*\n/),briefs=[];let scene='Scene 1',speakers=[];
  for(const block of blocks){
    const lines=block.trim().split('\n');
    for(let i=0;i<lines.length;i++){
      const line=lines[i].trim();
      if(/^(?:INT\.|EXT\.|INT\/EXT\.|I\/E\.|SCENE\s+\d|#\s)/i.test(line)){scene=line.replace(/^#\s*/,'').slice(0,100);continue;}
      if(!line)continue;
      const remaining=lines.slice(i).join('\n').trim();
      const characters=[...new Set(remaining.split('\n').filter(l=>/^[A-Z][A-Z '\-]{1,35}(?:\s*\(.*\))?$/.test(l.trim())).map(l=>l.trim()))];
      speakers=[...new Set([...speakers,...characters])];
      const dialogue=characters.length>0;
      const preset=dialogue?'locked':/\b(walks?|runs?|crosses|travels?|drives?)\b/i.test(remaining)?'pan':briefs.length===0?'pull-back':'push-in';
      if(remaining.length>2200)throw new Error('Split action or dialogue blocks longer than 2,200 characters with blank lines.');
      const source=remaining;
      briefs.push({id:randomUUID(),scene,title:`Shot ${briefs.length+1}`,source,prompt:`${scene}. ${source}`.slice(0,2500),preset,characters,notes:dialogue?'Dialogue is retained as story context. Generated clips are silent; speech and lip sync need a separate workflow.':'Check character appearance, props, location and screen direction against the preceding shot.'});
      break;
    }
  }
  if(!briefs.length)throw new Error('Add action or dialogue after your scene heading.');
  if(briefs.length>24)throw new Error('This breakdown supports up to 24 beats. Split the script into smaller scenes.');
  return {script,characters:speakers,briefs,method:'Local rule-based breakdown; camera suggestions require review.'};
}
export function validateBrief(input){
  const result={};for(const [key,max] of Object.entries({scene:100,title:100,prompt:2500,notes:2000})){if(typeof input[key]!=='string'||input[key].length>max||(['scene','title','prompt'].includes(key)&&!input[key].trim()))throw new Error(`Check the shot ${key}.`);result[key]=input[key].trim();}
  if(!['push-in','pull-back','orbit','pan','locked','handheld'].includes(input.preset))throw new Error('Choose a supported motion suggestion.');
  return {...result,preset:input.preset};
}
