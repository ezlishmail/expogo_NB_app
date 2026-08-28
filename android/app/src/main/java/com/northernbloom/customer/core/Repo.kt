// Repository helpers: error mapping + config bootstrap.
package com.northernbloom.customer.core

import com.northernbloom.customer.core.dto.ErrorEnvelope
import com.northernbloom.customer.core.dto.TenantConfig
import kotlinx.serialization.json.Json

class ApiException(val httpCode: Int, val code: String, message: String) : Exception(message)

val json = Json { ignoreUnknownKeys = true; coerceInputValues = true }

suspend fun <T> apiCall(block: suspend () -> T): T = try {
    block()
} catch (e: retrofit2.HttpException) {
    val bodyText = e.response()?.errorBody()?.string()
    val parsed = bodyText?.let {
        runCatching { json.decodeFromString<ErrorEnvelope>(it) }.getOrNull()
    }
    throw ApiException(
        httpCode = e.code(),
        code = parsed?.error?.code ?: "ERROR",
        message = parsed?.error?.message ?: "Something went wrong. Please try again.",
    )
}

object ConfigLoader {
    /** Fetch tenant config; returns null offline so cached UI can still render. */
    suspend fun load(api: NbApi): TenantConfig? = try {
        apiCall { api.config() }
    } catch (_: Exception) {
        null
    }
}

/** Money helper: integer cents -> "$12.34" (currency symbol configurable later). */
fun formatMoney(cents: Int): String = "$${(cents / 100)}.${(cents % 100).toString().padStart(2, '0')}"

/** "2026-08-26T13:00:00.000Z" -> "Tue, Aug 26 · 1:00 PM" */
fun formatDateTime(iso: String): String = try {
    val instant = java.time.Instant.parse(iso)
    val zoned = instant.atZone(java.time.ZoneId.systemDefault())
    val date = zoned.format(java.time.format.DateTimeFormatter.ofPattern("EEE, MMM d"))
    val time = zoned.format(java.time.format.DateTimeFormatter.ofPattern("h:mm a"))
    "$date · $time"
} catch (_: Exception) {
    iso
}
