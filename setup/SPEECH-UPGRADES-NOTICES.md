# Local speech upgrades

Official implementation: [Resemble AI Chatterbox](https://github.com/resemble-ai/chatterbox), PyPI `chatterbox-tts==0.1.7`. Model source: [ResembleAI/chatterbox](https://huggingface.co/ResembleAI/chatterbox), immutable revision and every selected byte count/SHA in speech-upgrades.lock.json. The upstream repository publishes MIT licensing; its model README is retained with the downloaded files.

[Perth](https://github.com/resemble-ai/Perth) watermarking remains enabled. The isolated runtime pins `resemble-perth==1.0.1` and Setuptools 80.9.0, because the watermark package imports pkg_resources. Package-contained watermark model hashes are retained in speech-runtime.lock.json; no dummy watermark replacement is used.

Reverse translation uses [Helsinki-NLP/opus-mt-es-en](https://huggingface.co/Helsinki-NLP/opus-mt-es-en). Its exact revision, configuration, vocabulary and model hashes are pinned separately from the existing English-to-Spanish model; its model README is retained locally.

The isolated speech environment uses its own pinned NumPy, SciPy and Transformers packages with read-only fallback to the existing audio and engine environments. The tested CUDA runtime is Torch 2.10.0+cu130; this differs from Chatterbox's nominal Torch 2.6 dependency. No engine/audio package was replaced. Only English Chatterbox speech/conversion is exposed; multilingual weights were not downloaded.
