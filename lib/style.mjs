export const STYLE_TOOL='style-board';
export function normalizeStyle(input){
 if(!Array.isArray(input.styleImages)||input.styleImages.length<1||input.styleImages.length>16||input.styleImages.some(x=>typeof x!=='string'||!/^[a-f0-9-]{36}\.(png|jpg|webp)$/.test(x))||new Set(input.styleImages).size!==input.styleImages.length)throw Error('Choose 1–16 different saved style references.');
 const styleStrength=Number(input.styleStrength??.8);if(!Number.isFinite(styleStrength)||styleStrength<0||styleStrength>1.2)throw Error('Style strength must be between 0 and 1.2.');
 const styleLabel=input.styleLabel??'Selected references';if(typeof styleLabel!=='string'||styleLabel.length>120)throw Error('Keep the reference label under 120 characters.');
 const styleMode=input.styleMode??'layers';if(!['layers','subtract'].includes(styleMode))throw Error('Choose how to handle reference content.');
 const styleContent=input.styleContent??'',styleContentStrength=Number(input.styleContentStrength??.5);
 if(typeof styleContent!=='string'||styleContent.length>500||styleMode==='subtract'&&!styleContent.trim())throw Error('Describe the reference subjects to remove in 1–500 characters.');
 if(!Number.isFinite(styleContentStrength)||styleContentStrength<0||styleContentStrength>1)throw Error('Content removal must be between 0 and 1.');
 return {styleImages:[...input.styleImages],styleStrength,styleLabel:styleLabel.trim(),styleMode,styleContent:styleMode==='subtract'?styleContent.trim():'',styleContentStrength:styleMode==='subtract'?styleContentStrength:0};
}
