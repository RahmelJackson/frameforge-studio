# Local vision dependencies

The optional vision environment is separate from ComfyUI. Restore it with `scripts/setup-vision.ps1`. Exact installed Python versions are recorded in `requirements-vision.lock.txt`; the face landmarker artifact is pinned by Google Cloud object generation, size and SHA-256 in `vision-models.lock.json`.

- MediaPipe: https://github.com/google-ai-edge/mediapipe (Apache-2.0). Face Landmarker: https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker. Face Mesh V2 model card: https://storage.googleapis.com/mediapipe-assets/Model%20Card%20MediaPipe%20Face%20Mesh%20V2.pdf.
- OpenCV: https://github.com/opencv/opencv (Apache-2.0); Python distribution: https://pypi.org/project/opencv-contrib-python/. Tracking uses optical flow and a fitted affine transform, not semantic segmentation or a new diffusion model.
- SciPy: https://github.com/scipy/scipy (BSD-3-Clause); NumPy: https://github.com/numpy/numpy (BSD-3-Clause); Pillow: https://github.com/python-pillow/Pillow (HPND).
- PyAV: https://github.com/PyAV-Org/PyAV (BSD-3-Clause). Codec library build and license details are retained in the installed distribution. FFV1 produces the RGB-preserving Matroska master; the MP4 is a compressed viewing copy.

Installed distributions retain their own LICENSE/NOTICE metadata. This list describes the direct components; it does not replace their notices. No InsightFace recognition weights, face datasets or additional large generative models were installed for these features.
