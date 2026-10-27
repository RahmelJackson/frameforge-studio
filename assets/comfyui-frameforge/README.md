# Frameforge image bridge for ComfyUI

Copy this entire folder into `ComfyUI/custom_nodes/comfyui-frameforge`, then restart ComfyUI. No new Python packages or models are required.

Add **Frameforge → Frameforge · send image to Studio** after a node that outputs `IMAGE`. Run the graph. The node saves a PNG, retaining ComfyUI workflow metadata. Click **Send saved image to Frameforge**, confirm your local Studio address, and continue editing that image in Studio. The handoff is explicit and does not start a generation in Frameforge.

Both applications must run on the same computer. The bridge accepts only PNG outputs within that ComfyUI's output folder and local HTTP Studio addresses. It does not upload to Comfy Cloud, expose shell commands or download weights. Video and audio bridge nodes are not implemented.

Original code is MIT licensed as part of Frameforge Studio.
