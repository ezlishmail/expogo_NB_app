// Auth + Home screens.
import SwiftUI

struct AuthView: View {
    @EnvironmentObject private var state: AppState
    @State private var isRegistering = false
    @State private var name = ""
    @State private var email = ""
    @State private var password = ""
    @State private var busy = false
    @State private var errorText: String?

    var body: some View {
        VStack(spacing: 16) {
            Spacer()
            Text("Welcome").font(.largeTitle.bold())
            Text("Sign in to book and shop faster").foregroundStyle(.secondary)

            Picker("", selection: $isRegistering) {
                Text("Sign in").tag(false)
                Text("Register").tag(true)
            }
            .pickerStyle(.segmented)
            .padding(.horizontal)

            if isRegistering {
                TextField("Full name", text: $name)
                    .textFieldStyle(.roundedBorder)
                    .padding(.horizontal)
            }
            TextField("Email", text: $email)
                .keyboardType(.emailAddress)
                .autocorrectionDisabled()
                .textInputAutocapitalization(.never)
                .textFieldStyle(.roundedBorder)
                .padding(.horizontal)
            SecureField(isRegistering ? "Password (8+ characters)" : "Password", text: $password)
                .textFieldStyle(.roundedBorder)
                .padding(.horizontal)

            if let errorText {
                Text(errorText).font(.footnote).foregroundStyle(.red)
            }

            Button {
                Task { await submit() }
            } label: {
                if busy {
                    ProgressView().frame(maxWidth: .infinity)
                } else {
                    Text(isRegistering ? "Create account" : "Sign in")
                        .frame(maxWidth: .infinity)
                }
            }
            .buttonStyle(.borderedProminent)
            .disabled(busy || email.isEmpty || password.isEmpty || (isRegistering && name.isEmpty))
            .padding(.horizontal)
            Spacer()
        }
    }

    private func submit() async {
        busy = true
        errorText = nil
        do {
            if isRegistering {
                try await state.register(name: name, email: email, password: password)
            } else {
                try await state.signIn(email: email, password: password)
            }
        } catch {
            errorText = error.localizedDescription
        }
        busy = false
    }
}

// MARK: - Home

struct HomeView: View {
    @EnvironmentObject private var state: AppState
    @State private var greeting = "Hello"
    @State private var featured: [CatalogProduct] = []

    var body: some View {
        NavigationStack {
            List {
                Section {
                    Text(greeting).font(.title2.bold()).listRowBackground(Color.clear)
                }

                if state.config?.features.appointments != false {
                    Section {
                        NavigationLink {
                            BookingFlowView()
                        } label: {
                            VStack(alignment: .leading, spacing: 4) {
                                Text("Book an appointment").font(.headline)
                                Text("Pick a service, staff and time that suits you.")
                                    .font(.subheadline).foregroundStyle(.secondary)
                            }
                            .padding(.vertical, 4)
                        }
                    }
                }

                if state.config?.features.shopping != false && !featured.isEmpty {
                    Section("Featured") {
                        ForEach(featured) { product in
                            NavigationLink {
                                ProductDetailView(product: product)
                            } label: {
                                HStack {
                                    Text(product.name)
                                    Spacer()
                                    Text(formatMoney(product.priceCents)).foregroundStyle(.secondary)
                                }
                            }
                        }
                    }
                }
            }
            .navigationTitle(state.config?.brand.name ?? "Home")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    NavigationLink {
                        NotificationsView()
                    } label: {
                        Image(systemName: "bell")
                    }
                }
            }
            .task { await load() }
        }
    }

    private func load() async {
        do {
            let me = try await state.api.request(UserEnvelope.self, "me")
            greeting = "Hi, \(me.user.name.split(separator: " ").first ?? "there")"
            let catalog = try await state.api.request(CatalogResponse.self, "catalog")
            featured = catalog.products.filter(\.featured)
        } catch {
            // Offline-tolerant home.
        }
    }
}
