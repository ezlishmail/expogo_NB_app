// White-label theming: colors come from the tenant config, never the APK.
package com.northernbloom.customer.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.ColorScheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import com.northernbloom.customer.core.dto.Brand

private fun parseHexOrNull(hex: String?): Color? {
    if (hex.isNullOrBlank()) return null
    val cleaned = hex.removePrefix("#")
    if (cleaned.length != 6) return null
    // Remote values must never crash the UI — anything unparseable falls back.
    val value = cleaned.toLongOrNull(16) ?: return null
    return Color(0xFF000000L or value)
}

private val DefaultPrimary = Color(0xFF16A34A)
private val DefaultAccent = Color(0xFFF472B6)

fun brandColors(brand: Brand): Pair<Color, Color> =
    (parseHexOrNull(brand.primaryColor) ?: DefaultPrimary) to
        (parseHexOrNull(brand.accentColor) ?: DefaultAccent)

@Composable
fun NBTheme(brand: Brand, content: @Composable () -> Unit) {
    val (primary, accent) = brandColors(brand)
    val scheme: ColorScheme = if (isSystemInDarkTheme()) {
        darkColorScheme(primary = primary, secondary = accent, tertiary = accent)
    } else {
        lightColorScheme(primary = primary, secondary = accent, tertiary = accent)
    }
    MaterialTheme(colorScheme = scheme, content = content)
}
