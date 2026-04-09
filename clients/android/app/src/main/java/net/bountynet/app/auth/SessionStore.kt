package net.bountynet.app.auth

import android.content.Context
import androidx.core.content.edit

object SessionStore {
    private const val PREFS = "bountynet_auth"
    private const val KEY_JWT = "dynamic_jwt"

    fun jwt(appContext: Context): String? =
        appContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_JWT, null)

    fun setJwt(appContext: Context, value: String?) {
        appContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit {
            if (value == null) remove(KEY_JWT) else putString(KEY_JWT, value)
        }
    }
}
