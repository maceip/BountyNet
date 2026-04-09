package net.bountynet.app.auth

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.browser.auth.AuthTabIntent
import androidx.browser.customtabs.CustomTabColorSchemeParams
import androidx.browser.customtabs.CustomTabsIntent
import com.google.androidbrowserhelper.trusted.TwaProviderPicker

/**
 * Partial Chrome Custom Tab for auth, opened at **half the current display height** (the minimum
 * Chrome allows for bottom-sheet partial tabs).
 *
 * Per Chrome, partial height is honored when the tab is started via
 * [Activity.startActivityForResult] / [androidx.activity.result] — not always when using
 * [CustomTabsIntent.launchUrl] alone. Prefer [intentForHalfHeightWebLogin] + an
 * `ActivityResultLauncher<Intent>`.
 *
 * @see <a href="https://developer.chrome.com/docs/android/custom-tabs/guide-partial-custom-tabs">Partial Custom Tabs</a>
 */
object PartialCustomTabLogin {

    /** Exactly **50%** of [android.util.DisplayMetrics.heightPixels] (Chrome clamps to this minimum anyway). */
    fun intentForHalfHeightWebLogin(context: Context, url: String): Intent {
        val dm = context.resources.displayMetrics
        val halfHeightPx = dm.heightPixels / 2

        val pick = TwaProviderPicker.pickProvider(context.packageManager)

        val builder = CustomTabsIntent.Builder()
            .setDefaultColorSchemeParams(CustomTabColorSchemeParams.Builder().build())
            .setShowTitle(true)
            .setCloseButtonPosition(CustomTabsIntent.CLOSE_BUTTON_POSITION_END)
            .setToolbarCornerRadiusDp(16)
            .setInitialActivityHeightPx(halfHeightPx, CustomTabsIntent.ACTIVITY_HEIGHT_ADJUSTABLE)
            .setActivitySideSheetBreakpointDp(600)
            .setBackgroundInteractionEnabled(true)

        val tabs = builder.build()
        tabs.intent.putExtra(AuthTabIntent.EXTRA_LAUNCH_AUTH_TAB, true)

        when (pick.launchMode) {
            TwaProviderPicker.LaunchMode.BROWSER -> { }
            else -> pick.provider?.let { tabs.intent.setPackage(it) }
        }

        return tabs.intent.apply {
            data = Uri.parse(url)
        }
    }

    /** Fallback when you cannot use an activity-result launcher (may be **full height** on some Chrome versions). */
    fun launchWebLogin(context: Context, url: String) {
        CustomTabsIntent.Builder()
            .setDefaultColorSchemeParams(CustomTabColorSchemeParams.Builder().build())
            .setShowTitle(true)
            .setCloseButtonPosition(CustomTabsIntent.CLOSE_BUTTON_POSITION_END)
            .setToolbarCornerRadiusDp(16)
            .setInitialActivityHeightPx(
                context.resources.displayMetrics.heightPixels / 2,
                CustomTabsIntent.ACTIVITY_HEIGHT_ADJUSTABLE,
            )
            .setActivitySideSheetBreakpointDp(600)
            .setBackgroundInteractionEnabled(true)
            .build()
            .also {
                it.intent.putExtra(AuthTabIntent.EXTRA_LAUNCH_AUTH_TAB, true)
                val pick = TwaProviderPicker.pickProvider(context.packageManager)
                when (pick.launchMode) {
                    TwaProviderPicker.LaunchMode.BROWSER -> { }
                    else -> pick.provider?.let { pkg -> it.intent.setPackage(pkg) }
                }
                it.launchUrl(context, Uri.parse(url))
            }
    }
}
