package com.zeroui.template

import android.app.Application
import com.zeroui.template.core.AppContainer
import com.zeroui.template.data.CrashLogger

/** Application entry that owns the dependency container. */
class ZeroApp : Application() {
    val container: AppContainer by lazy { AppContainer(this) }

    override fun onCreate() {
        super.onCreate()
        CrashLogger.install(this, container.settings.settings.value.crashLog)
    }
}
