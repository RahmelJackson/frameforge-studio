---
license: apache-2.0
tags:
- comfyui
- diffusion-single-file
base_model:
- Qwen/Qwen-Image-Edit
- Qwen/Qwen-Image-Edit-2509
- Qwen/Qwen-Image-Edit-2511
- FireRedTeam/FireRed-Image-Edit-1.0
---

# Qwen-Image Edit

Repackaged model files for ComfyUI.

Original model repository:

- https://huggingface.co/dx8152/Qwen-Edit-2509-Light-Migration/
- https://huggingface.co/dx8152/Qwen-Edit-2509-Multiple-angles
- https://huggingface.co/dx8152/Qwen-Image-Edit-2509-Fusion
- https://huggingface.co/dx8152/Qwen-Image-Edit-2509-Relight
- https://huggingface.co/lrzjason/QwenEdit-Anything2Real_Alpha/

Place the files in the following folders:

```
📂 ComfyUI/
├── 📂 models/
│   ├── 📂 diffusion_models/
│   │   ├── firered_image_edit_1.0_bf16.safetensors
│   │   ├── qwen_image_edit_2509_bf16.safetensors
│   │   ├── qwen_image_edit_2509_fp8_e4m3fn.safetensors
│   │   ├── qwen_image_edit_2509_fp8mixed.safetensors
│   │   ├── qwen_image_edit_2509_int8_convrot.safetensors
│   │   ├── qwen_image_edit_2511_bf16.safetensors
│   │   ├── qwen_image_edit_2511_fp8mixed.safetensors
│   │   ├── qwen_image_edit_2511_int8_convrot.safetensors
│   │   ├── qwen_image_edit_bf16.safetensors
│   │   └── qwen_image_edit_fp8_e4m3fn.safetensors
│   ├── 📂 loras/
│   │   ├── Qwen-Edit-2509-Multiple-angles.safetensors
│   │   ├── Qwen-Image-Edit-2509-Anything2RealAlpha.safetensors
│   │   ├── Qwen-Image-Edit-2509-Fusion.safetensors
│   │   ├── Qwen-Image-Edit-2509-Light-Migration.safetensors
│   │   ├── Qwen-Image-Edit-2509-Relight.safetensors
│   │   └── Qwen-Image-Edit-2509-White_to_Scene.safetensors
```

---
## LoRA model source
- Qwen-Image-Edit-2509-Light-Migration.safetensors from [dx8152/Qwen-Edit-2509-Light-Migration](https://huggingface.co/dx8152/Qwen-Edit-2509-Light-Migration/)
- Qwen-Edit-2509-Multiple-angles.safetensors from [dx8152/Qwen-Edit-2509-Multiple-angles](https://huggingface.co/dx8152/Qwen-Edit-2509-Multiple-angles)
- Qwen-Image-Edit-2509-Relight.safetensors from [dx8152/Qwen-Image-Edit-2509-Fusion](https://huggingface.co/dx8152/Qwen-Image-Edit-2509-Fusion)
- Qwen-Image-Edit-2509-Relight.safetensors fromt [dx8152/Qwen-Image-Edit-2509-Relight](https://huggingface.co/dx8152/Qwen-Image-Edit-2509-Relight)
- Qwen-Image-Edit-2509-Anything2RealAlpha.safetensors from [lrzjason/QwenEdit-Anything2Real_Alpha](https://huggingface.co/lrzjason/QwenEdit-Anything2Real_Alpha/)

## Workflows

<table>
<thead>
<tr><th align="center" valign="middle" style="text-align:center;vertical-align:middle">Workflow</th><th colspan="2" align="center" valign="middle" style="text-align:center;vertical-align:middle">Thumb</th></tr>
</thead>
<tbody>
<tr><td align="center" valign="middle" style="text-align:center;vertical-align:middle"><a href="https://github.com/Comfy-Org/workflow_templates/blob/main/templates/image_qwen_image_edit_2509.json">Qwen Image Edit 2509</a></td><td align="center" valign="middle" style="text-align:center;vertical-align:middle"><a href="https://github.com/Comfy-Org/workflow_templates/blob/main/templates/image_qwen_image_edit_2509.json"><img src="https://raw.githubusercontent.com/Comfy-Org/workflow_templates/main/templates/image_qwen_image_edit_2509-2.webp" width="200" height="200" alt="Qwen Image Edit 2509"></a><div align="center">Before</div></td><td align="center" valign="middle" style="text-align:center;vertical-align:middle"><a href="https://github.com/Comfy-Org/workflow_templates/blob/main/templates/image_qwen_image_edit_2509.json"><img src="https://raw.githubusercontent.com/Comfy-Org/workflow_templates/main/templates/image_qwen_image_edit_2509-1.webp" width="200" height="200" alt="Qwen Image Edit 2509"></a><div align="center">After</div></td></tr>
<tr><td align="center" valign="middle" style="text-align:center;vertical-align:middle"><a href="https://github.com/Comfy-Org/workflow_templates/blob/main/templates/image_qwen_image_edit_2511_int8.json">Qwen Image Edit 2511 Int8: Image Edit</a></td><td align="center" valign="middle" style="text-align:center;vertical-align:middle"><a href="https://github.com/Comfy-Org/workflow_templates/blob/main/templates/image_qwen_image_edit_2511_int8.json"><img src="https://raw.githubusercontent.com/Comfy-Org/workflow_templates/main/templates/image_qwen_image_edit_2511_int8-2.webp" width="200" height="200" alt="Qwen Image Edit 2511 Int8: Image Edit"></a><div align="center">Before</div></td><td align="center" valign="middle" style="text-align:center;vertical-align:middle"><a href="https://github.com/Comfy-Org/workflow_templates/blob/main/templates/image_qwen_image_edit_2511_int8.json"><img src="https://raw.githubusercontent.com/Comfy-Org/workflow_templates/main/templates/image_qwen_image_edit_2511_int8-1.webp" width="200" height="200" alt="Qwen Image Edit 2511 Int8: Image Edit"></a><div align="center">After</div></td></tr>
<tr><td align="center" valign="middle" style="text-align:center;vertical-align:middle"><a href="https://github.com/Comfy-Org/workflow_templates/blob/main/templates/image_qwen_image_edit_2511.json">Qwen Image Edit 2511 - Material Replacement</a></td><td align="center" valign="middle" style="text-align:center;vertical-align:middle"><a href="https://github.com/Comfy-Org/workflow_templates/blob/main/templates/image_qwen_image_edit_2511.json"><img src="https://raw.githubusercontent.com/Comfy-Org/workflow_templates/main/templates/image_qwen_image_edit_2511-2.webp" width="200" height="200" alt="Qwen Image Edit 2511 - Material Replacement"></a><div align="center">Before</div></td><td align="center" valign="middle" style="text-align:center;vertical-align:middle"><a href="https://github.com/Comfy-Org/workflow_templates/blob/main/templates/image_qwen_image_edit_2511.json"><img src="https://raw.githubusercontent.com/Comfy-Org/workflow_templates/main/templates/image_qwen_image_edit_2511-1.webp" width="200" height="200" alt="Qwen Image Edit 2511 - Material Replacement"></a><div align="center">After</div></td></tr>
<tr><td align="center" valign="middle" style="text-align:center;vertical-align:middle"><a href="https://github.com/Comfy-Org/workflow_templates/blob/main/templates/image_qwen_image_edit.json">Qwen Image Edit</a></td><td align="center" valign="middle" style="text-align:center;vertical-align:middle"><a href="https://github.com/Comfy-Org/workflow_templates/blob/main/templates/image_qwen_image_edit.json"><img src="https://raw.githubusercontent.com/Comfy-Org/workflow_templates/main/templates/image_qwen_image_edit-2.webp" width="200" height="200" alt="Qwen Image Edit"></a><div align="center">Before</div></td><td align="center" valign="middle" style="text-align:center;vertical-align:middle"><a href="https://github.com/Comfy-Org/workflow_templates/blob/main/templates/image_qwen_image_edit.json"><img src="https://raw.githubusercontent.com/Comfy-Org/workflow_templates/main/templates/image_qwen_image_edit-1.webp" width="200" height="200" alt="Qwen Image Edit"></a><div align="center">After</div></td></tr>
<tr><td align="center" valign="middle" style="text-align:center;vertical-align:middle"><a href="https://github.com/Comfy-Org/workflow_templates/blob/main/templates/image_qwen_image_edit_2509_relight.json">Image Relight</a></td><td align="center" valign="middle" style="text-align:center;vertical-align:middle"><a href="https://github.com/Comfy-Org/workflow_templates/blob/main/templates/image_qwen_image_edit_2509_relight.json"><img src="https://raw.githubusercontent.com/Comfy-Org/workflow_templates/main/templates/image_qwen_image_edit_2509_relight-2.webp" width="200" height="200" alt="Image Relight"></a><div align="center">Before</div></td><td align="center" valign="middle" style="text-align:center;vertical-align:middle"><a href="https://github.com/Comfy-Org/workflow_templates/blob/main/templates/image_qwen_image_edit_2509_relight.json"><img src="https://raw.githubusercontent.com/Comfy-Org/workflow_templates/main/templates/image_qwen_image_edit_2509_relight-1.webp" width="200" height="200" alt="Image Relight"></a><div align="center">After</div></td></tr>
<tr><td align="center" valign="middle" style="text-align:center;vertical-align:middle"><a href="https://github.com/Comfy-Org/workflow_templates/blob/main/templates/image-qwen_image_edit_2511_lora_inflation.json">Image Inflation Effect with INFL8 LoRA</a></td><td align="center" valign="middle" style="text-align:center;vertical-align:middle"><a href="https://github.com/Comfy-Org/workflow_templates/blob/main/templates/image-qwen_image_edit_2511_lora_inflation.json"><img src="https://raw.githubusercontent.com/Comfy-Org/workflow_templates/main/templates/image-qwen_image_edit_2511_lora_inflation-2.webp" width="200" height="200" alt="Image Inflation Effect with INFL8 LoRA"></a><div align="center">Before</div></td><td align="center" valign="middle" style="text-align:center;vertical-align:middle"><a href="https://github.com/Comfy-Org/workflow_templates/blob/main/templates/image-qwen_image_edit_2511_lora_inflation.json"><img src="https://raw.githubusercontent.com/Comfy-Org/workflow_templates/main/templates/image-qwen_image_edit_2511_lora_inflation-1.webp" width="200" height="200" alt="Image Inflation Effect with INFL8 LoRA"></a><div align="center">After</div></td></tr>
</tbody>
</table>
