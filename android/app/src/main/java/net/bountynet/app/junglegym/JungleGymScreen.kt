package net.bountynet.app.junglegym

import android.content.Intent
import androidx.compose.foundation.Image
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import net.bountynet.app.R

/**
 * Agent Junglegym: **API 30+** (see `minSdk`). Uses [JungleGymImmersiveEffect] (platform-samples style
 * transient immersive bars) for projector demos. IME motion follows system insets via Compose
 * [androidx.compose.foundation.layout.imePadding] on the scroll content (tracks [WindowInsetsAnimation]
 * on Android 11+ when edge-to-edge is enabled in [net.bountynet.app.MainActivity]).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun JungleGymScreen(
    onBack: () -> Unit,
    vm: JungleGymViewModel = viewModel(),
) {
    val ctx = LocalContext.current
    val st by vm.ui.collectAsStateWithLifecycle()
    var shellInput by remember { mutableStateOf("") }

    JungleGymImmersiveEffect()

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text("AGENT JUNGLEGYM", letterSpacing = 2.sp, style = MaterialTheme.typography.titleMedium)
                        Text(
                            GemmaModelContract.MODEL_DISPLAY_NAME + " · offline target · ${GemmaModelContract.LITERT_LM_RUNTIME_LABEL}",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBack) { Text("<") }
                },
                actions = {
                    TextButton(onClick = vm::refreshScenarios) { Text("Sync feed") }
                },
            )
        },
    ) { pad ->
        LazyColumn(
            Modifier
                .fillMaxSize()
                .padding(pad)
                .imePadding()
                .navigationBarsPadding()
                .padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            item {
                Text(
                    "Train releaseable agents on CI failures that already flowed through BountyNet / the gateway. " +
                        "Shell is a mock Linux UX; Gemma weights stay off-device until you sync.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            item {
                Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
                    Column(Modifier.padding(12.dp)) {
                        Text(
                            "Creditmaxer (prototype)",
                            style = MaterialTheme.typography.titleSmall,
                        )
                        Text(
                            "Mock network control surface — hook to gateway + budgets when wired.",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        Spacer(Modifier.height(10.dp))
                        Image(
                            painter = painterResource(R.drawable.creditmaxer),
                            contentDescription = "Creditmaxer interface mock",
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(220.dp),
                            contentScale = ContentScale.Fit,
                        )
                    }
                }
            }

            item {
                Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
                    Column(Modifier.padding(12.dp)) {
                        Text(
                            "Key attestation",
                            style = MaterialTheme.typography.titleSmall,
                        )
                        Text(
                            "Runs android/keyattestation locally, then POSTs the cert chain to " +
                                "/attest/android-key/verify. With a Dynamic JWT (from web login), " +
                                "the gateway also binds the leaf SPKI hash to your agent.",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        Spacer(Modifier.height(8.dp))
                        OutlinedTextField(
                            value = st.attestationBindJwt,
                            onValueChange = vm::setAttestationBindJwt,
                            label = { Text("Dynamic JWT (optional)") },
                            placeholder = { Text("Paste after login — binds device to agent") },
                            minLines = 2,
                            maxLines = 4,
                            modifier = Modifier.fillMaxWidth(),
                        )
                        Spacer(Modifier.height(8.dp))
                        Button(
                            onClick = vm::runDeviceAttestation,
                            enabled = !st.attestationRunning,
                        ) {
                            Text(if (st.attestationRunning) "Attesting…" else "Attest & verify with gateway")
                        }
                        st.attestationLastLine?.let { line ->
                            Spacer(Modifier.height(6.dp))
                            Text(
                                line,
                                style = MaterialTheme.typography.labelSmall,
                                fontFamily = FontFamily.Monospace,
                            )
                        }
                    }
                }
            }

            if (st.loadingScenarios) {
                item { LinearProgressIndicator(Modifier.fillMaxWidth()) }
            }
            st.loadError?.let { err ->
                item {
                    Text(
                        "Feed: $err",
                        color = MaterialTheme.colorScheme.error,
                        style = MaterialTheme.typography.bodySmall,
                    )
                }
            }

            item {
                Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.35f))) {
                    Column(Modifier.padding(12.dp)) {
                        Text("Solver names (export)", style = MaterialTheme.typography.labelLarge)
                        Spacer(Modifier.height(6.dp))
                        OutlinedTextField(
                            value = st.agentDisplayName,
                            onValueChange = vm::setAgentDisplayName,
                            label = { Text("Agent display name") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth(),
                        )
                        Spacer(Modifier.height(8.dp))
                        OutlinedTextField(
                            value = st.adapterDisplayName,
                            onValueChange = vm::setAdapterDisplayName,
                            label = { Text("Tuned adapter name") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth(),
                        )
                    }
                }
            }

            item {
                Text("Failure scenarios (${st.scenarios.size})", style = MaterialTheme.typography.titleSmall)
                Spacer(Modifier.height(4.dp))
                Row(
                    Modifier.horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    st.scenarios.forEach { sc ->
                        AssistChip(
                            onClick = { vm.selectScenario(sc) },
                            label = {
                                Text(
                                    sc.repo.substringAfterLast('/') + if (sc.fromNetwork) " · net" else " · local",
                                    style = MaterialTheme.typography.labelSmall,
                                )
                            },
                        )
                    }
                }
            }

            item {
                val sel = st.selected
                if (sel == null) {
                    Text("Pick a scenario chip above.", style = MaterialTheme.typography.bodyMedium)
                } else {
                    Card(colors = CardDefaults.cardColors()) {
                        Column(Modifier.padding(12.dp)) {
                            Text(sel.repo, style = MaterialTheme.typography.titleSmall, fontFamily = FontFamily.Monospace)
                            Text(
                                "${sel.checkName} · ${sel.commitSha} ${if (sel.fromNetwork) "(gateway)" else "(fixture)"}",
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                            Spacer(Modifier.height(6.dp))
                            Text(sel.errorSnippet, style = MaterialTheme.typography.bodySmall)
                            Spacer(Modifier.height(8.dp))
                            Text(
                                "Loop: ${st.loopPhase.name} · step ${st.stepIndex}",
                                style = MaterialTheme.typography.labelMedium,
                            )
                            Row(
                                horizontalArrangement = Arrangement.spacedBy(8.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Button(onClick = vm::runSolveStep) { Text("Run solve step") }
                                OutlinedButton(onClick = vm::resetLoop) { Text("Reset") }
                                OutlinedButton(
                                    onClick = {
                                        val intent = vm.buildShareExportIntent()
                                        if (intent != null) {
                                            ctx.startActivity(Intent.createChooser(intent, "Export Junglegym bundle"))
                                        }
                                    },
                                ) {
                                    Text("Export JSON")
                                }
                            }
                        }
                    }
                }
            }

            item {
                Text("Sandbox terminal", style = MaterialTheme.typography.titleSmall)
                Text(
                    "Mock commands for hackathon demos — same surface can swap to embedded Python/Node later.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(Modifier.height(8.dp))
                JunglegymTerminalPanel(
                    lines = st.terminalLines,
                    input = shellInput,
                    onInputChange = { shellInput = it },
                    onSubmit = {
                        vm.runShellCommand(shellInput)
                        shellInput = ""
                    },
                    quickCommands = listOf("uname -a", "pwd", "ls", "git status", "be watch"),
                    onQuickCommand = vm::runQuick,
                    modifier = Modifier.fillMaxWidth(),
                    pathHint = "~/repo",
                )
            }

            item {
                Text("LiteRT-LM (last turn)", style = MaterialTheme.typography.titleSmall)
                val turn = st.lastTurn
                if (turn == null) {
                    Text("Run a solve step to see tool calls.", style = MaterialTheme.typography.bodySmall)
                } else {
                    Card {
                        Column(Modifier.padding(12.dp)) {
                            Text(turn.assistantText, style = MaterialTheme.typography.bodySmall)
                            Spacer(Modifier.height(6.dp))
                            turn.toolCalls.forEach { tc ->
                                Text("→ ${tc.name}", fontFamily = FontFamily.Monospace, style = MaterialTheme.typography.labelMedium)
                                Text(tc.arguments, fontFamily = FontFamily.Monospace, style = MaterialTheme.typography.labelSmall)
                            }
                        }
                    }
                }
            }

            item { Spacer(Modifier.height(24.dp)) }
        }
    }
}
