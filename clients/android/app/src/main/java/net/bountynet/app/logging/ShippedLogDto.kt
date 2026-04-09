package net.bountynet.app.logging

import kotlinx.serialization.Serializable

@Serializable
internal data class ShippedLogBatch(
    val ts: Long,
    val deviceModel: String,
    val androidSdk: Int,
    val appId: String,
    val appVersion: String,
    /** Discriminator for shared gateway ingest (`POST /logs/android`). */
    val source: String = "android",
    val entries: List<ShippedLogEntry>,
)

@Serializable
internal data class ShippedLogEntry(
    val ts: Long,
    val level: String,
    val tag: String?,
    val message: String,
    val stack: String? = null,
)
