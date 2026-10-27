"""Explicit local image, video and audio handoff to Frameforge Studio."""
import asyncio
import json
import re
import urllib.request
import ipaddress
import wave
import uuid
from pathlib import Path
from urllib.parse import urlsplit

import folder_paths
from aiohttp import web
from nodes import SaveImage
from server import PromptServer


def studio_address(value):
    parsed = urlsplit(value)
    if parsed.scheme != 'http' or parsed.hostname not in ('127.0.0.1', 'localhost', '::1') or parsed.username or parsed.password or parsed.path not in ('', '/') or parsed.query or parsed.fragment:
        raise ValueError('Use the root address of your local Frameforge Studio.')
    return value.rstrip('/')


class FrameforgeStudioOutput:
    CATEGORY = 'Frameforge'
    FUNCTION = 'save'
    RETURN_TYPES = ('IMAGE',)
    OUTPUT_NODE = True

    @classmethod
    def INPUT_TYPES(cls):
        return {'required': {'images': ('IMAGE',)}, 'hidden': {'prompt': 'PROMPT', 'extra_pnginfo': 'EXTRA_PNGINFO'}}

    def save(self, images, prompt=None, extra_pnginfo=None):
        result = SaveImage().save_images(images, filename_prefix='Frameforge/bridge', prompt=prompt, extra_pnginfo=extra_pnginfo)
        return {'ui': result['ui'], 'result': (images,)}


def saved_file(extension):
    root = Path(folder_paths.get_output_directory()).resolve()
    destination = root / 'Frameforge'
    destination.mkdir(exist_ok=True)
    if not destination.resolve().is_relative_to(root):
        raise ValueError('Keep Frameforge outputs inside this ComfyUI output folder.')
    return destination / (str(uuid.uuid4()) + extension)


def media_result(file):
    return {'filename': file.name, 'subfolder': 'Frameforge', 'type': 'output'}


class FrameforgeStudioAudioOutput:
    CATEGORY = 'Frameforge'
    FUNCTION = 'save'
    RETURN_TYPES = ('AUDIO',)
    OUTPUT_NODE = True

    @classmethod
    def INPUT_TYPES(cls):
        return {'required': {'audio': ('AUDIO',)}}

    def save(self, audio):
        import numpy as np
        samples = audio['waveform'].detach().cpu().numpy()
        rate = int(audio['sample_rate'])
        if samples.ndim != 3 or samples.shape[0] != 1 or not 1 <= samples.shape[1] <= 8 or not 8000 <= rate <= 192000 or samples.shape[2] > rate * 300:
            raise ValueError('Use one audio item, up to five minutes and eight channels.')
        if not np.isfinite(samples).all():
            raise ValueError('Audio contains invalid samples.')
        pcm = (np.clip(samples[0].T, -1, 1) * 32767).astype('<i2').tobytes()
        if len(pcm) > 25 * 1024 * 1024 - 44:
            raise ValueError('Use a WAV output under 25 MiB.')
        file = saved_file('.wav')
        with wave.open(str(file), 'wb') as stream:
            stream.setnchannels(samples.shape[1])
            stream.setsampwidth(2)
            stream.setframerate(rate)
            stream.writeframes(pcm)
        return {'ui': {'frameforge_media': [media_result(file)]}, 'result': (audio,)}


class FrameforgeStudioVideoOutput:
    CATEGORY = 'Frameforge'
    FUNCTION = 'save'
    RETURN_TYPES = ('VIDEO',)
    OUTPUT_NODE = True

    @classmethod
    def INPUT_TYPES(cls):
        return {'required': {'video': ('VIDEO',)}, 'hidden': {'prompt': 'PROMPT', 'extra_pnginfo': 'EXTRA_PNGINFO'}}

    def save(self, video, prompt=None, extra_pnginfo=None):
        from comfy_api.latest import Types
        file = saved_file('.mp4')
        video.save_to(str(file), format=Types.VideoContainer('mp4'), codec='h264', metadata={**(extra_pnginfo or {}), 'prompt': prompt})
        if file.stat().st_size > 100 * 1024 * 1024:
            raise ValueError('Saved video exceeds the Studio 100 MiB import limit. Use a shorter preview.')
        return {'ui': {'frameforge_media': [media_result(file)]}, 'result': (video,)}


def send_image(payload):
    base = studio_address(payload.get('studio', 'http://127.0.0.1:4317'))
    ref = payload.get('media', payload.get('image', {}))
    if not isinstance(ref, dict) or ref.get('type') != 'output' or not re.fullmatch(r'[\w .-]+\.(png|mp4|webm|wav)', ref.get('filename', '')):
        raise ValueError('Choose a saved PNG, MP4, WebM or WAV output from this node.')
    extension = Path(ref['filename']).suffix
    mime, route, limit = {'.png': ('image/png', '/api/assets', 20), '.mp4': ('video/mp4', '/api/footage', 100), '.webm': ('video/webm', '/api/footage', 100), '.wav': ('audio/wav', '/api/audio-assets', 25)}[extension]
    root = Path(folder_paths.get_output_directory()).resolve()
    file = (root / ref.get('subfolder', '') / ref['filename']).resolve()
    if not file.is_relative_to(root) or not file.is_file() or file.stat().st_size > limit * 1024 * 1024:
        raise ValueError('Choose a saved output inside this ComfyUI, up to ' + str(limit) + ' MiB.')
    request = urllib.request.Request(base + route, data=file.read_bytes(), headers={'Content-Type': mime, 'X-File-Name': 'ComfyUI output' + extension, 'X-Frameforge-Source': 'comfyui'}, method='POST')
    # Do not forward images through environment-configured HTTP proxies.
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, req, fp, code, msg, headers, newurl):
            raise ValueError('The local Studio must accept the upload without a redirect.')
    with urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect()).open(request, timeout=30) as response:
        item = json.load(response)
    if extension == '.png':
        if not re.fullmatch(r'[a-f0-9-]{36}\.png', item.get('name', '')):
            raise ValueError('The Studio did not acknowledge an imported PNG.')
        return {'url': base + '/images?tool=edit&source=' + item['name'], 'asset': item['name']}
    if not re.fullmatch(r'[a-f0-9-]{36}', item.get('id', '')):
        raise ValueError('The Studio did not acknowledge the imported media.')
    page = '/audio?tool=transcribe&audio=' if extension == '.wav' else '/video-tools?footage='
    return {'url': base + page + item['id'], 'id': item['id'], 'kind': 'audio' if extension == '.wav' else 'footage'}


@PromptServer.instance.routes.post('/frameforge/send')
async def frameforge_send(request):
    if not request.remote or not ipaddress.ip_address(request.remote).is_loopback:
        return web.json_response({'error': 'Use this image bridge on the same computer.'}, status=403)
    if request.content_length is None or request.content_length > 4096:
        return web.json_response({'error': 'Invalid handoff request.'}, status=400)
    # Browser scripts on unrelated sites must not use this local file handoff.
    origin = request.headers.get('Origin')
    if origin and urlsplit(origin).netloc != request.host:
        return web.json_response({'error': 'Use the ComfyUI page on this server.'}, status=403)
    try:
        value = await asyncio.to_thread(send_image, await request.json())
        return web.json_response(value)
    except Exception as error:
        return web.json_response({'error': str(error)}, status=400)


NODE_CLASS_MAPPINGS = {'FrameforgeStudioOutput': FrameforgeStudioOutput, 'FrameforgeStudioVideoOutput': FrameforgeStudioVideoOutput, 'FrameforgeStudioAudioOutput': FrameforgeStudioAudioOutput}
NODE_DISPLAY_NAME_MAPPINGS = {'FrameforgeStudioOutput': 'Frameforge · send image to Studio', 'FrameforgeStudioVideoOutput': 'Frameforge · send video to Studio', 'FrameforgeStudioAudioOutput': 'Frameforge · send audio to Studio'}
WEB_DIRECTORY = './web'
