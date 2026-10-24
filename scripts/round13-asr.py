"""Bounded, isolated VibeVoice-ASR evaluation. Never modifies an existing environment."""
from __future__ import annotations

import argparse
import concurrent.futures
import hashlib
import importlib.metadata
import itertools
import json
import os
from pathlib import Path
import re
import sys
import time
import traceback
import urllib.request
import uuid
import zipfile

ROOT = Path(__file__).resolve().parents[1]
LOCK = json.loads((ROOT / 'setup/round13-asr.lock.json').read_text(encoding='utf-8'))
MODELS = Path(LOCK['modelDirectory'])
OVERLAY = ROOT / LOCK['overlayDirectory']
EVIDENCE = ROOT / 'evidence/round13-asr'
SOURCES = {
    'spanish-overlap': ('228329e4-318f-4d46-82a7-f2304b95eacb', 'ec2e3adf5aff71710681cf38c0a37374a360bb13ad46423fe5ce42f7b699469a', ['Buenos días. El jardín abre a las nueve.', 'Perfecto. Nos vemos junto a la puerta.']),
    'english-overlap': ('b04ea1a7-6075-4c61-b6ca-42a5bdcdb7e2', '2e3969ef0c4b60f0ccfa5cba667f91906b3158996e43bab35761641285e7feff', ['Welcome back. The garden opens at nine.', 'Great. I will bring the camera.']),
    'colored-noise': ('0ff47ddb-8ac1-4fbe-8273-68fa58b77e02', '1872b251382edeffd1ee16a755da96a65b87abfd1f7b74ece05c477909450f65', None),
}


def digest(file):
    h = hashlib.sha256()
    with Path(file).open('rb') as handle:
        for chunk in iter(lambda: handle.read(8 * 1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def save(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(path.suffix + '.writing')
    temp.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding='utf-8')
    temp.replace(path)


def download(url, target, size, sha):
    if target.exists():
        if target.stat().st_size != size or digest(target) != sha:
            raise ValueError(f'Existing file differs from pin; inspect before replacement: {target}')
        return
    target.parent.mkdir(parents=True, exist_ok=True)
    partial = target.with_suffix(target.suffix + '.partial')
    offset = partial.stat().st_size if partial.exists() else 0
    if offset > size:
        raise ValueError('Partial exceeds pinned size')
    if offset < size:
        request = urllib.request.Request(url, headers={'User-Agent': 'Frameforge-pinned-research/1', **({'Range': f'bytes={offset}-'} if offset else {})})
        with urllib.request.urlopen(request, timeout=120) as response:
            if offset and (response.status != 206 or not response.headers.get('Content-Range', '').startswith(f'bytes {offset}-')):
                raise ValueError('Server did not honor partial resume; original partial preserved')
            with partial.open('ab' if offset else 'wb') as handle:
                while chunk := response.read(8 * 1024 * 1024):
                    handle.write(chunk)
    if partial.stat().st_size != size or digest(partial) != sha:
        raise ValueError(f'Download failed pinned verification: {partial}')
    partial.replace(target)
    print(json.dumps({'downloaded': str(target), 'bytes': size}), flush=True)


def prepare():
    if sum(x['bytes'] for x in LOCK['files']) > 18_000_000_000:
        raise ValueError('Authorized weight budget exceeded')
    wheel = LOCK['overlay']
    package = ROOT / 'runtime/round13-asr-download' / wheel['url'].split('/')[-1]
    download(wheel['url'], package, wheel['bytes'], wheel['sha256'])
    if not (OVERLAY / 'transformers/__init__.py').exists():
        OVERLAY.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(package) as archive:
            for name in archive.namelist():
                if not (OVERLAY / name).resolve().is_relative_to(OVERLAY.resolve()):
                    raise ValueError('Unsafe wheel path')
            archive.extractall(OVERLAY)
    def one(item):
        url = f"https://huggingface.co/{LOCK['repo']}/resolve/{LOCK['revision']}/{item['path']}"
        download(url, MODELS / item['path'], item['bytes'], item['sha256'])
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        list(pool.map(one, LOCK['files']))
    save(EVIDENCE / 'prepared.json', {'at': time.time(), 'revision': LOCK['revision'], 'modelBytes': sum(x['bytes'] for x in LOCK['files']), 'overlay': wheel, 'existingEnvironmentsModified': False})


def activate():
    if 'transformers' in sys.modules:
        raise RuntimeError('Overlay must precede every Transformers import')
    sys.path.insert(0, str(OVERLAY))
    os.environ['HF_HUB_OFFLINE'] = '1'
    os.environ['TRANSFORMERS_OFFLINE'] = '1'
    os.environ['HF_HOME'] = str(ROOT / 'runtime/round13-asr-cache')
    os.environ['PYTHONDONTWRITEBYTECODE'] = '1'
    sys.dont_write_bytecode = True
    import transformers
    if transformers.__version__ != '5.3.0' or not Path(transformers.__file__).resolve().is_relative_to(OVERLAY.resolve()):
        raise ValueError('Wrong isolated Transformers path/version')
    from transformers import AutoProcessor, VibeVoiceAsrForConditionalGeneration
    return AutoProcessor, VibeVoiceAsrForConditionalGeneration


def readiness():
    activate()
    packages = {name: importlib.metadata.version(name) for name in LOCK['borrowedPackages']}
    if packages != LOCK['borrowedPackages']:
        raise ValueError(f'Borrowed environment changed: {packages}')
    files = {}
    for item in LOCK['files']:
        file = MODELS / item['path']
        if file.stat().st_size != item['bytes'] or digest(file) != item['sha256']:
            raise ValueError('Pinned model mismatch: ' + item['path'])
        files[item['path']] = item['sha256']
    result = {'ready': True, 'checkedAt': time.time(), 'packages': packages, 'overlay': 'transformers==5.3.0', 'files': files, 'existingEnvironmentsModified': False}
    save(EVIDENCE / 'readiness.json', result)
    print(json.dumps({'ready': True, 'files': len(files), 'overlay': result['overlay']}), flush=True)


def words(text):
    return re.sub(r'[^\w\s]', ' ', text.lower().replace('9', 'nine')).split()


def distance(a, b):
    previous = list(range(len(b) + 1))
    for i, x in enumerate(a, 1):
        row = [i]
        for j, y in enumerate(b, 1):
            row.append(min(row[-1] + 1, previous[j] + 1, previous[j - 1] + (x != y)))
        previous = row
    return previous[-1]


def score(parsed, truths):
    if truths is None:
        return {'scored': False, 'reason': 'Noise exact-script comparison is recorded separately; no acceptance inferred.'}
    speakers = {}
    for line in parsed:
        speakers.setdefault(str(line['Speaker']), []).extend(words(line['Content']))
    reference = [words(x) for x in truths]
    hypothesis = list(speakers.values())
    count = max(len(reference), len(hypothesis))
    if count > 8:
        return {'scored': False, 'reason': 'More than eight speaker labels is invalid for this two-speaker fixture.'}
    reference += [[] for _ in range(count - len(reference))]
    hypothesis += [[] for _ in range(count - len(hypothesis))]
    best = min((sum(distance(reference[i], hypothesis[j]) for i, j in enumerate(order)), order) for order in itertools.permutations(range(count)))
    total = sum(map(len, reference))
    return {'scored': True, 'speakerCount': len(speakers), 'referenceSpeakerCount': len(truths), 'wordEdits': best[0], 'referenceWords': total, 'permutationInvariantSpeakerWer': best[0] / total, 'allWordsWithDistinctSpeakers': best[0] == 0 and len(speakers) == len(truths), 'assignment': list(best[1]), 'hypothesisBySpeaker': speakers, 'referenceScripts': truths}


def run(case):
    if case not in SOURCES:
        raise ValueError('Choose one of the three authorized cases')
    state_path = EVIDENCE / (case + '.json')
    if state_path.exists():
        raise ValueError('Recorded case exists; inspect it instead of submitting again')
    identity, expected, truths = SOURCES[case]
    source = ROOT / 'data/audio' / (identity + '.wav')
    if digest(source) != expected:
        raise ValueError('Frozen source changed')
    ready = json.loads((EVIDENCE / 'readiness.json').read_text(encoding='utf-8'))
    if not ready.get('ready') or ready['files'] != {x['path']: x['sha256'] for x in LOCK['files']}:
        raise ValueError('Complete pinned readiness first')
    state = {'id': str(uuid.uuid4()), 'case': case, 'status': 'started', 'startedAt': time.time(), 'source': str(source), 'sourceSha256': expected, 'modelRevision': LOCK['revision'], 'generation': {'do_sample': False, 'max_new_tokens': 512, 'acoustic_tokenizer_chunk_size': 64000, 'attn_implementation': 'eager', 'dtype': 'bfloat16'}, 'prompt': None, 'groundTruthPassedToModel': False, 'creativeApproval': 'pending'}
    save(state_path, state)
    try:
        AutoProcessor, Model = activate()
        import numpy as np
        import soundfile as sf
        import torch
        waveform, sample_rate = sf.read(source, dtype='float32')
        if sample_rate != 24000 or waveform.ndim != 1 or len(waveform) > 30 * sample_rate:
            raise ValueError('Only original short mono24k fixtures are authorized')
        free, total = torch.cuda.mem_get_info()
        state['gpuBefore'] = {'freeBytes': free, 'totalBytes': total}
        if free < 19 * 1024 ** 3:
            raise RuntimeError('Less than19GiB free; release the authorized GPU slot first')
        torch.manual_seed(20261023)
        torch.cuda.reset_peak_memory_stats()
        processor = AutoProcessor.from_pretrained(MODELS, local_files_only=True, trust_remote_code=False)
        model = Model.from_pretrained(MODELS, local_files_only=True, trust_remote_code=False, dtype=torch.bfloat16, attn_implementation='eager').eval().to('cuda')
        inputs = processor.apply_transcription_request(audio=waveform, sampling_rate=sample_rate).to('cuda', torch.bfloat16)
        state['inputTokens'] = inputs['input_ids'].shape[1]
        state['loadedAt'] = time.time()
        save(state_path, state)
        with torch.inference_mode():
            output = model.generate(**inputs, do_sample=False, max_new_tokens=512, acoustic_tokenizer_chunk_size=64000)
        generated = output[:, inputs['input_ids'].shape[1]:]
        raw = processor.decode(generated)[0]
        parsed = processor.decode(generated, return_format='parsed')[0]
        state.update({'raw': raw, 'parsed': parsed, 'outputTokens': generated.shape[1], 'peakAllocatedBytes': torch.cuda.max_memory_allocated(), 'peakReservedBytes': torch.cuda.max_memory_reserved()})
        if not isinstance(parsed, list) or not parsed:
            raise ValueError('ASR did not return structured utterances; raw output retained')
        duration = len(waveform) / sample_rate
        valid = all(isinstance(line, dict) and isinstance(line.get('Content'), str) and isinstance(line.get('Speaker'), (str, int)) and isinstance(line.get('Start'), (int, float)) and isinstance(line.get('End'), (int, float)) and 0 <= line['Start'] < line['End'] <= duration + .25 for line in parsed)
        state.update({'status': 'completed', 'duration': duration, 'technicalPass': valid and generated.shape[1] < 512, 'quality': score(parsed, truths), 'sourceUnchanged': digest(source) == expected, 'finishedAt': time.time()})
        if not state['sourceUnchanged']:
            raise ValueError('Source changed during probe')
        save(state_path, state)
        print(json.dumps({k: state[k] for k in ['case', 'status', 'technicalPass', 'parsed', 'quality', 'peakAllocatedBytes']}, ensure_ascii=False), flush=True)
    except Exception as error:
        state.update({'status': 'failed', 'error': str(error), 'traceback': traceback.format_exc(), 'finishedAt': time.time()})
        save(state_path, state)
        raise


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    action = parser.add_mutually_exclusive_group(required=True)
    action.add_argument('--prepare', action='store_true')
    action.add_argument('--ready', action='store_true')
    action.add_argument('--case', choices=list(SOURCES))
    args = parser.parse_args()
    if args.prepare:
        prepare()
    elif args.ready:
        readiness()
    else:
        run(args.case)
