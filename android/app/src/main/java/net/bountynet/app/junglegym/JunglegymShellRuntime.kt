package net.bountynet.app.junglegym

/**
 * Backend for the Junglegym terminal. [LocalPreviewShellRuntime] is the default until a native
 * runtime is embedded; swap implementations without changing [JungleGymViewModel].
 *
 * ## Cory-style embedding without copying the Cory app
 *
 * You do not need Cory’s Activity, orderfile sample, or JNI from that repo — only the **same vendored
 * SDK layout** its CMake expects, plus a thin bridge of your own:
 * - **Python:** `prefix/include/python3.x` to compile against `Python.h`, and `libpython3.x.so` plus
 *   stdlib (from assets or install tree) at runtime.
 * - **Node (embed):** `include/src`, `include/deps/v8`, `include/deps/uv` for headers; `liblibnode.a`
 *   (per ABI) at link time, with the usual Android NDK helper libs.
 *
 * Headers alone let you **compile** JNI; you still ship the **binaries** — the win is not cloning
 * a full reference app, only reusing that artifact layout.
 *
 * ## “Full bash” feel
 *
 * A POSIX shell is optional. Cory’s pattern is a **single Python entry** (`run_command`) that
 * splits the line (e.g. `shlex`-style), dispatches built-ins (`ls`, `git` via libgit2, etc.),
 * delegates unknown
 * applets to **busybox**, and optionally execs **node** / **rg** from sandbox `bin/`. The Compose
 * terminal stays dumb; the dispatcher gives users/bash-like prompts and exit codes.
 */
interface JunglegymShellRuntime {
    fun motdLines(): List<String>
    fun runLine(userInput: String): List<String>
}
