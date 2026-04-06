package net.bountynet.app.junglegym

import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Scripted terminal responses for Junglegym UX testing.
 * Not a POSIX shell and not connected to the device kernel — replace with a real
 * [JunglegymShellRuntime] when embedding a runtime.
 */
class LocalPreviewShellRuntime(
    private val workDir: String = "/home/solver/$DEFAULT_SIM_REPO",
) : JunglegymShellRuntime {
    private val ts: String
        get() = SimpleDateFormat("HH:mm:ss", Locale.US).format(Date())

    override fun motdLines(): List<String> = listOf(
        "BountyNet Junglegym — terminal preview",
        "No container or JNI shell is bundled; output is scripted for layout and flow testing.",
    )

    override fun runLine(userInput: String): List<String> {
        val cmd = userInput.trim().removePrefix("$").trim()
        if (cmd.isEmpty()) return emptyList()
        val header = "[$ts] $cmd"
        return when {
            cmd == "uname -a" -> listOf(
                header,
                "preview: uname is not backed by the host OS (Android)",
            )
            cmd == "pwd" -> listOf(header, workDir)
            cmd.startsWith("cd ") -> listOf(header, "preview: directory changes are not persisted")
            cmd.startsWith("ls") -> listOf(
                header,
                "Cargo.toml  src/  .github/  README.md  (static listing)",
            )
            cmd.startsWith("git status") -> listOf(
                header,
                "On branch main",
                "nothing to commit, working tree clean (preview text)",
            )
            cmd.startsWith("git log -1") -> listOf(
                header,
                "commit a1b2c3d (HEAD -> main) — preview log line",
            )
            cmd.startsWith("be ") -> listOf(
                header,
                "preview: host CLI is `be`; install from repo and run on your machine.",
                "Args: ${cmd.removePrefix("be ").trim()}",
            )
            else -> listOf(header, "preview: no handler for `${cmd.take(48)}`")
        }
    }
}
