package com.jaynes.maxtv.network

import com.jaynes.maxtv.model.*
import retrofit2.Response
import retrofit2.http.*

interface AuthApiService {
    @POST("auth/login")
    suspend fun login(@Body req: LoginRequest): Response<AuthResponse>

    @POST("auth/register")
    suspend fun register(@Body req: RegisterRequest): Response<AuthResponse>

    @GET("auth/verify")
    suspend fun verifyToken(@Header("Authorization") token: String): Response<AuthResponse>
}

interface StreamApiService {
    @POST("auth/token")
    suspend fun getStreamToken(@Body body: StreamTokenRequest): Response<StreamTokenResponse>
    @GET("channels")
    suspend fun getChannels(@Query("user_id") userId: String, @Query("token") token: String): Response<ChannelsResponse>
}

interface UpdateApiService {
    @GET("version")
    suspend fun checkUpdate(): Response<UpdateResponse>
}

data class StreamTokenRequest(val user_id: String)
data class StreamTokenResponse(val token: String, val expires_in: Int = 3600, val tier: String? = null)
