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
    @GET("channels")
    suspend fun getChannels(@Header("Authorization") token: String): Response<ChannelsResponse>
}

interface UpdateApiService {
    @GET("version")
    suspend fun checkUpdate(): Response<UpdateResponse>
}
