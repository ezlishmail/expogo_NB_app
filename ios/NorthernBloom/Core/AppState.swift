// App-wide observable state: session + tenant config (branding/features).
import SwiftUI

@MainActor
final class AppState: ObservableObject {
    enum Phase { case loading, loggedOut, loggedIn }

    @Published var phase: Phase = .loading
    @Published var config: TenantConfig?

    let api: APIClient

    // Cart is client-side; totals are recomputed server-side at checkout.
    struct CartLine: Identifiable {
        let productId: String
        let name: String
        let priceCents: Int
        var qty: Int
        var id: String { productId }
    }
    @Published var cart: [CartLine] = []

    init(api: APIClient = APIClient()) {
        self.api = api
    }

    func bootstrap() async {
        if let token = await TokenStore.shared.token() {
            phase = .loggedIn
        } else {
            phase = .loggedOut
        }
        // Branding/features refresh every launch; last value stays visible offline.
        if let cfg = try? await requestConfig() {
            config = cfg
        }
    }

    private func requestConfig() async throws -> TenantConfig {
        try await api.request(TenantConfig.self, "config")
    }

    func signIn(email: String, password: String) async throws {
        let res = try await api.request(
            AuthResponse.self, "auth/login", method: "POST",
            body: ["email": email, "password": password],
        )
        await TokenStore.shared.save(res.token)
        phase = .loggedIn
    }

    func register(name: String, email: String, password: String) async throws {
        let res = try await api.request(
            AuthResponse.self, "auth/register", method: "POST",
            body: ["name": name, "email": email, "password": password],
        )
        await TokenStore.shared.save(res.token)
        phase = .loggedIn
    }

    func signOut() async {
        await TokenStore.shared.clear()
        cart.removeAll()
        phase = .loggedOut
    }

    func deleteAccount() async {
        try? await api.send("me", method: "DELETE")
        await signOut()
    }

    // MARK: cart helpers

    var cartCount: Int { cart.reduce(0) { $0 + $1.qty } }
    var cartSubtotalCents: Int { cart.reduce(0) { $0 + $1.priceCents * $1.qty } }

    func addToCart(_ product: CatalogProduct) {
        if let i = cart.firstIndex(where: { $0.productId == product.id }) {
            cart[i].qty += 1
        } else {
            cart.append(CartLine(productId: product.id, name: product.name, priceCents: product.priceCents, qty: 1))
        }
    }

    func setQty(_ productId: String, _ qty: Int) {
        guard let i = cart.firstIndex(where: { $0.productId == productId }) else { return }
        cart[i].qty = qty
        if cart[i].qty <= 0 { cart.remove(at: i) }
    }
}

// MARK: - Formatting

func formatMoney(_ cents: Int) -> String {
    String(format: "$%.2f", Double(cents) / 100)
}

func formatISODateTime(_ iso: String) -> String {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    let date = formatter.date(from: iso) ?? ISO8601DateFormatter().date(from: iso)
    guard let date else { return iso }
    let df = DateFormatter()
    df.dateFormat = "EEE, MMM d · h:mm a"
    return df.string(from: date)
}

// MARK: - Brand color parsing (never crashes on bad remote values)

extension Color {
    static func fromHexOrNull(_ hex: String?) -> Color? {
        guard let hex, !hex.isEmpty else { return nil }
        let cleaned = hex.hasPrefix("#") ? String(hex.dropFirst()) : hex
        guard cleaned.count == 6, let value = UInt64(cleaned, radix: 16) else { return nil }
        return Color(
            red: Double((value >> 16) & 0xFF) / 255,
            green: Double((value >> 8) & 0xFF) / 255,
            blue: Double(value & 0xFF) / 255,
        )
    }
}
