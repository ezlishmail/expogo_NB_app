// Manual DI container: API client, session store, config state.
// Solo-dev pragmatic; swap for Hilt/Koin if the team grows.
package com.northernbloom.customer.core

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.jakewharton.retrofit2.converter.kotlinx.serialization.asConverterFactory
import com.northernbloom.customer.BuildConfig
import com.northernbloom.customer.core.dto.TenantConfig
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.first
import kotlinx.serialization.json.Json
import okhttp3.Interceptor
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Response
import retrofit2.Retrofit
import java.util.concurrent.TimeUnit

private val Context.dataStore by preferencesDataStore(name = "nb_session")

class SessionStore(private val context: Context) {
    private val tokenKey = stringPreferencesKey("auth_token")

    suspend fun token(): String? = context.dataStore.data.first()[tokenKey]

    suspend fun save(token: String) {
        context.dataStore.edit { it[tokenKey] = token }
    }

    suspend fun clear() {
        context.dataStore.edit { it.remove(tokenKey) }
    }
}

sealed interface SessionState {
    data object Loading : SessionState
    data object LoggedOut : SessionState
    data class LoggedIn(val token: String) : SessionState
}

/** In-memory mirror of the persisted token so the OkHttp interceptor stays sync. */
object TokenHolder {
    @Volatile
    var token: String? = null
}

private class AuthInterceptor : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val request = chain.request().newBuilder().apply {
            TokenHolder.token?.let { header("Authorization", "Bearer $it") }
        }.build()
        return chain.proceed(request)
    }
}

class AppContainer(private val context: Context) {
    val sessionStore = SessionStore(context)

    private val json = Json {
        ignoreUnknownKeys = true
        coerceInputValues = true
    }

    private val okHttp = OkHttpClient.Builder()
        .addInterceptor(AuthInterceptor())
        .connectTimeout(20, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .build()

    val api: NbApi = Retrofit.Builder()
        .baseUrl(BuildConfig.API_BASE_URL)
        .client(okHttp)
        .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
        .build()
        .create(NbApi::class.java)

    // Live tenant branding/features, refreshed on every app start.
    private val _config = MutableStateFlow<TenantConfig?>(null)
    val config: StateFlow<TenantConfig?> = _config

    fun publishConfig(cfg: TenantConfig) {
        _config.value = cfg
    }

    private val _session = MutableStateFlow<SessionState>(SessionState.Loading)
    val session: StateFlow<SessionState> = _session

    suspend fun restoreSession() {
        val token = sessionStore.token()
        TokenHolder.token = token
        _session.value = if (token != null) SessionState.LoggedIn(token) else SessionState.LoggedOut
    }

    suspend fun loggedIn(token: String) {
        TokenHolder.token = token
        sessionStore.save(token)
        _session.value = SessionState.LoggedIn(token)
    }

    suspend fun loggedOut() {
        TokenHolder.token = null
        sessionStore.clear()
        _session.value = SessionState.LoggedOut
    }
}
