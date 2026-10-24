export function parseChecklist(markdown){
  const groups={ready:[],remaining:[],recent:[],next:[],production:[]};const plans=new Map();let section='';
  for(const line of markdown.split(/\r?\n/)){
    if(line.startsWith('## ')){section=line.slice(3);continue;}
    const item=line.match(/^- \[([ x])\] (.+)$/);
    if(item){const text=item[2].replace(/\*\*/g,''),id=text.match(/^(\d+)\./)?.[1]??null,entry={id,done:item[1]==='x',text};
      if(section==='Completed foundations')groups.ready.push(entry);else if(section==='Remaining creative acceptance')groups.remaining.push(entry);else if(section==='Latest completed work')groups.recent.push(entry);else if(section==='Active film workflow')groups.production.push(entry);
    }
    if(section==='Next implementation order'&&/^\d+\. /.test(line))groups.next.push(line.replace(/^\d+\. /,''));
    if(section==='Resolution plan'&&/^\|\s*\d+\s*\|/.test(line)){
      const cells=line.split('|').slice(1,-1).map(s=>s.trim());
      if(cells.length!==4||cells.some(s=>!s)||plans.has(cells[0]))throw Error('Check the workflow resolution plan.');
      plans.set(cells[0],{state:cells[1],route:cells[2],gate:cells[3]});
    }
  }
  if(!groups.ready.length||!groups.remaining.length)throw Error('The saved checklist is incomplete.');
  for(const [id,plan] of plans){const item=groups.remaining.find(x=>x.id===id);if(!item||item.done)throw Error('A resolution plan must belong to an open goal.');item.plan=plan;}
  const researchParked=/^Research status: Parked\s*$/m.test(markdown);if(researchParked)for(const item of groups.remaining)if(!item.done)item.parked=true;
  return {...groups,researchParked,activeOpenCount:groups.production.filter(x=>!x.done).length,updated:markdown.split(/\r?\n/).find(l=>l.startsWith('Updated '))??'',openCount:groups.remaining.filter(x=>!x.done).length};
}
