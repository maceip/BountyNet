# Isolated soak/e2e environment: own network + PID namespace, so host tools named
# `chisel` / `anvil` / etc. are invisible to pgrep inside the container.
#
# From repo root (use sudo if your user cannot access the docker socket):
#   sudo docker build -f docker/soak/Dockerfile -t bountynet-soak .
#   sudo docker run --rm bountynet-soak

FROM python:3.12-bookworm

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential \
        curl \
        git \
        libssl-dev \
        pkg-config \
    && rm -rf /var/lib/apt/lists/*

ENV PATH="/root/.foundry/bin:${PATH}"
RUN curl -L https://foundry.paradigm.xyz | bash \
    && foundryup

WORKDIR /app

COPY . .

RUN pip install --no-cache-dir pip -U \
    && pip install --no-cache-dir -e ".[dev]"

RUN cd contracts && python -m moccasin compile -q

ENV BOUNTYNET_DEV_SKIP_JWT_VERIFICATION=1
ENV BOUNTYNET_DEV_SKIP_GITHUB_WEBHOOK_VERIFY=1

CMD ["pytest", "tests/soak", "-vv", "-m", "soak", "--tb=short"]
