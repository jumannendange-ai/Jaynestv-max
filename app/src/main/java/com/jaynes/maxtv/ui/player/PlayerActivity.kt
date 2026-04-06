package com.jaynes.maxtv.ui.player

import android.app.PictureInPictureParams
import android.content.pm.ActivityInfo
import android.os.Build
import android.os.Bundle
import android.util.Rational
import android.view.View
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.lifecycle.lifecycleScope
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.datasource.DataSource
import androidx.media3.datasource.okhttp.OkHttpDataSource
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.dash.DashMediaSource
import androidx.media3.exoplayer.drm.DefaultDrmSessionManager
import androidx.media3.exoplayer.drm.DrmSessionManager
import androidx.media3.exoplayer.drm.FrameworkMediaDrm
import androidx.media3.exoplayer.drm.HttpMediaDrmCallback
import androidx.media3.exoplayer.hls.HlsMediaSource
import androidx.media3.exoplayer.source.MediaSource
import androidx.media3.exoplayer.trackselection.DefaultTrackSelector
import com.jaynes.maxtv.BuildConfig
import com.jaynes.maxtv.R
import com.jaynes.maxtv.databinding.ActivityPlayerBinding
import com.jaynes.maxtv.util.toast
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import okhttp3.OkHttpClient
import java.util.concurrent.TimeUnit

@UnstableApi
class PlayerActivity : AppCompatActivity() {

    private lateinit var binding: ActivityPlayerBinding
    private var player: ExoPlayer? = null
    private var trackSelector: DefaultTrackSelector? = null
    private var retryCount = 0

    companion object {
        const val EXTRA_CHANNEL_NAME     = "ch_name"
        const val EXTRA_STREAM_URL       = "stream_url"
        const val EXTRA_STREAM_TYPE      = "stream_type"
        const val EXTRA_CHANNEL_CATEGORY = "ch_cat"
        const val EXTRA_DRM_TYPE         = "drm_type"
        const val EXTRA_DRM_LICENSE      = "drm_license"
        private const val MAX_RETRY = 3
    }

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
        WindowInsetsControllerCompat(window, binding.root).let {
            it.hide(WindowInsetsCompat.Type.systemBars())
            it.systemBarsBehavior =
                WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        }
    }

    private fun setupUI() {
        binding.tvChannelName.text = channelName
        binding.tvChannelMeta.text =
            "${intent.getStringExtra(EXTRA_CHANNEL_CATEGORY)?.uppercase() ?: "LIVE"} • HD LIVE"

        binding.btnBack.setOnClickListener { finish() }
        binding.btnRetry.setOnClickListener { retryPlay() }
        binding.btnPip.setOnClickListener  { enterPip() }

        binding.btnPlayPause.setOnClickListener {
            if (player?.isPlaying == true) player?.pause() else player?.play()
        }

        binding.seekVolume.setOnSeekBarChangeListener(
            object : android.widget.SeekBar.OnSeekBarChangeListener {
                override fun onProgressChanged(sb: android.widget.SeekBar?, p: Int, fromUser: Boolean) {
                    player?.volume = p / 100f
                }
                override fun onStartTrackingTouch(sb: android.widget.SeekBar?) {}
                override fun onStopTrackingTouch(sb: android.widget.SeekBar?) {}
            }
        )
    }

    // ─── PLAYER ──────────────────────────────────────────────

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

        player = ExoPlayer.Builder(this)
            .setTrackSelector(trackSelector!!)
            .build()
            .also { exo ->
                binding.playerView.player = exo
                exo.addListener(playerListener)
                exo.playWhenReady = true
                exo.setMediaSource(buildMediaSource(okClient))
                exo.prepare()
            }

        showBuffering(true)
        hideError()
    }

    private fun buildDataSourceFactory(client: OkHttpClient): DataSource.Factory =
        OkHttpDataSource.Factory(client)
            .setDefaultRequestProperties(mapOf("X-Azam-Token" to BuildConfig.AZAM_TOKEN))

    private fun buildDrmManager(client: OkHttpClient): DrmSessionManager? {
        if (drmType == "NONE" || drmType.isEmpty()) return null
        return when (drmType.uppercase()) {
            "WIDEVINE" -> {
                if (drmLicense.isEmpty()) return null
                val cb = HttpMediaDrmCallback(
                    drmLicense,
                    OkHttpDataSource.Factory(client)
                )
                DefaultDrmSessionManager.Builder()
                    .setUuidAndExoMediaDrmProvider(C.WIDEVINE_UUID, FrameworkMediaDrm.DEFAULT_PROVIDER)
                    .build(cb)
            }
            "CLEARKEY" -> {
                val licUrl = drmLicense.ifEmpty {
                    "https://cwip-shaka-proxy.appspot.com/no_auth"
                }
                val cb = HttpMediaDrmCallback(licUrl, OkHttpDataSource.Factory(client))
                DefaultDrmSessionManager.Builder()
                    .setUuidAndExoMediaDrmProvider(C.CLEARKEY_UUID, FrameworkMediaDrm.DEFAULT_PROVIDER)
                    .build(cb)
            }
            else -> null
        }
    }

    private fun buildMediaSource(client: OkHttpClient): MediaSource {
        val dsFactory = buildDataSourceFactory(client)

        // Build MediaItem with DRM if needed
        val drmUuid = when (drmType.uppercase()) {
            "WIDEVINE"  -> C.WIDEVINE_UUID
            "CLEARKEY"  -> C.CLEARKEY_UUID
            else        -> null
        }

        val mediaItemBuilder = MediaItem.Builder().setUri(streamUrl)
        if (drmUuid != null && drmLicense.isNotEmpty()) {
            mediaItemBuilder.setDrmConfiguration(
                MediaItem.DrmConfiguration.Builder(drmUuid)
                    .setLicenseUri(drmLicense)
                    .build()
            )
        }
        val mediaItem = mediaItemBuilder.build()

        return when (streamType.uppercase()) {
            "DASH", "MPD" -> DashMediaSource.Factory(dsFactory).createMediaSource(mediaItem)
            else           -> HlsMediaSource.Factory(dsFactory).createMediaSource(mediaItem)
        }
    }

    // ─── LISTENER ────────────────────────────────────────────

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

    // ─── HELPERS ─────────────────────────────────────────────

    private fun retryPlay() {
        retryCount = 0
        hideError()
        showBuffering(true)
        player?.prepare()
        player?.play()
    }

    private fun enterPip() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            enterPictureInPictureMode(
                PictureInPictureParams.Builder()
                    .setAspectRatio(Rational(16, 9))
                    .build()
            )
        }
    }

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
    override fun onResume()  { super.onResume();  if (player?.isPlaying == false) player?.play() }
    override fun onDestroy() {
        super.onDestroy()
        player?.removeListener(playerListener)
        player?.release()
        player = null
    }

    override fun onPictureInPictureModeChanged(
        isInPipMode: Boolean,
        config: android.content.res.Configuration
    ) {
        super.onPictureInPictureModeChanged(isInPipMode, config)
        binding.layoutControls.visibility = if (isInPipMode) View.GONE else View.VISIBLE
    }
}
