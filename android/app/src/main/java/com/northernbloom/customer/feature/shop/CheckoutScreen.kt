package com.northernbloom.customer.feature.shop

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
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
import com.northernbloom.customer.core.formatMoney
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

class CheckoutViewModel(private val container: AppContainer) : ViewModel() {
    data class UiState(
        val fulfillment: String = "PICKUP",
        val line1: String = "",
        val city: String = "",
        val postalCode: String = "",
        val coupon: String = "",
        val busy: Boolean = false,
        val error: String? = null,
        val placedOrderId: String? = null,
    )

    private val _state = MutableStateFlow(UiState())
    val state: StateFlow<UiState> = _state

    fun setFulfillment(v: String) = mutate { it.copy(fulfillment = v) }
    fun setLine1(v: String) = mutate { it.copy(line1 = v) }
    fun setCity(v: String) = mutate { it.copy(city = v) }
    fun setPostal(v: String) = mutate { it.copy(postalCode = v) }
    fun setCoupon(v: String) = mutate { it.copy(coupon = v.uppercase()) }

    fun checkout() {
        val s = _state.value
        if (s.busy || CartStore.lines.isEmpty()) return
        if (s.fulfillment == "DELIVERY" && s.line1.isBlank()) {
            mutate { it.copy(error = "Please enter a delivery address") }
            return
        }

        mutate { it.copy(busy = true, error = null) }
        viewModelScope.launch {
            try {
                val res = apiCall {
                    container.api.placeOrder(
                        com.northernbloom.customer.core.PlaceOrderRequest(
                            items = CartStore.lines.map { com.northernbloom.customer.core.CartLineRequest(it.productId, it.qty) },
                            fulfillment = s.fulfillment,
                            address = if (s.fulfillment == "DELIVERY") {
                                com.northernbloom.customer.core.NewAddressInline(
                                    line1 = s.line1.trim(),
                                    city = s.city.trim().ifBlank { null },
                                    postalCode = s.postalCode.trim().ifBlank { null },
                                )
                            } else null,
                            couponCode = s.coupon.ifBlank { null },
                        ),
                    )
                }
                CartStore.clear()
                _state.value = _state.value.copy(busy = false, placedOrderId = res.order.id)
            } catch (e: ApiException) {
                mutate { it.copy(busy = false, error = e.message) }
            } catch (e: Exception) {
                mutate { it.copy(busy = false, error = "Checkout failed. Please try again.") }
            }
        }
    }

    private fun mutate(reducer: (UiState) -> UiState) {
        _state.value = reducer(_state.value)
    }
}

@Composable
fun CheckoutScreen(container: AppContainer, onDone: (String) -> Unit) {
    val vm: CheckoutViewModel = viewModel(factory = viewModelFactory { initializer { CheckoutViewModel(container) } })
    val state by vm.state.collectAsState()

    // Hand the order id to navigation once placed.
    state.placedOrderId?.let(onDone)

    Column(Modifier.fillMaxSize().padding(16.dp), Arrangement.spacedBy(12.dp)) {
        Text("Checkout", style = MaterialTheme.typography.headlineSmall)

        Row(Arrangement.spacedBy(8.dp)) {
            FilterChip(
                selected = state.fulfillment == "PICKUP",
                onClick = { vm.setFulfillment("PICKUP") },
                label = { Text("Store pickup") },
            )
            FilterChip(
                selected = state.fulfillment == "DELIVERY",
                onClick = { vm.setFulfillment("DELIVERY") },
                label = { Text("Delivery") },
            )
        }

        if (state.fulfillment == "DELIVERY") {
            Card {
                Column(Modifier.padding(12.dp)) {
                    OutlinedTextField(
                        value = state.line1,
                        onValueChange = vm::setLine1,
                        label = { Text("Street address") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                    )
                    Row(Arrangement.spacedBy(8.dp), Modifier.padding(top = 8.dp)) {
                        OutlinedTextField(
                            value = state.city,
                            onValueChange = vm::setCity,
                            label = { Text("City") },
                            modifier = Modifier.weight(1f),
                            singleLine = true,
                        )
                        OutlinedTextField(
                            value = state.postalCode,
                            onValueChange = vm::setPostal,
                            label = { Text("Postal code") },
                            modifier = Modifier.weight(1f),
                            singleLine = true,
                        )
                    }
                }
            }
        }

        OutlinedTextField(
            value = state.coupon,
            onValueChange = vm::setCoupon,
            label = { Text("Coupon code (optional)") },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
        )

        Row(Modifier.fillMaxWidth(), Arrangement.SpaceBetween) {
            Text("Subtotal")
            Text(formatMoney(CartStore.subtotalCents()))
        }
        Text("Final total is confirmed by the store before payment.", style = MaterialTheme.typography.bodySmall)

        state.error?.let {
            Text(it, color = MaterialTheme.colorScheme.error)
        }

        Button(
            onClick = vm::checkout,
            enabled = !state.busy,
            Modifier.fillMaxWidth(),
        ) { Text(if (state.busy) "Placing order…" else "Place order · Pay at store") }

        OutlinedButton(onClick = onDone, Modifier.fillMaxWidth()) { Text("Cancel") }
    }
}
