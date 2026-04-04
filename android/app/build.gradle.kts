plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
    alias(libs.plugins.kotlin.ksp)
}

android {
    namespace = "net.bountynet.app"
    compileSdk = 36

    defaultConfig {
        applicationId = "net.bountynet.app"
        minSdk = 30
        targetSdk = 36
        versionCode = 1
        versionName = "0.1.0"
        // Must match a deployed `/android-auth` page (see web/src/pages/AndroidAuth.tsx). Override in debug below for local Vite.
        buildConfigField("String", "WEB_AUTH_URL", "\"https://bountynet.stare.network/android-auth\"")
        // Optional: POST JSON log batches (see net.bountynet.app.logging.RemoteShipTree). Empty = ship only to on-device file.
        buildConfigField("String", "LOG_SHIP_URL", "\"\"")
        buildConfigField("String", "LOG_SHIP_TOKEN", "\"\"")
        // Same default as `sim/agent.py` / BOUNTYNET_GATEWAY — Agent Junglegym fetch + export targets.
        buildConfigField("String", "GATEWAY_URL", "\"https://gateway.stare.network\"")
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_21
        targetCompatibility = JavaVersion.VERSION_21
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    buildTypes {
        debug {
            // Emulator → host machine Vite (web dev server). Physical device: use http://<LAN-IP>:3000/android-auth via buildConfigField or a dev flavor.
            buildConfigField("String", "WEB_AUTH_URL", "\"http://10.0.2.2:3000/android-auth\"")
            // Emulator → host gateway (override if your Flask bind differs).
            buildConfigField("String", "GATEWAY_URL", "\"http://10.0.2.2:8090\"")
        }
    }

    packaging {
        resources {
            pickFirsts += "META-INF/INDEX.LIST"
            pickFirsts += "META-INF/DEPENDENCIES"
            pickFirsts += "META-INF/io.netty.versions.properties"
            pickFirsts += "META-INF/FastDoubleParser-LICENSE"
            pickFirsts += "META-INF/FastDoubleParser-NOTICE"
        }
    }
}

dependencies {
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.core.splashscreen)
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.lifecycle.viewmodel.navigation3)
    implementation(libs.androidx.navigation3.runtime)
    implementation(libs.androidx.navigation3.ui)
    implementation(libs.androidx.adaptive.navigation3)
    implementation(libs.androidx.material3.window.size)

    implementation(libs.androidx.window)
    implementation(libs.androidx.window.core)
    implementation(libs.androidx.adaptive)
    implementation(libs.androidx.adaptive.layout)
    implementation(libs.androidx.adaptive.navigation)

    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.foundation)
    implementation(libs.androidx.compose.animation)
    implementation(libs.androidx.compose.animation.android)
    implementation(libs.androidx.compose.material3)
    implementation(libs.androidx.compose.ui.tooling.preview)
    debugImplementation(libs.androidx.compose.ui.tooling)

    implementation(libs.kotlinx.coroutines.android)
    implementation(libs.kotlinx.serialization.json)

    implementation(libs.androidx.room.runtime)
    implementation(libs.androidx.room.ktx)
    ksp(libs.androidx.room.compiler)

    implementation(libs.web3j.core)
    implementation(libs.ktor.client.core)
    implementation(libs.ktor.client.okhttp)
    implementation(libs.ktor.client.content.negotiation)
    implementation(libs.ktor.serialization.kotlinx.json)

    implementation(libs.coil.compose)
    implementation(libs.coil.network.okhttp)

    // Chrome Custom Tabs (+ partial / half-height sheets); android-browser-helper aligns with https://github.com/GoogleChrome/android-browser-helper
    implementation(libs.androidx.browser)
    implementation(libs.google.androidbrowserhelper)

    implementation(libs.timber)

    implementation(libs.chrisbanes.haze)
    implementation(libs.chrisbanes.haze.materials)
}
