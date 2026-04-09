#!/usr/bin/env python3
"""
After `git submodule update --init clients/android/third_party/keyattestation`, apply
the Kotlin JVM plugin line fix for the BountyNet composite Gradle build.

Upstream pins `id("org.jetbrains.kotlin.jvm") version "2.x"` which clashes with
the app’s plugin classpath; the version must come from root `pluginManagement`.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
K = ROOT / "clients" / "android" / "third_party" / "keyattestation" / "build.gradle.kts"


def main() -> None:
    if not K.is_file():
        print(f"patch-keyattestation: skip (missing {K})", file=sys.stderr)
        sys.exit(0)
    text = K.read_text(encoding="utf-8")
    new_text, n = re.subn(
        r'id\("org\.jetbrains\.kotlin\.jvm"\)\s+version\s+"[^"]+"',
        'id("org.jetbrains.kotlin.jvm")  // version from root pluginManagement',
        text,
        count=1,
    )
    if not n:
        print(f"patch-keyattestation: kotlin plugin line already patched or unexpected format in {K}")
        return
    K.write_text(new_text, encoding="utf-8")
    print(f"patched {K} (kotlin plugin for composite build)")


if __name__ == "__main__":
    main()
