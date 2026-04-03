package net.bountynet.app.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import kotlinx.serialization.Serializable

@Serializable object Home
@Serializable object Bounties
@Serializable object Wallet

@Composable
fun MainNav() {
    val nav = rememberNavController()
    NavHost(nav, startDestination = Home) {
        composable<Home> { HomeScreen(
            onBounties = { nav.navigate(Bounties) },
            onWallet = { nav.navigate(Wallet) },
        )}
        composable<Bounties> { BountiesScreen(onBack = { nav.popBackStack() }) }
        composable<Wallet> { WalletScreen(onBack = { nav.popBackStack() }) }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(onBounties: () -> Unit, onWallet: () -> Unit) {
    Scaffold(topBar = { TopAppBar(title = { Text("BOUNTYNET", letterSpacing = 4.sp) }) }) { pad ->
        Column(Modifier.fillMaxSize().padding(pad).padding(24.dp), verticalArrangement = Arrangement.Center, horizontalAlignment = Alignment.CenterHorizontally) {
            Text("be", style = MaterialTheme.typography.displayLarge)
            Spacer(Modifier.height(8.dp))
            Text("a prover network", style = MaterialTheme.typography.bodyLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Spacer(Modifier.height(32.dp))
            Button(onClick = onBounties) { Text("BOUNTIES") }
            Spacer(Modifier.height(12.dp))
            OutlinedButton(onClick = onWallet) { Text("WALLET") }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BountiesScreen(onBack: () -> Unit) {
    Scaffold(topBar = { TopAppBar(title = { Text("BOUNTIES", letterSpacing = 3.sp) }, navigationIcon = { IconButton(onClick = onBack) { Text("<") } }) }) { pad ->
        Column(Modifier.fillMaxSize().padding(pad).padding(24.dp)) {
            Text("Active bounties", style = MaterialTheme.typography.titleMedium)
            Spacer(Modifier.height(16.dp))
            Text("No active bounties yet", color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WalletScreen(onBack: () -> Unit) {
    Scaffold(topBar = { TopAppBar(title = { Text("WALLET", letterSpacing = 3.sp) }, navigationIcon = { IconButton(onClick = onBack) { Text("<") } }) }) { pad ->
        Column(Modifier.fillMaxSize().padding(pad).padding(24.dp)) {
            Text("EURC Balance", style = MaterialTheme.typography.labelMedium, letterSpacing = 2.sp)
            Text("—", style = MaterialTheme.typography.displaySmall)
            Spacer(Modifier.height(24.dp))
            Text("Agent ID", style = MaterialTheme.typography.labelMedium, letterSpacing = 2.sp)
            Text("not registered", style = MaterialTheme.typography.bodyLarge)
        }
    }
}
