// FCM glue: receives pushes and registers/unregisters device tokens.
package com.northernbloom.customer.push

import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.northernbloom.customer.NBApplication

class NBFirebaseMessagingService : FirebaseMessagingService() {

    override fun onNewToken(token: String) {
        // Bind this installation's token to whoever is signed in. If nobody is
        // logged in we skip registration; it happens after login instead.
        val container = (application as? NBApplication)?.container ?: return
        kotlinx.coroutines.runBlocking {
            try {
                if (container.sessionStore.token() != null) {
                    container.api.registerDevice(com.northernbloom.customer.core.DeviceRequest(fcmToken = token))
                }
            } catch (_: Exception) {
                // Retried on next token refresh / app start.
            }
        }
    }

    override fun onMessageReceived(message: RemoteMessage) {
        // Notification payloads render via the system tray automatically.
        // Data-only messages could route deep links here:
        val deeplink = message.data["deeplink"] ?: return
        DeeplinkQueue.enqueue(applicationContext, deeplink)
    }
}
