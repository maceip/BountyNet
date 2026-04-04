package net.bountynet.app.ui.screens

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.SharedTransitionLayout
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalInspectionMode
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation3.runtime.NavKey
import androidx.navigation3.runtime.entryProvider
import androidx.navigation3.runtime.rememberNavBackStack
import androidx.navigation3.ui.NavDisplay
import kotlinx.serialization.Serializable
import net.bountynet.app.BountyNetApp
import net.bountynet.app.BuildConfig
import net.bountynet.app.auth.PartialCustomTabLogin
import net.bountynet.app.auth.SessionStore
import net.bountynet.app.ui.expressive.ExpressiveHeroSlideshow
import net.bountynet.app.junglegym.JungleGymScreen
import net.bountynet.app.ui.nav.TwoPaneScene
import net.bountynet.app.ui.nav.rememberTwoPaneSceneStrategy
import coil3.compose.AsyncImage
import dev.chrisbanes.haze.ExperimentalHazeApi
import dev.chrisbanes.haze.HazeInputScale
import dev.chrisbanes.haze.hazeEffect
import dev.chrisbanes.haze.hazeSource
import dev.chrisbanes.haze.materials.ExperimentalHazeMaterialsApi
import dev.chrisbanes.haze.materials.HazeMaterials
import dev.chrisbanes.haze.rememberHazeState

@Serializable
sealed interface AppRoute : NavKey {
    @Serializable
    data object Home : AppRoute

    @Serializable
    data object Bounties : AppRoute

    @Serializable
    data object Wallet : AppRoute

    @Serializable
    data object JungleGym : AppRoute
}

@Composable
fun MainNav(
    sessionJwt: String?,
    onSessionJwtChange: (String?) -> Unit,
) {
    val context = LocalContext.current
    val appCtx = context.applicationContext

    val loginSheetLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.StartActivityForResult(),
    ) { /* OAuth completion returns via bountynet:// deep link; no result data required */ }

    val onLoginWithAuthTab: () -> Unit = {
        val intent = PartialCustomTabLogin.intentForHalfHeightWebLogin(context, BuildConfig.WEB_AUTH_URL)
        loginSheetLauncher.launch(intent)
    }

    val onLogout = {
        SessionStore.setJwt(appCtx, null)
        onSessionJwtChange(null)
    }

    SharedTransitionLayout {
        val backStack = rememberNavBackStack(AppRoute.Home)
        val twoPaneStrategy = rememberTwoPaneSceneStrategy<NavKey>()
        NavDisplay(
            backStack = backStack,
            onBack = { backStack.removeLastOrNull() },
            sceneStrategies = listOf(twoPaneStrategy),
            sharedTransitionScope = this,
            entryProvider = entryProvider {
                entry<AppRoute.Home>(
                    metadata = TwoPaneScene.twoPane(),
                ) {
                    HomeScreen(
                        sessionJwt = sessionJwt,
                        onLoginWithAuthTab = onLoginWithAuthTab,
                        onLogout = onLogout,
                        onBounties = { backStack.add(AppRoute.Bounties) },
                        onWallet = { backStack.add(AppRoute.Wallet) },
                        onJungleGym = { backStack.add(AppRoute.JungleGym) },
                    )
                }
                entry<AppRoute.Bounties>(
                    metadata = TwoPaneScene.twoPane(),
                ) {
                    BountiesScreen(onBack = { backStack.removeLastOrNull() })
                }
                entry<AppRoute.Wallet> {
                    WalletScreen(
                        sessionJwt = sessionJwt,
                        onBack = { backStack.removeLastOrNull() },
                    )
                }
                entry<AppRoute.JungleGym>(
                    metadata = TwoPaneScene.twoPane(),
                ) {
                    JungleGymScreen(onBack = { backStack.removeLastOrNull() })
                }
            },
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    sessionJwt: String?,
    onLoginWithAuthTab: () -> Unit,
    onLogout: () -> Unit,
    onBounties: () -> Unit,
    onWallet: () -> Unit,
    onJungleGym: () -> Unit,
) {
    Scaffold(topBar = { TopAppBar(title = { Text("BOUNTYNET", letterSpacing = 4.sp) }) }) { pad ->
        Column(
            Modifier
                .fillMaxSize()
                .padding(pad)
                .padding(horizontal = 24.dp),
        ) {
            ExpressiveHeroSlideshow(Modifier.padding(top = 8.dp, bottom = 20.dp))
            Column(
                Modifier
                    .weight(1f)
                    .fillMaxWidth(),
                verticalArrangement = Arrangement.Center,
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Text("be", style = MaterialTheme.typography.displayLarge)
                Spacer(Modifier.height(8.dp))
                Text("a prover network", style = MaterialTheme.typography.bodyLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Spacer(Modifier.height(24.dp))
                if (sessionJwt == null) {
                    Text(
                        "Sign in opens a half-height Chrome sheet (partial Custom Tab + Auth Tab styling). Same Dynamic login as the site; you return to the app when done.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(horizontal = 8.dp),
                    )
                    Spacer(Modifier.height(12.dp))
                    Button(onClick = onLoginWithAuthTab) { Text("SIGN IN") }
                } else {
                    Text(
                        "Signed in (demo session)",
                        style = MaterialTheme.typography.labelLarge,
                        color = MaterialTheme.colorScheme.primary,
                    )
                    Spacer(Modifier.height(8.dp))
                    TextButton(onClick = onLogout) { Text("Sign out") }
                    Spacer(Modifier.height(16.dp))
                }
                Spacer(Modifier.height(16.dp))
                Button(onClick = onBounties) { Text("BOUNTIES") }
                Spacer(Modifier.height(12.dp))
                OutlinedButton(onClick = onJungleGym) { Text("AGENT JUNGLEGYM") }
                Spacer(Modifier.height(12.dp))
                OutlinedButton(onClick = onWallet) { Text("WALLET") }
            }
        }
    }
}

@OptIn(
    ExperimentalMaterial3Api::class,
    ExperimentalFoundationApi::class,
    ExperimentalHazeApi::class,
    ExperimentalHazeMaterialsApi::class,
)
@Composable
fun BountiesScreen(onBack: () -> Unit) {
    val context = LocalContext.current
    val dao = remember(context) { (context.applicationContext as BountyNetApp).database.bountyDao() }
    val cached by dao.observeAll().collectAsStateWithLifecycle(initialValue = emptyList())

    val hazeState = rememberHazeState()
    val listState = rememberLazyListState()
    val blurEnabled = !LocalInspectionMode.current
    val style = HazeMaterials.regular(MaterialTheme.colorScheme.surface)

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("BOUNTIES", letterSpacing = 3.sp) },
                navigationIcon = {
                    IconButton(onClick = onBack) { Text("<") }
                },
            )
        },
    ) { contentPadding ->
        LazyColumn(
            state = listState,
            modifier = Modifier
                .padding(contentPadding)
                .fillMaxSize(),
        ) {
            item {
                Column(Modifier.padding(horizontal = 24.dp, vertical = 16.dp)) {
                    Text("Active bounties", style = MaterialTheme.typography.titleMedium)
                    Spacer(Modifier.height(8.dp))
                    Text(
                        "Cached rows (Room): ${cached.size}",
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    if (cached.isEmpty()) {
                        Spacer(Modifier.height(8.dp))
                        Text(
                            "No active bounties yet",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }

            val groupSize = 6
            repeat(5) { group ->
                stickyHeader {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .hazeEffect(state = hazeState, style = style) {
                                inputScale = HazeInputScale.Auto
                                this.blurEnabled = blurEnabled
                            },
                    ) {
                        Text(
                            "Header: $group",
                            modifier = Modifier.padding(16.dp),
                            style = MaterialTheme.typography.titleSmall,
                        )
                    }
                }
                items(groupSize) { index ->
                    Box(
                        modifier = Modifier
                            .hazeSource(state = hazeState)
                            .fillParentMaxWidth(),
                    ) {
                        AsyncImage(
                            model = bountiesSampleImageUrl((group * groupSize) + index),
                            contentScale = ContentScale.Crop,
                            contentDescription = null,
                            modifier = Modifier
                                .height(128.dp)
                                .fillMaxWidth(),
                        )
                    }
                }
            }
        }
    }
}

private fun bountiesSampleImageUrl(seed: Int): String =
    "https://picsum.photos/seed/bountynet-$seed/800/256"

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WalletScreen(
    sessionJwt: String?,
    onBack: () -> Unit,
) {
    Scaffold(topBar = { TopAppBar(title = { Text("WALLET", letterSpacing = 3.sp) }, navigationIcon = { IconButton(onClick = onBack) { Text("<") } }) }) { pad ->
        Column(Modifier.fillMaxSize().padding(pad).padding(24.dp)) {
            Text("EURC Balance", style = MaterialTheme.typography.labelMedium, letterSpacing = 2.sp)
            Text("—", style = MaterialTheme.typography.displaySmall)
            Spacer(Modifier.height(24.dp))
            Text("Gateway session", style = MaterialTheme.typography.labelMedium, letterSpacing = 2.sp)
            if (sessionJwt.isNullOrEmpty()) {
                Text("Not signed in", style = MaterialTheme.typography.bodyLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
            } else {
                val preview =
                    if (sessionJwt.length <= 24) "(stored)"
                    else "${sessionJwt.take(8)}…${sessionJwt.takeLast(8)}"
                Text(
                    "Dynamic JWT (demo): $preview",
                    style = MaterialTheme.typography.bodyMedium,
                )
            }
            Spacer(Modifier.height(24.dp))
            Text("Agent ID", style = MaterialTheme.typography.labelMedium, letterSpacing = 2.sp)
            Text("not registered", style = MaterialTheme.typography.bodyLarge)
        }
    }
}
