package com.northernbloom.customer.feature.book

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
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
import com.northernbloom.customer.core.dto.AppointmentDto
import com.northernbloom.customer.core.formatDateTime

@Composable
fun MyAppointmentsScreen(container: AppContainer, onBookNew: () -> Unit) {
    var appointments by remember { mutableStateOf<List<AppointmentDto>>(emptyList()) }
    var error by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(Unit) {
        try {
            appointments = apiCall { container.api.appointments(upcoming = true) }.appointments
        } catch (e: Exception) {
            error = e.message
        }
    }

    Column(Modifier.fillMaxSize().padding(16.dp)) {
        Text("My appointments", style = MaterialTheme.typography.headlineSmall)
        Button(onClick = onBookNew, Modifier.padding(top = 8.dp)) { Text("Book new") }

        error?.let { Text(it, color = MaterialTheme.colorScheme.error, Modifier.padding(top = 12.dp)) }

        if (appointments.isEmpty() && error == null) {
            Text("Nothing booked yet.", Modifier.padding(top = 24.dp))
        }

        appointments.forEach { appt ->
            Card(Modifier.fillMaxWidth().padding(top = 12.dp)) {
                Column(Modifier.padding(12.dp)) {
                    Row(Modifier.fillMaxWidth(), Arrangement.SpaceBetween) {
                        Text(appt.serviceName ?: "Appointment", style = MaterialTheme.typography.titleSmall)
                        Text(appt.status, style = MaterialTheme.typography.labelSmall)
                    }
                    Text(formatDateTime(appt.startsAt), style = MaterialTheme.typography.bodySmall)
                    appt.staffName?.let { Text("with $it", style = MaterialTheme.typography.bodySmall) }
                }
            }
        }
    }
}
