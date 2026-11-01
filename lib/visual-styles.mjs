// Strong visual styles shared by Images, Video and Produce. Each one is a full art direction
// (medium, lens, light, colour, texture) so results look designed rather than generic.
// Styles never ask for lettering: image models garble text.
export const VISUAL_STYLES=[
 {id:'none',name:'Your words only',hint:'No added style',swatch:['#3a4044','#5b6266','#8b9396'],prompt:''},
 {id:'blockbuster',name:'Blockbuster',hint:'Anamorphic, teal and orange',swatch:['#0f3d4a','#e2742b','#f4c36a'],prompt:'Big-budget action film still: anamorphic widescreen framing, teal-and-orange colour grade, high contrast, volumetric light beams, subtle lens flare, crisp cinematic detail.'},
 {id:'indie',name:'Indie film',hint:'35 mm grain, soft colour',swatch:['#c9a27e','#6d7f72','#e8d9c4'],prompt:'35 mm indie film still: warm portrait-film colour, gentle halation around highlights, visible fine film grain, natural window light, muted earthy palette, intimate framing.'},
 {id:'documentary',name:'Nature documentary',hint:'Telephoto, true colour',swatch:['#3f6b2f','#c9b458','#e9efe0'],prompt:'Premium nature documentary footage: long telephoto lens, razor-sharp subject, creamy natural bokeh, true-to-life colour, soft natural light, rich fine detail.'},
 {id:'anime',name:'Painted anime',hint:'Line art, luminous skies',swatch:['#3d7fd6','#f6c1d3','#fff3c4'],prompt:'Hand-painted anime film frame: clean expressive line art, lush painted background, soft cel shading, luminous sky and clouds, vivid saturated colour, gentle light.'},
 {id:'animated3d',name:'3D animated feature',hint:'Stylised, warm, tactile',swatch:['#ff8a3d','#4bb3fd','#ffe28a'],prompt:'Feature-length 3D animated film: appealing stylised characters, soft global illumination, subsurface glow, rich saturated colour, tactile materials, polished render.'},
 {id:'neon',name:'Neon noir',hint:'Rain, magenta and cyan',swatch:['#120c2b','#ff2fb3','#22e3ff'],prompt:'Neon noir: rain-slick night streets, magenta and cyan neon reflections, deep black shadows, drifting haze, moody high-contrast lighting, glossy wet surfaces.'},
 {id:'painterly',name:'Oil painting',hint:'Brush strokes, chiaroscuro',swatch:['#5a3b22','#c78c3d','#e9d2a6'],prompt:'Oil painting brought to life: thick visible brush strokes, rich impasto texture, dramatic chiaroscuro light, warm old-master palette, painterly depth.'},
 {id:'clay',name:'Stop-motion clay',hint:'Handmade miniatures',swatch:['#d9664a','#f2c14e','#6fa8a0'],prompt:'Stop-motion claymation: handmade clay figures with fingerprint texture, miniature practical sets, soft studio lighting, slightly imperfect handcrafted charm.'},
 {id:'noir',name:'Black-and-white noir',hint:'Monochrome, hard light',swatch:['#0c0c0c','#6b6b6b','#e6e6e6'],prompt:'Black-and-white film noir: strictly monochrome, no colour, hard key light, venetian-blind shadows, deep blacks, smoky atmosphere, dramatic contrast.'},
 {id:'retro',name:'90s camcorder',hint:'VHS colour bleed',swatch:['#3b5ba5','#d94f70','#f2e07b'],prompt:'1990s home camcorder footage: soft focus, VHS colour bleed, faint scan lines, slightly blown highlights, warm nostalgic colour, handheld home-video feel.'},
 {id:'dream',name:'Dreamscape',hint:'Pastel glow, haze',swatch:['#b8a1e8','#f7c6d9','#bfe8f2'],prompt:'Ethereal dreamscape: pastel palette, soft glow and highlight bloom, floating light particles, gentle haze, otherworldly calm, delicate textures.'},
 {id:'graphic',name:'Graphic novel',hint:'Ink lines, halftone',swatch:['#111111','#e53935','#fdd835'],prompt:'Graphic novel panel: bold ink outlines, flat cel colours, halftone shading, strong silhouettes, dynamic dramatic composition.'}
];
export function visualStyle(id){return VISUAL_STYLES.find(s=>s.id===id)??VISUAL_STYLES[0];}
export function stylePrompt(id){return visualStyle(id).prompt;}
// Adds the style after the user's description, unless it is already there.
export function withStyle(prompt,id){const style=stylePrompt(id),text=String(prompt??'').trim();if(!style||text.includes(style))return text;return (text?text.replace(/[.\s]*$/,'.')+' ':'')+style;}
// The default production look for each format, as a style id.
export const FORMAT_STYLES={'fruit-romance':'animated3d','explainer':'documentary','explainer-sources':'documentary','life-as':'indie','small-story':'blockbuster','satisfying-loop':'animated3d'};
