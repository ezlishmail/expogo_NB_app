// Entry point + root routing. Tabs mirror the tenant feature flags so the
// iOS and Android apps behave identically for every tenant.
import SwiftUI
import UIKit

@main
struct NorthernBloomApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @StateObject private var state = AppState()
    @State private var deeplinkTarget: DeeplinkTarget?

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(state)
                .task {
                    await state.bootstrap()
                    await PushRegistrar.requestAuthorization()
                }
                .onOpenURL { url in
                    deeplinkTarget = DeeplinkTarget(url: url)
                }
                .onReceive(DeepLinkRouter.shared.$pending) { pending in
                    guard let pending else { return }
                    DeepLinkRouter.shared.pending = nil
                    deeplinkTarget = DeeplinkTarget(url: pending)
                }
                .sheet(item: $deeplinkTarget) { target in
                    NavigationStack {
                        target.view()
                            .environmentObject(state)
                    }
                }
        }
    }
}

/// Maps deep links (nbcustomer://open/product/123, /order/456) to screens.
struct DeeplinkTarget: Identifiable {
    enum Kind {
        case product(String)
        case order(String)
    }
    let kind: Kind
    var id: String {
        switch kind {
        case .product(let id): return "product-\(id)"
        case .order(let id): return "order-\(id)"
        }
    }

    init?(url: URL) {
        // nbcustomer://open/<kind>/<id>
        let parts = url.pathComponents.filter { $0 != "/" && $0.lowercased() != "open" }
        switch parts.first {
        case "product":
            guard parts.count > 1 else { return nil }
            kind = .product(parts[1])
        case "order":
            guard parts.count > 1 else { return nil }
            kind = .order(parts[1])
        default:
            return nil
        }
    }

    @ViewBuilder
    func view() -> some View {
        switch kind {
        case .product(let id):
            ProductDeepLinkPlaceholder(productId: id)
        case .order(let id):
            OrderDetailView(orderId: id)
        }
    }
}

private struct ProductDeepLinkPlaceholder: View {
    let productId: String
    var body: some View {
        ProductDetailView(product: CatalogProduct(
            id: productId,
            categoryId: nil,
            name: "Product",
            description: nil,
            priceCents: 0,
            imageUrl: nil,
            soldOut: false,
            featured: false,
        ))
    }
}

struct RootView: View {
    @EnvironmentObject private var state: AppState

    var body: some View {
        switch state.phase {
        case .loading:
            ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
        case .loggedOut:
            AuthView()
        case .loggedIn:
            MainTabView()
        }
    }
}

struct MainTabView: View {
    @EnvironmentObject private var state: AppState

    var body: some View {
        TabView {
            HomeView()
                .tabItem { Label("Home", systemImage: "house") }

            if state.config?.features.shopping != false {
                ShopView()
                    .tabItem { Label("Shop", systemImage: "bag") }
            }

            if state.config?.features.appointments != false {
                MyAppointmentsView()
                    .tabItem { Label("Book", systemImage: "calendar") }
            }

            OrdersView()
                .tabItem { Label("Orders", systemImage: "shippingbox") }

            ProfileView()
                .tabItem { Label("Profile", systemImage: "person") }
        }
        .tint(Color.fromHexOrNull(state.config?.brand.primaryColor) ?? Color.green)
    }
}
