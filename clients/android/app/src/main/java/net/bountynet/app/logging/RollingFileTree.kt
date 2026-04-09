package net.bountynet.app.logging

import android.content.Context
import android.util.Log
import timber.log.Timber
import java.io.File

/**
 * Append-only log file under app private storage ([Context.getFilesDir]/logs/).
 * Rotates when the primary file exceeds [maxBytes] (renames to [secondaryName]).
 */
internal class RollingFileTree(
    context: Context,
    private val maxBytes: Long = 2 * 1024 * 1024,
    private val secondaryName: String = "bountynet.log.1",
) : Timber.Tree() {

    private val dir: File = File(context.filesDir, "logs").also { it.mkdirs() }
    private val primary: File = File(dir, "bountynet.log")
    private val lock = Any()

    fun logFile(): File = primary

    override fun log(priority: Int, tag: String?, message: String, t: Throwable?) {
        val stamp = System.currentTimeMillis()
        val level = priorityLetter(priority)
        val stack = t?.let { Log.getStackTraceString(it) }
        val line = buildString {
            append(stamp)
            append(' ')
            append(level)
            append('/')
            append(tag ?: "—")
            append(": ")
            append(message)
            if (stack != null) {
                append('\n')
                append(stack)
            }
            append('\n')
        }
        synchronized(lock) {
            try {
                if (primary.length() > maxBytes) rotate()
                primary.appendText(line)
            } catch (_: Exception) {
                // Never crash the app for logging
            }
        }
    }

    private fun rotate() {
        try {
            File(dir, secondaryName).delete()
            primary.renameTo(File(dir, secondaryName))
        } catch (_: Exception) {
        }
    }

    private fun priorityLetter(priority: Int): Char = when (priority) {
        Log.VERBOSE -> 'V'
        Log.DEBUG -> 'D'
        Log.INFO -> 'I'
        Log.WARN -> 'W'
        Log.ERROR -> 'E'
        Log.ASSERT -> 'A'
        else -> '?'
    }
}
