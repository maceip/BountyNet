FROM pytorch/pytorch:2.5.1-cuda12.4-cudnn9-runtime

ENV DEBIAN_FRONTEND=noninteractive
WORKDIR /workspace

RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir --upgrade pip setuptools wheel

# 2026 tuning baseline: adapter-centric stack for specialist agents.
RUN pip install --no-cache-dir \
    axolotl \
    bitsandbytes \
    deepspeed \
    transformers \
    datasets \
    accelerate \
    peft \
    trl \
    sentencepiece

WORKDIR /workspace/axolotl
CMD ["sleep", "infinity"]
