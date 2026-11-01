// Motion: the most common way AI video fails is that nothing moves, or it moves
// in slow motion. These are the evidence-based levers that apply to the open
// models Studio runs:
//  - Prompt wording: speed-encoded verbs, explicit camera direction and speed,
//    and motion in the environment (LTX guide; Wan community testing).
//  - Negative prompt: Wan's own default negative names static/still frames
//    (静态, 静止, 静止不动的画面) and crowded backgrounds; slow-motion words help too.
//  - Enough sampling steps: very low step counts give stiff, static clips.
//  - Distilled speed LoRAs (lightx2v) slow motion; lowering their high-noise
//    strength speeds it up again (Wan2.2-Lightning discussion).
export const MOTION_LEVELS=['calm','natural','dynamic'];
export const MOTION_LABELS={calm:'Calm: gentle, subtle movement',natural:'Natural: clearly moving, realistic pace',dynamic:'Dynamic: fast, energetic action'};
// Wan 2.x default negative prompt (from the official Wan configuration).
export const WAN_DEFAULT_NEGATIVE='色调艳丽，过曝，静态，细节模糊不清，字幕，风格，作品，画作，画面，静止，整体发灰，最差质量，低质量，JPEG压缩残留，丑陋的，残缺的，多余的手指，画得不好的手部，画得不好的脸部，畸形的，毁容的，形态畸形的肢体，手指融合，静止不动的画面，杂乱的背景，三条腿，背景人很多，倒着走';
const CUES={
 calm:'Gentle, continuous natural movement throughout the shot.',
 natural:'The subject moves clearly and continuously at a natural, real-time pace, with visible motion in the surroundings.',
 dynamic:'Fast, energetic real-time action: the subject moves quickly and decisively, the surroundings react with motion such as dust, wind or reflections, and the camera keeps pace.'
};
export function normalizeMotion(value,fallback='natural'){const v=value??fallback;if(!MOTION_LEVELS.includes(v))throw Error('Choose calm, natural or dynamic motion.');return v;}
// No level means the prompt already directs the motion (Director recipes, Produce
// shot plans), so nothing is added to it.
export function motionPrompt(prompt,level=null){const text=String(prompt??'').trim();if(level==null)return text;const cue=CUES[normalizeMotion(level)];return text.includes(cue)?text:(text?text.replace(/\.?\s*$/,'. '):'')+cue;}
export function motionNegative(level=null,extra=''){const slow=level==='calm'?'':'slow motion, frozen frame, still image, static shot, floating, drifting, ';return (extra?extra.replace(/\.?\s*$/,', '):'')+slow+'camera equipment in the frame, colour bars, glitches, smeared frames. '+WAN_DEFAULT_NEGATIVE;}
// Distilled 4-step LoRAs flatten motion; ease the high-noise one for more movement.
export function speedLoraStrength(level=null){return level==='dynamic'?.8:1;}
// Steps for Wan 2.2 5B. Twelve draft steps gave stiff clips; 16 keeps drafts quick.
export function wanSteps(quality){return quality==='draft'?16:20;}
