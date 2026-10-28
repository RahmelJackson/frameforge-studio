"""Exercise the shipped response hook without importing ComfyUI or Torch."""
import ast
import asyncio
import re
from pathlib import Path
from types import SimpleNamespace
from urllib.parse import urlsplit, quote

source = Path('assets/comfyui-frameforge/__init__.py').read_text(encoding='utf-8')
tree = ast.parse(source)
functions = [n for n in tree.body if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef)) and n.name in ('studio_address', 'frameforge_prepare')]
calls = []
def connect(payload, ancestor):
    calls.append((payload, ancestor))
    return {'url': 'http://127.0.0.1:49231'}
namespace = dict(asyncio=asyncio, re=re, urlsplit=urlsplit, quote=quote,
                 create_studio=connect, _STUDIO_BASE='http://127.0.0.1:4317')
exec(compile(ast.Module(body=functions, type_ignores=[]), '<bridge>', 'exec'), namespace)
class Headers(dict):
    def add(self, key, value):
        self[key] = value
def request(path='/', method='GET', host='127.0.0.1:8188'):
    return SimpleNamespace(path=path, method=method, host=host)
def response(policy="default-src 'self'; frame-src 'self'; object-src 'none';"):
    return SimpleNamespace(headers=Headers({'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': policy}))
async def check():
    hook = namespace['frameforge_prepare']
    for policy in ("default-src 'self'; frame-src 'self'; object-src 'none';", "default-src 'self'; frame-src 'none'; object-src 'none';", "default-src 'self'; object-src 'none'"):
        result = response(policy)
        await hook(request(), result)
        updated = result.headers['Content-Security-Policy']
        assert updated.count('http://127.0.0.1:49231') == 1
        assert "default-src 'self'" in updated and "object-src 'none'" in updated
        frame = re.search(r'frame-src([^;]+)', updated).group(1)
        assert set(frame.split()).issubset({"'self'", 'http://127.0.0.1:49231'})
        assert result.headers['Set-Cookie'].startswith('frameforge_comfy_view=http%3A%2F%2F127.0.0.1%3A49231;')
    before = len(calls)
    for req in (request('/api/queue'), request(method='POST'), request(host='example.com:8188')):
        result = response()
        await hook(req, result)
        assert 'Set-Cookie' not in result.headers
        assert '49231' not in result.headers['Content-Security-Policy']
    result = response()
    result.headers['Content-Type'] = 'application/json'
    await hook(request(), result)
    assert len(calls) == before
    def offline(*args):
        raise OSError('Studio stopped')
    namespace['create_studio'] = offline
    result = response()
    original = result.headers['Content-Security-Policy']
    await hook(request(), result)
    assert result.headers['Content-Security-Policy'] == original
    assert result.headers['Set-Cookie'].startswith('frameforge_comfy_view=;')
    assert all(ancestor == 'http://127.0.0.1:8188' for _, ancestor in calls)
    print('Exact-origin frame policy, unrelated routes, preserved restrictions and offline recovery passed.')
asyncio.run(check())
