// Orders, profile, notifications, deep links, push registration.
import SwiftUI
import UserNotifications

struct OrdersView: View {
    @EnvironmentObject private var state: AppState
    @State private var orders: [OrderSummary] = []

    var body: some View {
        NavigationStack {
            List {
                if orders.isEmpty {
                    Text("No orders yet.").foregroundStyle(.secondary)
                }
                ForEach(orders) { order in
                    NavigationLink {
                        OrderDetailView(orderId: order.id)
                    } label: {
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text("#\(order.id.prefix(8))").font(.headline)
                                Text(formatISODateTime(order.placedAt)).font(.caption).foregroundStyle(.secondary)
                            }
                            Spacer()
                            VStack(alignment: .trailing, spacing: 2) {
                                Text(formatMoney(order.totalCents)).font(.headline)
                                Text(order.status.lowercased().replacingOccurrences(of: "_", with: " "))
                                    .font(.caption).foregroundStyle(.secondary)
                            }
                        }
                    }
                }
            }
            .navigationTitle("Orders")
            .task { await load() }
        }
    }

    private func load() async {
        orders = (try? await state.api.request(OrdersResponse.self, "orders"))?.orders ?? []
    }
}

struct OrderDetailView: View {
    @EnvironmentObject private var state: AppState
    let orderId: String
    @State private var detail: OrderDetail?

    var body: some View {
        Form {
            if let d = detail {
                Section("Order #\(d.id.prefix(8))") {
                    LabeledContent("Status", value: d.status.lowercased().replacingOccurrences(of: "_", with: " "))
                    LabeledContent("Placed", value: formatISODateTime(d.placedAt))
                }
                Section("Items") {
                    ForEach(Array(d.items.enumerated()), id: \.offset) { _, item in
                        HStack {
                            Text("\(item.qty)× \(item.name)")
                            Spacer()
                            Text(formatMoney(item.unitPriceCents * item.qty))
                        }
                    }
                }
                Section("Totals") {
                    LabeledContent("Subtotal", value: formatMoney(d.subtotalCents))
                    if d.discountCents > 0 {
                        LabeledContent("Discount", value: "-" + formatMoney(d.discountCents))
                    }
                    if d.deliveryFeeCents > 0 {
                        LabeledContent("Delivery", value: formatMoney(d.deliveryFeeCents))
                    }
                    LabeledContent("Total", value: formatMoney(d.totalCents)).fontWeight(.semibold)
                }
                if let line1 = d.address?.line1 {
                    Section("Delivery") { Text(line1) }
                }
                if let payment = d.payment {
                    Section("Payment") {
                        LabeledContent("Method", value: payment.method)
                        LabeledContent("Status", value: payment.status)
                    }
                }
            } else {
                ProgressView().centered()
            }
        }
        .navigationTitle("Order")
        .task {
            detail = try? await state.api.request(OrderDetailEnvelope.self, "orders/\(orderId)").order
        }
    }
}

extension ProgressView {
    func centered() -> some View {
        frame(maxWidth: .infinity, alignment: .center)
    }
}

// MARK: - Profile

struct ProfileView: View {
    @EnvironmentObject private var state: AppState
    @State private var user: User?
    @State private var confirmDelete = false

    var body: some View {
        NavigationStack {
            List {
                if let user {
                    Section("Account") {
                        LabeledContent("Name", value: user.name)
                        LabeledContent("Email", value: user.email)
                        Toggle(
                            "Promotional notifications",
                            isOn: Binding(
                                get: { user.marketingOptIn },
                                set: { newValue in
                                    self.user?.marketingOptIn = newValue
                                    Task {
                                        try? await state.api.request(
                                            UserEnvelope.self, "me", method: "PATCH",
                                            body: UpdateMeRequest(marketingOptIn: newValue),
                                        )
                                    }
                                },
                            ),
                        )
                    }
                }
                Section {
                    NavigationLink {
                        NotificationsView()
                    } label: {
                        Label("Notifications", systemImage: "bell")
                    }
                    Button(role: .destructive) {
                        Task { await state.signOut() }
                    } label: {
                        Label("Sign out", systemImage: "rectangle.portrait.and.arrow.right")
                    }
                }
                Section {
                    Button(role: .destructive) {
                        confirmDelete = true
                    } label: {
                        Label("Delete my account", systemImage: "trash")
                    }
                    .confirmationDialog(
                        "Delete your account? Orders are kept for accounting; everything else is erased.",
                        isPresented: $confirmDelete,
                        titleVisibility: .visible,
                    ) {
                        Button("Delete account", role: .destructive) {
                            Task { await state.deleteAccount() }
                        }
                    }
                }
            }
            .navigationTitle("Profile")
            .task {
                user = try? await state.api.request(UserEnvelope.self, "me").user
            }
        }
    }
}

// MARK: - Notifications inbox (in-app)

struct NotificationsView: View {
    @EnvironmentObject private var state: AppState
    @State private var items: [NotificationItem] = []

    var body: some View {
        List {
            if items.isEmpty {
                Text("You're all caught up.").foregroundStyle(.secondary)
            }
            ForEach(items) { n in
                VStack(alignment: .leading, spacing: 2) {
                    HStack {
                        Text(n.title).font(.headline)
                        if !n.read {
                            Text("new").font(.caption2.bold()).padding(3)
                                .background(Capsule().fill(Color.accentColor.opacity(0.2)))
                        }
                    }
                    if let body = n.body {
                        Text(body).font(.subheadline).foregroundStyle(.secondary)
                    }
                    Text(formatISODateTime(n.createdAt)).font(.caption2).foregroundStyle(.tertiary)
                }
            }
        }
        .navigationTitle("Notifications")
        .task {
            items = (try? await state.api.request(NotificationPage.self, "notifications"))?.notifications ?? []
            try? await state.api.send("notifications/read-all", method: "POST")
        }
    }
}

// MARK: - Deep links + push

/// Central router for nbcustomer://open/... links arriving via URL schemes or push.
@MainActor
final class DeepLinkRouter: ObservableObject {
    static let shared = DeepLinkRouter()
    @Published var pending: URL?
}

/// Registers APNs and forwards pushes. Device tokens bind server-side to the
/// signed-in customer (see POST /devices); tokens are never a permanent identity.
final class PushRegistrar {
    static func register(api: APIClient) async {
        do {
            let granted = try await UNUserNotificationCenter.current()
                .requestAuthorization(options: [.alert, .badge, .sound])
            guard granted else { return }
            let tokenData = try await UIApplication.shared.registerForRemoteNotifications()
            // Bind the APNs token for this installation/user. The backend's
            // devices table stores whatever platform token we send it.
            _ = try? await api.send(
                "devices",
                method: "POST",
                body: ["fcmToken": tokenData.hexString, "platform": "ios"],
            )
        } catch {
            // Push is best-effort; never block app startup on it.
        }
    }
}

extension Data {
    var hexString: String { map { String(format: "%02x", $0) }.joined() }
}
