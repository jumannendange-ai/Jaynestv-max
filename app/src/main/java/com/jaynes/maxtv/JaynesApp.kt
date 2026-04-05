package com.jaynes.maxtv

import android.app.Application
import androidx.multidex.MultiDex
import android.content.Context

class JaynesApp : Application() {
    override fun attachBaseContext(base: Context) {
        super.attachBaseContext(base)
        MultiDex.install(this)
    }

    override fun onCreate() {
        super.onCreate()
        instance = this
    }

    companion object {
        lateinit var instance: JaynesApp
            private set
    }
}
