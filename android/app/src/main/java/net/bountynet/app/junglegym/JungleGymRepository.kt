package net.bountynet.app.junglegym

import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.engine.okhttp.OkHttp
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.request.get
import io.ktor.serialization.kotlinx.json.json
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import java.util.UUID

@Serializable
private data class BountiesResponse(
    val bounties: List<BountyDto> = emptyList(),
)

@Serializable
private data class BountyDto(
    val repo: String? = null,
    @SerialName("context_hash") val contextHash: String? = null,
    @SerialName("check_name") val checkName: String? = null,
    val commit: String? = null,
    val resolved: Boolean? = null,
)

class JungleGymRepository(
    private val gatewayBaseUrl: String,
) {
    private val json = Json { ignoreUnknownKeys = true; isLenient = true }
    private val client = HttpClient(OkHttp) {
        install(ContentNegotiation) { json(json) }
    }

    suspend fun loadScenarios(): List<CiFailureScenario> = withContext(Dispatchers.IO) {
        try {
            val url = "${gatewayBaseUrl.trimEnd('/')}/bounties?status=all&limit=12"
            val body: BountiesResponse = client.get(url).body()
            body.bounties
                .filter { it.resolved != true && !it.repo.isNullOrBlank() }
                .map { b ->
                    CiFailureScenario(
                        id = b.contextHash ?: UUID.randomUUID().toString(),
                        repo = b.repo!!,
                        checkName = b.checkName ?: "CI",
                        commitSha = (b.commit ?: "deadbeef").take(12),
                        errorSnippet = "Gateway failure replay for ${b.checkName ?: "check"} (network)",
                        fromNetwork = true,
                    )
                }
                .ifEmpty { offlineScenarios() }
        } catch (_: Exception) {
            offlineScenarios()
        }
    }

    private fun offlineScenarios(): List<CiFailureScenario> = listOf(
        CiFailureScenario(
            id = "offline-1",
            repo = DEFAULT_SIM_REPO,
            checkName = "rust-ci / test",
            commitSha = "a1b2c3d4e5f6",
            errorSnippet = "error[E0425]: cannot find function `relay_forward` in this scope",
            fromNetwork = false,
        ),
        CiFailureScenario(
            id = "offline-2",
            repo = DEFAULT_SIM_REPO,
            checkName = "github-actions / build",
            commitSha = "9f8e7d6c5b4a",
            errorSnippet = "Process completed with exit code 101.",
            fromNetwork = false,
        ),
    )

    fun close() {
        client.close()
    }
}
