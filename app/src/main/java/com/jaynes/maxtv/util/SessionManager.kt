package com.jaynes.maxtv.util

import android.content.Context
import android.content.SharedPreferences
import com.google.gson.Gson
import com.jaynes.maxtv.model.UserModel

class SessionManager(context: Context) {

    private val prefs: SharedPreferences =
        context.getSharedPreferences("jmtv_prefs", Context.MODE_PRIVATE)
    private val gson = Gson()

    companion object {
        const val KEY_TOKEN   = "jmtv_token"
        const val KEY_USER    = "jmtv_user"
        const val KEY_TOK_EXP = "jmtv_tokexp"
    }

    fun saveSession(token: String, user: UserModel, expiresAt: Long) {
        prefs.edit()
            .putString(KEY_TOKEN, token)
            .putString(KEY_USER, gson.toJson(user))
            .putString("user_id", user.id)
            .putLong(KEY_TOK_EXP, expiresAt)
            .apply()
    }

    fun getToken(): String? = prefs.getString(KEY_TOKEN, null)
    fun getUserId(): String? = prefs.getString("user_id", null)

    fun getUser(): UserModel? {
        val json = prefs.getString(KEY_USER, null) ?: return null
        return try { gson.fromJson(json, UserModel::class.java) } catch (e: Exception) { null }
    }

    fun isSessionValid(): Boolean {
        val token = getToken()
        val exp   = prefs.getLong(KEY_TOK_EXP, 0L)
        return !token.isNullOrEmpty() && System.currentTimeMillis() < exp
    }

    fun clearSession() {
        prefs.edit().clear().apply()
    }

    fun updateToken(token: String, expiresAt: Long) {
        prefs.edit()
            .putString(KEY_TOKEN, token)
            .putLong(KEY_TOK_EXP, expiresAt)
            .apply()
    }
}
