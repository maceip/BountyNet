package net.bountynet.app.logging

import android.content.Context
import android.os.Build
import android.util.Log
import io.ktor.client.HttpClient
import io.ktor.client.engine.okhttp.OkHttp
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.request.header
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.contentType
import io.ktor.http.isSuccess
import io.ktor.serialization.kotlinx.json.json
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.Json
import net.bountynet.app.BuildConfig
import timber.log.Timber
import java.util.concurrent.LinkedBlockingQueue
import java.util.concurrent.TimeUnit
import kotlin.concurrent.thread

/**
 * Batches [Timber] lines (INFO and above) and POSTs JSON to [BuildConfig.LOG_SHIP_URL].
 * Intended for a small collector endpoint you control; leave URL empty to disable shipping.
 */
internal class RemoteShipTree(
    appContext: Context,
) : Timber.Tree() {

    private val endpoint: String = BuildConfig.LOG_SHIP_URL.trim()
    private val bearer: String = BuildConfig.LOG_SHIP_TOKEN.trim()
    private val deviceModel: String = Build.MODEL ?: "unknown"
    private val queue = LinkedBlockingQueue<ShippedLogEntry>()

    private val client: HttpClient = HttpClient(OkHttp) {
        install(ContentNegotiation) {
            json(
                Json {
                    ignoreUnknownKeys = true
                    encodeDefaults = true
                },
            )
        }
    }

    init {
        if (endpoint.isNotEmpty()) {
            thread(name = "bnet-log-ship", isDaemon = true) {
                while (!Thread.currentThread().isInterrupted) {
                    try {
                        val first = queue.poll(2, TimeUnit.SECONDS) ?: continue
                        val batch = mutableListOf(first)
                        queue.drainTo(batch, 49)
                        Thread.sleep(200)
                        queue.drainTo(batch, 100 - batch.size)
                        runBlocking { postBatch(appContext, batch) }
                    } catch (_: InterruptedException) {
                        break
                    } catch (_: Exception) {
                    }
                }
            }
        }
    }

    override fun log(priority: Int, tag: String?, message: String, t: Throwable?) {
        if (endpoint.isEmpty() || priority < Log.INFO) return
        val level = when (priority) {
            Log.INFO -> "INFO"
            Log.WARN -> "WARN"
            Log.ERROR -> "ERROR"
            Log.ASSERT -> "ASSERT"
            else -> "UNKNOWN"
        }
        queue.offer(
            ShippedLogEntry(
                ts = System.currentTimeMillis(),
                level = level,
                tag = tag,
                message = message,
                stack = t?.let { Log.getStackTraceString(it) },
            ),
        )
    }

    private suspend fun postBatch(appContext: Context, entries: List<ShippedLogEntry>) {
        if (entries.isEmpty()) return
        val body = ShippedLogBatch(
            ts = System.currentTimeMillis(),
            deviceModel = deviceModel,
            androidSdk = Build.VERSION.SDK_INT,
            appId = appContext.packageName,
            appVersion = BuildConfig.VERSION_NAME,
            source = "android",
            entries = entries,
        )
        try {
            val response = client.post(endpoint) {
                contentType(ContentType.Application.Json)
                if (bearer.isNotEmpty()) {
                    header(HttpHeaders.Authorization, "Bearer $bearer")
                }
                setBody(body)
            }
            if (!response.status.isSuccess()) {
                // Avoid logging through Timber here (recursion). Drop failed batches silently.
                response.bodyAsText()
            }
        } catch (_: Exception) {
        }
    }
}
