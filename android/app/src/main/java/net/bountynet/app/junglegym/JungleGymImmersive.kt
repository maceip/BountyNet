package net.bountynet.app.junglegym

import android.app.Activity
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat

/**
 * Sticky immersive system UI for demo / projector use on **JungleGym only** (API 30+ app min).
 * Mirrors [android/platform-samples ImmersiveMode](https://github.com/android/platform-samples/tree/main/samples/user-interface/window-insets):
 * hide [WindowInsetsCompat.Type.systemBars] with [WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE].
 *
 * Android 15 / API 36 still supports this via [WindowInsetsControllerCompat]; bars return with edge swipe.
 */
@Composable
fun JungleGymImmersiveEffect() {
    val view = LocalView.current
    DisposableEffect(view) {
        val window = (view.context as? Activity)?.window
        val controller = window?.let { WindowInsetsControllerCompat(it, view) }
        if (controller != null) {
            controller.systemBarsBehavior =
                WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            controller.hide(WindowInsetsCompat.Type.systemBars())
        }
        onDispose {
            controller?.show(WindowInsetsCompat.Type.systemBars())
            controller?.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_DEFAULT
        }
    }
}
