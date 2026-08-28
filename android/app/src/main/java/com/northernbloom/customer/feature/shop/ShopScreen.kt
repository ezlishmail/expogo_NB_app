package com.northernbloom.customer.feature.shop

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ShoppingCart
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.Card
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.northernbloom.customer.core.AppContainer
import com.northernbloom.customer.core.apiCall
import com.northernbloom.customer.core.dto.CatalogResponse
import com.northernbloom.customer.core.formatMoney

// Cart lives client-side (v1 has no server cart tables); totals are always
// recomputed server-side at checkout.
object CartStore {
    data class Line(val productId: String, val name: String, val priceCents: Int, var qty: Int)

    private val _lines = mutableListOf<Line>()
    val lines: List<Line> get() = _lines.toList()

    fun add(productId: String, name: String, priceCents: Int) {
        val existing = _lines.firstOrNull { it.productId == productId }
        if (existing != null) existing.qty += 1 else _lines.add(Line(productId, name, priceCents, 1))
    }

    fun remove(productId: String) {
        _lines.removeAll { it.productId == productId }
    }

    fun setQty(productId: String, qty: Int) {
        if (qty <= 0) return remove(productId)
        _lines.firstOrNull { it.productId == productId }?.qty = qty
    }

    fun subtotalCents(): Int = _lines.sumOf { it.priceCents * it.qty }

    fun count(): Int = _lines.sumOf { it.qty }

    fun clear() = _lines.clear()
}

@Composable
fun ShopScreen(
    container: AppContainer,
    onOpenProduct: (String) -> Unit,
    onOpenCart: () -> Unit,
) {
    val catalog = remember { mutableStateOf<CatalogResponse?>(null) }
    val selectedCategory = remember { mutableStateOf<String?>(null) }

    LaunchedEffect(Unit) {
        try {
            catalog.value = apiCall { container.api.catalog() }
        } catch (_: Exception) {
            // Offline; empty state shows.
        }
    }

    Column(Modifier.fillMaxSize().padding(16.dp)) {
        Row(Modifier.fillMaxWidth(), Arrangement.SpaceBetween) {
            Text("Shop", style = MaterialTheme.typography.headlineSmall)
            BadgedBox(badge = { if (CartStore.count() > 0) Badge { Text(CartStore.count().toString()) } }) {
                Icon(
                    Icons.Default.ShoppingCart,
                    contentDescription = "Cart",
                    Modifier.clickable(onClick = onOpenCart),
                )
            }
        }

        Row(
            Modifier.fillMaxWidth().padding(top = 8.dp),
            Arrangement.spacedBy(6.dp),
        ) {
            FilterChip(
                selected = selectedCategory.value == null,
                onClick = { selectedCategory.value = null },
                label = { Text("All") },
            )
            (catalog.value?.categories ?: emptyList()).forEach { c ->
                FilterChip(
                    selected = selectedCategory.value == c.id,
                    onClick = { selectedCategory.value = c.id },
                    label = { Text(c.name) },
                )
            }
        }

        val visible = (catalog.value?.products ?: emptyList())
            .filter { selectedCategory.value == null || it.categoryId == selectedCategory.value }

        Column {
            visible.forEach { p ->
                Card(
                    Modifier
                        .fillMaxWidth()
                        .padding(top = 8.dp)
                        .clickable { onOpenProduct(p.id) },
                ) {
                    Row(Modifier.padding(12.dp).fillMaxWidth(), Arrangement.SpaceBetween) {
                        Column(Modifier.weight(1f)) {
                            Text(p.name, style = MaterialTheme.typography.titleSmall)
                            if (p.description != null) {
                                Text(p.description!!, style = MaterialTheme.typography.bodySmall, maxLines = 1)
                            }
                        }
                        Text(if (p.soldOut) "Sold out" else formatMoney(p.priceCents))
                    }
                }
            }
            if (visible.isEmpty()) {
                Text("No products yet.", Modifier.padding(top = 24.dp))
            }
        }
    }
}
