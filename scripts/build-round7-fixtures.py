"""Original evaluation fixtures and controlled degradations of saved studio media."""
import sys,json,math
from pathlib import Path
import numpy as np,soundfile as sf
from PIL import Image,ImageDraw
from video_media import sample_images,encode,digest,decode_images
ROOT=Path(__file__).resolve().parents[1];out=ROOT/'evidence/acceptance-round7';out.mkdir(exist_ok=True,parents=True)
balloon=Image.open(ROOT/'evidence/acceptance-round6/balloon-sketch.png').convert('RGB');frames=[]
for i in range(33):
    im=Image.new('RGB',balloon.size,'white');im.paste(balloon.crop((280,65,490,390)),(280,65-round(i*2.5)));ImageDraw.Draw(im).line((0,406,767,406),fill='black',width=3);frames.append(im)
encode(frames,out/'sketch-driver.mp4',balloon.size,16)
tracking=list(decode_images(ROOT/'evidence/acceptance-round6/tracking-source.mp4'))
gap=[im if not 20<=i<26 else Image.new('RGB',im.size,(24,34,48)) for i,im in enumerate(tracking)]
encode(gap,out/'tracking-gap.mp4',tracking[0].size,24)
encode(tracking[::2],out/'interpolation-half-rate.mp4',tracking[0].size,12)
hd=ROOT/'data/jobs/8fb32064-6c5e-4f62-8ab6-5bb2ce2bc5c1/output.mp4'
high=list(sample_images(hd,(i/24 for i in range(25))))
encode([im.resize((512,288),Image.Resampling.LANCZOS) for im in high],out/'upscale-low.mp4',(512,288),24)
high[0].save(out/'transition-start.png');high[-1].save(out/'transition-end.png')
robot=[]
for i in range(33):
    im=Image.new('RGB',(512,288),(225,228,231));d=ImageDraw.Draw(im);angle=-.2-i/32*1.1;elbow=(320+round(45*math.cos(angle)),150+round(45*math.sin(angle)));hand=(elbow[0]+round(38*math.cos(angle-.6)),elbow[1]+round(38*math.sin(angle-.6)))
    d.rectangle((235,100,305,185),fill=(38,90,150),outline=(20,20,20),width=4);d.rounded_rectangle((245,43,295,94),radius=10,fill=(205,145,60),outline='black',width=3)
    d.ellipse((257,60,264,67),fill='black');d.ellipse((277,60,284,67),fill='black')
    d.line((245,180,237,248),fill='black',width=12);d.line((294,180,309,248),fill='black',width=12)
    d.line((240,115,205,157,190,200),fill=(30,60,90),width=13);d.line((303,115,320,150,*elbow,*hand),fill=(30,60,90),width=13);d.ellipse((hand[0]-9,hand[1]-9,hand[0]+9,hand[1]+9),fill=(205,145,60))
    robot.append(im)
robot[0].save(out/'robot-reference.png');encode(robot,out/'robot-driver.mp4',(512,288),16)
original,rate=sf.read(ROOT/'data/audio-jobs/98f2dc96-ad17-441f-95f0-0caf87518236/output.wav');rng=np.random.default_rng(202610207)
# Colored low-frequency background; known original words.
noise=rng.normal(size=len(original));kernel=np.exp(-np.arange(120)/20);noise=np.convolve(noise,kernel/kernel.sum(),mode='same')
noise*=math.sqrt(float(np.mean(original**2))/(float(np.mean(noise**2))*10**(.3)))
mixed=original+noise;mixed*=min(1,.95/max(abs(mixed)));sf.write(out/'colored-noise.wav',mixed,rate,subtype='PCM_16')
first,_=sf.read(ROOT/'data/audio-jobs/98f2dc96-ad17-441f-95f0-0caf87518236/line-000.wav');second,_=sf.read(ROOT/'data/audio-jobs/98f2dc96-ad17-441f-95f0-0caf87518236/line-001.wav')
overlap=np.zeros(max(len(first),len(second)+round(rate*.6)));overlap[:len(first)]+=first;overlap[round(rate*.6):round(rate*.6)+len(second)]+=second;overlap*=min(1,.95/max(abs(overlap)));sf.write(out/'overlap.wav',overlap,rate,subtype='PCM_16')
lipjob=json.loads((ROOT/'data/jobs/850cf011-0100-4027-b54f-42368d8ff78d/job.json').read_text());lip=list(sample_images(ROOT/'data/jobs'/lipjob['id']/lipjob['video'],(i/25 for i in range(49))))
# Block lower face in an explicit negative control; not a realistic hand-occlusion benchmark.
track=json.loads((ROOT/'data/audio-jobs/09e253ac-e3a5-4c2e-98d5-b95c49587acb/lipsync.json').read_text())
for i,image in enumerate(lip):
    if i>=12:
        x,y,x1,y1=track['trajectory'][min(i,len(track['trajectory'])-1)]['crop'];ImageDraw.Draw(image).rectangle((x,y+(y1-y)//2,x1,y1),fill='black')
encode(lip,out/'lip-blocked.mp4',lip[0].size,25)
files={p.name:digest(p) for p in out.iterdir() if p.suffix in ['.mp4','.wav','.png'] and p.name in ['sketch-driver.mp4','tracking-gap.mp4','interpolation-half-rate.mp4','upscale-low.mp4','transition-start.png','transition-end.png','robot-reference.png','robot-driver.mp4','colored-noise.wav','overlap.wav','lip-blocked.mp4']}
(out/'fixtures.json').write_text(json.dumps({'files':files,'sketchShiftY':-80,'articulation':'Original drawn robot with moving right forearm','noise':'Original four-line dialogue + deterministic colored noise at 3 dB SNR before peak scaling','overlap':'Original Host and Guest lines, guest starts at 0.6 seconds','highResolutionSource':'8fb32064-6c5e-4f62-8ab6-5bb2ce2bc5c1','interpolationGroundTruth':'acceptance-round6/tracking-source.mp4','warning':'Synthetic controls do not establish broad real-world quality.'},indent=2),encoding='utf-8')
print('Prepared',len(files),'bounded fixtures.')
