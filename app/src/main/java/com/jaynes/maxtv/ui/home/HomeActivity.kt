package com.jaynes.maxtv.ui.home

import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.text.Editable
import android.text.TextWatcher
import android.view.View
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.GridLayoutManager
import com.google.android.material.chip.Chip
import com.jaynes.maxtv.BuildConfig
import com.jaynes.maxtv.R
import com.jaynes.maxtv.databinding.ActivityHomeBinding
import com.jaynes.maxtv.model.Channel
import com.jaynes.maxtv.network.ApiClient
import com.jaynes.maxtv.ui.auth.AuthActivity
import com.jaynes.maxtv.ui.player.PlayerActivity
import com.jaynes.maxtv.util.*
import kotlinx.coroutines.*
import java.io.IOException

class HomeActivity : AppCompatActivity() {

    private lateinit var binding: ActivityHomeBinding
    private lateinit var session: SessionManager
    private lateinit var adapter: ChannelAdapter

    private val allChannels = mutableListOf<Channel>()
    private var filteredChannels = listOf<Channel>()
    private var currentCat = ""
    private var searchQuery = ""

    private var healthJob: Job? = null
    private var tokenJob: Job? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityHomeBinding.inflate(layoutInflater)
        setContentView(binding.root)
        session = SessionManager(this)

        setupRecyclerView()
        setupSearch()
        setupNavBar()
        applyUserUI()
        fetchVersion()
        loadChannels()
        startHealthCheck()
        startTokenCountdown()
    }

    private fun setupRecyclerView() {
        adapter = ChannelAdapter { ch -> onChannelClick(ch) }
        binding.rvChannels.layoutManager = GridLayoutManager(this, 2)
        binding.rvChannels.adapter = adapter
    }

    private fun setupSearch() {
        binding.etSearch.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
            override fun afterTextChanged(s: Editable?) {
                searchQuery = s.toString().trim()
                applyFilters()
            }
        })
    }

    private fun setupNavBar() {
        binding.btnNavChannels.setOnClickListener {
            setNavActive(0)
            binding.rvChannels.scrollToPosition(0)
        }
        binding.btnNavReload.setOnClickListener {
            setNavActive(2)
            loadChannels()
        }
        binding.btnNavInfo.setOnClickListener {
            setNavActive(3)
            showInfo()
        }
        binding.btnLogout.setOnClickListener { doLogout() }
    }

    private fun setNavActive(idx: Int) {
        listOf(binding.btnNavChannels, binding.btnNavReload, binding.btnNavInfo)
            .forEachIndexed { i, btn -> btn.isSelected = i == idx }
    }

    private fun applyUserUI() {
        val tok = session.getToken() ?: ""
        // display token short form - will be set after user block
        val user = session.getUser() ?: return
        binding.tvUserName.text = user.name.ifEmpty { user.email }
        binding.tvUserAvatar.text = (user.name.ifEmpty { "U" })[0].uppercaseChar().toString()
    }

    fun onUpdateBannerClose(v: android.view.View) { binding.layoutUpdateBanner.visibility = android.view.View.GONE }

    // ─── CHANNELS ────────────────────────────────────────────
    private fun loadChannels() {
        val token = session.getToken() ?: run { doLogout(); return }
        showSkeleton(true)
        lifecycleScope.launch {
            try {
                val r = ApiClient.streamApi.getChannels(bearerToken(token))
                if (r.isSuccessful) {
                    val chs = r.body()?.channels ?: emptyList()
                    allChannels.clear()
                    allChannels.addAll(chs)
                    buildCategoryChips()
                    applyFilters()
                    updateServerStatus(true)
                } else {
                    updateServerStatus(false)
                    showEmpty("Hitilafu ya seva: ${r.code()}")
                }
            } catch (e: IOException) {
                updateServerStatus(false)
                showEmpty("Hakuna mtandao")
            } catch (e: Exception) {
                updateServerStatus(false)
                showEmpty(e.message ?: "Hitilafu")
            } finally {
                showSkeleton(false)
            }
        }
    }

    private fun buildCategoryChips() {
        binding.chipGroupCats.removeAllViews()
        val allChip = layoutInflater.inflate(R.layout.item_chip, binding.chipGroupCats, false) as Chip
        allChip.text = "ZOTE"
        allChip.isChecked = currentCat.isEmpty()
        allChip.setOnClickListener { currentCat = ""; applyFilters() }
        binding.chipGroupCats.addView(allChip)

        val cats = allChannels.map { it.category }.distinct().sorted()
        cats.forEach { cat ->
            val chip = layoutInflater.inflate(R.layout.item_chip, binding.chipGroupCats, false) as Chip
            chip.text = categoryLabel(cat)
            chip.isChecked = currentCat == cat
            chip.setOnClickListener { currentCat = cat; applyFilters() }
            binding.chipGroupCats.addView(chip)
        }
    }

    private fun applyFilters() {
        filteredChannels = allChannels.filter { ch ->
            val matchCat  = currentCat.isEmpty() || ch.category.equals(currentCat, true)
            val matchSearch = searchQuery.isEmpty() || ch.name.contains(searchQuery, true)
            matchCat && matchSearch
        }
        adapter.submitList(filteredChannels.toList())
        binding.tvSecHeader.text = if (searchQuery.isNotEmpty())
            "MATOKEO: ${filteredChannels.size}"
        else "LIVE CHANNELS — ${filteredChannels.size}"
        binding.tvEmpty.visibility = if (filteredChannels.isEmpty()) View.VISIBLE else View.GONE
    }

    private fun showSkeleton(show: Boolean) {
        binding.progressBar.visibility = if (show) View.VISIBLE else View.GONE
        if (show) binding.rvChannels.gone()
        else binding.rvChannels.show()
    }

    private fun showEmpty(msg: String) {
        binding.tvEmpty.text = msg
        binding.tvEmpty.show()
    }

    // ─── CHANNEL CLICK ───────────────────────────────────────
    private fun onChannelClick(ch: Channel) {
        val user = session.getUser()
        if (ch.locked && user?.tier != "premium") {
            showPremiumDialog(); return
        }
        startActivity(Intent(this, PlayerActivity::class.java).apply {
            putExtra(PlayerActivity.EXTRA_CHANNEL_ID,       ch.id)
            putExtra(PlayerActivity.EXTRA_CHANNEL_NAME,     ch.name)
            putExtra(PlayerActivity.EXTRA_STREAM_URL,       ch.streamUrl)
            putExtra(PlayerActivity.EXTRA_STREAM_TYPE,      ch.streamType)
            putExtra(PlayerActivity.EXTRA_CHANNEL_CATEGORY, ch.category)
            putExtra(PlayerActivity.EXTRA_DRM_TYPE,         ch.drm?.type ?: "NONE")
            putExtra(PlayerActivity.EXTRA_DRM_LICENSE,      ch.drm?.licenseUrl ?: "")
        })
    }

    private fun showPremiumDialog() {
        val dlg = android.app.AlertDialog.Builder(this, R.style.JaynesDialog)
            .setTitle("🔒 PREMIUM")
            .setMessage("Channel hii inahitaji subscription ya Premium.\nUpgrade kupata HD channels zote bila kikwazo.")
            .setPositiveButton("⭐ UPGRADE") { d, _ -> d.dismiss(); toast("Upgrade itapatikana hivi karibuni!") }
            .setNegativeButton("BAADAYE") { d, _ -> d.dismiss() }
            .create()
        dlg.show()
    }

    // ─── VERSION ─────────────────────────────────────────────
    private fun fetchVersion() {
        lifecycleScope.launch {
            try {
                val r = ApiClient.updateApi.getVersion()
                if (r.isSuccessful && r.body()?.updateAvailable == true) {
                    val msg = r.body()?.updateMessage ?: "Update mpya inapatikana!"
                    binding.tvUpdateBanner.text = "🔄 $msg"
                    binding.layoutUpdateBanner.show()
                }
            } catch (_: Exception) {}
        }
    }

    // ─── HEALTH CHECK ────────────────────────────────────────
    private fun startHealthCheck() {
        healthJob = lifecycleScope.launch {
            while (isActive) {
                delay(30_000)
                try {
                    val r = ApiClient.updateApi.getVersion()
                    updateServerStatus(r.isSuccessful)
                } catch (_: Exception) { updateServerStatus(false) }
            }
        }
    }

    private fun updateServerStatus(online: Boolean) {
        runOnUiThread {
            binding.viewServerDot.setBackgroundResource(
                if (online) R.drawable.dot_green else R.drawable.dot_red
            )
            binding.tvServerStatus.text = if (online) "ONLINE" else "OFFLINE"
        }
    }

    // ─── TOKEN COUNTDOWN ─────────────────────────────────────
    private fun startTokenCountdown() {
        tokenJob = lifecycleScope.launch {
            while (isActive) {
                val remain = session.getTokenExp() - System.currentTimeMillis()
                if (remain <= 0) { doLogout(); break }
                binding.tvTokenTime.text = formatTokenCountdown(remain)
                // Auto-refresh when < 5min remain
                if (remain < 300_000) {
                    tryRefreshToken()
                }
                delay(1_000)
            }
        }
    }

    private suspend fun tryRefreshToken() {
        val tok = session.getToken() ?: return
        try {
            val r = ApiClient.authApi.refreshToken(bearerToken(tok))
            if (r.isSuccessful && r.body()?.token != null) {
                val exp = System.currentTimeMillis() + ((r.body()!!.expiresIn ?: 3600L) * 1000L)
                session.updateToken(r.body()!!.token!!, exp)
            }
        } catch (_: Exception) {}
    }

    private fun showInfo() {
        val user  = session.getUser()
        val remain = formatTokenCountdown(session.getTokenExp() - System.currentTimeMillis())
        toast("${user?.name} • ${(user?.tier ?: "free").uppercase()} • Token: $remain")
    }

    // ─── LOGOUT ──────────────────────────────────────────────
    private fun doLogout() {
        healthJob?.cancel(); tokenJob?.cancel()
        session.clearSession()
        startActivity(Intent(this, AuthActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        })
        finish()
    }

    override fun onDestroy() {
        super.onDestroy()
        healthJob?.cancel(); tokenJob?.cancel()
    }
}
