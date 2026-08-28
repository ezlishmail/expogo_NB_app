package com.northernbloom.customer.feature.auth

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.northernbloom.customer.core.AppContainer

@Composable
fun AuthScreen(container: AppContainer) {
    val vm: AuthViewModel = viewModel(factory = viewModelFactory {
        initializer { AuthViewModel(container) }
    })
    val state by vm.state.collectAsState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Spacer(Modifier.height(32.dp))
        Text("Welcome", style = MaterialTheme.typography.headlineMedium, textAlign = TextAlign.Center)
        Text("Sign in to book and shop faster", style = MaterialTheme.typography.bodyMedium)

        SingleChoiceSegmentedButtonRow(modifier = Modifier.padding(top = 24.dp).fillMaxWidth()) {
            SegmentedButton(
                selected = !state.isRegistering,
                onClick = { vm.setRegistering(false) },
                shape = SegmentedButtonDefaults.itemShape(0, 2),
            ) { Text("Sign in") }
            SegmentedButton(
                selected = state.isRegistering,
                onClick = { vm.setRegistering(true) },
                shape = SegmentedButtonDefaults.itemShape(1, 2),
            ) { Text("Register") }
        }

        if (state.isRegistering) {
            OutlinedTextField(
                value = state.name,
                onValueChange = vm::setName,
                label = { Text("Full name") },
                modifier = Modifier.padding(top = 16.dp).fillMaxWidth(),
                singleLine = true,
            )
        }
        OutlinedTextField(
            value = state.email,
            onValueChange = vm::setEmail,
            label = { Text("Email") },
            modifier = Modifier.padding(top = 16.dp).fillMaxWidth(),
            singleLine = true,
        )
        OutlinedTextField(
            value = state.password,
            onValueChange = vm::setPassword,
            label = { Text("Password") },
            supportingText = {
                if (state.isRegistering) Text("At least 8 characters")
            },
            isError = state.error != null,
            modifier = Modifier.padding(top = 8.dp).fillMaxWidth(),
            singleLine = true,
        )

        state.error?.let {
            Text(
                it,
                color = MaterialTheme.colorScheme.error,
                style = MaterialTheme.typography.bodySmall,
                modifier = Modifier.padding(top = 8.dp),
            )
        }

        Button(onClick = { vm.submit() }, enabled = !state.busy, modifier = Modifier.padding(top = 16.dp)) {
            if (state.busy) {
                CircularProgressIndicator(modifier = Modifier.height(18.dp))
            } else {
                Text(if (state.isRegistering) "Create account" else "Sign in")
            }
        }
    }
}
