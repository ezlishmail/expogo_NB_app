package com.northernbloom.customer.feature.home

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
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.northernbloom.customer.core.AppContainer
import com.northernbloom.customer.core.apiCall
import com.northernbloom.customer.core.dto.CatalogProductDto
import com.northernbloom.customer.core.formatMoney
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

class HomeViewModel(private val container: AppContainer) : ViewModel() {
    data class UiState(
        val greeting: String = "Hello",
        val featured: List<CatalogProductDto> = emptyList(),
    )

    private val _state = MutableStateFlow(UiState())
    val state: StateFlow<UiState> = _state

    init {
        viewModelScope.launch {
            try {
                val me = apiCall { container.api.me() }
                _state.value = _state.value.copy(greeting = "Hi, ${me.user.name.split(" ").first()}")
                val catalog = apiCall { container.api.catalog() }
                _state.value =
                    _state.value.copy(featured = catalog.products.filter { it.featured }.take(6))
            } catch (_: Exception) {
                // Offline-tolerant home; sections simply stay empty.
            }
        }
    }
}

@Composable
fun HomeScreen(
    container: AppContainer,
    onOpenProduct: (String) -> Unit,
    onOpenBooking: () -> Unit,
    onOpenNotifications: () -> Unit,
) {
    val vm: HomeViewModel = viewModel(factory = viewModelFactory { initializer { HomeViewModel(container) } })
    val state by vm.state.collectAsState()
    val config by container.config.collectAsState()

    Column(Modifier.fillMaxSize().padding(16.dp)) {
        Row(Modifier.fillMaxWidth(), Arrangement.SpaceBetween) {
            Text(state.greeting, style = MaterialTheme.typography.headlineSmall)
            Button(onClick = onOpenNotifications) { Text("Alerts") }
        }

        if (config?.features?.appointments != false) {
            Card(Modifier.fillMaxWidth().padding(top = 12.dp)) {
                Column(Modifier.padding(16.dp)) {
                    Text("Book an appointment", style = MaterialTheme.typography.titleMedium)
                    Text("Pick a service, staff and time that suits you.")
                    Button(onClick = onOpenBooking, Modifier.padding(top = 8.dp)) { Text("Book now") }
                }
            }
        }

        if (config?.features?.shopping != false && state.featured.isNotEmpty()) {
            Text("Featured", style = MaterialTheme.typography.titleMedium, Modifier.padding(top = 20.dp))
            state.featured.forEach { p ->
                Card(
                    Modifier
                        .fillMaxWidth()
                        .padding(top = 8.dp)
                        .clickable { onOpenProduct(p.id) },
                ) {
                    Row(Modifier.padding(12.dp).fillMaxWidth(), Arrangement.SpaceBetween) {
                        Text(p.name, Modifier.weight(1f))
                        Text(formatMoney(p.priceCents))
                    }
                }
            }
        }
    }
}
