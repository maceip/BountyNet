package net.bountynet.app

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.MutableState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import dev.chrisbanes.haze.hazeSource
import dev.chrisbanes.haze.rememberHazeState
import net.bountynet.app.auth.SessionStore
import net.bountynet.app.ui.chrome.LiquidGlassEdgeVignette
import net.bountynet.app.ui.helios.HeliosIslandOverlay
import net.bountynet.app.ui.screens.MainNav
import net.bountynet.app.ui.theme.BountyNetTheme

class MainActivity : ComponentActivity() {

    private lateinit var sessionJwtState: MutableState<String?>

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        sessionJwtState = mutableStateOf(SessionStore.jwt(applicationContext))
        applyAuthFromIntent(intent)

        enableEdgeToEdge()
        setContent {
            val sessionJwt by sessionJwtState
            BountyNetTheme {
                val hazeState = rememberHazeState()
                Box(Modifier.fillMaxSize()) {
                    Box(
                        Modifier
                            .fillMaxSize()
                            .hazeSource(state = hazeState),
                    ) {
                        MainNav(
                            sessionJwt = sessionJwt,
                            onSessionJwtChange = { sessionJwtState.value = it },
                        )
                    }
                    LiquidGlassEdgeVignette(hazeState = hazeState)
                    HeliosIslandOverlay(Modifier.align(Alignment.TopCenter))
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        applyAuthFromIntent(intent)
    }

    private fun applyAuthFromIntent(intent: Intent?) {
        val uri = intent?.data ?: return
        if (uri.scheme != AUTH_REDIRECT_SCHEME || uri.host != AUTH_REDIRECT_HOST) return
        val token = uri.getQueryParameter(AUTH_QUERY_PARAM) ?: return
        SessionStore.setJwt(applicationContext, token)
        if (::sessionJwtState.isInitialized) {
            sessionJwtState.value = token
        }
    }

    companion object {
        /** Must match AuthTabIntent.launch(..., redirectScheme) and the web redirect (AndroidAuth.tsx). */
        const val AUTH_REDIRECT_SCHEME = "bountynet"
        const val AUTH_REDIRECT_HOST = "auth"
        const val AUTH_QUERY_PARAM = "authorization"
    }
}
