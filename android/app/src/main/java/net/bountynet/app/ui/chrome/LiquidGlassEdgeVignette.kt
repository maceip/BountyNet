package net.bountynet.app.ui.chrome

import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalInspectionMode
import dev.chrisbanes.haze.HazeProgressive
import dev.chrisbanes.haze.HazeState
import dev.chrisbanes.haze.hazeEffect
import dev.chrisbanes.haze.materials.ExperimentalHazeMaterialsApi
import dev.chrisbanes.haze.materials.HazeMaterials

/**
 * Subtle “liquid glass” scrims over [about] the top tenth and lower two-thirds of the screen,
 * with progressive falloff so the middle band stays more legible. Touch-transparent via
 * disabled [clickable] so taps reach [MainNav] underneath.
 *
 * Uses Haze 1.7.x [hazeEffect] + [HazeMaterials.thin()] (Haze 2.0 moves the same knobs under
 * [dev.chrisbanes.haze.blur.blurEffect] once that artifact is on Maven Central).
 */
@OptIn(ExperimentalHazeMaterialsApi::class)
@Composable
fun LiquidGlassEdgeVignette(
    hazeState: HazeState,
    modifier: Modifier = Modifier,
) {
    val blurEnabled = !LocalInspectionMode.current
    val style = HazeMaterials.thin()
    val noTouch = remember { MutableInteractionSource() }
    Box(
        modifier
            .fillMaxSize()
            .clickable(
                enabled = false,
                indication = null,
                interactionSource = noTouch,
                onClick = {},
            ),
    ) {
        Box(
            Modifier
                .align(Alignment.TopCenter)
                .fillMaxWidth()
                .fillMaxHeight(0.1f)
                .clickable(
                    enabled = false,
                    indication = null,
                    interactionSource = remember { MutableInteractionSource() },
                    onClick = {},
                )
                .hazeEffect(state = hazeState, style = style) {
                    this.blurEnabled = blurEnabled
                    progressive = HazeProgressive.verticalGradient(
                        startIntensity = 1f,
                        endIntensity = 0f,
                    )
                    noiseFactor = 0.06f
                },
        )
        Box(
            Modifier
                .align(Alignment.BottomCenter)
                .fillMaxWidth()
                .fillMaxHeight(2f / 3f)
                .clickable(
                    enabled = false,
                    indication = null,
                    interactionSource = remember { MutableInteractionSource() },
                    onClick = {},
                )
                .hazeEffect(state = hazeState, style = style) {
                    this.blurEnabled = blurEnabled
                    progressive = HazeProgressive.verticalGradient(
                        startIntensity = 0f,
                        endIntensity = 1f,
                    )
                    noiseFactor = 0.06f
                },
        )
    }
}
