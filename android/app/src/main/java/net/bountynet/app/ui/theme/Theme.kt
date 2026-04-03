package net.bountynet.app.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.platform.LocalContext

@Composable
fun BountyNetTheme(content: @Composable () -> Unit) {
    val colorScheme = try {
        dynamicLightColorScheme(LocalContext.current)
    } catch (_: Exception) {
        lightColorScheme()
    }
    MaterialTheme(colorScheme = colorScheme, content = content)
}
