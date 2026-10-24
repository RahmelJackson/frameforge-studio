---
license: apache-2.0
tags:
- comfyui
- diffusion-single-file
base_model:
- Qwen/Qwen-Image
- Qwen/Qwen-Image-2512
- DiffSynth-Studio/Qwen-Image-Distill-Full
---

# Qwen-Image

Repackaged model files for ComfyUI.

Original model repository:

- https://huggingface.co/Qwen/Qwen-Image
- https://huggingface.co/Qwen/Qwen-Image-2512
- https://huggingface.co/DiffSynth-Studio/Qwen-Image-Distill-Full

Place the files in the following folders:

```
📂 ComfyUI/
├── 📂 models/
│   ├── 📂 diffusion_models/
│   │   ├── qwen_image_distill_full_bf16.safetensors
│   │   ├── qwen_image_distill_full_fp8_e4m3fn.safetensors
│   │   ├── qwen_image_2512_bf16.safetensors
│   │   ├── qwen_image_2512_fp8_e4m3fn.safetensors
│   │   ├── qwen_image_bf16.safetensors
│   │   ├── qwen_image_fp8_e4m3fn.safetensors
│   │   ├── qwen_image_fp8_hq.safetensors
│   │   ├── qwen_image_fp8mixed.safetensors
│   │   └── qwen_image_nvfp4.safetensors
│   ├── 📂 text_encoders/
│   │   ├── qwen_2.5_vl_7b.safetensors
│   │   ├── qwen_2.5_vl_7b_fp8_scaled.safetensors
│   │   └── qwen_2.5_vl_7b_nvfp4.safetensors
│   ├── 📂 vae/
│   │   └── qwen_image_vae.safetensors
```

---
See: https://comfyanonymous.github.io/ComfyUI_examples/qwen_image/

## Workflows

<table>
<thead>
<tr><th align="center" valign="middle" style="text-align:center;vertical-align:middle">Workflow</th><th colspan="2" align="center" valign="middle" style="text-align:center;vertical-align:middle">Thumb</th></tr>
</thead>
<tbody>
<tr><td align="center" valign="middle" style="text-align:center;vertical-align:middle"><a href="https://github.com/Comfy-Org/workflow_templates/blob/main/templates/image_qwen_Image_2512.json">Qwen Image 2512</a></td><td colspan="2" align="center" valign="middle" style="text-align:center;vertical-align:middle"><a href="https://github.com/Comfy-Org/workflow_templates/blob/main/templates/image_qwen_Image_2512.json"><img src="https://raw.githubusercontent.com/Comfy-Org/workflow_templates/main/templates/image_qwen_Image_2512-1.webp" width="200" height="200" alt="Qwen Image 2512"></a></td></tr>
<tr><td align="center" valign="middle" style="text-align:center;vertical-align:middle"><a href="https://github.com/Comfy-Org/workflow_templates/blob/main/templates/image_qwen_image_instantx_inpainting_controlnet.json">Qwen-Image InstantX Inpainting ControlNet</a></td><td align="center" valign="middle" style="text-align:center;vertical-align:middle"><a href="https://github.com/Comfy-Org/workflow_templates/blob/main/templates/image_qwen_image_instantx_inpainting_controlnet.json"><img src="https://raw.githubusercontent.com/Comfy-Org/workflow_templates/main/templates/image_qwen_image_instantx_inpainting_controlnet-2.webp" width="200" height="200" alt="Qwen-Image InstantX Inpainting ControlNet"></a><div align="center">Before</div></td><td align="center" valign="middle" style="text-align:center;vertical-align:middle"><a href="https://github.com/Comfy-Org/workflow_templates/blob/main/templates/image_qwen_image_instantx_inpainting_controlnet.json"><img src="https://raw.githubusercontent.com/Comfy-Org/workflow_templates/main/templates/image_qwen_image_instantx_inpainting_controlnet-1.webp" width="200" height="200" alt="Qwen-Image InstantX Inpainting ControlNet"></a><div align="center">After</div></td></tr>
<tr><td align="center" valign="middle" style="text-align:center;vertical-align:middle"><a href="https://github.com/Comfy-Org/workflow_templates/blob/main/templates/image_qwen_image_2512_with_2steps_lora.json">Qwen-Image 2512 Turbo</a></td><td colspan="2" align="center" valign="middle" style="text-align:center;vertical-align:middle"><a href="https://github.com/Comfy-Org/workflow_templates/blob/main/templates/image_qwen_image_2512_with_2steps_lora.json"><img src="https://raw.githubusercontent.com/Comfy-Org/workflow_templates/main/templates/image_qwen_image_2512_with_2steps_lora-1.webp" width="200" height="200" alt="Qwen-Image 2512 Turbo"></a></td></tr>
<tr><td align="center" valign="middle" style="text-align:center;vertical-align:middle"><a href="https://github.com/Comfy-Org/workflow_templates/blob/main/templates/image_qwen_image_controlnet_patch.json">Qwen-Image ControlNet Model Patch</a></td><td align="center" valign="middle" style="text-align:center;vertical-align:middle"><a href="https://github.com/Comfy-Org/workflow_templates/blob/main/templates/image_qwen_image_controlnet_patch.json"><img src="https://raw.githubusercontent.com/Comfy-Org/workflow_templates/main/templates/image_qwen_image_controlnet_patch-2.webp" width="200" height="200" alt="Qwen-Image ControlNet Model Patch"></a><div align="center">Before</div></td><td align="center" valign="middle" style="text-align:center;vertical-align:middle"><a href="https://github.com/Comfy-Org/workflow_templates/blob/main/templates/image_qwen_image_controlnet_patch.json"><img src="https://raw.githubusercontent.com/Comfy-Org/workflow_templates/main/templates/image_qwen_image_controlnet_patch-1.webp" width="200" height="200" alt="Qwen-Image ControlNet Model Patch"></a><div align="center">After</div></td></tr>
<tr><td align="center" valign="middle" style="text-align:center;vertical-align:middle"><a href="https://github.com/Comfy-Org/workflow_templates/blob/main/templates/image_qwen_image_instantx_controlnet.json">Qwen-Image InstantX Union ControlNet</a></td><td align="center" valign="middle" style="text-align:center;vertical-align:middle"><a href="https://github.com/Comfy-Org/workflow_templates/blob/main/templates/image_qwen_image_instantx_controlnet.json"><img src="https://raw.githubusercontent.com/Comfy-Org/workflow_templates/main/templates/image_qwen_image_instantx_controlnet-2.webp" width="200" height="200" alt="Qwen-Image InstantX Union ControlNet"></a><div align="center">Before</div></td><td align="center" valign="middle" style="text-align:center;vertical-align:middle"><a href="https://github.com/Comfy-Org/workflow_templates/blob/main/templates/image_qwen_image_instantx_controlnet.json"><img src="https://raw.githubusercontent.com/Comfy-Org/workflow_templates/main/templates/image_qwen_image_instantx_controlnet-1.webp" width="200" height="200" alt="Qwen-Image InstantX Union ControlNet"></a><div align="center">After</div></td></tr>
<tr><td align="center" valign="middle" style="text-align:center;vertical-align:middle"><a href="https://github.com/Comfy-Org/workflow_templates/blob/main/templates/image_qwen_Image_2512_controlnet.json">Qwen-Image 2512: Fun Union ControlNet</a></td><td align="center" valign="middle" style="text-align:center;vertical-align:middle"><a href="https://github.com/Comfy-Org/workflow_templates/blob/main/templates/image_qwen_Image_2512_controlnet.json"><img src="https://raw.githubusercontent.com/Comfy-Org/workflow_templates/main/templates/image_qwen_Image_2512_controlnet-2.webp" width="200" height="200" alt="Qwen-Image 2512: Fun Union ControlNet"></a><div align="center">Before</div></td><td align="center" valign="middle" style="text-align:center;vertical-align:middle"><a href="https://github.com/Comfy-Org/workflow_templates/blob/main/templates/image_qwen_Image_2512_controlnet.json"><img src="https://raw.githubusercontent.com/Comfy-Org/workflow_templates/main/templates/image_qwen_Image_2512_controlnet-1.webp" width="200" height="200" alt="Qwen-Image 2512: Fun Union ControlNet"></a><div align="center">After</div></td></tr>
<tr><td align="center" valign="middle" style="text-align:center;vertical-align:middle"><a href="https://github.com/Comfy-Org/workflow_templates/blob/main/templates/image_qwen_image.json">Qwen-Image: Text to Image</a></td><td colspan="2" align="center" valign="middle" style="text-align:center;vertical-align:middle"><a href="https://github.com/Comfy-Org/workflow_templates/blob/main/templates/image_qwen_image.json"><img src="https://raw.githubusercontent.com/Comfy-Org/workflow_templates/main/templates/image_qwen_image-1.webp" width="200" height="200" alt="Qwen-Image: Text to Image"></a></td></tr>
<tr><td align="center" valign="middle" style="text-align:center;vertical-align:middle"><a href="https://github.com/Comfy-Org/workflow_templates/blob/main/templates/image_qwen_image_union_control_lora.json">Qwen-Image Union Control</a></td><td align="center" valign="middle" style="text-align:center;vertical-align:middle"><a href="https://github.com/Comfy-Org/workflow_templates/blob/main/templates/image_qwen_image_union_control_lora.json"><img src="https://raw.githubusercontent.com/Comfy-Org/workflow_templates/main/templates/image_qwen_image_union_control_lora-2.webp" width="200" height="200" alt="Qwen-Image Union Control"></a><div align="center">Before</div></td><td align="center" valign="middle" style="text-align:center;vertical-align:middle"><a href="https://github.com/Comfy-Org/workflow_templates/blob/main/templates/image_qwen_image_union_control_lora.json"><img src="https://raw.githubusercontent.com/Comfy-Org/workflow_templates/main/templates/image_qwen_image_union_control_lora-1.webp" width="200" height="200" alt="Qwen-Image Union Control"></a><div align="center">After</div></td></tr>
</tbody>
</table>
