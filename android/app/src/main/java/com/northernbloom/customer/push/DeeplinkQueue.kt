package com.northernbloom.customer.push

import android.content.Context
import android.content.Intent
import android.net.Uri

// Bridges FCM data messages to MainActivity deep links without a global nav
// singleton. v1 keeps it simple: the activity re-reads its intent.
object DeeplinkQueue {
    private const val PREFS = "nb_deeplinks"
    private const val KEY = "pending"

    fun enqueue(context: Context, deeplink: String) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY, deeplink)
            .apply()
    }

    fun drain(context: Context): Intent? {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val pending = prefs.getString(KEY, null) ?: return null
        prefs.edit().remove(KEY).apply()
        // Map backend deeplinks (/product/123) onto the app scheme.
        val cleaned = pending.trimStart('/').split("/")
        val uri = when (cleaned.getOrNull(0)) {
            "product" -> "nbcustomer://open/product/${cleaned.getOrNull(1)}"
            "order" -> "nbcustomer://open/order/${cleaned.getOrNull(1)}"
            "appointment" -> "nbcustomer://open/appointment"
            else -> return null
        }
        return Intent(Intent.ACTION_VIEW, Uri.parse(uri))
    }
}
