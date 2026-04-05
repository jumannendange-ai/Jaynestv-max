package com.jaynes.maxtv.util

import android.content.Context
import android.view.View
import android.widget.Toast
import androidx.core.view.isVisible
import com.google.android.material.snackbar.Snackbar

fun View.show() { isVisible = true }
fun View.hide() { isVisible = false }
fun View.gone() { visibility = View.GONE }

fun Context.toast(msg: String) =
    Toast.makeText(this, msg, Toast.LENGTH_SHORT).show()

fun View.snack(msg: String, duration: Int = Snackbar.LENGTH_SHORT) =
    Snackbar.make(this, msg, duration).show()

fun formatTokenCountdown(remainMs: Long): String {
    val s = (remainMs / 1000).coerceAtLeast(0)
    val m = s / 60
    val sec = s % 60
    return if (m > 0) "${m}m ${sec}s" else "${sec}s"
}

fun bearerToken(token: String) = "Bearer $token"

fun categoryLabel(cat: String): String = when (cat.lowercase()) {
    "sports"        -> "⚽ MICHEZO"
    "news"          -> "📰 HABARI"
    "entertainment" -> "🎬 BURUDANI"
    "kids"          -> "👶 WATOTO"
    "music"         -> "🎵 MUZIKI"
    "religious"     -> "🙏 DINI"
    "documentary"   -> "🌍 DOCUMENTARY"
    else            -> cat.uppercase()
}
