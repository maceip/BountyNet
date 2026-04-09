package net.bountynet.app.helios

import android.app.Application
import android.util.Log
import com.helios.Helios
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

private const val TAG = "HeliosRuntime"

enum class HeliosPhase {
    Idle,
    NativeMissing,
    Starting,
    Running,
    Stopping,
    Error,
}

data class HeliosUiState(
    val phase: HeliosPhase = HeliosPhase.Idle,
    val detail: String = "",
    val rpcPort: Int = 8485,
    val lastBlockHex: String? = null,
    val lastError: String? = null,
)

/**
 * Bridges Kotlin to {@link com.helios.Helios} (react-native-helios / flapigen JNI).
 * Starts a local JSON-RPC on `127.0.0.1` using the port in the companion object when native code is available.
 */
class HeliosRuntime(private val app: Application) {
    private val io = Executors.newSingleThreadExecutor { r ->
        Thread(r, "helios-runtime").apply { isDaemon = true }
    }
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)

    private val _state = MutableStateFlow(HeliosUiState())
    val state: StateFlow<HeliosUiState> = _state.asStateFlow()

    private var client: Helios? = null
    private var pollJob: Job? = null

    fun startDefaultMainnet() {
        io.execute {
            try {
                val busy = _state.value.phase == HeliosPhase.Starting || _state.value.phase == HeliosPhase.Running
                if (busy) return@execute

                if (!Helios.loadLibrary()) {
                    _state.value = HeliosUiState(
                        phase = HeliosPhase.NativeMissing,
                        detail = "Add libhelios.so (see react-native-helios yarn heliosup)",
                        rpcPort = DEFAULT_PORT,
                    )
                    return@execute
                }

                _state.value = _state.value.copy(phase = HeliosPhase.Starting, lastError = null, detail = "Starting…")

                val checkpoint = try {
                    Helios().heliosFallbackCheckpoint("mainnet")
                } catch (e: Exception) {
                    Log.e(TAG, "fallbackCheckpoint failed", e)
                    ""
                }

                val dataDir = app.cacheDir.resolve("helios").apply { mkdirs() }.absolutePath

                val h = Helios()
                h.heliosStart(
                    DEFAULT_UNTRUSTED_RPC,
                    DEFAULT_CONSENSUS_RPC,
                    DEFAULT_PORT.toDouble(),
                    "mainnet",
                    dataDir,
                    checkpoint,
                )
                client = h

                _state.value = _state.value.copy(
                    phase = HeliosPhase.Running,
                    detail = "Local JSON-RPC · 127.0.0.1:$DEFAULT_PORT",
                    rpcPort = DEFAULT_PORT,
                )
                startPolling()
            } catch (e: Exception) {
                Log.e(TAG, "heliosStart failed", e)
                _state.value = _state.value.copy(
                    phase = HeliosPhase.Error,
                    lastError = e.message ?: e.toString(),
                    detail = "Start failed",
                )
            }
        }
    }

    fun stop() {
        io.execute {
            pollJob?.cancel()
            pollJob = null
            _state.value = _state.value.copy(phase = HeliosPhase.Stopping, detail = "Stopping…")
            try {
                client?.heliosShutdown()
            } catch (e: Exception) {
                Log.e(TAG, "heliosShutdown failed", e)
            } finally {
                client = null
                _state.value = HeliosUiState(phase = HeliosPhase.Idle, rpcPort = DEFAULT_PORT)
            }
        }
    }

    private fun startPolling() {
        pollJob?.cancel()
        pollJob = scope.launch(Dispatchers.IO) {
            while (true) {
                val port = _state.value.rpcPort
                val hex = runCatching { fetchBlockNumber(port) }.getOrNull()
                if (hex != null) {
                    _state.value = _state.value.copy(lastBlockHex = hex, lastError = null)
                }
                delay(3_000)
            }
        }
    }

    private suspend fun fetchBlockNumber(port: Int): String? = withContext(Dispatchers.IO) {
        val url = URL("http://127.0.0.1:$port")
        val conn = (url.openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            doOutput = true
            setRequestProperty("Content-Type", "application/json")
            connectTimeout = 4_000
            readTimeout = 4_000
        }
        val body = """{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}"""
        conn.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
        val text = conn.inputStream.use { it.reader().readText() }
        val json = JSONObject(text)
        if (!json.has("result")) return@withContext null
        json.getString("result").takeIf { it.isNotBlank() }
    }

    companion object {
        /** Default local JSON-RPC port (react-native-helios examples use 8485; set to match your native build). */
        const val DEFAULT_PORT: Int = 8485

        /** Public execution endpoint — proofs source; replace for your infra. */
        const val DEFAULT_UNTRUSTED_RPC: String = "https://ethereum-rpc.publicnode.com"

        /** Light client sync committee data (Helios default in upstream README). */
        const val DEFAULT_CONSENSUS_RPC: String = "https://www.lightclientdata.org"
    }
}
