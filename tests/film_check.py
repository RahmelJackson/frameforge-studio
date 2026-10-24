import sys,importlib.util,pathlib,tempfile,json,wave
import numpy as np
from PIL import Image
root=pathlib.Path(__file__).resolve().parents[1];sys.path.insert(0,str(root/'scripts'))
from video_media import encode,audio_samples,sample_images,inspect
spec=importlib.util.spec_from_file_location('film',root/'scripts/render-film.py');film=importlib.util.module_from_spec(spec);spec.loader.exec_module(film)
with tempfile.TemporaryDirectory(prefix='frameforge-film-mix-') as temp:
 directory=pathlib.Path(temp);shots=[]
 for i,(color,hz) in enumerate([('red',440),('blue',880)]):
  tone=(np.sin(np.arange(144000)/48000*2*np.pi*hz)*.2).astype(np.float32);source=directory/f'{i}.mp4';encode((Image.new('RGB',(192,108),color) for _ in range(72)),source,(192,108),24,np.stack([tone,tone]));shots.append({'path':str(source),'jobId':str(i),'trimStart':.5,'trimEnd':2.5,'transition':'crossfade','transitionSeconds':.5,'fadeIn':.2,'fadeOut':.2,'volume':1})
 tone=(np.sin(np.arange(48000)/48000*2*np.pi*1760)*.2*32767).astype('<i2')
 with wave.open(str(directory/'music.wav'),'wb') as audio:audio.setnchannels(1);audio.setsampwidth(2);audio.setframerate(48000);audio.writeframes(tone.tobytes())
 Image.new('RGB',(32,32),'lime').save(directory/'logo.png')
 settings={'tracks':[{'id':'music','type':'wav','path':str(directory/'music.wav'),'label':'Test sound','start':.5,'end':1.25,'trimStart':0,'volume':.5,'fadeIn':.05,'fadeOut':.05,'loop':False}], 'texts':[{'id':'title','text':'A TEST FILM','start':.2,'end':.7,'position':'top','fontSize':18},{'id':'subtitle','text':'Second scene','start':2.3,'end':3.3,'position':'bottom','fontSize':18}], 'overlays':[{'id':'logo','path':str(directory/'logo.png'),'asset':'logo.png','start':.8,'end':1.3,'x':.05,'y':.4,'width':.2,'opacity':1}]}
 out=directory/'movie.mp4';result=film.render(shots,out,size=(192,108),film=settings);assert result['frames']==84 and result['duration']==3.5 and result['hasAudio']
 audio=audio_samples(out,3.5)
 def power(start,end,hz):
  x=audio[0,round(start*48000):round(end*48000)];spectrum=np.abs(np.fft.rfft(x));freq=np.fft.rfftfreq(x.size,1/48000);return float(spectrum[np.abs(freq-hz)<15].max())
 assert power(.25,.45,440)>power(.25,.45,880)*20
 assert power(2.7,2.9,880)>power(2.7,2.9,440)*20
 assert power(.8,1,1760)>power(.25,.45,1760)*10
 assert power(1.65,1.85,440)>10 and power(1.65,1.85,880)>10
 assert np.sqrt(np.mean(audio[:,:2400]**2))<np.sqrt(np.mean(audio[:,20000:22400]**2))*.5
 frames=list(sample_images(out,[.1,.4,.9,1.4,2.5]));pixels=[np.asarray(f).astype(int) for f in frames]
 assert pixels[0][18,96,0]>180 and pixels[1][18,96,0]<60,'Title timing did not change the expected top region'
 assert pixels[2][55,20,1]>170 and pixels[3][55,20,0]>180,'Overlay did not enter/leave at its timed region'
 assert pixels[4][90,96,2]<100,'Timed subtitle background is missing'
 assert '00:00:02,300 --> 00:00:03,300' in (directory/'subtitles.srt').read_text(encoding='utf-8')
 shots[0]['volume']=0;muted=directory/'muted.mp4';film.render(shots,muted,size=(192,108));muted_audio=audio_samples(muted,3.5);assert np.max(np.abs(muted_audio[:,:48000]))<.001
 try:film.render(shots,directory/'bad.mp4',size=(192,108),film={**settings,'texts':[{**settings['texts'][0],'end':4}]})
 except ValueError:pass
 else:raise AssertionError('Layer outside the film accepted')
print('Real source/crossfade audio, independent track alignment, fades, mute, timed text/image and SRT checks passed')
