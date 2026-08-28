package com.northernbloom.customer.feature.shop

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Remove
import androidx.compose.material3.Button
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.northernbloom.customer.core.formatMoney

@Composable
fun CartScreen(onBack: () -> Unit, onCheckout: () -> Unit) {
    var revision by remember { mutableIntStateOf(0) }

    Column(Modifier.fillMaxSize().padding(16.dp)) {
        Row(Modifier.fillMaxWidth(), Arrangement.SpaceBetween, Alignment.CenterVertically) {
            OutlinedButton(onClick = onBack) { Text("← Back") }
            Text("Cart", style = MaterialTheme.typography.headlineSmall)
        }

        val lines = CartStore.lines
        if (lines.isEmpty()) {
            Text("Your cart is empty.", Modifier.padding(top = 32.dp))
        } else {
            lines.forEach { line ->
                Row(
                    Modifier.fillMaxWidth().padding(top = 8.dp),
                    Arrangement.SpaceBetween,
                    Alignment.CenterVertically,
                ) {
                    Column(Modifier.weight(1f)) {
                        Text(line.name, style = MaterialTheme.typography.titleSmall)
                        Text(formatMoney(line.priceCents * line.qty), style = MaterialTheme.typography.bodySmall)
                    }
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            Icons.Default.Remove,
                            contentDescription = "Less",
                            Modifier
                                .padding(6.dp)
                                .clickable { revision++; CartStore.setQty(line.productId, line.qty - 1) },
                        )
                        Text(line.qty.toString(), Modifier.padding(horizontal = 4.dp))
                        Icon(
                            Icons.Default.Add,
                            contentDescription = "More",
                            Modifier
                                .padding(6.dp)
                                .clickable { revision++; CartStore.setQty(line.productId, line.qty + 1) },
                        )
                        Icon(
                            Icons.Default.Close,
                            contentDescription = "Remove",
                            Modifier
                                .padding(6.dp)
                                .clickable { revision++; CartStore.remove(line.productId) },
                        )
                    }
                }
            }

            Row(Modifier.fillMaxWidth().padding(top = 16.dp), Arrangement.SpaceBetween) {
                Text("Subtotal", style = MaterialTheme.typography.titleMedium)
                Text(formatMoney(CartStore.subtotalCents()), style = MaterialTheme.typography.titleMedium)
            }
            Button(onClick = onCheckout, Modifier.fillMaxWidth().padding(top = 16.dp)) {
                Text("Checkout")
            }
        }
    }
}
