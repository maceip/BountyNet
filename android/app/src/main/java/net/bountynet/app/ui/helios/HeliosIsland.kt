package net.bountynet.app.ui.helios

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.wrapContentHeight
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import net.bountynet.app.BountyNetApp
import net.bountynet.app.helios.HeliosPhase
import net.bountynet.app.helios.HeliosUiState

/**
 * Dynamic-Island–style status “pill” for the embedded Helios JSON-RPC light client.
 */
@Composable
fun HeliosIslandOverlay(modifier: Modifier = Modifier) {
    val app = LocalContext.current.applicationContext as BountyNetApp
    val runtime = app.heliosRuntime
    val state by runtime.state.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) {
        runtime.startDefaultMainnet()
    }

    val pulse = rememberInfiniteTransition(label = "helios_pulse")
    val breathe by pulse.animateFloat(
        initialValue = 0.92f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(tween(900), RepeatMode.Reverse),
        label = "breathe",
    )

    Box(
        modifier
            .fillMaxWidth()
            .wrapContentHeight()
            .statusBarsPadding(),
        contentAlignment = Alignment.TopCenter,
    ) {
        HeliosPill(
            state = state,
            modifier = Modifier
                .padding(top = 6.dp)
                .graphicsLayer { scaleX = breathe; scaleY = breathe }
                .clip(RoundedCornerShape(percent = 50))
                .clickable {
                    when (state.phase) {
                        HeliosPhase.Running -> runtime.stop()
                        else -> runtime.startDefaultMainnet()
                    }
                },
        )
    }
}

@Composable
private fun HeliosPill(state: HeliosUiState, modifier: Modifier = Modifier) {
    val (title, subtitle) = pillContent(state)

    Surface(
        modifier = modifier,
        color = MaterialTheme.colorScheme.surfaceContainerHigh,
        tonalElevation = 3.dp,
        shadowElevation = 6.dp,
        shape = RoundedCornerShape(percent = 50),
    ) {
        Row(
            Modifier.padding(horizontal = 14.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Text(
                "◈",
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.primary,
            )
            Column {
                Text(
                    title,
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(
                    subtitle,
                    style = MaterialTheme.typography.labelLarge,
                    color = MaterialTheme.colorScheme.onSurface,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
    }
}

@Composable
private fun pillContent(state: HeliosUiState): Pair<String, String> {
    val title = "HELIOS"
    val subtitle = when (state.phase) {
        HeliosPhase.Idle -> "Tap to start · :${state.rpcPort}"
        HeliosPhase.NativeMissing -> "libhelios.so missing — jniLibs/arm64-v8a"
        HeliosPhase.Starting -> state.detail.ifBlank { "Booting light client…" }
        HeliosPhase.Stopping -> "Stopping…"
        HeliosPhase.Running -> {
            val block = state.lastBlockHex
            if (block != null) "Head $block · tap to stop" else "RPC up · sync…"
        }
        HeliosPhase.Error -> state.lastError?.take(42)?.let { "$it…" } ?: "Error"
    }
    return title to subtitle
}
