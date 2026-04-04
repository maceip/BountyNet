package net.bountynet.app.ui.screens

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.SharedTransitionLayout
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
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
import androidx.compose.ui.platform.LocalContext
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
import net.bountynet.app.ui.nav.TwoPaneScene
import net.bountynet.app.ui.nav.rememberTwoPaneSceneStrategy

@Serializable
sealed interface AppRoute : NavKey {
    @Serializable
    data object Home : AppRoute

    @Serializable
    data object Bounties : AppRoute

    @Serializable
    data object Wallet : AppRoute
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
                OutlinedButton(onClick = onWallet) { Text("WALLET") }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BountiesScreen(onBack: () -> Unit) {
    val context = LocalContext.current
    val dao = remember(context) { (context.applicationContext as BountyNetApp).database.bountyDao() }
    val cached by dao.observeAll().collectAsStateWithLifecycle(initialValue = emptyList())

    Scaffold(topBar = { TopAppBar(title = { Text("BOUNTIES", letterSpacing = 3.sp) }, navigationIcon = { IconButton(onClick = onBack) { Text("<") } }) }) { pad ->
        Column(Modifier.fillMaxSize().padding(pad).padding(24.dp)) {
            Text("Active bounties", style = MaterialTheme.typography.titleMedium)
            Spacer(Modifier.height(8.dp))
            Text(
                "Cached rows (Room): ${cached.size}",
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(Modifier.height(16.dp))
            Text("No active bounties yet", color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

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
