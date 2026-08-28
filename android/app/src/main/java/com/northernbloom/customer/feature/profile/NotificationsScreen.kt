package com.northernbloom.customer.feature.profile

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
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.northernbloom.customer.core.AppContainer
import com.northernbloom.customer.core.apiCall
import com.northernbloom.customer.core.dto.NotificationDto

@Composable
fun NotificationsScreen(container: AppContainer, onBack: () -> Unit) {
    var items by remember { mutableStateOf<List<NotificationDto>>(emptyList()) }

    LaunchedEffect(Unit) {
        try {
            apiCall { container.api.notifications() }.let { items = it.notifications }
            apiCall { container.api.markAllRead() }
        } catch (_: Exception) {
            // Empty state on failure.
        }
    }

    Column(Modifier.fillMaxSize().padding(16.dp)) {
        Row(Modifier.fillMaxWidth(), Arrangement.SpaceBetween) {
            OutlinedButton(onClick = onBack) { Text("← Back") }
            Text("Notifications", style = MaterialTheme.typography.headlineSmall)
        }

        if (items.isEmpty()) {
            Text("You're all caught up.", Modifier.padding(top = 24.dp))
        }

        items.forEach { n ->
            Card(
                Modifier
                    .fillMaxWidth()
                    .padding(top = 8.dp),
            ) {
                Column(
                    Modifier
                        .padding(12.dp)
                        .fillMaxWidth()
                        .semantics { contentDescription = n.title },
                ) {
                    Row(Modifier.fillMaxWidth(), Arrangement.SpaceBetween) {
                        Text(n.title, style = MaterialTheme.typography.titleSmall)
                        if (!n.read) {
                            androidx.compose.material3.Badge { Text("new") }
                        }
                    }
                    if (n.body != null) {
                        Text(n.body!!, style = MaterialTheme.typography.bodySmall)
                    }
                    Text(
                        com.northernbloom.customer.core.formatDateTime(n.createdAt),
                        style = MaterialTheme.typography.labelSmall,
                    )
                }
            }
        }
    }
}
