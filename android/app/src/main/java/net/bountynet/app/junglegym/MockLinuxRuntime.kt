package net.bountynet.app.junglegym

import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Fake shell for UX — not a real container. Lines look like a dev workstation
 * cloned for the sim repo. Replace with a [JunglegymShellRuntime] backed by JNI +
 * embedded Python/Node when those artifacts are wired in.
 */
class MockLinuxRuntime(
    private val workDir: String = "/home/solver/$DEFAULT_SIM_REPO",
) : JunglegymShellRuntime {
    private val ts: String
        get() = SimpleDateFormat("HH:mm:ss", Locale.US).format(Date())

    override fun motdLines(): List<String> = listOf(
        "Linux android-junglegym 6.6.0-mock #1 SMP BountyNet",
        "solver@sandbox:~$  # mock runtime — Android shell is not POSIX",
    )

    override fun runLine(userInput: String): List<String> {
        val cmd = userInput.trim().removePrefix("$").trim()
        if (cmd.isEmpty()) return emptyList()
        val header = "[$ts] $cmd"
        return when {
            cmd == "uname -a" -> listOf(header, "Linux android-junglegym 6.6.0-mock aarch64 GNU/Linux")
            cmd == "pwd" -> listOf(header, workDir)
            cmd.startsWith("cd ") -> listOf(header, "(mock) changed directory")
            cmd.startsWith("ls") -> listOf(
                header,
                "Cargo.toml  src/  .github/  README.md",
            )
            cmd.startsWith("git status") -> listOf(
                header,
                "On branch main",
                "nothing to commit, working tree clean",
            )
            cmd.startsWith("git log -1") -> listOf(
                header,
                "commit a1b2c3d (HEAD -> main) mock CI failure replay",
            )
            cmd.startsWith("be ") -> listOf(
                header,
                "(mock) bountynet-cli would dispatch: ${cmd.removePrefix("be ").trim()}",
                "hint: real `be` runs on host; this session traces solver UX only.",
            )
            else -> listOf(header, "bash: ${cmd.take(48)}: command not found (mock)")
        }
    }
}
