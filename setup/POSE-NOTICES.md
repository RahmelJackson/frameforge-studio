# Explicit body-pose conditioning

Model: [xinsir/controlnet-openpose-sdxl-1.0](https://huggingface.co/xinsir/controlnet-openpose-sdxl-1.0), Apache-2.0 as declared by its official card. Immutable revision, 2,502,139,104-byte file and SHA-256 are in pose-model.lock.json. The verified model card is retained under runtime/pose-notices/ on D:. Restore only that weight with scripts/download-pose-model.py.

Uses existing native ComfyUI ControlNet and PhotoMaker/SDXL nodes; no new custom node, package update or engine edit. Independent body_pose.py renders user-authored 18-joint skeletons in the conventional OpenPose layout. The author card recommends thicker pose limbs; our renderer implements its own colored line/joint drawing. There is no pose detector, automatic body-proportion retargeting, face/finger guide or rear-facing annotation. Pose control does not establish likeness.

Prepared pose videos reuse native VACE reference/control inputs. This does not install Wan-Animate or its preprocessing. Original PhotoMaker, SDXL and VACE licenses/locks remain in their existing notices. Three images and one human arm-lift preview are documented in ACCEPTANCE-ROUND11.md; hand framing, detail and broader motion remain open.
