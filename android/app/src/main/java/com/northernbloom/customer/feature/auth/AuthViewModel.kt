package com.northernbloom.customer.feature.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.northernbloom.customer.core.AppContainer
import com.northernbloom.customer.core.apiCall
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

data class AuthUiState(
    val isRegistering: Boolean = false,
    val name: String = "",
    val email: String = "",
    val password: String = "",
    val busy: Boolean = false,
    val error: String? = null,
)

class AuthViewModel(private val container: AppContainer) : ViewModel() {
    private val _state = MutableStateFlow(AuthUiState())
    val state: StateFlow<AuthUiState> = _state

    fun setRegistering(value: Boolean) = mutate { it.copy(isRegistering = value, error = null) }
    fun setName(v: String) = mutate { it.copy(name = v) }
    fun setEmail(v: String) = mutate { it.copy(email = v) }
    fun setPassword(v: String) = mutate { it.copy(password = v) }

    fun submit() {
        val s = _state.value
        if (s.busy || s.email.isBlank() || s.password.length < (if (s.isRegistering) 8 else 1)) return
        mutate { it.copy(busy = true, error = null) }

        viewModelScope.launch {
            try {
                val body = buildMap<String, String> {
                    put("email", s.email.trim())
                    put("password", s.password)
                    if (s.isRegistering) put("name", s.name.trim())
                }
                val res = if (s.isRegistering) {
                    apiCall { container.api.register(body) }
                } else {
                    apiCall { container.api.login(body) }
                }
                container.loggedIn(res.token)
            } catch (e: Exception) {
                mutate { it.copy(error = e.message ?: "Something went wrong") }
            } finally {
                mutate { it.copy(busy = false) }
            }
        }
    }

    private fun mutate(reducer: (AuthUiState) -> AuthUiState) {
        _state.value = reducer(_state.value)
    }
}
