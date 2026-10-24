---
license: apache-2.0
tags:
- comfyui
- diffusion-single-file
base_model:
- Tongyi-MAI/Z-Image-Turbo
---

# Z-Image Turbo

Repackaged model files for ComfyUI.

Original model repository: https://huggingface.co/Tongyi-MAI/Z-Image-Turbo

Place the files in the following folders:

```
📂 ComfyUI/
├── 📂 models/
│   ├── 📂 diffusion_models/
│   │   ├── z_image_turbo_bf16.safetensors
│   │   ├── z_image_turbo_int8_convrot.safetensors
│   │   └── z_image_turbo_nvfp4.safetensors
│   ├── 📂 loras/
│   │   └── z_image_turbo_distill_patch_lora_bf16.safetensors
│   ├── 📂 text_encoders/
│   │   ├── qwen_3_4b.safetensors
│   │   ├── qwen_3_4b_fp4_mixed.safetensors
│   │   └── qwen_3_4b_fp8_mixed.safetensors
│   └── 📂 vae/
│       └── ae.safetensors
```

Workflows: https://comfyanonymous.github.io/ComfyUI_examples/z_image/

## Workflows

<table>
<thead>
<tr><th align="center" valign="middle" style="text-align:center;vertical-align:middle">Workflow</th><th colspan="2" align="center" valign="middle" style="text-align:center;vertical-align:middle">Thumb</th></tr>
</thead>
<tbody>
<tr><td align="center" valign="middle" style="text-align:center;vertical-align:middle"><a href="https://github.com/Comfy-Org/workflow_templates/blob/main/templates/image_z_image_turbo.json">Z-Image-Turbo: Text to Image</a></td><td colspan="2" align="center" valign="middle" style="text-align:center;vertical-align:middle"><a href="https://github.com/Comfy-Org/workflow_templates/blob/main/templates/image_z_image_turbo.json"><img src="https://raw.githubusercontent.com/Comfy-Org/workflow_templates/main/templates/image_z_image_turbo-1.webp" width="200" height="200" alt="Z-Image-Turbo: Text to Image"></a></td></tr>
<tr><td align="center" valign="middle" style="text-align:center;vertical-align:middle"><a href="https://github.com/Comfy-Org/workflow_templates/blob/main/templates/image_z_image_turbo_int8.json">Z-Image-Turbo Int8: Text to Image</a></td><td colspan="2" align="center" valign="middle" style="text-align:center;vertical-align:middle"><a href="https://github.com/Comfy-Org/workflow_templates/blob/main/templates/image_z_image_turbo_int8.json"><img src="https://raw.githubusercontent.com/Comfy-Org/workflow_templates/main/templates/image_z_image_turbo_int8-1.webp" width="200" height="200" alt="Z-Image-Turbo Int8: Text to Image"></a></td></tr>
<tr><td align="center" valign="middle" style="text-align:center;vertical-align:middle"><a href="https://github.com/Comfy-Org/workflow_templates/blob/main/templates/utility_z_image_turbo_2k_upscaler.app.json">Image Upscale: Z-Image-Turbo 2K</a></td><td align="center" valign="middle" style="text-align:center;vertical-align:middle"><a href="https://github.com/Comfy-Org/workflow_templates/blob/main/templates/utility_z_image_turbo_2k_upscaler.app.json"><img src="https://raw.githubusercontent.com/Comfy-Org/workflow_templates/main/templates/utility_z_image_turbo_2k_upscaler.app-2.webp" width="200" height="200" alt="Image Upscale: Z-Image-Turbo 2K"></a><div align="center">Before</div></td><td align="center" valign="middle" style="text-align:center;vertical-align:middle"><a href="https://github.com/Comfy-Org/workflow_templates/blob/main/templates/utility_z_image_turbo_2k_upscaler.app.json"><img src="https://raw.githubusercontent.com/Comfy-Org/workflow_templates/main/templates/utility_z_image_turbo_2k_upscaler.app-1.webp" width="200" height="200" alt="Image Upscale: Z-Image-Turbo 2K"></a><div align="center">After</div></td></tr>
<tr><td align="center" valign="middle" style="text-align:center;vertical-align:middle"><a href="https://github.com/Comfy-Org/workflow_templates/blob/main/templates/image_z_image_turbo_fun_union_controlnet.json">Z-Image-Turbo Fun Union ControlNet</a></td><td align="center" valign="middle" style="text-align:center;vertical-align:middle"><a href="https://github.com/Comfy-Org/workflow_templates/blob/main/templates/image_z_image_turbo_fun_union_controlnet.json"><img src="https://raw.githubusercontent.com/Comfy-Org/workflow_templates/main/templates/image_z_image_turbo_fun_union_controlnet-2.webp" width="200" height="200" alt="Z-Image-Turbo Fun Union ControlNet"></a><div align="center">Before</div></td><td align="center" valign="middle" style="text-align:center;vertical-align:middle"><a href="https://github.com/Comfy-Org/workflow_templates/blob/main/templates/image_z_image_turbo_fun_union_controlnet.json"><img src="https://raw.githubusercontent.com/Comfy-Org/workflow_templates/main/templates/image_z_image_turbo_fun_union_controlnet-1.webp" width="200" height="200" alt="Z-Image-Turbo Fun Union ControlNet"></a><div align="center">After</div></td></tr>
</tbody>
</table>
