package com.northernbloom.customer

import android.app.Application
import com.northernbloom.customer.core.AppContainer

class NBApplication : Application() {
    lateinit var container: AppContainer
        private set

    override fun onCreate() {
        super.onCreate()
        container = AppContainer(this)
    }
}
