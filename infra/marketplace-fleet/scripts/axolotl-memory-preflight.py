#!/usr/bin/env python3
from __future__ import annotations

import argparse
import math
import os
import sys


def _parse_mem_gib() -> float:
    env = os.getenv("AXOLOTL_AVAILABLE_GPU_MEM_GB", "").strip()
    if env:
        try:
            return float(env)
        except ValueError:
            pass
    # Conservative default for single 80GB-class card.
    return 80.0


def _estimate_required_gib(sequence_len: int, micro_batch: int, grad_accum: int) -> float:
    # Heuristic budget model for 35B-ish qlora runs.
    # Intentionally conservative: raise early rather than OOM late.
    seq_scale = sequence_len / 32768.0
    base = 34.0
    per_micro = 6.0 * max(1, micro_batch)
    long_ctx_penalty = 8.0 * (seq_scale ** 1.25)
    accum_penalty = 0.35 * max(1, grad_accum)
    return base + per_micro + long_ctx_penalty + accum_penalty


def main() -> int:
    parser = argparse.ArgumentParser(description="Preflight memory guard for Axolotl long-context tuning")
    parser.add_argument("--sequence-len", type=int, required=True)
    parser.add_argument("--micro-batch-size", type=int, default=1)
    parser.add_argument("--gradient-accumulation-steps", type=int, default=8)
    parser.add_argument("--available-gib", type=float, default=_parse_mem_gib())
    parser.add_argument("--fail-on-risk", action="store_true", default=True)
    args = parser.parse_args()

    required = _estimate_required_gib(
        sequence_len=args.sequence_len,
        micro_batch=args.micro_batch_size,
        grad_accum=args.gradient_accumulation_steps,
    )
    headroom = args.available_gib - required

    print(
        f"Axolotl preflight: seq={args.sequence_len} "
        f"micro_batch={args.micro_batch_size} grad_accum={args.gradient_accumulation_steps} "
        f"required≈{required:.1f}GiB available={args.available_gib:.1f}GiB headroom={headroom:.1f}GiB"
    )

    if headroom >= 10:
        print("Preflight result: PASS (healthy headroom)")
        return 0
    if headroom >= 0:
        print("Preflight result: WARN (tight headroom; monitor memory closely)")
        return 0

    msg = (
        "Preflight result: FAIL (estimated OOM risk). "
        "Lower AXOLOTL_SEQUENCE_LEN or micro-batch, or increase available memory."
    )
    print(msg, file=sys.stderr)
    return 2 if args.fail_on_risk else 0


if __name__ == "__main__":
    raise SystemExit(main())
