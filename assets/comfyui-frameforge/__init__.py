"""Local-only image handoff between native ComfyUI and Frameforge Studio."""
import asyncio
import json
import re
import urllib.request
import ipaddress
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


def send_image(payload):
    base = studio_address(payload.get('studio', 'http://127.0.0.1:4317'))
    ref = payload.get('image', {})
    if ref.get('type') != 'output' or not re.fullmatch(r'[\w .-]+\.png', ref.get('filename', '')):
        raise ValueError('Choose a saved PNG output from this node.')
    root = Path(folder_paths.get_output_directory()).resolve()
    file = (root / ref.get('subfolder', '') / ref['filename']).resolve()
    if not file.is_relative_to(root) or not file.is_file() or file.stat().st_size > 20 * 1024 * 1024:
        raise ValueError('Choose an output image inside this ComfyUI, up to 20 MiB.')
    request = urllib.request.Request(base + '/api/assets', data=file.read_bytes(), headers={'Content-Type': 'image/png'}, method='POST')
    # Do not forward images through environment-configured HTTP proxies.
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, req, fp, code, msg, headers, newurl):
            raise ValueError('The local Studio must accept the upload without a redirect.')
    with urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect()).open(request, timeout=30) as response:
        item = json.load(response)
    if not re.fullmatch(r'[a-f0-9-]{36}\.png', item.get('name', '')):
        raise ValueError('The Studio did not acknowledge an imported PNG.')
    return {'url': base + '/images?tool=edit&source=' + item['name'], 'asset': item['name']}


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


NODE_CLASS_MAPPINGS = {'FrameforgeStudioOutput': FrameforgeStudioOutput}
NODE_DISPLAY_NAME_MAPPINGS = {'FrameforgeStudioOutput': 'Frameforge · send image to Studio'}
WEB_DIRECTORY = './web'
