// Shop, product detail, cart, checkout.
import SwiftUI

struct ShopView: View {
    @EnvironmentObject private var state: AppState
    @State private var catalog: CatalogResponse?
    @State private var selectedCategory: String?

    var visibleProducts: [CatalogProduct] {
        (catalog?.products ?? []).filter { selectedCategory == nil || $0.categoryId == selectedCategory }
    }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack {
                            chip(title: "All", id: nil)
                            ForEach(catalog?.categories ?? []) { c in
                                chip(title: c.name, id: c.id)
                            }
                        }
                    }
                    .listRowBackground(Color.clear)
                }

                Section {
                    ForEach(visibleProducts) { product in
                        NavigationLink {
                            ProductDetailView(product: product)
                        } label: {
                            HStack {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(product.name).font(.headline)
                                    if let desc = product.description {
                                        Text(desc).font(.caption).foregroundStyle(.secondary)
                                    }
                                }
                                Spacer()
                                Text(product.soldOut ? "Sold out" : formatMoney(product.priceCents))
                                    .foregroundStyle(product.soldOut ? Color.red : .secondary)
                            }
                        }
                    }
                }
            }
            .navigationTitle("Shop")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    NavigationLink {
                        CartView()
                    } label: {
                        ZStack(alignment: .topTrailing) {
                            Image(systemName: "cart")
                            if state.cartCount > 0 {
                                Text("\(state.cartCount)")
                                    .font(.caption2.bold())
                                    .foregroundStyle(.white)
                                    .background(Circle().fill(.red).frame(width: 14, height: 14))
                                    .offset(x: 8, y: -8)
                            }
                        }
                    }
                }
            }
            .task {
                catalog = try? await state.api.request(CatalogResponse.self, "catalog")
            }
        }
    }

    private func chip(title: String, id: String?) -> some View {
        Button {
            selectedCategory = id
        } label: {
            Text(title)
                .font(.subheadline)
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .background(
                    Capsule().fill(selectedCategory == id ? Color.accentColor.opacity(0.25) : Color.secondary.opacity(0.12)),
                )
        }
        .buttonStyle(.plain)
    }
}

struct ProductDetailView: View {
    @EnvironmentObject private var state: AppState
    let product: CatalogProduct

    var body: some View {
        VStack(spacing: 16) {
            Text(formatMoney(product.priceCents)).font(.largeTitle.bold())
            if let desc = product.description {
                Text(desc).font(.body).padding(.horizontal)
            }
            if product.soldOut {
                Text("Currently sold out").foregroundStyle(.red)
            } else {
                Button {
                    state.addToCart(product)
                } label: {
                    Text("Add to cart").frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .padding(.horizontal)
            }
            Spacer()
        }
        .navigationTitle(product.name)
    }
}

struct CartView: View {
    @EnvironmentObject private var state: AppState

    var body: some View {
        List {
            if state.cart.isEmpty {
                Text("Your cart is empty.").foregroundStyle(.secondary)
            }
            ForEach(state.cart) { line in
                HStack {
                    VStack(alignment: .leading) {
                        Text(line.name).font(.headline)
                        Text(formatMoney(line.priceCents * line.qty)).font(.subheadline)
                    }
                    Spacer()
                    Stepper(
                        "\(line.qty)",
                        value: Binding(
                            get: { line.qty },
                            set: { state.setQty(line.productId, $0) },
                        ),
                        in: 0...99,
                    )
                    .fixedSize()
                }
            }
            if !state.cart.isEmpty {
                Section {
                    HStack {
                        Text("Subtotal").font(.headline)
                        Spacer()
                        Text(formatMoney(state.cartSubtotalCents)).font(.headline)
                    }
                    NavigationLink {
                        CheckoutView()
                    } label: {
                        Text("Checkout").bold()
                    }
                }
            }
        }
        .navigationTitle("Cart")
    }
}

struct CheckoutView: View {
    @EnvironmentObject private var state: AppState
    enum Fulfillment: String, CaseIterable, Identifiable {
        case pickup = "PICKUP"
        case delivery = "DELIVERY"
        var id: String { rawValue }
    }
    @State private var fulfillment: Fulfillment = .pickup
    @State private var line1 = ""
    @State private var city = ""
    @State private var postalCode = ""
    @State private var coupon = ""
    @State private var busy = false
    @State private var errorText: String?
    @State private var placedOrderId: String?

    var body: some View {
        Form {
            Section("Fulfilment") {
                Picker("Method", selection: $fulfillment) {
                    Text("Store pickup").tag(Fulfillment.pickup)
                    Text("Delivery").tag(Fulfillment.delivery)
                }
                .pickerStyle(.segmented)

                if fulfillment == .delivery {
                    TextField("Street address", text: $line1)
                    TextField("City", text: $city)
                    TextField("Postal code", text: $postalCode)
                }
            }

            Section("Coupon") {
                TextField("Code (optional)", text: $coupon)
                    .textInputAutocapitalization(.characters)
            }

            Section {
                HStack {
                    Text("Subtotal"); Spacer(); Text(formatMoney(state.cartSubtotalCents))
                }
                Text("Final total is confirmed by the store before payment.")
                    .font(.footnote).foregroundStyle(.secondary)
            }

            if let errorText {
                Section { Text(errorText).foregroundStyle(.red) }
            }

            Section {
                Button {
                    Task { await placeOrder() }
                } label: {
                    if busy {
                        ProgressView().frame(maxWidth: .infinity)
                    } else {
                        Text("Place order · Pay at store").frame(maxWidth: .infinity)
                    }
                }
                .disabled(busy || state.cart.isEmpty || (fulfillment == .delivery && line1.isEmpty))
            }
        }
        .navigationTitle("Checkout")
        .navigationDestination(isPresented: Binding(
            get: { placedOrderId != nil },
            set: { _ in },
        )) {
            if let placedOrderId {
                OrderDetailView(orderId: placedOrderId)
            }
        }
    }

    private func placeOrder() async {
        busy = true
        errorText = nil
        do {
            let req = PlaceOrderRequest(
                items: state.cart.map { CartLineRequest(productId: $0.productId, qty: $0.qty) },
                fulfillment: fulfillment.rawValue,
                address: fulfillment == .delivery
                    ? NewAddressInline(line1: line1, city: city.isEmpty ? nil : city, postalCode: postalCode.isEmpty ? nil : postalCode)
                    : nil,
                addressId: nil,
                couponCode: coupon.isEmpty ? nil : coupon,
            )
            let res = try await state.api.request(OrderEnvelope.self, "orders", method: "POST", body: req)
            state.cart.removeAll()
            placedOrderId = res.order.id
        } catch {
            errorText = error.localizedDescription
        }
        busy = false
    }
}
