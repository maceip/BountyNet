package net.bountynet.app.ui.nav

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.adaptive.currentWindowAdaptiveInfo
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.navigation3.runtime.NavEntry
import androidx.navigation3.runtime.NavKey
import androidx.navigation3.runtime.NavMetadataKey
import androidx.navigation3.runtime.contains
import androidx.navigation3.runtime.metadata
import androidx.navigation3.scene.Scene
import androidx.navigation3.scene.SceneStrategy
import androidx.navigation3.scene.SceneStrategyScope
import androidx.window.core.layout.WindowSizeClass
import androidx.window.core.layout.WindowSizeClass.Companion.WIDTH_DP_MEDIUM_LOWER_BOUND

/**
 * Two-pane [Scene] and [SceneStrategy], adapted from
 * [android/nav3-recipes twopane](https://github.com/android/nav3-recipes/tree/main/app/src/main/java/com/example/nav3recipes/scenes/twopane).
 *
 * When width is at least the medium breakpoint (~600dp), e.g. unfolded inner display,
 * the last two entries that declare [TwoPaneKey] render side-by-side (50/50).
 */
data class TwoPaneScene<T : NavKey>(
    override val key: Any,
    override val previousEntries: List<NavEntry<T>>,
    val firstEntry: NavEntry<T>,
    val secondEntry: NavEntry<T>,
) : Scene<T> {
    override val entries: List<NavEntry<T>> = listOf(firstEntry, secondEntry)
    override val content: @Composable (() -> Unit) = {
        Row(modifier = Modifier.fillMaxSize()) {
            Column(modifier = Modifier.weight(0.5f)) {
                firstEntry.Content()
            }
            Column(modifier = Modifier.weight(0.5f)) {
                secondEntry.Content()
            }
        }
    }

    companion object {
        /** Mark a [NavEntry] as eligible for two-pane presentation. */
        fun twoPane() = metadata {
            put(TwoPaneKey, true)
        }
    }

    object TwoPaneKey : NavMetadataKey<Boolean>
}

@Composable
fun <T : NavKey> rememberTwoPaneSceneStrategy(): TwoPaneSceneStrategy<T> {
    val windowSizeClass = currentWindowAdaptiveInfo().windowSizeClass
    return remember(windowSizeClass) {
        TwoPaneSceneStrategy(windowSizeClass)
    }
}

class TwoPaneSceneStrategy<T : NavKey>(
    private val windowSizeClass: WindowSizeClass,
) : SceneStrategy<T> {
    override fun SceneStrategyScope<T>.calculateScene(entries: List<NavEntry<T>>): Scene<T>? {
        if (!windowSizeClass.isWidthAtLeastBreakpoint(WIDTH_DP_MEDIUM_LOWER_BOUND)) {
            return null
        }

        val lastTwoEntries = entries.takeLast(2)
        return if (lastTwoEntries.size == 2 &&
            lastTwoEntries.all { it.metadata.contains(TwoPaneScene.TwoPaneKey) }
        ) {
            val firstEntry = lastTwoEntries.first()
            val secondEntry = lastTwoEntries.last()
            val sceneKey = Pair(firstEntry.contentKey, secondEntry.contentKey)
            TwoPaneScene(
                key = sceneKey,
                previousEntries = entries.dropLast(1),
                firstEntry = firstEntry,
                secondEntry = secondEntry,
            )
        } else {
            null
        }
    }
}
