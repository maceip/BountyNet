# BountyNet CI Runner — self-hosted GitHub Actions runner
#
# Stakers add this as a runner in their repos. BountyNet hosts it.
# Gives us direct visibility into CI execution for oracle attestation.
#
# When wired to Flare TEE: runner executes inside confidential VM,
# CI results are hardware-attested, not just webhook-reported.
#
# Usage:
#   docker build -t bountynet-runner .
#   docker run -d --name bountynet-runner \
#     -e GITHUB_TOKEN=ghp_... \
#     -e REPO_URL=https://github.com/owner/repo \
#     -e RUNNER_NAME=bountynet-1 \
#     -e RUNNER_LABELS=bountynet,tee \
#     bountynet-runner

FROM ubuntu:24.04

ARG RUNNER_VERSION=2.322.0
ARG RUNNER_ARCH=x64

ENV DEBIAN_FRONTEND=noninteractive

# Core deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl jq git sudo ca-certificates \
    build-essential python3 python3-pip nodejs npm \
    docker.io \
    && rm -rf /var/lib/apt/lists/*

# Create runner user
RUN useradd -m -s /bin/bash runner && \
    usermod -aG docker runner && \
    echo "runner ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers

# Install GitHub Actions runner
WORKDIR /home/runner
RUN curl -fsSL -o runner.tar.gz \
    "https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/actions-runner-linux-${RUNNER_ARCH}-${RUNNER_VERSION}.tar.gz" && \
    tar xzf runner.tar.gz && \
    rm runner.tar.gz && \
    ./bin/installdependencies.sh && \
    chown -R runner:runner /home/runner

# BountyNet attestation hook — captures run context for oracle
COPY entrypoint.sh /home/runner/entrypoint.sh
RUN chmod +x /home/runner/entrypoint.sh

USER runner

ENTRYPOINT ["/home/runner/entrypoint.sh"]
