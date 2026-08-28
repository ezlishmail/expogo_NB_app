package com.northernbloom.customer.feature.profile

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.northernbloom.customer.core.AppContainer
import com.northernbloom.customer.core.apiCall
import kotlinx.coroutines.launch

@Composable
fun ProfileScreen(container: AppContainer, onOpenNotifications: () -> Unit) {
    var name by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var marketingOptIn by remember { mutableStateOf(true) }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    LaunchedEffect(Unit) {
        try {
            val me = apiCall { container.api.me() }.user
            name = me.name
            email = me.email
            marketingOptIn = me.marketingOptIn
        } catch (e: Exception) {
            error = e.message
        }
    }

    Column(Modifier.fillMaxSize().padding(16.dp)) {
        Text("Profile", style = MaterialTheme.typography.headlineSmall)

        Card(Modifier.fillMaxWidth().padding(top = 12.dp)) {
            Column(Modifier.padding(16.dp)) {
                Text(name.ifBlank { "…" }, style = MaterialTheme.typography.titleMedium)
                Text(email, style = MaterialTheme.typography.bodySmall)
            }
        }

        Card(Modifier.fillMaxWidth().padding(top = 12.dp)) {
            Row(
                Modifier.padding(12.dp).fillMaxWidth(),
                Arrangement.SpaceBetween,
                Alignment.CenterVertically,
            ) {
                Text("Promotional notifications")
                Switch(
                    checked = marketingOptIn,
                    onCheckedChange = { checked ->
                        marketingOptIn = checked
                        scope.launch {
                            try {
                                apiCall {
                                    container.api.updateMe(
                                        com.northernbloom.customer.core.UpdateMeRequest(marketingOptIn = checked),
                                    )
                                }
                            } catch (_: Exception) {
                            }
                        }
                    },
                )
            }
        }

        OutlinedButton(onClick = onOpenNotifications, Modifier.fillMaxWidth().padding(top = 12.dp)) {
            Text("Notifications")
        }

        error?.let { Text(it, color = MaterialTheme.colorScheme.error, Modifier.padding(top = 8.dp)) }

        OutlinedButton(
            onClick = {
                busy = true
                scope.launch {
                    // Sign out clears the local session only.
                    container.loggedOut()
                }
            },
            enabled = !busy,
            modifier = Modifier.padding(top = 24.dp),
        ) { Text("Sign out") }

        Button(
            onClick = {
                busy = true
                scope.launch {
                    try {
                        apiCall { container.api.deleteMe() }
                    } catch (_: Exception) {
                        // Even if the call fails, drop the local session.
                    } finally {
                        container.loggedOut()
                    }
                }
            },
            enabled = !busy,
            colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error),
            modifier = Modifier.padding(top = 8.dp),
        ) { Text("Delete my account") }
    }
}
