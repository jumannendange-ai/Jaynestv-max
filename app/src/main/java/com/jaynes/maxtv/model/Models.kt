package com.jaynes.maxtv.model

import com.google.gson.annotations.SerializedName

data class UserModel(
    val id: String? = null,
    val name: String = "",
    val email: String = "",
    val plan: String = "free"
)

data class LoginRequest(val email: String, val password: String)
data class RegisterRequest(val name: String, val email: String, val password: String)

data class AuthResponse(
    val success: Boolean = false,
    val token: String? = null,
    val user: UserModel? = null,
    val error: String? = null,
    val message: String? = null,
    @com.google.gson.annotations.SerializedName("has_subscription")
    val hasSubscription: Boolean = false
)

data class Channel(
    val id: String = "",
    val name: String = "",
    @SerializedName("logo_url") val logoUrl: String = "",
    @SerializedName("stream_url") val streamUrl: String = "",
    @SerializedName("stream_type") val streamType: String = "HLS",
    @SerializedName("drm_type") val drmType: String = "NONE",
    @SerializedName("drm_license") val drmLicense: String = "",
    val category: String = "General",
    val premium: Boolean = false,
    val active: Boolean = true
)

data class ChannelsResponse(
    val channels: List<Channel>? = null,
    val error: String? = null
)

data class UpdateResponse(
    @SerializedName("latest_version") val latestVersion: String? = null,
    @SerializedName("min_version") val minVersion: String? = null,
    @SerializedName("download_url") val downloadUrl: String? = null,
    val message: String? = null,
    val force: Boolean = false
)
