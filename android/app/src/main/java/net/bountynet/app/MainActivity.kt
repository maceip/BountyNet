package net.bountynet.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import net.bountynet.app.ui.theme.BountyNetTheme
import net.bountynet.app.ui.screens.MainNav

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            BountyNetTheme {
                MainNav()
            }
        }
    }
}
