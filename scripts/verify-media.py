"""Decode every frame and write technical evidence; creative approval stays separate."""
import argparse
import hashlib
import json
from pathlib import Path

import av
import numpy as np
from PIL import Image, ImageDraw

def verify(path, expected, out):
    out.mkdir(parents=True, exist_ok=True)
    checks, warnings, samples, luminance, deltas, times = [], [], [], [], [], []
    previous = None
    count = 0
    sample_indices = set(np.linspace(0, expected['frames'] - 1, 6, dtype=int).tolist())
    with av.open(str(path)) as container:
        stream = container.streams.video[0]
        width, height, fps = stream.width, stream.height, float(stream.average_rate)
        for frame in container.decode(stream):
            if frame.time is not None:
                times.append(float(frame.time))
            image = frame.to_image()
            small = np.asarray(image.resize((96, 54)).convert('L'), dtype=np.float32)
            luminance.append(float(small.mean()))
            if previous is not None:
                deltas.append(float(np.abs(small - previous).mean()))
            previous = small
            if count in sample_indices:
                samples.append((count, image.copy()))
            count += 1
    checks.extend([
        {'name': 'All frames decode', 'pass': count > 0, 'actual': count},
        {'name': 'Frame count', 'pass': count == expected['frames'], 'actual': count, 'expected': expected['frames']},
        {'name': 'Dimensions', 'pass': [width, height] == expected['size'], 'actual': [width, height], 'expected': expected['size']},
        {'name': 'Frame rate', 'pass': abs(fps - expected['fps']) < .01, 'actual': fps, 'expected': expected['fps']},
        {'name': 'Frame timing', 'pass': len(times) == count and all(abs((b-a)-1/expected['fps']) < .005 for a,b in zip(times,times[1:])), 'actual': len(times)},
    ])
    if luminance and sum(x < 3 for x in luminance) > count * .1:
        warnings.append('More than 10% of frames are nearly black. Inspect whether intentional.')
    if deltas and float(np.mean(deltas)) < .2:
        warnings.append('Very little visible motion. Inspect the requested movement.')
    sheet = Image.new('RGB', (960, 414), '#111319')
    draw = ImageDraw.Draw(sheet)
    for i, (number, image) in enumerate(samples):
        image.thumbnail((304, 170))
        x, y = (i % 3) * 320 + 8, (i // 3) * 207 + 8
        sheet.paste(image, (x + (304 - image.width)//2, y))
        draw.text((x, y + 177), f'{number / fps:.2f}s / frame {number}', fill='#b9c3cd')
    sheet.save(out / 'contact-sheet.jpg', quality=90)
    if samples:
        samples[len(samples)//2][1].save(out / 'poster.jpg', quality=92)
    with path.open('rb') as f:
        digest = hashlib.file_digest(f, 'sha256').hexdigest()
    report = {'technicalPass': all(x['pass'] for x in checks), 'creativeReview': 'pending', 'poster': bool(samples), 'checks': checks, 'warnings': warnings, 'duration': count/fps, 'frames': count, 'fps': fps, 'size': [width,height], 'meanFrameDifference': float(np.mean(deltas)) if deltas else 0, 'sha256': digest}
    (out / 'report.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    return report

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('video', type=Path)
    parser.add_argument('--expected', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    try:
        report = verify(args.video, json.loads(args.expected.read_text()), args.output)
        print(json.dumps(report))
        raise SystemExit(0 if report['technicalPass'] else 2)
    except Exception as exc:
        report = {'technicalPass': False, 'creativeReview': 'pending', 'checks': [{'name': 'Media decode', 'pass': False}], 'error': str(exc)}
        args.output.mkdir(parents=True, exist_ok=True)
        (args.output / 'report.json').write_text(json.dumps(report, indent=2))
        print(json.dumps(report))
        raise SystemExit(2)
