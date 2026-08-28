package com.northernbloom.customer

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.lifecycle.lifecycleScope
import com.northernbloom.customer.core.ConfigLoader
import com.northernbloom.customer.core.dto.Brand
import com.northernbloom.customer.ui.nav.AppRoot
import com.northernbloom.customer.ui.theme.NBTheme
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
    private val app by lazy { application as NBApplication }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        // Deep links (nbcustomer://open/...) arrive here; AppRoot handles routing.
        // Push data-messages queue links via DeeplinkQueue instead of an intent.
        val startDeepLink = intent?.data?.toString()
            ?: com.northernbloom.customer.push.DeeplinkQueue.drain(this)?.data?.toString()

        setContent {
            val config by app.container.config.collectAsState()
            NBTheme(brand = config?.brand ?: Brand()) {
                AppRoot(container = app.container, initialDeepLink = startDeepLink)
            }
        }

        lifecycleScope.launch {
            app.container.restoreSession()
            ConfigLoader.load(app.container.api)?.let { app.container.publishConfig(it) }
        }
    }
}
