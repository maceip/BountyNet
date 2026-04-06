package net.bountynet.app.attestation

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import com.android.keyattestation.verifier.GoogleTrustAnchors
import com.android.keyattestation.verifier.InstantSource
import com.android.keyattestation.verifier.VerificationResult
import com.android.keyattestation.verifier.Verifier
import com.android.keyattestation.verifier.challengecheckers.ChallengeMatcher
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.engine.okhttp.OkHttp
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.request.header
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.contentType
import io.ktor.serialization.kotlinx.json.json
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.cert.X509Certificate
import java.security.spec.ECGenParameterSpec
import java.time.Instant
import java.util.Base64
import javax.security.auth.x500.X500Principal
import kotlin.coroutines.cancellation.CancellationException

/**
 * Fetches a challenge from the gateway, generates an attested EC key in AndroidKeyStore,
 * verifies the chain locally with [com.android.keyattestation], then POSTs the chain for server verification.
 * Optional Dynamic JWT: after verify, the client can POST `/identity/android-attestation/bind`
 * with the verify response `bind_token` so the leaf SPKI hash is stored on the signed-in agent.
 */
class AttestationGateway(
    private val gatewayBaseUrl: String,
) {
    private val json = Json { ignoreUnknownKeys = true; isLenient = true }
    private val client = HttpClient(OkHttp) {
        expectSuccess = false
        install(ContentNegotiation) { json(json) }
    }

    fun close() {
        client.close()
    }

    suspend fun runAttestationFlow(dynamicJwtForBind: String? = null): AttestationResult {
        val base = gatewayBaseUrl.trimEnd('/')
        val challengeOut = try {
            client.post("$base/attest/android-key/challenge").body<ChallengeResponse>()
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            return AttestationResult(false, "challenge request failed: ${e.message}")
        }

        val challenge = try {
            Base64.getDecoder().decode(challengeOut.challengeB64)
        } catch (e: Exception) {
            return AttestationResult(false, "invalid challenge_b64: ${e.message}")
        }

        val alias = "bountynet-attest-${System.currentTimeMillis()}"
        val chain = try {
            generateAttestedChain(alias, challenge)
        } finally {
            deleteAlias(alias)
        }

        if (chain.isEmpty()) {
            return AttestationResult(false, "empty certificate chain (device may not support attestation)")
        }

        val verifier = Verifier(
            GoogleTrustAnchors,
            { emptySet() },
            InstantSource { Instant.now() },
        )
        val local = verifier.verify(chain, ChallengeMatcher(challenge))
        if (local !is VerificationResult.Success) {
            return AttestationResult(false, "local keyattestation verify failed: $local")
        }

        val certChainB64 = chain.map { Base64.getEncoder().encodeToString(it.encoded) }
        val verifyBody = VerifyRequest(
            nonce = challengeOut.nonce,
            certChainB64 = certChainB64,
        )
        return try {
            val resp = client.post("$base/attest/android-key/verify") {
                contentType(ContentType.Application.Json)
                setBody(verifyBody)
            }
            val vr: VerifyResponse = resp.body()
            when {
                resp.status.value in 200..299 && vr.verified == true ->
                    tryBindAfterVerify(base, vr, dynamicJwtForBind)
                else ->
                    AttestationResult(
                        false,
                        "gateway HTTP ${resp.status.value}: ${vr.error ?: "verify failed"}",
                    )
            }
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            AttestationResult(false, "verify request failed: ${e.message}")
        }
    }

    private suspend fun tryBindAfterVerify(
        base: String,
        vr: VerifyResponse,
        dynamicJwtForBind: String?,
    ): AttestationResult {
        val spki = vr.leafSpkiSha256Hex ?: "?"
        val jwt = dynamicJwtForBind?.trim()?.takeIf { it.isNotEmpty() }
        val bindTok = vr.bindToken?.takeIf { it.isNotEmpty() }
        if (jwt == null || bindTok == null) {
            val hint =
                if (bindTok != null && jwt == null) {
                    " — add Dynamic JWT below to bind this device to your agent"
                } else {
                    ""
                }
            return AttestationResult(
                true,
                "gateway OK — leaf SPKI sha256: $spki$hint",
                boundToAgent = false,
            )
        }
        return try {
            val bindResp = client.post("$base/identity/android-attestation/bind") {
                contentType(ContentType.Application.Json)
                header(HttpHeaders.Authorization, "Bearer $jwt")
                setBody(BindRequest(bindToken = bindTok))
            }
            val br: BindResponse = bindResp.body()
            when {
                bindResp.status.value in 200..299 && br.bound == true ->
                    AttestationResult(
                        true,
                        "gateway OK — SPKI $spki — bound to agent #${br.agentId}",
                        boundToAgent = true,
                    )
                else ->
                    AttestationResult(
                        true,
                        "verified SPKI $spki; bind failed HTTP ${bindResp.status.value}: ${br.error ?: "unknown"}",
                        boundToAgent = false,
                    )
            }
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            AttestationResult(
                true,
                "verified SPKI $spki; bind request error: ${e.message}",
                boundToAgent = false,
            )
        }
    }

    private fun deleteAlias(alias: String) {
        try {
            val ks = KeyStore.getInstance("AndroidKeyStore")
            ks.load(null)
            if (ks.containsAlias(alias)) ks.deleteEntry(alias)
        } catch (_: Exception) {
        }
    }

    private fun generateAttestedChain(alias: String, challenge: ByteArray): List<X509Certificate> {
        val kp = KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_EC, "AndroidKeyStore")
        val spec = KeyGenParameterSpec.Builder(
            alias,
            KeyProperties.PURPOSE_SIGN,
        )
            .setCertificateSubject(X500Principal("CN=BountyNet Attestation"))
            .setAlgorithmParameterSpec(ECGenParameterSpec("secp256r1"))
            .setDigests(KeyProperties.DIGEST_SHA256)
            .setAttestationChallenge(challenge)
            .build()
        kp.initialize(spec)
        kp.generateKeyPair()
        val ks = KeyStore.getInstance("AndroidKeyStore")
        ks.load(null)
        @Suppress("UNCHECKED_CAST")
        val raw = ks.getCertificateChain(alias) as? Array<X509Certificate>
        return raw?.toList() ?: emptyList()
    }
}

data class AttestationResult(
    val ok: Boolean,
    val message: String,
    val boundToAgent: Boolean = false,
)

@Serializable
private data class ChallengeResponse(
    val nonce: String,
    @SerialName("challenge_b64") val challengeB64: String,
)

@Serializable
private data class VerifyRequest(
    val nonce: String,
    @SerialName("cert_chain_b64") val certChainB64: List<String>,
)

@Serializable
private data class VerifyResponse(
    val verified: Boolean? = null,
    val error: String? = null,
    @SerialName("leaf_spki_sha256_hex") val leafSpkiSha256Hex: String? = null,
    @SerialName("bind_token") val bindToken: String? = null,
    @SerialName("bind_expires_in") val bindExpiresIn: Int? = null,
)

@Serializable
private data class BindRequest(
    @SerialName("bind_token") val bindToken: String,
)

@Serializable
private data class BindResponse(
    val bound: Boolean? = null,
    val error: String? = null,
    @SerialName("agent_id") val agentId: Int? = null,
    @SerialName("leaf_spki_sha256_hex") val leafSpkiSha256Hex: String? = null,
)
