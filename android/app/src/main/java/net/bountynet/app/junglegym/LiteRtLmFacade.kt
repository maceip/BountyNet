package net.bountynet.app.junglegym

import android.content.Context
import kotlinx.coroutines.delay

/**
 * Facade for **LiteRT-LM** + tool calling + Codex-style exec.
 *
 * Real integration: add Google’s LiteRT / MediaPipe GenAI dependencies and swap
 * [MockLiteRtLmFacade] for a production implementation that calls native inference.
 */
data class LmToolCall(
    val name: String,
    val arguments: String,
)

data class LmTurn(
    val assistantText: String,
    val toolCalls: List<LmToolCall>,
)

interface LiteRtLmFacade {
    val modelLabel: String
    val weightsReady: Boolean
    suspend fun solveTurn(scenario: CiFailureScenario, stepIndex: Int): LmTurn
}

/**
 * Deterministic offline stand-in until Gemma weights are on disk and LiteRT is linked.
 */
class MockLiteRtLmFacade(
    private val context: Context,
) : LiteRtLmFacade {
    override val modelLabel: String =
        "${GemmaModelContract.MODEL_DISPLAY_NAME} · ${GemmaModelContract.LITERT_LM_RUNTIME_LABEL}"

    override val weightsReady: Boolean =
        GemmaModelContract.expectedWeightsPresent(context)

    override suspend fun solveTurn(scenario: CiFailureScenario, stepIndex: Int): LmTurn {
        delay(380L + (stepIndex * 90L) % 200)
        val tools = when (stepIndex % 4) {
            0 -> listOf(
                LmToolCall(
                    name = "read_repo_slice",
                    arguments = """{"repo":"${scenario.repo}","paths":[".github/workflows/*","Cargo.toml"]}""",
                ),
            )
            1 -> listOf(
                LmToolCall(
                    name = "codex_exec",
                    arguments = """{"cmd":"cargo check -q","cwd":"$DEFAULT_SIM_REPO","timeout_sec":120}""",
                ),
            )
            2 -> listOf(
                LmToolCall(
                    name = "apply_patch_draft",
                    arguments = """{"files":[{"path":"src/lib.rs","op":"insert_use"}]}""",
                ),
            )
            else -> emptyList()
        }
        val text = buildString {
            append("Thought: replaying network failure for `${scenario.checkName}` on `${scenario.repo}`.\n")
            append("Error excerpt: ${scenario.errorSnippet.take(120)}…\n")
            if (weightsReady) {
                append("Inference path: LiteRT-LM + Gemma local (weights detected).\n")
            } else {
                append("Inference path: MOCK — place weights at `${GemmaModelContract.WEIGHTS_RELATIVE_PATH}`.\n")
            }
            if (tools.isEmpty()) {
                append("Loop: staging PR metadata for BountyNet registration export.")
            }
        }
        return LmTurn(assistantText = text, toolCalls = tools)
    }
}
