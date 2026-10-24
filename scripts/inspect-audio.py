import json,sys,av
count=0
with av.open(sys.argv[1]) as media:
    if not media.streams.audio:raise ValueError('Choose a WAV with an audio stream.')
    stream=media.streams.audio[0]
    for frame in media.decode(stream):
        count+=frame.samples
        if count/frame.sample_rate>60:raise ValueError('Audio is limited to 60 seconds.')
    if not count:raise ValueError('The audio stream is empty.')
    print(json.dumps({'duration':count/stream.rate,'sampleRate':stream.rate,'channels':stream.channels}))
