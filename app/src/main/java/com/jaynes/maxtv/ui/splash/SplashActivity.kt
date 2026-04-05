package com.jaynes.maxtv.ui.splash

import android.annotation.SuppressLint
import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import androidx.appcompat.app.AppCompatActivity
import com.jaynes.maxtv.databinding.ActivitySplashBinding
import com.jaynes.maxtv.ui.auth.AuthActivity
import com.jaynes.maxtv.ui.home.HomeActivity
import com.jaynes.maxtv.util.SessionManager

@SuppressLint("CustomSplashScreen")
class SplashActivity : AppCompatActivity() {
    private lateinit var binding: ActivitySplashBinding
    private lateinit var session: SessionManager

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivitySplashBinding.inflate(layoutInflater)
        setContentView(binding.root)
        session = SessionManager(this)
        Handler(Looper.getMainLooper()).postDelayed({ navigateNext() }, 2000)
    }

    private fun navigateNext() {
        val target = if (session.isSessionValid()) HomeActivity::class.java else AuthActivity::class.java
        startActivity(Intent(this, target))
        overridePendingTransition(android.R.anim.fade_in, android.R.anim.fade_out)
        finish()
    }
}
