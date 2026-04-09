package net.bountynet.app.junglegym

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.ime
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AssistChip
import androidx.compose.material3.AssistChipDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

private val TerminalBg = Color(0xFF0D1117)
private val TerminalTitleBar = Color(0xFF161B22)
private val TerminalFg = Color(0xFFC9D1D9)
private val TerminalPrompt = Color(0xFF3FB950)
private val TerminalWarn = Color(0xFFD29922)
private val TerminalErr = Color(0xFFFF7B72)
private val TerminalMuted = Color(0xFF8B949E)
private val TerminalBorder = Color(0xFF30363D)

@Composable
fun JunglegymTerminalPanel(
    lines: List<String>,
    input: String,
    onInputChange: (String) -> Unit,
    onSubmit: () -> Unit,
    quickCommands: List<String>,
    onQuickCommand: (String) -> Unit,
    modifier: Modifier = Modifier,
    panelHeightDp: Int = 400,
    prompt: String = "solver@sandbox",
    pathHint: String = "~/project",
) {
    val scroll = rememberScrollState()
    LaunchedEffect(lines.size) {
        scroll.scrollTo(scroll.maxValue)
    }

    val density = LocalDensity.current
    val imeBottomPx = WindowInsets.ime.getBottom(density)
    val keyboardOpen = imeBottomPx > with(density) { 96.dp.toPx() }

    val focusRequester = remember { FocusRequester() }
    val keyboard = LocalSoftwareKeyboardController.current
    var ctrlArmed by remember { mutableStateOf(false) }

    fun applyInputChange(new: String) {
        if (ctrlArmed && new.length > input.length) {
            val added = new.substring(input.length)
            if (added.length == 1) {
                val ch = added[0]
                if (ch.isLetter()) {
                    val ctrlCode = ch.uppercaseChar().code - 64
                    if (ctrlCode in 1..26) {
                        ctrlArmed = false
                        onInputChange(input + ctrlCode.toChar())
                        return
                    }
                }
            }
        }
        onInputChange(new)
    }

    fun insertFromLedge(seq: String) {
        applyInputChange(input + seq)
    }

    fun toggleCtrl() {
        ctrlArmed = !ctrlArmed
        if (ctrlArmed) {
            focusRequester.requestFocus()
            keyboard?.show()
        }
    }

    Column(modifier) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            quickCommands.forEach { cmd ->
                AssistChip(
                    onClick = { onQuickCommand(cmd) },
                    label = {
                        Text(cmd, fontFamily = FontFamily.Monospace, fontSize = 11.sp)
                    },
                    colors = AssistChipDefaults.assistChipColors(
                        containerColor = TerminalTitleBar,
                        labelColor = TerminalMuted,
                    ),
                    border = AssistChipDefaults.assistChipBorder(
                        enabled = true,
                        borderColor = TerminalBorder,
                    ),
                )
            }
        }

        Spacer(Modifier.height(8.dp))

        Column(
            modifier = Modifier
                .fillMaxWidth()
                .height(panelHeightDp.dp)
                .background(TerminalBg, RoundedCornerShape(10.dp))
                .border(1.dp, TerminalBorder, RoundedCornerShape(10.dp)),
        ) {
            Row(
                Modifier
                    .fillMaxWidth()
                    .background(TerminalTitleBar, RoundedCornerShape(topStart = 10.dp, topEnd = 10.dp))
                    .padding(horizontal = 12.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    Box(Modifier.width(8.dp).height(8.dp).background(Color(0xFFFF5F57), RoundedCornerShape(50)))
                    Box(Modifier.width(8.dp).height(8.dp).background(Color(0xFFFEBC2E), RoundedCornerShape(50)))
                    Box(Modifier.width(8.dp).height(8.dp).background(Color(0xFF28C840), RoundedCornerShape(50)))
                }
                Spacer(Modifier.width(12.dp))
                Text(
                    "bash — sandbox session · keys",
                    color = TerminalMuted,
                    fontFamily = FontFamily.Monospace,
                    fontSize = 11.sp,
                )
            }

            SelectionContainer {
                Column(
                    Modifier
                        .weight(1f, fill = true)
                        .padding(horizontal = 12.dp, vertical = 8.dp)
                        .verticalScroll(scroll),
                ) {
                    lines.forEach { line ->
                        Text(
                            line,
                            color = terminalLineColor(line),
                            fontFamily = FontFamily.Monospace,
                            fontSize = 12.sp,
                            lineHeight = 16.sp,
                            modifier = Modifier.padding(vertical = 1.dp),
                        )
                    }
                }
            }

            Row(
                Modifier
                    .fillMaxWidth()
                    .background(Color(0xFF010409))
                    .padding(horizontal = 10.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = "$prompt:$pathHint$ ",
                    color = TerminalPrompt,
                    fontFamily = FontFamily.Monospace,
                    fontSize = 12.sp,
                )
                BasicTextField(
                    value = input,
                    onValueChange = { applyInputChange(it) },
                    modifier = Modifier
                        .weight(1f)
                        .padding(start = 4.dp)
                        .focusRequester(focusRequester),
                    textStyle = TextStyle(
                        color = TerminalFg,
                        fontFamily = FontFamily.Monospace,
                        fontSize = 12.sp,
                    ),
                    singleLine = true,
                    cursorBrush = SolidColor(TerminalPrompt),
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send),
                    keyboardActions = KeyboardActions(
                        onSend = { if (input.isNotBlank()) onSubmit() },
                    ),
                )
                Text(
                    "run",
                    color = TerminalMuted,
                    fontFamily = FontFamily.Monospace,
                    fontSize = 11.sp,
                    modifier = Modifier
                        .clickable(enabled = input.isNotBlank()) { onSubmit() }
                        .padding(start = 8.dp),
                )
            }

            KeyboardExtensionLedge(
                keyboardOpen = keyboardOpen,
                ctrlArmed = ctrlArmed,
                onCtrlToggle = { toggleCtrl() },
                onInsert = { insertFromLedge(it) },
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }
}

private fun terminalLineColor(line: String): Color {
    val lower = line.lowercase()
    return when {
        lower.contains("error") || lower.contains("failed") || lower.startsWith("bash:") -> TerminalErr
        lower.contains("warning") || lower.contains("hint:") -> TerminalWarn
        lower.startsWith("[") -> TerminalMuted
        else -> TerminalFg
    }
}
