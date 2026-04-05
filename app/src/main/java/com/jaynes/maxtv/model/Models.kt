package com.jaynes.maxtv.model

import com.google.gson.annotations.SerializedName

// ─── AUTH ───────────────────────────────────────────────
data class LoginRequest(val email: String, val password: String)
data class RegisterRequest(val name: String, val email: String, val password: String)
data class GoogleAuthRequest(@SerializedName("id_token") val idToken: String)

data class AuthResponse(
    val token: String?,
    val user: UserModel?,
    val error: String?,
    val message: String?
)

data class UserModel(
    val id: String = "",
    val name: String = "",
    val email: String = "",
    val tier: String = "free",
    @SerializedName("user_id") val userId: String = ""
)

// ─── CHANNELS ───────────────────────────────────────────
data class ChannelsResponse(
    val channels: List<Channel>?,
    val error: String?
)

data class Channel(
    val id: String = "",
    val name: String = "",
    val category: String = "",
    val logo: String? = null,
    @SerializedName("stream_url") val streamUrl: String = "",
    @SerializedName("stream_type") val streamType: String = "HLS",
    val locked: Boolean = false,
    val drm: DrmInfo? = null,
    val headers: Map<String, String>? = null
)

data class DrmInfo(
    val type: String = "NONE",
    @SerializedName("license_url") val licenseUrl: String? = null,
    val keys: List<DrmKey>? = null
)

data class DrmKey(
    val kid: String = "",
    val key: String = ""
)

// ─── VERSION ─────────────────────────────────────────────
data class VersionResponse(
    val version: String?,
    @SerializedName("update_available") val updateAvailable: Boolean = false,
    @SerializedName("latest_version") val latestVersion: String?,
    @SerializedName("update_message") val updateMessage: String?
)

// ─── CONFIG ──────────────────────────────────────────────
data class ConfigResponse(
    @SerializedName("google_client_id") val googleClientId: String?
)

// ─── TOKEN REFRESH ───────────────────────────────────────
data class RefreshResponse(
    val token: String?,
    @SerializedName("expires_in") val expiresIn: Long?,
    val error: String?
)
