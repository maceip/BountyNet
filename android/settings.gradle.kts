pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
    plugins {
        id("org.jetbrains.kotlin.jvm") version "2.3.0"
    }
}
dependencyResolutionManagement {
    // PREFER_PROJECT: included builds (android/keyattestation) declare their own repositories.
    repositoriesMode.set(RepositoriesMode.PREFER_PROJECT)
    repositories {
        google()
        mavenCentral()
    }
}
rootProject.name = "bountynet"
include(":app")
include(":keyattestation")
project(":keyattestation").projectDir = file("third_party/keyattestation")
