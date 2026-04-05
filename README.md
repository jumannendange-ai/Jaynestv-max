# JAYNES MAX TV — Native Android

## Muundo wa Project
```
JaynesMaxTV/
├── app/
│   ├── google-services.json          ← tayari imewekwa
│   ├── src/main/
│   │   ├── AndroidManifest.xml
│   │   ├── java/com/jaynes/maxtv/
│   │   │   ├── JaynesApp.kt
│   │   │   ├── model/Models.kt
│   │   │   ├── network/ApiClient.kt
│   │   │   ├── network/ApiService.kt
│   │   │   ├── util/SessionManager.kt
│   │   │   ├── util/Extensions.kt
│   │   │   ├── ui/splash/SplashActivity.kt
│   │   │   ├── ui/auth/AuthActivity.kt
│   │   │   ├── ui/home/HomeActivity.kt
│   │   │   ├── ui/home/ChannelAdapter.kt
│   │   │   └── ui/player/PlayerActivity.kt
│   │   └── res/
│   │       ├── layout/ (splash, auth, home, player, item_channel, item_chip)
│   │       ├── drawable/ (icons, backgrounds, dots)
│   │       ├── values/ (colors, themes, strings, dimens, arrays)
│   │       ├── color/ (selectors)
│   │       └── anim/ (pulse_glow, rise_up)
```

## Jinsi ya Build

### Hatua 1: Weka kwenye Android Studio
1. Open Android Studio → File → Open → chagua folder `JaynesMaxTV`
2. Subiri Gradle sync (itapakua dependencies ~200MB)

### Hatua 2: Kuhusu Font
- Pakua `Share Tech Mono` kutoka Google Fonts
- Weka `share_tech_mono.ttf` kwenye `app/src/main/res/font/`
- Au badilisha `@font/share_tech_mono` na `monospace` kwenye layouts kwa haraka

### Hatua 3: Kuhusu Launcher Icon
- Weka picha yako ya icon (`ic_launcher.png`) kwenye mipmap folders:
  - mdpi: 48x48
  - hdpi: 72x72
  - xhdpi: 96x96
  - xxhdpi: 144x144
  - xxxhdpi: 192x192

### Hatua 4: Build APK
```
Build → Build Bundle(s)/APK(s) → Build APK(s)
```
APK itapatikana: `app/build/outputs/apk/debug/app-debug.apk`

## APIs Zilizowekwa
- AUTH:   https://jaynestv-jaynestv-authenticationapi.hf.space
- STREAM: https://jaynestv-jaynestv-stream.hf.space
- UPDATE: https://jaynestv-updateapi.hf.space
- AZAM TOKEN: imewekwa ndani ya BuildConfig

## Features
✅ Splash screen na glow animation
✅ Login / Register / Google Sign-In
✅ Channel grid (2 columns) na search + category chips
✅ ExoPlayer na HLS + DASH support
✅ ClearKey + Widevine DRM
✅ Azam OS token header kwenye kila request
✅ Token countdown + auto-refresh
✅ Server health indicator
✅ Premium lock overlay + dialog
✅ Picture-in-Picture (Android 8+)
✅ Quality selector (AUTO/720p/480p/360p)
✅ Session persistence (SharedPreferences)
✅ Firebase / Google Services integrated

## Rangi (Azam OS Style)
- Red:   #E31E25
- Cyan:  #00F0FF
- Gold:  #FFC940
- Green: #00E87A
- Dark:  #04070D
