export const LOOKS={
  style:[{id:'original',name:'As described',prompt:''},{id:'natural',name:'Natural cinema',prompt:'Photorealistic natural cinema, restrained contrast, fine realistic detail.'},{id:'noir',name:'Black-and-white noir',prompt:'Strictly monochrome black and white film noir, no color, deep shadows, dramatic contrast.'},{id:'dream',name:'Dreamlike',prompt:'Dreamlike soft cinematic atmosphere, gentle highlight bloom, delicate ethereal textures.'}],
  lighting:[{id:'original',name:'As described',prompt:''},{id:'golden',name:'Golden hour',prompt:'Warm low golden-hour sunlight, long soft shadows, amber rim light.'},{id:'moonlight',name:'Moonlight',prompt:'Cool blue moonlight at night, low-key lighting, deep soft shadows.'},{id:'soft',name:'Soft daylight',prompt:'Broad soft diffused daylight, gentle shadows, balanced natural exposure.'}],
  palette:[{id:'original',name:'As described',prompt:''},{id:'warm',name:'Warm amber',prompt:'Warm amber and muted earth color palette.'},{id:'cool',name:'Cool blue',prompt:'Cool blue and cyan color palette with restrained saturation.'},{id:'muted',name:'Muted pastels',prompt:'Desaturated pastel colors, subtle gentle color separation.'}],
  lens:[{id:'original',name:'As described',prompt:''},{id:'wide',name:'Wide lens look',prompt:'Wide-angle lens appearance, expansive environment, strong foreground perspective.'},{id:'portrait',name:'Portrait lens look',prompt:'Portrait telephoto lens appearance, compressed background, intimate subject framing.'}],
  depth:[{id:'original',name:'As described',prompt:''},{id:'shallow',name:'Shallow focus',prompt:'Shallow depth of field, subject in sharp focus against a soft defocused background.'},{id:'deep',name:'Deep focus',prompt:'Deep depth of field, clear foreground and background detail throughout the scene.'}]
};
export function normalizeLook(input={}){
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Choose supported film-look settings.');
  if(Object.keys(input).some(key=>!Object.hasOwn(LOOKS,key)))throw new Error('Unknown film-look setting.');
  return Object.fromEntries(Object.entries(LOOKS).map(([key,options])=>{const id=input[key]??'original';if(!options.some(o=>o.id===id))throw new Error(`Choose a supported ${key} look.`);return [key,id];}));
}
export function lookPrompt(input){const look=normalizeLook(input);return Object.entries(look).map(([key,id])=>LOOKS[key].find(o=>o.id===id).prompt).filter(Boolean).join(' ');}
