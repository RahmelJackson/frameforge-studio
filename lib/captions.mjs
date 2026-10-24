const finite=v=>typeof v==='number'&&Number.isFinite(v);
export function normalizeCues(cues,duration=60){
  if(!Array.isArray(cues)||!cues.length||cues.length>48)throw Error('Choose 1-48 caption cues.');let end=0;
  return cues.map(c=>{if(!c||!finite(c.start)||!finite(c.end)||c.start<end-1e-6||c.start<0||c.end-c.start<.08||c.end>duration+.001||typeof c.text!=='string'||!c.text.trim()||c.text.trim().length>180||/[\u0000-\u0008\u000b\u000c\u000e-\u001f<>]/.test(c.text))throw Error('Captions need ordered, non-overlapping times and 1-180 plain-text characters.');end=c.end;return {start:c.start,end:c.end,text:c.text.trim(),...(typeof c.speaker==='string'?{speaker:c.speaker.slice(0,40)}:{})};});
}
export function transcriptCues(transcript){
  const result=[];
  for(const s of transcript.segments??[]){
    if(s.words?.length){let group=[];const flush=()=>{if(group.length){result.push({start:group[0].start,end:group.at(-1).end,text:group.map(w=>w.word.trim()).join(' ')});group=[];}};
      for(const w of s.words){if(group.length&&(group.map(x=>x.word).join(' ').length+w.word.length>72||w.end-group[0].start>4))flush();group.push(w);if(/[.!?]$/.test(w.word.trim()))flush();}flush();
    }else result.push({start:s.start,end:s.end,text:s.text,...(s.speakerName?{speaker:s.speakerName}:{})});
  }
  return normalizeCues(result,transcript.duration);
}
