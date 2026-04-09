package net.bountynet.app.junglegym

import android.view.HapticFeedbackConstants
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

private val LedgeBg = Color(0xFF161B22)
private val LedgeStroke = Color(0xFF30363D)
private val KeyBg = Color(0xFF21262D)
private val KeyFg = Color(0xFFC9D1D9)
private val KeyAccent = Color(0xFF3FB950)
private val CtrlOn = Color(0xFF238636)

/**
 * **Keyboard extension**: numpad + terminal control keys; morphs to a scrollable **rail** when the IME
 * is visible so keys stay above the soft keyboard (tracks IME insets on API 30+ with [Modifier.imePadding] upstream).
 */
@Composable
fun KeyboardExtensionLedge(
    keyboardOpen: Boolean,
    ctrlArmed: Boolean,
    onCtrlToggle: () -> Unit,
    onInsert: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    val view = LocalView.current
    fun hapticTap(block: () -> Unit) {
        view.performHapticFeedback(HapticFeedbackConstants.CONTEXT_CLICK)
        block()
    }

    AnimatedContent(
        targetState = keyboardOpen,
        transitionSpec = { fadeIn() togetherWith fadeOut() },
        label = "ledgeMorph",
        modifier = modifier,
    ) { compact ->
        if (compact) {
            Row(
                Modifier
                    .fillMaxWidth()
                    .background(LedgeBg, RoundedCornerShape(bottomStart = 8.dp, bottomEnd = 8.dp))
                    .border(1.dp, LedgeStroke, RoundedCornerShape(bottomStart = 8.dp, bottomEnd = 8.dp))
                    .horizontalScroll(rememberScrollState())
                    .padding(horizontal = 8.dp, vertical = 6.dp),
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                val rail = listOf<Pair<String, () -> Unit>>(
                    "Esc" to { onInsert("\u001B") },
                    "Tab" to { onInsert("\t") },
                    "Ctrl" to { onCtrlToggle() },
                    "←" to { onInsert("\u001B[D") },
                    "↓" to { onInsert("\u001B[B") },
                    "↑" to { onInsert("\u001B[A") },
                    "→" to { onInsert("\u001B[C") },
                    "⌂" to { onInsert("\u001B[H") },
                    "⏎" to { onInsert("\r") },
                    "7" to { onInsert("7") },
                    "8" to { onInsert("8") },
                    "9" to { onInsert("9") },
                    "4" to { onInsert("4") },
                    "5" to { onInsert("5") },
                    "6" to { onInsert("6") },
                    "1" to { onInsert("1") },
                    "2" to { onInsert("2") },
                    "3" to { onInsert("3") },
                    "0" to { onInsert("0") },
                    "." to { onInsert(".") },
                )
                rail.forEach { (label, action) ->
                    val ctrlKey = label == "Ctrl"
                    LedgeKey(
                        label = label,
                        modifier = Modifier.width(40.dp),
                        containerColor = if (ctrlKey && ctrlArmed) CtrlOn else KeyBg,
                        contentColor = if (ctrlKey && ctrlArmed) Color.White else KeyFg,
                    ) { hapticTap(action) }
                }
            }
        } else {
            Column(
                Modifier
                    .fillMaxWidth()
                    .background(LedgeBg, RoundedCornerShape(bottomStart = 8.dp, bottomEnd = 8.dp))
                    .border(1.dp, LedgeStroke, RoundedCornerShape(bottomStart = 8.dp, bottomEnd = 8.dp))
                    .padding(8.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    listOf("7", "8", "9").forEach { d ->
                        LedgeKey(d, Modifier.weight(1f)) { hapticTap { onInsert(d) } }
                    }
                    LedgeKey("Esc", Modifier.width(44.dp)) { hapticTap { onInsert("\u001B") } }
                }
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    listOf("4", "5", "6").forEach { d ->
                        LedgeKey(d, Modifier.weight(1f)) { hapticTap { onInsert(d) } }
                    }
                    LedgeKey("Tab", Modifier.width(44.dp)) { hapticTap { onInsert("\t") } }
                }
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    listOf("1", "2", "3").forEach { d ->
                        LedgeKey(d, Modifier.weight(1f)) { hapticTap { onInsert(d) } }
                    }
                    LedgeKey("⌂", Modifier.width(44.dp)) { hapticTap { onInsert("\u001B[H") } }
                }
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    LedgeKey("0", Modifier.weight(2f)) { hapticTap { onInsert("0") } }
                    LedgeKey(".", Modifier.weight(1f)) { hapticTap { onInsert(".") } }
                    LedgeKey(
                        "Ctrl",
                        Modifier.width(52.dp),
                        containerColor = if (ctrlArmed) CtrlOn else KeyBg,
                        contentColor = if (ctrlArmed) Color.White else KeyFg,
                    ) { hapticTap { onCtrlToggle() } }
                }
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    LedgeKey("←", Modifier.weight(1f)) { hapticTap { onInsert("\u001B[D") } }
                    LedgeKey("↑", Modifier.weight(1f)) { hapticTap { onInsert("\u001B[A") } }
                    LedgeKey("↓", Modifier.weight(1f)) { hapticTap { onInsert("\u001B[B") } }
                    LedgeKey("→", Modifier.weight(1f)) { hapticTap { onInsert("\u001B[C") } }
                    LedgeKey(
                        "⏎",
                        Modifier.weight(1.4f),
                        containerColor = KeyAccent.copy(alpha = 0.2f),
                        contentColor = KeyAccent,
                    ) { hapticTap { onInsert("\r") } }
                }
            }
        }
    }
}

@Composable
private fun LedgeKey(
    label: String,
    modifier: Modifier = Modifier,
    containerColor: Color = KeyBg,
    contentColor: Color = KeyFg,
    onClick: () -> Unit,
) {
    Box(
        modifier
            .height(36.dp)
            .background(containerColor, RoundedCornerShape(8.dp))
            .border(1.dp, LedgeStroke, RoundedCornerShape(8.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 4.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            label,
            color = contentColor,
            fontFamily = FontFamily.Monospace,
            fontSize = 12.sp,
            fontWeight = FontWeight.Medium,
            textAlign = TextAlign.Center,
        )
    }
}
