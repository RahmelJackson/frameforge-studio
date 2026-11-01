// Stock footage for explainers. Wikimedia Commons needs no account and every
// result carries its licence and author, which Studio keeps with the clip and
// credits in the film. Pexels is used too when you add a free Pexels API key
// (FRAMEFORGE_PEXELS_KEY or config.pexelsKey). Only these hosts are downloaded.
export const STOCK_HOSTS=['upload.wikimedia.org','videos.pexels.com','player.vimeo.com'];
const UA='Frameforge-Studio/1.0 (open-source local creative studio)';
const strip=v=>String(v??'').replace(/<[^>]*>/g,'').replace(/\s+/g,' ').trim().slice(0,160);
// Filler and story-direction words never help a footage search ("how", "turn", "open with the question…").
const STOP=new Set('a an the and or of to in on for with without from by is are be was were this that these those it its as at into about over under your you we our their show shows showing make makes one each every scene shot clip camera view context how why what when where who which does do did turn turns can will would should get gets use uses using open finish give demonstrate idea question audience problem visible simple example central mechanism adding unrelated claims before after comparison practical action original answered takeaway concrete explain ask short'.split(' '));
export function stockQuery(text){return stockQueries(text)[0]??'';}
// Stock sites match every word, so try the most specific query first, then broaden: 4 words, 3, 2, then 1.
export function stockQueries(text){const words=[...new Set(String(text??'').toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu,' ').split(/\s+/).filter(w=>w.length>2&&!STOP.has(w)))];return [...new Set([4,3,2,1].map(n=>words.slice(0,n).join(' ')).filter(Boolean))];}
// Title matches count double; description matches count once.
function relevance(x,q){const title=x.title.toLowerCase(),desc=x.desc??'';return q.split(' ').reduce((n,w)=>{const stem=w.replace(/(ies|es|s)$/,'');return n+(title.includes(stem)?2:desc.includes(stem)?1:0);},0);}
function orientationOk(w,h,aspect){if(!w||!h)return true;return aspect==='portrait'?h>=w*.9:aspect==='square'?true:w>=h*1.2;}
export async function searchCommons(query,{aspect='landscape',fetcher=fetch,limit=8}={}){
 const q=stockQuery(query);if(!q)return [];
 const url='https://commons.wikimedia.org/w/api.php?'+new URLSearchParams({action:'query',format:'json',origin:'*',generator:'search',gsrnamespace:'6',gsrlimit:'40',gsrsearch:'filetype:video '+q,prop:'videoinfo',viprop:'url|size|mime|derivatives|extmetadata',viurlwidth:'480'});
 const r=await fetcher(url,{headers:{'User-Agent':UA,Accept:'application/json'}});if(!r.ok)throw Error('Wikimedia Commons search is unavailable right now.');const v=await r.json();
 return Object.values(v.query?.pages??{}).sort((a,b)=>(a.index??0)-(b.index??0)).map(p=>{const info=p.videoinfo?.[0];if(!info)return null;const meta=info.extmetadata??{};
  const dur=Number(info.duration)||0,cap=dur&&dur<=45?1080:480;if(dur>180)return null;const derivs=(info.derivatives??[]).filter(d=>/webm/.test(d.type??'')&&(d.height??0)<=cap&&(d.height??0)>=360).sort((a,b)=>(b.height??0)-(a.height??0));const pick=derivs[0]??(/webm/.test(info.mime??'')&&info.size<100*1024**2?{src:info.url,width:info.width,height:info.height}:null);if(!pick)return null;
  return {source:'wikimedia',desc:strip(meta.ImageDescription?.value).toLowerCase(),id:'commons:'+p.pageid,title:strip(p.title).replace(/^File:/,'').replace(/\.\w+$/,''),url:pick.src,width:pick.width??info.width,height:pick.height??info.height,duration:Number(info.duration)||null,thumb:info.thumburl??null,page:info.descriptionurl,author:strip(meta.Artist?.value)||'Unknown',license:strip(meta.LicenseShortName?.value)||'See source',licenseUrl:meta.LicenseUrl?.value??null};})
  .filter(Boolean).filter(x=>orientationOk(x.width,x.height,aspect)&&(!x.duration||x.duration>=2))
  // Commons search matches loosely; keep clips whose title or description names the topic.
  .map(x=>({...x,score:relevance(x,q)})).filter(x=>x.score>=Math.min(2,q.split(' ').length)&&!/benchmark|screenshot|gameplay|screencast|tutorial|lecture|slideshow|interview|trailer/i.test(x.title)).sort((a,b)=>b.score-a.score).slice(0,limit).map(({score,desc,...x})=>x);
}
export async function searchPexels(query,{aspect='landscape',key,fetcher=fetch,limit=8}={}){
 if(!key)return [];const q=stockQuery(query);if(!q)return [];
 const r=await fetcher('https://api.pexels.com/videos/search?'+new URLSearchParams({query:q,per_page:String(limit),orientation:aspect==='portrait'?'portrait':aspect==='square'?'square':'landscape'}),{headers:{Authorization:key}});if(!r.ok)throw Error('Pexels search failed. Check your Pexels API key.');const v=await r.json();
 return (v.videos??[]).map(x=>{const file=(x.video_files??[]).filter(f=>f.file_type==='video/mp4'&&(f.height??0)<=1080).sort((a,b)=>Math.abs((a.height??0)-720)-Math.abs((b.height??0)-720))[0];if(!file)return null;
  return {source:'pexels',id:'pexels:'+x.id,title:strip(x.url?.split('/').filter(Boolean).at(-1)?.replace(/-\d+$/,'').replace(/-/g,' '))||'Pexels video',url:file.link,width:file.width,height:file.height,duration:x.duration??null,thumb:x.image??null,page:x.url,author:strip(x.user?.name)||'Pexels creator',license:'Pexels License',licenseUrl:'https://www.pexels.com/license/'};}).filter(Boolean);
}
export async function searchStock(query,{aspect,pexelsKey,fetcher=fetch,limit=8}={}){
 const [pexels,commons]=await Promise.all([searchPexels(query,{aspect,key:pexelsKey,fetcher,limit}).catch(()=>[]),searchCommons(query,{aspect,fetcher,limit}).catch(e=>{if(!pexelsKey)throw e;return [];})]);
 return [...pexels,...commons].slice(0,limit);
}
export function allowedStockUrl(value){let u;try{u=new URL(value);}catch{return false;}return u.protocol==='https:'&&STOCK_HOSTS.includes(u.hostname)&&!u.username&&!u.password;}
export function creditLine(c){return `${c.title} · ${c.author} · ${c.license}${c.source==='wikimedia'?' · Wikimedia Commons':c.source==='pexels'?' · Pexels':''}`.slice(0,240);}
