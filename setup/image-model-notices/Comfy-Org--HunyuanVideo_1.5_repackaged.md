---
license: other
license_name: tencent-hunyuan-community
license_link: https://github.com/Tencent-Hunyuan/HunyuanVideo-1.5/blob/master/LICENSE
tags:
- comfyui
- diffusion-single-file
base_model:
- tencent/HunyuanVideo-1.5
---

# Hunyuan Video 1.5

Repackaged model files for ComfyUI.

Original model repository: https://huggingface.co/tencent/HunyuanVideo-1.5

Place the files in the following folders:

```
📂 ComfyUI/
├── 📂 models/
│   ├── 📂 clip_vision/
│   │   └── sigclip_vision_patch14_384.safetensors
│   ├── 📂 diffusion_models/
│   │   ├── capybara_v0.1.safetensors
│   │   ├── hunyuanvideo1.5_1080p_sr_distilled_fp16.safetensors
│   │   ├── hunyuanvideo1.5_1080p_sr_distilled_fp8_scaled.safetensors
│   │   ├── hunyuanvideo1.5_480p_i2v_cfg_distilled_fp16.safetensors
│   │   ├── hunyuanvideo1.5_480p_i2v_cfg_distilled_fp8_scaled.safetensors
│   │   ├── hunyuanvideo1.5_480p_i2v_fp16.safetensors
│   │   ├── hunyuanvideo1.5_480p_i2v_step_distilled_fp16.safetensors
│   │   ├── hunyuanvideo1.5_480p_i2v_step_distilled_fp8_scaled.safetensors
│   │   ├── hunyuanvideo1.5_480p_t2v_cfg_distilled_fp16.safetensors
│   │   ├── hunyuanvideo1.5_480p_t2v_cfg_distilled_fp8_scaled.safetensors
│   │   ├── hunyuanvideo1.5_480p_t2v_fp16.safetensors
│   │   ├── hunyuanvideo1.5_720p_i2v_cfg_distilled_fp16.safetensors
│   │   ├── hunyuanvideo1.5_720p_i2v_cfg_distilled_fp8_scaled.safetensors
│   │   ├── hunyuanvideo1.5_720p_i2v_fp16.safetensors
│   │   ├── hunyuanvideo1.5_720p_sr_distilled_fp16.safetensors
│   │   ├── hunyuanvideo1.5_720p_sr_distilled_fp8_scaled.safetensors
│   │   └── hunyuanvideo1.5_720p_t2v_fp16.safetensors
│   ├── 📂 latent_upscale_models/
│   │   ├── hunyuanvideo15_latent_upsampler_1080p.safetensors
│   │   └── hunyuanvideo15_latent_upsampler_720p.safetensors
│   ├── 📂 loras/
│   │   └── hunyuanvideo1.5_t2v_480p_lightx2v_4step_lora_rank_32_bf16.safetensors
│   ├── 📂 text_encoders/
│   │   ├── byt5_small_glyphxl_fp16.safetensors
│   │   ├── qwen_2.5_vl_7b.safetensors
│   │   └── qwen_2.5_vl_7b_fp8_scaled.safetensors
│   ├── 📂 vae/
│   │   └── hunyuanvideo15_vae_fp16.safetensors
```

## Workflows

<table>
<thead>
<tr><th align="center" valign="middle" style="text-align:center;vertical-align:middle">Workflow</th><th colspan="2" align="center" valign="middle" style="text-align:center;vertical-align:middle">Thumb</th></tr>
</thead>
<tbody>
<tr><td align="center" valign="middle" style="text-align:center;vertical-align:middle"><a href="https://github.com/Comfy-Org/workflow_templates/blob/main/templates/video_hunyuan_video_1.5_720p_i2v.json">Hunyuan Video 1.5 Image to Video</a></td><td colspan="2" align="center" valign="middle" style="text-align:center;vertical-align:middle"><a href="https://github.com/Comfy-Org/workflow_templates/blob/main/templates/video_hunyuan_video_1.5_720p_i2v.json"><img src="https://raw.githubusercontent.com/Comfy-Org/workflow_templates/main/templates/video_hunyuan_video_1.5_720p_i2v-1.webp" width="200" height="200" alt="Hunyuan Video 1.5 Image to Video"></a></td></tr>
<tr><td align="center" valign="middle" style="text-align:center;vertical-align:middle"><a href="https://github.com/Comfy-Org/workflow_templates/blob/main/templates/video_capybara_v0_1_video_edit.json">Capybara: Video Edit</a></td><td align="center" valign="middle" style="text-align:center;vertical-align:middle"><a href="https://github.com/Comfy-Org/workflow_templates/blob/main/templates/video_capybara_v0_1_video_edit.json"><img src="https://raw.githubusercontent.com/Comfy-Org/workflow_templates/main/templates/video_capybara_v0_1_video_edit-2.webp" width="200" height="200" alt="Capybara: Video Edit"></a><div align="center">Before</div></td><td align="center" valign="middle" style="text-align:center;vertical-align:middle"><a href="https://github.com/Comfy-Org/workflow_templates/blob/main/templates/video_capybara_v0_1_video_edit.json"><img src="https://raw.githubusercontent.com/Comfy-Org/workflow_templates/main/templates/video_capybara_v0_1_video_edit-1.webp" width="200" height="200" alt="Capybara: Video Edit"></a><div align="center">After</div></td></tr>
<tr><td align="center" valign="middle" style="text-align:center;vertical-align:middle"><a href="https://github.com/Comfy-Org/workflow_templates/blob/main/templates/Image_capybara_v0_1_image_edit.json">Capybara: Image Edit</a></td><td align="center" valign="middle" style="text-align:center;vertical-align:middle"><a href="https://github.com/Comfy-Org/workflow_templates/blob/main/templates/Image_capybara_v0_1_image_edit.json"><img src="https://raw.githubusercontent.com/Comfy-Org/workflow_templates/main/templates/Image_capybara_v0_1_image_edit-2.webp" width="200" height="200" alt="Capybara: Image Edit"></a><div align="center">Before</div></td><td align="center" valign="middle" style="text-align:center;vertical-align:middle"><a href="https://github.com/Comfy-Org/workflow_templates/blob/main/templates/Image_capybara_v0_1_image_edit.json"><img src="https://raw.githubusercontent.com/Comfy-Org/workflow_templates/main/templates/Image_capybara_v0_1_image_edit-1.webp" width="200" height="200" alt="Capybara: Image Edit"></a><div align="center">After</div></td></tr>
<tr><td align="center" valign="middle" style="text-align:center;vertical-align:middle"><a href="https://github.com/Comfy-Org/workflow_templates/blob/main/templates/video_capybara_v0_1_image_to_video.json">Capybara: Image to Video</a></td><td colspan="2" align="center" valign="middle" style="text-align:center;vertical-align:middle"><a href="https://github.com/Comfy-Org/workflow_templates/blob/main/templates/video_capybara_v0_1_image_to_video.json"><img src="https://raw.githubusercontent.com/Comfy-Org/workflow_templates/main/templates/video_capybara_v0_1_image_to_video-1.webp" width="200" height="200" alt="Capybara: Image to Video"></a></td></tr>
<tr><td align="center" valign="middle" style="text-align:center;vertical-align:middle"><a href="https://github.com/Comfy-Org/workflow_templates/blob/main/templates/video_hunyuan_video_1.5_720p_t2v.json">Hunyuan Video 1.5 Text to Video</a></td><td colspan="2" align="center" valign="middle" style="text-align:center;vertical-align:middle"><a href="https://github.com/Comfy-Org/workflow_templates/blob/main/templates/video_hunyuan_video_1.5_720p_t2v.json"><img src="https://raw.githubusercontent.com/Comfy-Org/workflow_templates/main/templates/video_hunyuan_video_1.5_720p_t2v-1.webp" width="200" height="200" alt="Hunyuan Video 1.5 Text to Video"></a></td></tr>
<tr><td align="center" valign="middle" style="text-align:center;vertical-align:middle"><a href="https://github.com/Comfy-Org/workflow_templates/blob/main/templates/Image_capybara_v0_1_text_to_image.json">Capybara: Text to Image</a></td><td colspan="2" align="center" valign="middle" style="text-align:center;vertical-align:middle"><a href="https://github.com/Comfy-Org/workflow_templates/blob/main/templates/Image_capybara_v0_1_text_to_image.json"><img src="https://raw.githubusercontent.com/Comfy-Org/workflow_templates/main/templates/Image_capybara_v0_1_text_to_image-1.webp" width="200" height="200" alt="Capybara: Text to Image"></a></td></tr>
</tbody>
</table>
