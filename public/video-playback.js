// Only one native decoder remains loaded. Inactive players show a real still.
export function singleVideoPlayers(notice=()=>{}){
 const players=new Map();let active=null,sequence=0;
 function release(video){video.pause();video.removeAttribute('src');video.load();if(active===video)active=null;}
 function prune(){for(const [video] of players)if(!video.isConnected){release(video);players.delete(video);}}
 function activate(video){for(const [other] of players)if(other!==video&&other.hasAttribute('src'))release(other);active=video;}
 async function play(video,reload=false){
  prune();const record=players.get(video);if(!record)return;const token=++sequence;
  activate(video);if(reload)release(video);active=video;
  if(video.getAttribute('src')!==record.url){video.src=record.url;video.load();}
  if(video.ended)video.currentTime=0;
  try{await video.play();if(token===sequence&&active===video)notice('Playback started. Inspect the moving picture and sound.');}
  catch(error){if(token===sequence&&active===video)notice('Playback could not start. Use Reload playback or open the player separately. '+error.message);}
 }
 function attach(video,url,poster,button){
  prune();const old=players.get(video);if(old?.url===url&&old?.button===button)return;
  if(old)release(video);video.preload='none';video.poster=poster;video.removeAttribute('src');
  players.set(video,{url,button});button.onclick=()=>play(video);
  video.onplay=()=>activate(video);
  video.onerror=()=>{if(active===video)notice('The browser could not display this video. Try Reload playback or open the player separately.');};
 }
 return {attach,play,reload:video=>play(video,true),prune,dispose(){++sequence;for(const [video] of players)release(video);players.clear();}};
}
