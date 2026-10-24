import argparse,json
from video_media import inspect
p=argparse.ArgumentParser();p.add_argument('file');p.add_argument('--poster');args=p.parse_args()
print(json.dumps(inspect(args.file,args.poster)))
