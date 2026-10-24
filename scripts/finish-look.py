"""Apply the explicit monochrome finish, keeping timing and the ungraded source."""
import argparse
import hashlib
import json
from pathlib import Path
import av

def finish(source,output):
    temporary=output.with_suffix('.grade.partial.mp4')
    frames=0
    try:
        with av.open(str(source)) as original,av.open(str(temporary),'w') as result:
            source_stream=original.streams.video[0]
            stream=result.add_stream('libx264',rate=source_stream.average_rate)
            stream.width,stream.height,stream.pix_fmt=source_stream.width,source_stream.height,'yuv420p'
            stream.options={'crf':'18','preset':'fast'}
            for frame in original.decode(video=0):
                image=frame.to_image().convert('L').convert('RGB')
                for packet in stream.encode(av.VideoFrame.from_image(image)):result.mux(packet)
                frames+=1
            for packet in stream.encode():result.mux(packet)
        temporary.replace(output)
    except Exception:
        temporary.unlink(missing_ok=True)
        raise
    def sha(p):
        with p.open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()
    return {'operation':'monochrome finishing','sourceSha256':sha(source),'outputSha256':sha(output),'frames':frames,'creativeReview':'pending'}

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('source',type=Path);parser.add_argument('output',type=Path)
    args=parser.parse_args();report=finish(args.source,args.output)
    args.output.with_name('finish.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
