package com.jaynes.maxtv.ui.player

import android.app.PictureInPictureParams
import android.content.pm.ActivityInfo
import android.os.Build
import android.os.Bundle
import android.util.Rational
import android.view.View
import android.view.WindowInsetsController
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.lifecycle.lifecycleScope
import androidx.media3.common.*
import androidx.media3.common.util.UnstableApi
import androidx.media3.datasource.DataSource
import androidx.media3.datasource.DefaultHttpDataSource
import androidx.media3.datasource.okhttp.OkHttpDataSource
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.dash.DashMediaSource
import androidx.media3.exoplayer.drm.*
import androidx.media3.exoplayer.hls.HlsMediaSource
import androidx.media3.exoplayer.source.MediaSource
import androidx.media3.exoplayer.trackselection.DefaultTrackSelector
import com.jaynes.maxtv.BuildConfig
import com.jaynes.maxtv.R
import com.jaynes.maxtv.databinding.ActivityPlayerBinding
import com.jaynes.maxtv.util.toast
import kotlinx.coroutines.*
import okhttp3.OkHttpClient
import java.util.concurrent.TimeUnit

@UnstableApi
class PlayerActivity : AppCompatActivity() {

    private lateinit var binding: ActivityPlayerBinding
    private var player: ExoPlayer? = null
    private var trackSelector: DefaultTrackSelector? = null
    private var retryCount = 0

    companion object {
        const val EXTRA_CHANNEL_ID       = "ch_id"
        const val EXTRA_CHANNEL_NAME     = "ch_name"
        const val EXTRA_STREAM_URL       = "stream_url"
        const val EXTRA_STREAM_TYPE      = "stream_type"
        const val EXTRA_CHANNEL_CATEGORY = "ch_cat"
        const val EXTRA_DRM_TYPE         = "drm_type"
        const val EXTRA_DRM_LICENSE      = "drm_license"
        private const val MAX_RETRY = 3
    }

    // Extras
    private lateinit var channelName: String
    private lateinit var streamUrl: String
    private lateinit var streamType: String
    private lateinit var drmType: String
    private var drmLicense: String = ""

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityPlayerBinding.inflate(layoutInflater)
        setContentView(binding.root)

        channelName = intent.getStringExtra(EXTRA_CHANNEL_NAME) ?: "Channel"
        streamUrl   = intent.getStringExtra(EXTRA_STREAM_URL)   ?: ""
        streamType  = intent.getStringExtra(EXTRA_STREAM_TYPE)  ?: "HLS"
        drmType     = intent.getStringExtra(EXTRA_DRM_TYPE)     ?: "NONE"
        drmLicense  = intent.getStringExtra(EXTRA_DRM_LICENSE)  ?: ""

        hideSystemUI()
        setupUI()
        initPlayer()
    }

    private fun hideSystemUI() {
        WindowCompat.setDecorFitsSystemWindows(window, false)
        WindowInsetsControllerCompat(window, binding.root).let { ctrl ->
            ctrl.hide(WindowInsetsCompat.Type.systemBars())
            ctrl.systemBarsBehavior =
                WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        }
    }

    private fun setupUI() {
        binding.tvChannelName.text = channelName
        binding.tvChannelMeta.text = "${intent.getStringExtra(EXTRA_CHANNEL_CATEGORY)?.uppercase() ?: "LIVE"} • HD LIVE"

        binding.btnBack.setOnClickListener { finish() }
        binding.btnRetry.setOnClickListener { retryPlay() }
        binding.btnPip.setOnClickListener  { enterPip() }
        binding.btnFullscreen.setOnClickListener { toggleFullscreen() }

        // Volume seekbar
        binding.seekVolume.setOnSeekBarChangeListener(object : android.widget.SeekBar.OnSeekBarChangeListener {
            override fun onProgressChanged(sb: android.widget.SeekBar?, progress: Int, fromUser: Boolean) {
                player?.volume = progress / 100f
            }
            override fun onStartTrackingTouch(sb: android.widget.SeekBar?) {}
            override fun onStopTrackingTouch(sb: android.widget.SeekBar?) {}
        })

        // Play/pause button
        binding.btnPlayPause.setOnClickListener {
            if (player?.isPlaying == true) player?.pause() else player?.play()
        }

        // Quality selector
        binding.spinnerQuality.setOnItemSelectedListener(
            object : android.widget.AdapterView.OnItemSelectedListener {
                override fun onItemSelected(p: android.widget.AdapterView<*>?, v: View?, pos: Int, id: Long) {
                    applyQuality(pos)
                }
                override fun onNothingSelected(p: android.widget.AdapterView<*>?) {}
            }
        )
    }

    // ─── PLAYER INIT ─────────────────────────────────────────
    private fun initPlayer() {
        trackSelector = DefaultTrackSelector(this).apply {
            setParameters(buildUponParameters().setMaxVideoSizeSd())
        }

        val okClient = OkHttpClient.Builder()
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(20, TimeUnit.SECONDS)
            .addInterceptor { chain ->
                chain.proceed(
                    chain.request().newBuilder()
                        .addHeader("X-Azam-Token", BuildConfig.AZAM_TOKEN)
                        .build()
                )
            }
            .build()

        val drmMgr = buildDrmManager(okClient)

        player = ExoPlayer.Builder(this)
            .setTrackSelector(trackSelector!!)
            
            .build()
            .also { exo ->
                binding.playerView.player = exo
                exo.addListener(playerListener)
                exo.playWhenReady = true
                exo.setMediaSource(buildMediaSource(okClient, drmMgr))
                exo.prepare()
            }

        showBuffering(true)
        hideError()
    }

    private fun buildDrmManager(okClient: OkHttpClient): DrmSessionManager? {
        if (drmType == "NONE" || drmType.isEmpty()) return null

        return when (drmType.uppercase()) {
            "CLEARKEY" -> {
                // Build offline ClearKey from kid/key pairs if license URL present
                val callback = if (drmLicense.isNotEmpty())
                    HttpMediaDrmCallback(drmLicense, okHttpFactory(okClient))
                else
                    HttpMediaDrmCallback("https://cwip-shaka-proxy.appspot.com/no_auth", okHttpFactory(okClient))

                DefaultDrmSessionManager.Builder()
                    .setUuidAndExoMediaDrmProvider(C.CLEARKEY_UUID, FrameworkMediaDrm.DEFAULT_PROVIDER)
                    .build(callback)
            }
            "WIDEVINE" -> {
                if (drmLicense.isEmpty()) return null
                val callback = HttpMediaDrmCallback(drmLicense, okHttpFactory(okClient))
                DefaultDrmSessionManager.Builder()
                    .setUuidAndExoMediaDrmProvider(C.WIDEVINE_UUID, FrameworkMediaDrm.DEFAULT_PROVIDER)
                    .build(callback)
            }
            else -> null
        }
    }

    private fun okHttpFactory(client: OkHttpClient): DataSource.Factory = OkHttpDataSource.Factory(client)

    private fun buildMediaSource(okClient: OkHttpClient, drmMgr: DrmSessionManager?): MediaSource {
        val dsFactory = OkHttpDataSource.Factory(okClient)
            .setDefaultRequestProperties(mapOf("X-Azam-Token" to BuildConfig.AZAM_TOKEN))

        val drmUuid = when (drmType.uppercase()) {
            "WIDEVINE" -> C.WIDEVINE_UUID
            "CLEARKEY" -> C.CLEARKEY_UUID
            else -> null
        }
        val mediaItem = MediaItem.Builder()
            .setUri(streamUrl)
            .apply {
                if (drmMgr != null && drmUuid != null && drmLicense.isNotEmpty()) {
                    setDrmConfiguration(
                        MediaItem.DrmConfiguration.Builder(drmUuid)
                            .setLicenseUri(drmLicense)
                            .build()
                    )
                }
            }
            .build()

        return when (streamType.uppercase()) {
            "DASH", "MPD" -> DashMediaSource.Factory(dsFactory).createMediaSource(mediaItem)
            else           -> HlsMediaSource.Factory(dsFactory).createMediaSource(mediaItem)
        }
    }

    // ─── PLAYER LISTENER ─────────────────────────────────────
    private val playerListener = object : Player.Listener {
        override fun onPlaybackStateChanged(state: Int) {
            when (state) {
                Player.STATE_BUFFERING -> { showBuffering(true); hideError() }
                Player.STATE_READY     -> { showBuffering(false); hideError(); retryCount = 0 }
                Player.STATE_IDLE      -> showBuffering(false)
                Player.STATE_ENDED     -> showBuffering(false)
            }
        }

        override fun onPlayerError(error: PlaybackException) {
            showBuffering(false)
            if (retryCount < MAX_RETRY) {
                retryCount++
                lifecycleScope.launch {
                    delay(2000L * retryCount)
                    player?.prepare()
                }
            } else {
                showError("Hitilafu ya stream: ${error.errorCodeName}\nJaribu tena au chagua channel nyingine.")
            }
        }

        override fun onIsPlayingChanged(isPlaying: Boolean) {
            binding.btnPlayPause.setImageResource(
                if (isPlaying) R.drawable.ic_pause else R.drawable.ic_play
            )
        }
    }

    // ─── CONTROLS ────────────────────────────────────────────
    private fun retryPlay() {
        retryCount = 0
        hideError()
        showBuffering(true)
        player?.prepare()
        player?.play()
    }

    private fun applyQuality(pos: Int) {
        val params = trackSelector?.buildUponParameters() ?: return
        when (pos) {
            0 -> params.setMaxVideoSize(Int.MAX_VALUE, Int.MAX_VALUE)
            1 -> params.setMaxVideoSize(1280, 720)
            2 -> params.setMaxVideoSize(854, 480)
            3 -> params.setMaxVideoSize(640, 360)
        }
        trackSelector?.setParameters(params)
    }

    private fun toggleFullscreen() {
        requestedOrientation = if (requestedOrientation == ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE)
            ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
        else ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
    }

    private fun enterPip() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val params = PictureInPictureParams.Builder()
                .setAspectRatio(Rational(16, 9))
                .build()
            enterPictureInPictureMode(params)
        }
    }

    // ─── UI HELPERS ──────────────────────────────────────────
    private fun showBuffering(show: Boolean) {
        binding.progressBuffering.visibility = if (show) View.VISIBLE else View.GONE
    }
    private fun showError(msg: String) {
        binding.layoutError.visibility = View.VISIBLE
        binding.tvErrorMsg.text = msg
    }
    private fun hideError() {
        binding.layoutError.visibility = View.GONE
    }

    // ─── LIFECYCLE ───────────────────────────────────────────
    override fun onPause()   { super.onPause();   player?.pause() }
    override fun onResume()  { super.onResume();  player?.play()  }
    override fun onDestroy() {
        super.onDestroy()
        player?.removeListener(playerListener)
        player?.release()
        player = null
    }

    override fun onPictureInPictureModeChanged(isInPipMode: Boolean, config: android.content.res.Configuration) {
        super.onPictureInPictureModeChanged(isInPipMode, config)
        binding.layoutControls.visibility = if (isInPipMode) View.GONE else View.VISIBLE
    }
}
