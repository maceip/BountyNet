package net.bountynet.app.junglegym

import android.app.Application
import android.content.Intent
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import net.bountynet.app.BuildConfig
import net.bountynet.app.attestation.AttestationGateway

data class JungleGymUiState(
    val scenarios: List<CiFailureScenario> = emptyList(),
    val selected: CiFailureScenario? = null,
    val terminalLines: List<String> = emptyList(),
    val loopPhase: SolveLoopPhase = SolveLoopPhase.Idle,
    val loopHistory: List<LoopStepRecord> = emptyList(),
    val stepIndex: Int = 0,
    val lastTurn: LmTurn? = null,
    val loadError: String? = null,
    val loadingScenarios: Boolean = false,
    val agentDisplayName: String = "junglegym-solver-01",
    val adapterDisplayName: String = "relay-ci-runs-v0",
    val attestationRunning: Boolean = false,
    val attestationLastLine: String? = null,
    /** Paste Dynamic JWT after web login to bind this device's attestation to your agent. */
    val attestationBindJwt: String = "",
)

class JungleGymViewModel(
    application: Application,
) : AndroidViewModel(application) {
    private val json = Json {
        prettyPrint = true
        ignoreUnknownKeys = true
    }

    private val repo = JungleGymRepository(BuildConfig.GATEWAY_URL)
    private val lm: LiteRtLmFacade = MockLiteRtLmFacade(application.applicationContext)
    private val linux: JunglegymShellRuntime = MockLinuxRuntime()

    private val _ui = MutableStateFlow(JungleGymUiState())
    val ui: StateFlow<JungleGymUiState> = _ui.asStateFlow()

    init {
        appendTerminal(*linux.motdLines().toTypedArray())
        appendTerminal(
            "LiteRT-LM facade: ${lm.modelLabel}",
            "Weights ready: ${lm.weightsReady} — expected: `${GemmaModelContract.WEIGHTS_RELATIVE_PATH}`",
            "Gateway: ${BuildConfig.GATEWAY_URL}",
        )
        refreshScenarios()
    }

    override fun onCleared() {
        repo.close()
        super.onCleared()
    }

    fun refreshScenarios() {
        viewModelScope.launch {
            _ui.update { it.copy(loadingScenarios = true, loadError = null) }
            try {
                val list = repo.loadScenarios()
                _ui.update {
                    it.copy(
                        scenarios = list,
                        selected = it.selected ?: list.firstOrNull(),
                        loadingScenarios = false,
                    )
                }
                appendTerminal("[scenarios] loaded ${list.size} failure replays (network + fallback).")
            } catch (e: Exception) {
                _ui.update { it.copy(loadingScenarios = false, loadError = e.message ?: "load failed") }
            }
        }
    }

    fun selectScenario(s: CiFailureScenario) {
        _ui.update { it.copy(selected = s, loopPhase = SolveLoopPhase.Idle, stepIndex = 0, lastTurn = null) }
        appendTerminal("[scenario] ${s.repo} @ ${s.commitSha} — ${s.checkName}")
    }

    fun setAgentDisplayName(name: String) {
        _ui.update { it.copy(agentDisplayName = name) }
    }

    fun setAdapterDisplayName(name: String) {
        _ui.update { it.copy(adapterDisplayName = name) }
    }

    fun runShellCommand(line: String) {
        val out = linux.runLine(line)
        if (out.isNotEmpty()) appendTerminal(*out.toTypedArray())
    }

    fun runQuick(cmd: String) = runShellCommand(cmd)

    /** One inference + tool round; advances mock solve loop toward export. */
    fun runSolveStep() {
        val scenario = _ui.value.selected ?: return
        viewModelScope.launch {
            val idx = _ui.value.stepIndex
            val turn = lm.solveTurn(scenario, idx)
            val phases = listOf(
                SolveLoopPhase.IngestFailure to "Ingest CI log + lockfile context",
                SolveLoopPhase.Plan to "Plan patch + run read-only repo slice",
                SolveLoopPhase.ToolCall to "LiteRT-LM tool round (read_repo_slice)",
                SolveLoopPhase.CodexExec to "Sandbox exec: cargo check (mock)",
                SolveLoopPhase.ApplyPatch to "Draft patch + verify (mock)",
            )
            val phase = phases.getOrElse(idx % phases.size) { SolveLoopPhase.Done to "Loop idle" }
            val now = System.currentTimeMillis()
            _ui.update { s ->
                s.copy(
                    loopPhase = phase.first,
                    lastTurn = turn,
                    stepIndex = idx + 1,
                    loopHistory = s.loopHistory + LoopStepRecord(phase.first.name, phase.second, now),
                )
            }
            appendTerminal(
                "[lm] ${turn.assistantText.trim().replace("\n", " ")}",
            )
            turn.toolCalls.forEach { tc ->
                appendTerminal("[tool] ${tc.name} ${tc.arguments}")
                when (tc.name) {
                    "codex_exec" -> appendTerminal(
                        "[codex_exec]    Checking solver v0.1.0",
                        "[codex_exec]    Finished `dev` profile in 12.4s (mock)",
                    )
                    "apply_patch_draft" -> appendTerminal(
                        "[patch] unified diff: src/lib.rs (+2 -0) (mock)",
                    )
                }
            }
            if (_ui.value.stepIndex >= 8) {
                _ui.update { it.copy(loopPhase = SolveLoopPhase.Done) }
                appendTerminal("[loop] mock verification passed — ready to export agent + tuned model.")
            }
        }
    }

    fun resetLoop() {
        _ui.update {
            it.copy(loopPhase = SolveLoopPhase.Idle, loopHistory = emptyList(), stepIndex = 0, lastTurn = null)
        }
        appendTerminal("[loop] reset")
    }

    /** Key + certificate attestation: local [android/keyattestation] verify, then gateway checks chain + challenge. */
    fun setAttestationBindJwt(value: String) {
        _ui.update { it.copy(attestationBindJwt = value) }
    }

    fun runDeviceAttestation() {
        viewModelScope.launch {
            _ui.update { it.copy(attestationRunning = true) }
            val gw = AttestationGateway(BuildConfig.GATEWAY_URL)
            try {
                val jwt = _ui.value.attestationBindJwt.trim().takeIf { it.isNotEmpty() }
                val r = gw.runAttestationFlow(dynamicJwtForBind = jwt)
                appendTerminal("[attest] ${if (r.ok) "OK" else "FAIL"} — ${r.message}")
                _ui.update { it.copy(attestationLastLine = r.message, attestationRunning = false) }
            } catch (e: Exception) {
                appendTerminal("[attest] error: ${e.message}")
                _ui.update {
                    it.copy(
                        attestationLastLine = e.message,
                        attestationRunning = false,
                    )
                }
            } finally {
                gw.close()
            }
        }
    }

    /** Full JSON export for “register on BountyNet” flow (share sheet — last mile still mock). */
    fun buildShareExportIntent(): Intent? {
        val s = _ui.value
        val sc = s.selected ?: return null
        val export = JunglegymRegistrationExportV1(
            gatewayUrl = BuildConfig.GATEWAY_URL,
            agent = AgentExportBundleV1(
                displayName = s.agentDisplayName.trim().ifEmpty { "junglegym-agent" },
                baseRepo = sc.repo,
            ),
            tunedModel = TunedModelExportV1(
                adapterDisplayName = s.adapterDisplayName.trim().ifEmpty { "adapter-v0" },
            ),
            lastSolveLoop = s.loopHistory,
        )
        val payload = json.encodeToString(export)
        return Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(Intent.EXTRA_SUBJECT, "BountyNet Junglegym export")
            putExtra(Intent.EXTRA_TEXT, payload)
        }
    }

    private fun appendTerminal(vararg lines: String) {
        _ui.update { st ->
            st.copy(terminalLines = (st.terminalLines + lines.toList()).takeLast(400))
        }
    }
}
