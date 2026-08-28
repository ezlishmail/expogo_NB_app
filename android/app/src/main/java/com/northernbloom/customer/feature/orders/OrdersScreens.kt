package com.northernbloom.customer.feature.orders

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.northernbloom.customer.core.AppContainer
import com.northernbloom.customer.core.apiCall
import com.northernbloom.customer.core.dto.OrderDetailDto
import com.northernbloom.customer.core.dto.OrderSummaryDto
import com.northernbloom.customer.core.formatDateTime
import com.northernbloom.customer.core.formatMoney

@Composable
fun OrdersScreen(container: AppContainer, onOpenOrder: (String) -> Unit) {
    var orders by remember { mutableStateOf<List<OrderSummaryDto>>(emptyList()) }
    var error by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(Unit) {
        try {
            orders = apiCall { container.api.orders() }.orders
        } catch (e: Exception) {
            error = e.message
        }
    }

    Column(Modifier.fillMaxSize().padding(16.dp)) {
        Text("Orders", style = MaterialTheme.typography.headlineSmall)
        error?.let { Text(it, color = MaterialTheme.colorScheme.error, Modifier.padding(top = 12.dp)) }
        if (orders.isEmpty() && error == null) {
            Text("No orders yet.", Modifier.padding(top = 24.dp))
        }
        orders.forEach { o ->
            Card(
                Modifier
                    .fillMaxWidth()
                    .padding(top = 12.dp)
                    .clickable { onOpenOrder(o.id) },
            ) {
                Row(Modifier.padding(12.dp).fillMaxWidth(), Arrangement.SpaceBetween) {
                    Column {
                        Text("#${o.id.take(8)}", style = MaterialTheme.typography.titleSmall)
                        Text(formatDateTime(o.placedAt), style = MaterialTheme.typography.bodySmall)
                    }
                    Column(horizontalAlignment = androidx.compose.ui.Alignment.End) {
                        Text(formatMoney(o.totalCents), style = MaterialTheme.typography.titleSmall)
                        Text(o.status.lowercase().replace('_', ' '), style = MaterialTheme.typography.labelSmall)
                    }
                }
            }
        }
    }
}

@Composable
fun OrderDetailScreen(container: AppContainer, orderId: String, onBack: () -> Unit) {
    var order by remember { mutableStateOf<OrderDetailDto?>(null) }
    var error by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(orderId) {
        try {
            order = apiCall { container.api.order(orderId) }.order
        } catch (e: Exception) {
            error = e.message
        }
    }

    Column(Modifier.fillMaxSize().padding(16.dp)) {
        OutlinedButton(onClick = onBack) { Text("← Back") }
        val o = order
        when {
            error != null -> Text(error!!, color = MaterialTheme.colorScheme.error, Modifier.padding(top = 12.dp))
            o == null -> Text("Loading…", Modifier.padding(top = 12.dp))
            else -> Column(Modifier.padding(top = 8.dp)) {
                Text("Order #${o.id.take(8)}", style = MaterialTheme.typography.headlineSmall)
                Text(o.status.lowercase().replace('_', ' '), Modifier.padding(top = 4.dp))
                Text(formatDateTime(o.placedAt), style = MaterialTheme.typography.bodySmall)

                Column(Modifier.padding(top = 16.dp)) {
                    o.items.forEach { item ->
                        Row(Modifier.fillMaxWidth().padding(vertical = 4.dp), Arrangement.SpaceBetween) {
                            Text("${item.qty}× ${item.name}")
                            Text(formatMoney(item.unitPriceCents * item.qty))
                        }
                    }
                }

                Column(Modifier.padding(top = 12.dp)) {
                    Row(Modifier.fillMaxWidth(), Arrangement.SpaceBetween) {
                        Text("Subtotal"); Text(formatMoney(o.subtotalCents))
                    }
                    if (o.discountCents > 0) {
                        Row(Modifier.fillMaxWidth(), Arrangement.SpaceBetween) {
                            Text("Discount", color = MaterialTheme.colorScheme.primary)
                            Text("−" + formatMoney(o.discountCents), color = MaterialTheme.colorScheme.primary)
                        }
                    }
                    if (o.deliveryFeeCents > 0) {
                        Row(Modifier.fillMaxWidth(), Arrangement.SpaceBetween) {
                            Text("Delivery"); Text(formatMoney(o.deliveryFeeCents))
                        }
                    }
                    Row(Modifier.fillMaxWidth().padding(top = 6.dp), Arrangement.SpaceBetween) {
                        Text("Total", style = MaterialTheme.typography.titleMedium)
                        Text(formatMoney(o.totalCents), style = MaterialTheme.typography.titleMedium)
                    }
                }

                o.address?.line1?.let {
                    Text("Deliver to: $it", Modifier.padding(top = 12.dp), style = MaterialTheme.typography.bodySmall)
                }
                o.payment?.let {
                    Text(
                        "Payment: ${it.method} · ${it.status}",
                        Modifier.padding(top = 4.dp),
                        style = MaterialTheme.typography.bodySmall,
                    )
                }
            }
        }
    }
}
