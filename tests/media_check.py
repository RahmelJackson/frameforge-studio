import importlib.util
from pathlib import Path
import tempfile
import av
import numpy as np

root = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('verifier', root / 'scripts/verify-media.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
with tempfile.TemporaryDirectory(prefix='frameforge-media-') as temporary:
    directory = Path(temporary)
    video = directory / 'fixture.mp4'
    with av.open(str(video), mode='w') as container:
        stream = container.add_stream('libx264', rate=24)
        stream.width, stream.height, stream.pix_fmt = 64, 64, 'yuv420p'
        for index in range(13):
            rgb = np.full((64,64,3), 40+index*8, dtype=np.uint8)
            frame = av.VideoFrame.from_ndarray(rgb, format='rgb24')
            for packet in stream.encode(frame):
                container.mux(packet)
        for packet in stream.encode():
            container.mux(packet)
    expected = {'frames':13,'size':[64,64],'fps':24}
    valid = module.verify(video,expected,directory/'valid')
    assert valid['technicalPass'] and valid['creativeReview']=='pending'
    assert len(valid['sha256'])==64 and (directory/'valid'/'poster.jpg').exists()
    invalid = module.verify(video,{**expected,'frames':17,'size':[128,64]},directory/'invalid')
    assert not invalid['technicalPass']
    assert sum(not c['pass'] for c in invalid['checks']) == 2
    second = directory / 'portrait.mp4'
    with av.open(str(second), mode='w') as container:
        stream = container.add_stream('libx264', rate=16)
        stream.width, stream.height, stream.pix_fmt = 64, 128, 'yuv420p'
        for index in range(13):
            rgb = np.full((128,64,3), (20,40,220), dtype=np.uint8)
            for packet in stream.encode(av.VideoFrame.from_ndarray(rgb, format='rgb24')): container.mux(packet)
        for packet in stream.encode(): container.mux(packet)
    film_spec = importlib.util.spec_from_file_location('film', root / 'scripts/render-film.py')
    film = importlib.util.module_from_spec(film_spec);film_spec.loader.exec_module(film)
    output = directory / 'movie.mp4'
    assembly = film.render([{'path':str(video),'jobId':'first'},{'path':str(second),'jobId':'second'}], output, size=(96,64))
    assert assembly['frames']==33 and assembly['shots'][1]['sourceFps']==16
    with av.open(str(output)) as container:
        frames=[f.to_ndarray(format='rgb24') for f in container.decode(video=0)]
    assert len(frames)==33
    assert abs(int(frames[0][32,48,0])-40)<10
    assert int(frames[13][32,48,2])>190 and int(frames[13][32,48,0])<40
    assert int(frames[13][32,0].max())<10
    assert module.verify(output,assembly,directory/'film-report')['technicalPass']
    repeated=film.render([{'path':str(second),'jobId':str(i)} for i in range(8)],directory/'eight-takes.mp4',size=(96,64))
    assert repeated['frames']==156, 'Frame rounding must not accumulate across shots'
    # A time-coded gray clip proves trim starts/ends use source time.
    trimmed=film.render([{'path':str(video),'jobId':'trim','trimStart':3/24,'trimEnd':9/24}],directory/'trim.mp4',size=(64,64))
    with av.open(str(directory/'trim.mp4')) as container:
        trim_frames=[f.to_ndarray(format='rgb24') for f in container.decode(video=0)]
    assert len(trim_frames)==6
    assert abs(int(trim_frames[0][32,32,0])-64)<10
    assert abs(int(trim_frames[-1][32,32,0])-104)<10
    # Two fades over three clips test both sides of a middle shot and exact overlap duration.
    colors=[]
    for label,color in [('red',(230,10,10)),('blue',(10,10,230)),('green',(10,230,10))]:
        filename=directory/(label+'.mp4');colors.append(str(filename))
        with av.open(str(filename),'w') as container:
            stream=container.add_stream('libx264',rate=24)
            stream.width,stream.height,stream.pix_fmt=64,64,'yuv420p'
            for _ in range(24):
                for packet in stream.encode(av.VideoFrame.from_ndarray(np.full((64,64,3),color,dtype=np.uint8),format='rgb24')):container.mux(packet)
            for packet in stream.encode():container.mux(packet)
    shots=[{'path':p,'jobId':str(i),'transition':'crossfade','transitionSeconds':.25} for i,p in enumerate(colors)]
    fades=film.render(shots,directory/'fades.mp4',size=(64,64))
    assert fades['frames']==60 and fades['duration']==2.5
    assert [s['timelineStartFrame'] for s in fades['shots']]==[0,18,36]
    with av.open(str(directory/'fades.mp4')) as container:
        pixels=[f.to_ndarray(format='rgb24')[32,32].astype(int) for f in container.decode(video=0)]
    assert pixels[17][0]>210 and pixels[24][2]>210
    assert 80<pixels[20][0]<155 and 80<pixels[20][2]<155
    assert all(pixels[i][0]>pixels[i+1][0] and pixels[i][2]<pixels[i+1][2] for i in range(18,23))
    assert pixels[-1][1]>210
    assert module.verify(directory/'fades.mp4',fades,directory/'fade-report')['technicalPass']
    for edits in [dict(trimStart=-1),dict(trimEnd=2),dict(trimStart=.5,trimEnd=.5),dict(transition='wipe'),dict(transitionSeconds=float('nan')),dict(sha256='wrong')]:
        try:film.render([{**shots[0],**edits}],directory/'invalid-edit.mp4',size=(64,64))
        except ValueError:pass
        else:raise AssertionError('Invalid edit accepted: '+str(edits))
    try:film.render([{**s,'transitionSeconds':.75} for s in shots],directory/'overlap.mp4',size=(64,64))
    except ValueError:pass
    else:raise AssertionError('Overlapping transitions consumed the middle shot')
    grade_spec=importlib.util.spec_from_file_location('grade',root/'scripts/finish-look.py')
    grade=importlib.util.module_from_spec(grade_spec);grade_spec.loader.exec_module(grade)
    grade_result=grade.finish(Path(colors[0]),directory/'graded.mp4')
    assert grade_result['frames']==24 and grade_result['sourceSha256']!=grade_result['outputSha256']
    with av.open(str(directory/'graded.mp4')) as container:
        graded=[f.to_ndarray(format='rgb24').astype(int) for f in container.decode(video=0)]
    assert len(graded)==24 and max(np.ptp(f,axis=2).max() for f in graded)<=2
    assert module.verify(directory/'graded.mp4',{'frames':24,'size':[64,64],'fps':24},directory/'grade-report')['technicalPass']
print('Encoded-video positive and negative controls passed.')
