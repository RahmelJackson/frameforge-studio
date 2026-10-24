"""Carry a checked video selection into a protected original-frame image edit."""
import json,sys
from pathlib import Path
from PIL import Image
from video_media import digest
from neural_masks import project_first_mask
m=json.loads(Path(sys.argv[1]).read_text(encoding='utf-8'));origin=Path(m['directory']);meta=json.loads((origin/'segmentation.json').read_text(encoding='utf-8'))
if digest(origin/'segmentation.json')!=m['metadataSha256'] or meta['sourceSha256']!=m['sourceSha256'] or abs(meta['sourceRange'][0]-m['time'])>.00001:raise ValueError('Neural selection does not match this original frame.')
mask=origin/'masks/0000.png'
if digest(mask)!=meta['maskSha256'][0] or digest(m['frame'])!=m['frameSha256']:raise ValueError('Original frame or checked mask changed.')
result,projection=project_first_mask(Image.open(mask),Image.open(m['frame']).size,meta,m['feather']);result.save(m['output'])
binding={'method':'checked-video-selection-to-original-frame-v1','selectionJob':m['jobId'],'metadataSha256':m['metadataSha256'],'originalMaskSha256':meta['maskSha256'][0],'sourceSha256':m['sourceSha256'],'frameSha256':m['frameSha256'],'time':m['time'],'maskSha256':digest(m['output']),'projection':projection}
Path(m['output']+'.json').write_text(json.dumps(binding,indent=2),encoding='utf-8');print(json.dumps(binding))
