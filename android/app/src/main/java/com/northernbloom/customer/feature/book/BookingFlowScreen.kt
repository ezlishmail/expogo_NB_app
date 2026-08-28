package com.northernbloom.customer.feature.book

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.northernbloom.customer.core.ApiException
import com.northernbloom.customer.core.AppContainer
import com.northernbloom.customer.core.apiCall
import com.northernbloom.customer.core.dto.SlotDto
import com.northernbloom.customer.core.dto.ServiceDto
import com.northernbloom.customer.core.dto.StaffDto
import com.northernbloom.customer.core.formatDateTime
import com.northernbloom.customer.core.formatMoney
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

class BookingViewModel(private val container: AppContainer) : ViewModel() {
    data class UiState(
        val step: Int = 0, // 0 service, 1 staff, 2 date+time, 3 done
        val services: List<ServiceDto> = emptyList(),
        val staff: List<StaffDto> = emptyList(),
        val serviceId: String? = null,
        val staffId: String? = null,
        val date: String = java.time.LocalDate.now().plusDays(1).toString(),
        val slots: List<SlotDto> = emptyList(),
        val slot: SlotDto? = null,
        val busy: Boolean = false,
        val error: String? = null,
    )

    private val _state = MutableStateFlow(UiState())
    val state: StateFlow<UiState> = _state

    init {
        viewModelScope.launch {
            try {
                val services = apiCall { container.api.services() }.services
                val staff = apiCall { container.api.staff() }.staff
                _state.value = _state.value.copy(services = services, staff = staff)
            } catch (e: Exception) {
                _state.value = _state.value.copy(error = e.message)
            }
        }
    }

    fun pickService(id: String) {
        mutate { it.copy(serviceId = id, slot = null) }
        loadSlots()
    }

    fun pickStaff(id: String?) {
        mutate { it.copy(staffId = id, slot = null) }
        loadSlots()
    }

    fun setDate(date: String) {
        mutate { it.copy(date = date, slot = null) }
        loadSlots()
    }

    fun pickSlot(slot: SlotDto) = mutate { it.copy(slot = slot) }

    private fun loadSlots() {
        val s = _state.value
        val serviceId = s.serviceId ?: return
        viewModelScope.launch {
            try {
                val slots = apiCall {
                    container.api.availability(serviceId, s.date, s.staffId)
                }.slots
                _state.value = _state.value.copy(slots = slots)
            } catch (_: Exception) {
                _state.value = _state.value.copy(slots = emptyList())
            }
        }
    }

    fun confirm(onBooked: () -> Unit) {
        val s = _state.value
        val slot = s.slot ?: return
        if (s.busy) return
        mutate { it.copy(busy = true, error = null) }

        viewModelScope.launch {
            try {
                apiCall {
                    container.api.bookAppointment(
                        com.northernbloom.customer.core.BookRequest(
                            serviceId = s.serviceId!!,
                            staffId = slot.staffId,
                            startsAt = slot.startsAt,
                        ),
                    )
                }
                onBooked()
            } catch (e: ApiException) {
                mutate { it.copy(busy = false, error = e.message) }
            } catch (e: Exception) {
                mutate { it.copy(busy = false, error = "Booking failed. Please try again.") }
            }
        }
    }

    private fun mutate(reducer: (UiState) -> UiState) {
        _state.value = reducer(_state.value)
    }
}

@Composable
fun BookingFlowScreen(container: AppContainer, onDone: () -> Unit) {
    val vm: BookingViewModel = viewModel(factory = viewModelFactory { initializer { BookingViewModel(container) } })
    val state by vm.state.collectAsState()

    Column(Modifier.fillMaxSize().padding(16.dp)) {
        Row(Modifier.fillMaxWidth(), Arrangement.SpaceBetween) {
            OutlinedButton(onClick = onDone) { Text("← Back") }
            Text("Book appointment", style = MaterialTheme.typography.headlineSmall)
        }

        // Step 1: service
        Text("Choose a service", style = MaterialTheme.typography.titleMedium, Modifier.padding(top = 16.dp))
        state.services.forEach { svc ->
            Card(
                Modifier
                    .fillMaxWidth()
                    .padding(top = 8.dp)
                    .clickable { vm.pickService(svc.id) },
            ) {
                Row(Modifier.padding(12.dp).fillMaxWidth(), Arrangement.SpaceBetween) {
                    Column(Modifier.weight(1f)) {
                        Text(svc.name, style = MaterialTheme.typography.titleSmall)
                        Text("${svc.durationMin} min")
                    }
                    Text(if (svc.priceCents == 0) "Free" else formatMoney(svc.priceCents))
                }
            }
        }

        // Step 2: staff
        if (state.serviceId != null) {
            Text("Choose staff", style = MaterialTheme.typography.titleMedium, Modifier.padding(top = 20.dp))
            Row(Arrangement.spacedBy(8.dp), Modifier.padding(top = 8.dp)) {
                androidx.compose.material3.FilterChip(
                    selected = state.staffId == null,
                    onClick = { vm.pickStaff(null) },
                    label = { Text("Any") },
                )
                state.staff.forEach { st ->
                    androidx.compose.material3.FilterChip(
                        selected = state.staffId == st.id,
                        onClick = { vm.pickStaff(st.id) },
                        label = { Text(st.name) },
                    )
                }
            }
        }

        // Step 3: date + time
        if (state.serviceId != null) {
            Text("Pick a day", style = MaterialTheme.typography.titleMedium, Modifier.padding(top = 20.dp))
            Row(Arrangement.spacedBy(6.dp), Modifier.padding(top = 8.dp)) {
                (1..7).forEach { offset ->
                    val d = java.time.LocalDate.now().plusDays(offset.toLong())
                    androidx.compose.material3.FilterChip(
                        selected = state.date == d.toString(),
                        onClick = { vm.setDate(d.toString()) },
                        label = {
                            Text(d.format(java.time.format.DateTimeFormatter.ofPattern("EEE d")))
                        },
                    )
                }
            }

            Text("Available times", style = MaterialTheme.typography.titleMedium, Modifier.padding(top = 20.dp))
            if (state.slots.isEmpty()) {
                Text("No openings this day — try another.", Modifier.padding(top = 4.dp))
            } else {
                Column(Modifier.padding(top = 8.dp)) {
                    state.slots.chunked(3).forEach { row ->
                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp), Modifier.padding(top = 6.dp)) {
                            row.forEach { slot ->
                                androidx.compose.material3.FilterChip(
                                    selected = state.slot == slot,
                                    onClick = { vm.pickSlot(slot) },
                                    label = { Text(formatTimeOnly(slot.startsAt)) },
                                )
                            }
                        }
                    }
                }
            }

            state.error?.let {
                Text(it, color = MaterialTheme.colorScheme.error, Modifier.padding(top = 8.dp))
            }

            Button(
                onClick = { vm.confirm(onDone) },
                enabled = state.slot != null && !state.busy,
                Modifier.fillMaxWidth().padding(top = 16.dp),
            ) {
                Text(if (state.busy) "Booking…" else "Confirm booking")
            }
        }
    }
}

private fun formatInstant(iso: String, pattern: String): String = try {
    java.time.Instant.parse(iso).atZone(java.time.ZoneId.systemDefault())
        .format(java.time.format.DateTimeFormatter.ofPattern(pattern))
} catch (_: Exception) {
    iso
}

private fun formatTimeOnly(iso: String): String = formatInstant(iso, "h:mm a")
