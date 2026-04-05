package com.jaynes.maxtv.ui.auth

import android.content.Intent
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.google.android.gms.auth.api.signin.*
import com.google.android.gms.common.api.ApiException
import com.jaynes.maxtv.R
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
    private var googleSignInClient: GoogleSignInClient? = null
    private var isLoginTab = true

    companion object {
        private const val RC_SIGN_IN = 9001
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityAuthBinding.inflate(layoutInflater)
        setContentView(binding.root)
        session = SessionManager(this)

        setupTabs()
        setupClickListeners()
        initGoogleSignIn()
    }

    private fun setupTabs() {
        binding.btnTabLogin.setOnClickListener { switchToLogin() }
        binding.btnTabRegister.setOnClickListener { switchToRegister() }
    }

    private fun switchToLogin() {
        isLoginTab = true
        binding.btnTabLogin.isSelected = true
        binding.btnTabRegister.isSelected = false
        binding.layoutLogin.show()
        binding.layoutRegister.hide()
    }

    private fun switchToRegister() {
        isLoginTab = false
        binding.btnTabLogin.isSelected = false
        binding.btnTabRegister.isSelected = true
        binding.layoutLogin.hide()
        binding.layoutRegister.show()
    }

    private fun setupClickListeners() {
        binding.btnLogin.setOnClickListener { doLogin() }
        binding.btnRegister.setOnClickListener { doRegister() }
        binding.btnGoogleLogin.setOnClickListener { launchGoogleSignIn() }
    }

    private fun initGoogleSignIn() {
        lifecycleScope.launch {
            try {
                val resp = ApiClient.authApi.getConfig()
                val clientId = resp.body()?.googleClientId
                if (!clientId.isNullOrEmpty()) {
                    val gso = GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
                        .requestIdToken(clientId)
                        .requestEmail()
                        .build()
                    googleSignInClient = GoogleSignIn.getClient(this@AuthActivity, gso)
                    binding.btnGoogleLogin.show()
                }
            } catch (e: Exception) {
                // Google unavailable — button stays hidden
            }
        }
    }

    private fun launchGoogleSignIn() {
        googleSignInClient?.signOut()?.addOnCompleteListener {
            startActivityForResult(googleSignInClient!!.signInIntent, RC_SIGN_IN)
        }
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == RC_SIGN_IN) {
            try {
                val account = GoogleSignIn.getSignedInAccountFromIntent(data)
                    .getResult(ApiException::class.java)
                val idToken = account.idToken ?: run {
                    toast("Google: hakuna ID token"); return
                }
                doGoogleAuth(idToken)
            } catch (e: ApiException) {
                toast("Google imeshindwa: ${e.statusCode}")
            }
        }
    }

    // ─── LOGIN ───────────────────────────────────────────────
    private fun doLogin() {
        val email = binding.etLoginEmail.text.toString().trim()
        val pass  = binding.etLoginPass.text.toString()
        if (email.isEmpty() || pass.isEmpty()) {
            showLoginError("Jaza barua pepe na nywila"); return
        }
        setLoginLoading(true)
        lifecycleScope.launch {
            try {
                val r = ApiClient.authApi.login(LoginRequest(email, pass))
                if (r.isSuccessful && r.body()?.token != null) {
                    onAuthSuccess(r.body()!!)
                } else {
                    showLoginError(r.body()?.error ?: r.body()?.message ?: "Kosa ${r.code()}")
                }
            } catch (e: IOException)   { showLoginError("Hakuna mtandao") }
              catch (e: HttpException)  { showLoginError("Kosa la seva: ${e.code()}") }
              catch (e: Exception)      { showLoginError(e.message ?: "Hitilafu") }
            finally { setLoginLoading(false) }
        }
    }

    // ─── REGISTER ────────────────────────────────────────────
    private fun doRegister() {
        val name  = binding.etRegName.text.toString().trim()
        val email = binding.etRegEmail.text.toString().trim()
        val pass  = binding.etRegPass.text.toString()
        if (name.isEmpty() || email.isEmpty() || pass.isEmpty()) {
            showRegError("Jaza sehemu zote"); return
        }
        if (pass.length < 6) { showRegError("Nywila iwe angalau herufi 6"); return }
        setRegLoading(true)
        lifecycleScope.launch {
            try {
                val r = ApiClient.authApi.register(RegisterRequest(name, email, pass))
                if (r.isSuccessful && r.body()?.token != null) {
                    onAuthSuccess(r.body()!!)
                } else {
                    showRegError(r.body()?.error ?: r.body()?.message ?: "Kosa ${r.code()}")
                }
            } catch (e: IOException)  { showRegError("Hakuna mtandao") }
              catch (e: Exception)    { showRegError(e.message ?: "Hitilafu") }
            finally { setRegLoading(false) }
        }
    }

    // ─── GOOGLE AUTH ─────────────────────────────────────────
    private fun doGoogleAuth(idToken: String) {
        toast("⏳ Google inathibitisha...")
        lifecycleScope.launch {
            try {
                val r = ApiClient.authApi.googleAuth(GoogleAuthRequest(idToken))
                if (r.isSuccessful && r.body()?.token != null) {
                    onAuthSuccess(r.body()!!)
                } else {
                    toast(r.body()?.error ?: "Google auth imeshindwa")
                }
            } catch (e: Exception) { toast("Google: ${e.message}") }
        }
    }

    // ─── ON SUCCESS ──────────────────────────────────────────
    private fun onAuthSuccess(auth: AuthResponse) {
        val user = auth.user ?: UserModel(name = "User", email = "")
        val exp  = System.currentTimeMillis() + (3600 * 1000L) // 1hr default
        session.saveSession(auth.token!!, user, exp)
        startActivity(Intent(this, HomeActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        })
        overridePendingTransition(android.R.anim.fade_in, android.R.anim.fade_out)
        finish()
    }

    private fun showLoginError(msg: String) {
        binding.tvLoginError.text = msg
        binding.tvLoginError.show()
    }
    private fun showRegError(msg: String) {
        binding.tvRegError.text = msg
        binding.tvRegError.show()
    }
    private fun setLoginLoading(on: Boolean) {
        binding.btnLogin.isEnabled = !on
        binding.btnLogin.text = if (on) "⏳ INAINGIZA..." else "▶  INGIA"
    }
    private fun setRegLoading(on: Boolean) {
        binding.btnRegister.isEnabled = !on
        binding.btnRegister.text = if (on) "⏳ INASAJILI..." else "▶  SAJILI SASA"
    }
}
