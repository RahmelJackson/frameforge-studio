// Colour themes. Studio's stylesheets use a lime accent on green-tinted
// charcoal. A theme recolours every same-origin stylesheet rule in place
// (CSSOM, so it works under the strict CSP): accent-family colours move to the
// theme's accent, neutral greys take the theme's tint, and Light inverts
// lightness. Photos, video and the 3D viewport are untouched.
export const THEMES=[
 {id:'studio',label:'Studio',hint:'Lime on charcoal',swatch:['#d6ff00','#141817']},
 {id:'ocean',label:'Ocean',hint:'Cyan on deep blue',accent:'#3fd5ff',tint:212,swatch:['#3fd5ff','#121720']},
 {id:'ember',label:'Ember',hint:'Amber on warm black',accent:'#ff9a3c',tint:24,swatch:['#ff9a3c','#1a1512']},
 {id:'violet',label:'Violet',hint:'Lilac on midnight',accent:'#b892ff',tint:258,swatch:['#b892ff','#16141e']},
 {id:'rose',label:'Rose',hint:'Pink on plum',accent:'#ff74ad',tint:330,swatch:['#ff74ad','#1c1418']},
 {id:'mono',label:'Mono',hint:'Pure greyscale',accent:'#f4f4f4',tint:0,grey:true,swatch:['#f4f4f4','#151515']},
 {id:'light',label:'Light',hint:'Bright, low glare',accent:'#4f7a00',light:true,swatch:['#4f7a00','#f3f5f0']}
];
const SKIP=/shadow/;
function parse(token){
 if(token[0]==='#'){let h=token.slice(1);if(h.length<=4)h=[...h].map(c=>c+c).join('');const n=parseInt(h.slice(0,6),16);return [n>>16&255,n>>8&255,n&255,h.length===8?parseInt(h.slice(6),16)/255:1];}
 const parts=token.slice(token.indexOf('(')+1,-1).split(/[\s,\/]+/).filter(Boolean);if(parts.length<3)return null;
 const v=parts.slice(0,3).map(p=>p.endsWith('%')?parseFloat(p)*2.55:parseFloat(p)),a=parts[3]==null?1:parts[3].endsWith('%')?parseFloat(parts[3])/100:parseFloat(parts[3]);return v.some(Number.isNaN)?null:[...v,a];
}
function toHsl([r,g,b]){r/=255;g/=255;b/=255;const max=Math.max(r,g,b),min=Math.min(r,g,b),l=(max+min)/2;if(max===min)return [0,0,l];const d=max-min,s=l>.5?d/(2-max-min):d/(max+min);let h=max===r?(g-b)/d+(g<b?6:0):max===g?(b-r)/d+2:(r-g)/d+4;return [h*60,s,l];}
function fromHsl(h,s,l){const k=n=>(n+h/30)%12,a=s*Math.min(l,1-l),f=n=>l-a*Math.max(-1,Math.min(k(n)-3,Math.min(9-k(n),1)));return [f(0),f(8),f(4)].map(v=>Math.round(v*255));}
export function recolor(rgba,theme){
 const [h,s,l]=toHsl(rgba),alpha=rgba[3];
 const accentFamily=s>.5&&h>=55&&h<=105&&l>.25;
 let out;
 if(accentFamily){const [ah,as,al]=toHsl(parse(theme.accent));out=[ah,theme.grey?0:as,theme.light?Math.min(al,.42)*(l/.5):Math.max(.25,Math.min(.92,al+(l-.5)*.6))];}
 else if(s<.42){const nl=theme.light?1-l:l;out=[theme.tint??h,theme.grey?0:theme.light?Math.min(s,.12):s,nl];}
 else if(theme.light&&l<.32)out=[h>=55&&h<=105?toHsl(parse(theme.accent))[0]:h,Math.min(s,.45),1-l*.7];
 else out=[h,s,theme.light&&l>.6?l-.25:l];
 const [r,g,b]=fromHsl(out[0],Math.max(0,Math.min(1,out[1])),Math.max(0,Math.min(1,out[2])));
 return alpha<1?`rgba(${r}, ${g}, ${b}, ${Math.round(alpha*1000)/1000})`:`rgb(${r}, ${g}, ${b})`;
}
const COLOR=/#[0-9a-f]{3,8}\b|rgba?\([^)]*\)/gi;
export function recolorValue(value,theme){return value.replace(COLOR,token=>{const c=parse(token);return c?recolor(c,theme):token;});}
const originals=new WeakMap();
function* styleRules(list){for(const rule of list){if(rule.style)yield rule;if(rule.cssRules)yield* styleRules(rule.cssRules);}}
export function applyTheme(id,doc=document){
 const theme=THEMES.find(t=>t.id===id)??THEMES[0],root=doc.documentElement;root.dataset.theme=theme.id;root.style.setProperty('color-scheme',theme.light?'light':'dark');
 for(const sheet of doc.styleSheets){let rules;try{rules=sheet.cssRules;}catch{continue;}if(!rules)continue;
  for(const rule of styleRules(rules)){let saved=originals.get(rule);
   if(!saved){saved=[];for(let i=0;i<rule.style.length;i++){const prop=rule.style[i];if(SKIP.test(prop))continue;const value=rule.style.getPropertyValue(prop);if(/#[0-9a-f]{3,8}\b|rgba?\(/i.test(value))saved.push([prop,value,rule.style.getPropertyPriority(prop)]);}originals.set(rule,saved);}
   for(const [prop,value,priority] of saved)rule.style.setProperty(prop,theme.id==='studio'?value:recolorValue(value,theme),priority);}}
 return theme;
}
