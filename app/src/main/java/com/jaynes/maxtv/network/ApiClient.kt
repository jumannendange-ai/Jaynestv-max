package com.jaynes.maxtv.network

import com.jaynes.maxtv.BuildConfig
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

object ApiClient {

    private fun buildClient(): OkHttpClient {
        val logging = HttpLoggingInterceptor().apply {
            level = HttpLoggingInterceptor.Level.BASIC
        }
        return OkHttpClient.Builder()
            .addInterceptor(logging)
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(20, TimeUnit.SECONDS)
            .writeTimeout(20, TimeUnit.SECONDS)
            .build()
    }

    private fun retrofit(url: String): Retrofit =
        Retrofit.Builder()
            .baseUrl(if (url.endsWith("/")) url else "$url/")
            .client(buildClient())
            .addConverterFactory(GsonConverterFactory.create())
            .build()

    val authApi: AuthApiService by lazy {
        retrofit(BuildConfig.AUTH_API).create(AuthApiService::class.java)
    }

    val streamApi: StreamApiService by lazy {
        retrofit(BuildConfig.STREAM_API).create(StreamApiService::class.java)
    }

    val updateApi: UpdateApiService by lazy {
        retrofit(BuildConfig.UPDATE_API).create(UpdateApiService::class.java)
    }
}
