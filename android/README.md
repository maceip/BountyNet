# BountyNet Android

**Kotlin + Jetpack Compose** · `minSdk 30` · `compileSdk 36` · Material 3 · Navigation 3 (two-pane on wide screens).

## Build

```bash
cd android
./gradlew :app:assembleDebug
```

APK: `app/build/outputs/apk/debug/app-debug.apk`

Debug builds point **`WEB_AUTH_URL`** at `http://10.0.2.2:3000/android-auth` (emulator → host Vite). Run **web** or **webv2** on port **3000** for local auth, or install a release-style build with the default `https://bountynet.stare.network/android-auth`.

## Emulator screenshots

1. Install a system image (API **30+**), e.g. via Android Studio SDK Manager or `sdkmanager "system-images;android-34;google_apis;x86_64"`.
2. Create an AVD (Pixel 6 + foldable optional for two-pane testing).
3. `emulator -avd <name> &` then:

```bash
adb install -r app/build/outputs/apk/debug/app-debug.apk
adb exec-out screencap -p > screenshot.png
```

On this machine, existing AVDs failed with **missing system image** — recreate AVDs after installing the image.

## Layout

- `app/src/main/java/net/bountynet/app/` — Compose UI, nav, Arc/web3, logging.
- `build.gradle.kts` — `GATEWAY_URL`, `WEB_AUTH_URL`, optional log shipping.
