package com.northernbloom.customer.feature.shop

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.northernbloom.customer.core.AppContainer
import com.northernbloom.customer.core.apiCall
import com.northernbloom.customer.core.formatMoney

@Composable
fun ProductDetailScreen(
    container: AppContainer,
    productId: String,
    onBack: () -> Unit,
    onOpenCart: () -> Unit,
) {
    val product = remember {
        mutableStateOf<com.northernbloom.customer.core.dto.CatalogProductDto?>(null)
    }
    LaunchedEffect(productId) {
        try {
            // Catalog is the v1 source for product details (single round-trip).
            product.value = apiCall { container.api.catalog() }.products.firstOrNull { it.id == productId }
        } catch (_: Exception) {
        }
    }

    val p = product.value ?: return
    Column(Modifier.fillMaxSize().padding(16.dp), Arrangement.spacedBy(12.dp)) {
        OutlinedButton(onClick = onBack) { Text("← Back") }
        Text(p.name, style = MaterialTheme.typography.headlineSmall)
        Text(formatMoney(p.priceCents), style = MaterialTheme.typography.titleLarge)
        if (p.description != null) Text(p.description!!, style = MaterialTheme.typography.bodyMedium)
        if (p.soldOut) {
            Text("Currently sold out", color = MaterialTheme.colorScheme.error)
        } else {
            Button(onClick = {
                CartStore.add(p.id, p.name, p.priceCents)
                onOpenCart()
            }, Modifier.fillMaxWidth()) {
                Text("Add to cart")
            }
        }
        Row(Modifier.fillMaxWidth(), Arrangement.End, verticalAlignment = Alignment.CenterVertically) {}
    }
}
