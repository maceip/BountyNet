package net.bountynet.app.ui.expressive

import androidx.compose.animation.Crossfade
import androidx.compose.animation.core.tween
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import coil3.request.ImageRequest
import coil3.request.crossfade
import kotlinx.coroutines.delay
import net.bountynet.app.R

private val slideDrawables = listOf(
    R.drawable.bn_expressive_print_1,
    R.drawable.bn_expressive_print_2,
    R.drawable.bn_expressive_print_3,
    R.drawable.bn_expressive_print_4,
    R.drawable.bn_expressive_print_5,
)

/**
 * Local artwork carousel: Coil [AsyncImage] + Compose [Crossfade], similar to Androidify’s
 * image-heavy motion surfaces (crossfade, rounded cards).
 */
@Composable
fun ExpressiveHeroSlideshow(modifier: Modifier = Modifier) {
    val context = LocalContext.current
    var index by remember { mutableIntStateOf(0) }

    LaunchedEffect(slideDrawables.size) {
        if (slideDrawables.size <= 1) return@LaunchedEffect
        while (true) {
            delay(4_500)
            index = (index + 1) % slideDrawables.size
        }
    }

    val shape = RoundedCornerShape(28.dp)
    Surface(
        modifier = modifier.fillMaxWidth(),
        shape = shape,
        color = MaterialTheme.colorScheme.surfaceContainerHigh,
        tonalElevation = 2.dp,
        shadowElevation = 0.dp,
    ) {
        Crossfade(
            targetState = index,
            animationSpec = tween(durationMillis = 520),
            label = "expressive_hero",
        ) { i ->
            AsyncImage(
                model = ImageRequest.Builder(context)
                    .data(slideDrawables[i])
                    .crossfade(420)
                    .build(),
                contentDescription = "BountyNet artwork ${i + 1} of ${slideDrawables.size}",
                contentScale = ContentScale.Crop,
                modifier = Modifier
                    .fillMaxWidth()
                    .aspectRatio(4f / 5f)
                    .clip(shape),
            )
        }
    }
}
