---
license: apache-2.0
tags:
- comfyui
- diffusion-single-file
base_model:
- Wan-AI/Wan2.1-FLF2V-14B-720P
- alibaba-pai/Wan2.1-Fun-V1.1-1.3B-Control-Camera
- alibaba-pai/Wan2.1-Fun-V1.1-14B-Control-Camera
- alibaba-pai/Wan2.1-Fun-V1.1-1.3B-Control
- alibaba-pai/Wan2.1-Fun-V1.1-1.3B-InP
- Wan-AI/Wan2.1-I2V-14B-480P
- Wan-AI/Wan2.1-I2V-14B-720P
- MAGREF-Video/MAGREF
- Wan-AI/Wan2.1-T2V-1.3B
- Wan-AI/Wan2.1-T2V-14B
- Wan-AI/Wan2.1-VACE-1.3B
- Wan-AI/Wan2.1-VACE-14B
- htdong/Wan-Alpha
- MeiGen-AI/InfiniteTalk
---

# Wan 2.1

Repackaged model files for ComfyUI.

Original model repository:

- https://huggingface.co/Wan-AI/Wan2.1-FLF2V-14B-720P
- https://huggingface.co/alibaba-pai/Wan2.1-Fun-V1.1-1.3B-Control-Camera
- https://huggingface.co/alibaba-pai/Wan2.1-Fun-V1.1-14B-Control-Camera
- https://huggingface.co/alibaba-pai/Wan2.1-Fun-V1.1-1.3B-Control
- https://huggingface.co/alibaba-pai/Wan2.1-Fun-V1.1-1.3B-InP
- https://huggingface.co/Wan-AI/Wan2.1-I2V-14B-480P
- https://huggingface.co/Wan-AI/Wan2.1-I2V-14B-720P
- https://huggingface.co/MAGREF-Video/MAGREF
- https://huggingface.co/Wan-AI/Wan2.1-T2V-1.3B
- https://huggingface.co/Wan-AI/Wan2.1-T2V-14B
- https://huggingface.co/Wan-AI/Wan2.1-VACE-1.3B
- https://huggingface.co/Wan-AI/Wan2.1-VACE-14B
- https://huggingface.co/htdong/Wan-Alpha
- https://huggingface.co/MeiGen-AI/InfiniteTalk

Place the files in the following folders:

```
📂 ComfyUI/
├── 📂 models/
│   ├── 📂 clip_vision/
│   │   └── clip_vision_h.safetensors
│   ├── 📂 diffusion_models/
│   │   ├── wan2.1_flf2v_720p_14B_fp16.safetensors
│   │   ├── wan2.1_flf2v_720p_14B_fp8_e4m3fn.safetensors
│   │   ├── wan2.1_fun_camera_v1.1_1.3B_bf16.safetensors
│   │   ├── wan2.1_fun_camera_v1.1_14B_bf16.safetensors
│   │   ├── wan2.1_fun_control_1.3B_bf16.safetensors
│   │   ├── wan2.1_fun_inp_1.3B_bf16.safetensors
│   │   ├── wan2.1_i2v_480p_14B_bf16.safetensors
│   │   ├── wan2.1_i2v_480p_14B_fp16.safetensors
│   │   ├── wan2.1_i2v_480p_14B_fp8_e4m3fn.safetensors
│   │   ├── wan2.1_i2v_480p_14B_fp8_scaled.safetensors
│   │   ├── wan2.1_i2v_720p_14B_bf16.safetensors
│   │   ├── wan2.1_i2v_720p_14B_fp16.safetensors
│   │   ├── wan2.1_i2v_720p_14B_fp8_e4m3fn.safetensors
│   │   ├── wan2.1_i2v_720p_14B_fp8_scaled.safetensors
│   │   ├── wan2.1_magref_14B_fp16.safetensors
│   │   ├── wan2.1_t2v_1.3B_bf16.safetensors
│   │   ├── wan2.1_t2v_1.3B_fp16.safetensors
│   │   ├── wan2.1_t2v_14B_bf16.safetensors
│   │   ├── wan2.1_t2v_14B_fp16.safetensors
│   │   ├── wan2.1_t2v_14B_fp8_e4m3fn.safetensors
│   │   ├── wan2.1_t2v_14B_fp8_scaled.safetensors
│   │   ├── wan2.1_vace_1.3B_fp16.safetensors
│   │   ├── wan2.1_vace_1.3B_preview_fp16.safetensors
│   │   └── wan2.1_vace_14B_fp16.safetensors
│   ├── 📂 loras/
│   │   └── wan_alpha_2.1_rgba_lora.safetensors
│   ├── 📂 model_patches/
│   │   ├── wan2.1_infiniteTalk_multi_fp16.safetensors
│   │   └── wan2.1_infiniteTalk_single_fp16.safetensors
│   ├── 📂 text_encoders/
│   │   ├── umt5_xxl_fp16.safetensors
│   │   └── umt5_xxl_fp8_e4m3fn_scaled.safetensors
│   ├── 📂 vae/
│   │   ├── wan_2.1_vae.safetensors
│   │   ├── wan_alpha_2.1_vae_alpha_channel.safetensors
│   │   └── wan_alpha_2.1_vae_rgb_channel.safetensors
```

## Workflows

- InfiniteTalk: Audio-Driven Full-Body Video Dubbing: https://github.com/Comfy-Org/workflow_templates/blob/main/templates/video_wan2_1_infinitetalk.json
- Wan 2.1 ControlNet: https://github.com/Comfy-Org/workflow_templates/blob/main/templates/wan2.1_fun_control.json
- Wan 2.1 FLF2V 720p F16: https://github.com/Comfy-Org/workflow_templates/blob/main/templates/wan2.1_flf2v_720_f16.json
- Wan 2.1 Fun Camera 1.3B: https://github.com/Comfy-Org/workflow_templates/blob/main/templates/video_wan2.1_fun_camera_v1.1_1.3B.json
- Wan 2.1 Fun Camera 14B: https://github.com/Comfy-Org/workflow_templates/blob/main/templates/video_wan2.1_fun_camera_v1.1_14B.json
- Wan 2.1 Image to Video: https://github.com/Comfy-Org/workflow_templates/blob/main/templates/image_to_video_wan.json
- Wan 2.1 Inpainting: https://github.com/Comfy-Org/workflow_templates/blob/main/templates/wan2.1_fun_inp.json
- Wan 2.1 Text to Video: https://github.com/Comfy-Org/workflow_templates/blob/main/templates/text_to_video_wan.json
- Wan2.1 Alpha T2V: https://github.com/Comfy-Org/workflow_templates/blob/main/templates/video_wan2.1_alpha_t2v_14B.json
- Wan2.1 VACE Control Video: https://github.com/Comfy-Org/workflow_templates/blob/main/templates/video_wan_vace_14B_v2v.json
- Wan2.1 VACE First-Last Frame: https://github.com/Comfy-Org/workflow_templates/blob/main/templates/video_wan_vace_flf2v.json
- Wan2.1 VACE Inpainting: https://github.com/Comfy-Org/workflow_templates/blob/main/templates/video_wan_vace_inpainting.json
- Wan2.1 VACE Outpainting: https://github.com/Comfy-Org/workflow_templates/blob/main/templates/video_wan_vace_outpainting.json
- Wan2.1 VACE Reference to Video: https://github.com/Comfy-Org/workflow_templates/blob/main/templates/video_wan_vace_14B_ref2v.json
- Wan2.1 VACE Text to Video: https://github.com/Comfy-Org/workflow_templates/blob/main/templates/video_wan_vace_14B_t2v.json

---

Wan 2.1 repackaged for ComfyUI use. For examples see: https://comfyanonymous.github.io/ComfyUI_examples/wan
