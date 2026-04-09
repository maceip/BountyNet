# BountyNet Android

## Key attestation (`:keyattestation`)

The verifier library lives in a **git submodule**: [android/keyattestation](https://github.com/android/keyattestation).

After cloning this repo:

```bash
git submodule update --init --depth 1 clients/android/third_party/keyattestation
```

The **`:app` preBuild** task runs `scripts/patch-keyattestation-gradle.py` so the submodule stays **clean in git** while Gradle still resolves the Kotlin plugin from the root `pluginManagement`.

You can also run `./scripts/android-bootstrap-keyattestation.sh` once (submodule init + patch) if you compile `:keyattestation` alone.

`settings.gradle.kts` uses `RepositoriesMode.PREFER_PROJECT` so the included library may declare `repositories { }` as upstream does.
