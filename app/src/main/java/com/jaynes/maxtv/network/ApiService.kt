package com.jaynes.maxtv.network

import com.jaynes.maxtv.model.*
import retrofit2.Response
import retrofit2.http.*

interface AuthApiService {
    @POST("auth/login")
    suspend fun login(@Body request: LoginRequest): Response<AuthResponse>

    @POST("auth/register")
    suspend fun register(@Body request: RegisterRequest): Response<AuthResponse>

    @POST("auth/google")
    suspend fun googleAuth(@Body request: GoogleAuthRequest): Response<AuthResponse>

    @GET("config")
    suspend fun getConfig(): Response<ConfigResponse>

    @POST("auth/refresh")
    suspend fun refreshToken(@Header("Authorization") token: String): Response<RefreshResponse>
}

interface StreamApiService {
    @GET("channels")
    suspend fun getChannels(@Header("Authorization") token: String): Response<ChannelsResponse>
}

interface UpdateApiService {
    @GET("version")
    suspend fun getVersion(): Response<VersionResponse>
}
