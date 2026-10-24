import asyncio,json,sys
from pathlib import Path
from mcp import ClientSession,StdioServerParameters
from mcp.client.stdio import stdio_client
root=Path(__file__).resolve().parents[1]
sys.stdout.reconfigure(encoding='utf-8')
async def main():
    params=StdioServerParameters(command=str(root/'runtime/mcp-env/Scripts/comfy-mcp.exe'),args=[],env={'COMFY_BIN':str(root/'runtime/mcp-env/Scripts/comfy.exe'),'COMFYUI_URL':'http://127.0.0.1:8188','COMFY_PROJECT':str(root),'DO_NOT_TRACK':'1','PYTHONUTF8':'1'})
    async with stdio_client(params) as (read,write):
        async with ClientSession(read,write,read_timeout_seconds=90) as session:
            init=await session.initialize();inventory=await session.list_tools()
            records=[t.model_dump(mode='json') for t in inventory.tools]
            (root/'evidence/mcp-tools.json').write_text(json.dumps(records,indent=2),encoding='utf-8')
            print(json.dumps({'server':init.server_info.model_dump(),'tools':[t.name for t in inventory.tools]}),flush=True)
            result=await session.call_tool('server_info',{})
            (root/'evidence/mcp-server-info.json').write_text(result.model_dump_json(indent=2),encoding='utf-8')
            info=json.loads(result.content[0].text)
            print(json.dumps({'running':info.get('server',{}).get('running'),'url':info.get('server',{}).get('url')}),flush=True)
            if '--resume' in sys.argv:
                state=json.loads((root/'evidence/mcp-render-state.json').read_text(encoding='utf-8'))
                submitted=json.loads(state['content'][0]['text'])
                prompt_id=submitted['prompt_id']
                status=await session.call_tool('job',{'action':'status','prompt_id':prompt_id})
                (root/'evidence/mcp-render-status.json').write_text(status.model_dump_json(indent=2),encoding='utf-8')
                print(status.model_dump_json(),flush=True)
                result=await session.call_tool('fetch_outputs',{'prompt_id':prompt_id,'out_dir':str(root/'evidence/mcp-outputs')})
                (root/'evidence/mcp-output-result.json').write_text(result.model_dump_json(indent=2),encoding='utf-8')
                print(result.model_dump_json(),flush=True)
            if '--render' in sys.argv:
                state_path=root/'evidence/mcp-render-state.json'
                if state_path.exists():raise RuntimeError('MCP render state exists; inspect it instead of duplicating the render.')
                source=root/'data/jobs/983b10be-723c-4c6c-91ef-55eaa8c1dc39/workflow.json'
                workflow=json.loads(source.read_text(encoding='utf-8'))
                workflow['12']['inputs']['filename_prefix']='frameforge/mcp-smoke-v1'
                workflow_path=root/'evidence/mcp-smoke-workflow.json'
                workflow_path.write_text(json.dumps(workflow,indent=2),encoding='utf-8')
                validation=await session.call_tool('validate_workflow',{'workflow_path':str(workflow_path)})
                (root/'evidence/mcp-validation.json').write_text(validation.model_dump_json(indent=2),encoding='utf-8')
                verdict=json.loads(validation.content[0].text)
                print(json.dumps({'validation':verdict}),flush=True)
                if not verdict.get('valid'):raise RuntimeError('MCP validation did not clear the workflow.')
                state_path.write_text(json.dumps({'status':'dispatching','workflow':str(workflow_path)}),encoding='utf-8')
                submitted=await session.call_tool('run_workflow',{'workflow_path':str(workflow_path),'wait':False})
                state_path.write_text(submitted.model_dump_json(indent=2),encoding='utf-8')
                print(submitted.model_dump_json(),flush=True)
asyncio.run(main())

