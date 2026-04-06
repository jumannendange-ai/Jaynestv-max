package com.jaynes.maxtv.ui.home

import android.content.Intent
import android.os.Bundle
import android.view.View
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.GridLayoutManager
import com.jaynes.maxtv.BuildConfig
import com.jaynes.maxtv.databinding.ActivityHomeBinding
import com.jaynes.maxtv.model.Channel
import com.jaynes.maxtv.network.ApiClient
import com.jaynes.maxtv.ui.auth.AuthActivity
import com.jaynes.maxtv.ui.player.PlayerActivity
import com.jaynes.maxtv.util.SessionManager
import com.jaynes.maxtv.util.toast
import kotlinx.coroutines.launch

class HomeActivity : AppCompatActivity() {

    private lateinit var binding: ActivityHomeBinding
    private lateinit var session: SessionManager
    private lateinit var adapter: ChannelAdapter
    private var allChannels = listOf<Channel>()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityHomeBinding.inflate(layoutInflater)
        setContentView(binding.root)
        session = SessionManager(this)

        setupRecycler()
        setupSearch()
        setupLogout()
        loadChannels()
    }

    private fun setupRecycler() {
        adapter = ChannelAdapter { ch -> openPlayer(ch) }
        binding.rvChannels.layoutManager = GridLayoutManager(this, 2)
        binding.rvChannels.adapter = adapter
    }

    private fun setupSearch() {
        binding.etSearch.addTextChangedListener(object : android.text.TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, st: Int, c: Int, a: Int) {}
            override fun onTextChanged(s: CharSequence?, st: Int, c: Int, a: Int) {
                val q = s.toString().lowercase()
                adapter.submitList(
                    if (q.isEmpty()) allChannels
                    else allChannels.filter { it.name.lowercase().contains(q) }
                )
            }
            override fun afterTextChanged(s: android.text.Editable?) {}
        })
    }

    private fun setupLogout() {
        binding.btnLogout.setOnClickListener {
            session.clearSession()
            startActivity(Intent(this, AuthActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
            })
            finish()
        }
    }

    private fun loadChannels() {
        binding.progressHome.visibility = View.VISIBLE
        binding.tvEmpty.visibility = View.GONE
        lifecycleScope.launch {
            try {
                val userId = session.getUserId() ?: ""
                val token = session.getToken() ?: ""
                val r = ApiClient.streamApi.getChannels(userId, token)
                if (r.isSuccessful) {
                    allChannels = r.body()?.channels?.filter { it.active } ?: emptyList()
                    adapter.submitList(allChannels)
                    if (allChannels.isEmpty()) binding.tvEmpty.visibility = View.VISIBLE
                } else if (r.code() == 401) {
                    session.clearSession()
                    goToAuth()
                } else {
                    toast("Hitilafu: ${r.code()}")
                    binding.tvEmpty.visibility = View.VISIBLE
                }
            } catch (e: Exception) {
                toast("Hakuna mtandao")
                binding.tvEmpty.visibility = View.VISIBLE
            } finally {
                binding.progressHome.visibility = View.GONE
                // swipeRefresh.isRefreshing = false
            }
        }

        // swipeRefresh listener removed
    }

    private fun openPlayer(ch: Channel) {
        startActivity(Intent(this, PlayerActivity::class.java).apply {
            putExtra(PlayerActivity.EXTRA_CHANNEL_NAME, ch.name)
            putExtra(PlayerActivity.EXTRA_STREAM_URL,   ch.streamUrl)
            putExtra(PlayerActivity.EXTRA_STREAM_TYPE,  ch.streamType)
            putExtra(PlayerActivity.EXTRA_DRM_TYPE,     ch.drmType)
            putExtra(PlayerActivity.EXTRA_DRM_LICENSE,  ch.drmLicense)
            putExtra(PlayerActivity.EXTRA_CHANNEL_CATEGORY, ch.category)
        })
    }

    private fun goToAuth() {
        startActivity(Intent(this, AuthActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        })
        finish()
    }
}
