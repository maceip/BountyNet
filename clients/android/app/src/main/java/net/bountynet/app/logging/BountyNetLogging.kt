package net.bountynet.app.logging

import android.app.Application
import android.content.Context
import net.bountynet.app.BuildConfig
import timber.log.Timber
import java.io.File

/**
 * App-wide logging: logcat-style tree in debug, **rolling file** in all builds, optional **HTTP ship**.
 *
 * - File: `filesDir/logs/bountynet.log` (pull with `adb shell run-as net.bountynet.app cat files/logs/bountynet.log`)
 * - Remote: set `LOG_SHIP_URL` (+ optional `LOG_SHIP_TOKEN` = gateway `BOUNTYNET_CLIENT_LOG_TOKEN`)
 *   to the gateway `POST /logs/android` URL; POST body is JSON ([ShippedLogBatch]).
 */
object BountyNetLogging {

    private var fileTree: RollingFileTree? = null

    fun install(app: Application) {
        if (BuildConfig.DEBUG) {
            Timber.plant(Timber.DebugTree())
        }
        fileTree = RollingFileTree(app).also { Timber.plant(it) }
        if (BuildConfig.LOG_SHIP_URL.isNotBlank()) {
            Timber.plant(RemoteShipTree(app.applicationContext))
        }
        Timber.i(
            "BountyNet logging ready file=%s ship=%s",
            logFile(app).absolutePath,
            BuildConfig.LOG_SHIP_URL.isNotBlank(),
        )
    }

    /** Primary rolling log (may be empty until first log line). */
    fun logFile(context: Context): File = fileTree?.logFile() ?: File(File(context.filesDir, "logs"), "bountynet.log")
}
