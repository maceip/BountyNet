package net.bountynet.app.junglegym

import kotlinx.serialization.Serializable

/** Default repo used by `sim/agent.py --repo` examples — same git story as the fleet sim. */
const val DEFAULT_SIM_REPO = "maceip/freehold-relay"

@Serializable
data class CiFailureScenario(
    val id: String,
    val repo: String,
    val checkName: String,
    val commitSha: String,
    val errorSnippet: String,
    val fromNetwork: Boolean,
)

enum class SolveLoopPhase {
    Idle,
    IngestFailure,
    Plan,
    ToolCall,
    CodexExec,
    ApplyPatch,
    VerifyMock,
    Done,
    Error,
}

@Serializable
data class LoopStepRecord(
    val phase: String,
    val detail: String,
    val unixMs: Long,
)

@Serializable
data class ToolInvocation(
    val name: String,
    val argsJson: String,
    val resultSummary: String,
)

@Serializable
data class AgentExportBundleV1(
    val schema: String = "bountynet.agent_bundle.v1",
    val displayName: String,
    val modelSlug: String = GemmaModelContract.MODEL_SLUG,
    val baseRepo: String,
    val toolCallingEnabled: Boolean = true,
    val codexExecSandbox: Boolean = true,
    /** Placeholder — replace with real calibration JSON from LiteRT / trainers. */
    val loraAdapterPlaceholderBase64: String = "",
    val registrationNotes: String =
        "Export for BountyNet registration (last mile: upload via `be join` + dashboard when wired).",
)

@Serializable
data class TunedModelExportV1(
    val schema: String = "bountynet.tuned_model.v1",
    val baseSlug: String = GemmaModelContract.MODEL_SLUG,
    val adapterDisplayName: String,
    val litertBundlePathHint: String = GemmaModelContract.WEIGHTS_RELATIVE_PATH,
    /** Replace with real adapter weights / tensors when training pipeline lands. */
    val adapterPlaceholderBase64: String = "",
)

@Serializable
data class JunglegymRegistrationExportV1(
    val schema: String = "bountynet.junglegym_export.v1",
    val gatewayUrl: String,
    val agent: AgentExportBundleV1,
    val tunedModel: TunedModelExportV1,
    val lastSolveLoop: List<LoopStepRecord> = emptyList(),
    val mockRegistrationAck: String =
        "PENDING — POST /identity/register-agent-bundle not implemented in this build.",
)
