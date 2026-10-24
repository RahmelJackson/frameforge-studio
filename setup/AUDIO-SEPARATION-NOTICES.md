# Local two-voice separation model

Official TorchAudio Conv-TasNet Libri2Mix checkpoint. Implementation: [TorchAudio v2.10.0](https://github.com/pytorch/audio/tree/v2.10.0/examples/source_separation); implementation license: [BSD 2-Clause](https://github.com/pytorch/audio/blob/v2.10.0/LICENSE). The pipeline documentation identifies its training dataset and training code: [Conv-TasNet Libri2Mix](https://docs.pytorch.org/audio/2.10.0/generated/torchaudio.pipelines.CONVTASNET_BASE_LIBRI2MIX.html). The implementation license is not a blanket claim about all training data or model redistribution rights.

Downloaded from https://download.pytorch.org/torchaudio/models/conv_tasnet_base_libri2mix.pt — 20,049,107 bytes. SHA-256: `ddf97d8341f616c6d8d1a4b20dd51042760392c6543e9eaac276c9f96eba0f0e`. This hash was recorded from the initial official HTTPS download; it is a local reproducibility pin, not an upstream signed checksum. Future restore verifies both size and checksum.

Restore from the project directory with `runtime/audio-env/Scripts/python.exe scripts/setup-separation-model.py`. No package install, runtime upgrade, extra custom node or inference-time download is needed. Backups exclude runtime weights; the lock and restore script are included. The model runs on CPU with the existing TorchAudio 2.10 runtime and loads only weights with `weights_only=True`.

The app accepts 0.5–12 seconds and produces two mono 8 kHz estimated voices. Track order is arbitrary. It cannot identify people, count speakers reliably, separate music generally or guarantee clean tracks. Controlled English examples passed; the held-out Spanish example failed. Review both outputs against the untouched original before transcription or editor use.
