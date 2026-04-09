package net.bountynet.app

import android.app.Application
import net.bountynet.app.data.local.BountyNetDatabase
import net.bountynet.app.helios.HeliosRuntime
import net.bountynet.app.logging.BountyNetLogging

class BountyNetApp : Application() {
    val database: BountyNetDatabase by lazy { BountyNetDatabase.build(this) }
    val heliosRuntime: HeliosRuntime by lazy { HeliosRuntime(this) }

    override fun onCreate() {
        super.onCreate()
        BountyNetLogging.install(this)
    }
}
