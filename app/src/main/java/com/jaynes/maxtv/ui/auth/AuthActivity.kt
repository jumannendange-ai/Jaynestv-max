package com.jaynes.maxtv.ui.auth

import android.content.Intent
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.jaynes.maxtv.databinding.ActivityAuthBinding
import com.jaynes.maxtv.model.*
import com.jaynes.maxtv.network.ApiClient
import com.jaynes.maxtv.ui.home.HomeActivity
import com.jaynes.maxtv.util.SessionManager
import com.jaynes.maxtv.util.hide
import com.jaynes.maxtv.util.show
import com.jaynes.maxtv.util.toast
import kotlinx.coroutines.launch
import retrofit2.HttpException
import java.io.IOException

class AuthActivity : AppCompatActivity() {

    private lateinit var binding: ActivityAuthBinding
    private lateinit var session: SessionManager
    private var isLoginTab = true

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityAuthBinding.inflate(layoutInflater)
        setContentView(binding.root)
        session = SessionManager(this)
        setupTabs()
        setupClicks()
    }

    private fun setupTabs() {
        binding.btnTabLogin.setOnClickListener { switchToLogin() }
        binding.btnTabRegister.setOnClickListener { switchToRegister() }
        switchToLogin()
    }

    private fun switchToLogin() {
        isLoginTab = true
        binding.btnTabLogin.alpha = 1f
        binding.btnTabRegister.alpha = 0.5f
        binding.layoutLogin.show()
        binding.layoutRegister.hide()
        binding.tvError.hide()
    }

    private fun switchToRegister() {
        isLoginTab = false
        binding.btnTabLogin.alpha = 0.5f
        binding.btnTabRegister.alpha = 1f
        binding.layoutLogin.hide()
        binding.layoutRegister.show()
        binding.tvError.hide()
    }

    private fun setupClicks() {
        binding.btnLogin.setOnClickListener { doLogin() }
        binding.btnRegister.setOnClickListener { doRegister() }
    }

    private fun doLogin() {
        val email = binding.etLoginEmail.text.toString().trim()
        val pass  = binding.etLoginPass.text.toString()
        if (email.isEmpty() || pass.isEmpty()) {
            showError("Jaza barua pepe na nywila"); return
        }
        setLoading(true)
        lifecycleScope.launch {
            try {
                val r = ApiClient.authApi.login(LoginRequest(email, pass))
                if (r.isSuccessful && r.body()?.success == true) {
                    onSuccess(r.body()!!)
                } else {
                    showError(r.body()?.error ?: r.body()?.message ?: "Kosa ${r.code()}")
                }
            } catch (e: IOException)  { showError("Hakuna mtandao") }
              catch (e: HttpException) { showError("Kosa la seva: ${e.code()}") }
              catch (e: Exception)     { showError(e.message ?: "Hitilafu") }
            finally { setLoading(false) }
        }
    }

    private fun doRegister() {
        val name  = binding.etRegName.text.toString().trim()
        val email = binding.etRegEmail.text.toString().trim()
        val pass  = binding.etRegPass.text.toString()
        if (name.isEmpty() || email.isEmpty() || pass.isEmpty()) {
            showError("Jaza sehemu zote"); return
        }
        if (pass.length < 6) { showError("Nywila iwe angalau herufi 6"); return }
        setLoading(true)
        lifecycleScope.launch {
            try {
                val r = ApiClient.authApi.register(RegisterRequest(name, email, pass))
                if (r.isSuccessful && r.body()?.success == true) {
                    onSuccess(r.body()!!)
                } else {
                    showError(r.body()?.error ?: r.body()?.message ?: "Kosa ${r.code()}")
                }
            } catch (e: IOException) { showError("Hakuna mtandao") }
              catch (e: Exception)   { showError(e.message ?: "Hitilafu") }
            finally { setLoading(false) }
        }
    }

    private fun onSuccess(auth: AuthResponse) {
        val user = auth.user ?: UserModel(name = "User", email = "")
        lifecycleScope.launch {
            try {
                val uid = user.id ?: "session_${System.currentTimeMillis()}"
                val r = ApiClient.streamApi.getStreamToken(StreamTokenRequest(uid))
                val tokenData = r.body()
                val token = tokenData?.token ?: uid
                val exp = System.currentTimeMillis() + (tokenData?.expires_in ?: 3600) * 1000L
                session.saveSession(token, user, exp)
            } catch (e: Exception) {
                val token = user.id ?: "session_${System.currentTimeMillis()}"
                val exp = System.currentTimeMillis() + 24 * 3600 * 1000L
                session.saveSession(token, user, exp)
            }
            startActivity(Intent(this@AuthActivity, HomeActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
            })
            finish()
        }
    }

    private fun showError(msg: String) {
        binding.tvError.text = msg
        binding.tvError.show()
    }

    private fun setLoading(on: Boolean) {
        binding.btnLogin.isEnabled    = !on
        binding.btnRegister.isEnabled = !on
        binding.progressAuth.visibility = if (on) android.view.View.VISIBLE else android.view.View.GONE
    }
}
