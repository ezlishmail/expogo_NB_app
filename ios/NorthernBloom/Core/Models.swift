// Wire-format models. Keys match the backend JSON exactly (camelCase).
import Foundation

// MARK: - Config

struct TenantConfig: Codable {
    var tenantId: String?
    var name: String?
    var brand: Brand = Brand()
    var features: Features = Features()
    var settings: SettingsPayload = SettingsPayload()
}

struct Brand: Codable {
    var name: String?
    var logoUrl: String?
    var primaryColor: String?
    var accentColor: String?
}

struct Features: Codable {
    var appointments: Bool = true
    var shopping: Bool = false
    var delivery: Bool = false
    var pickup: Bool = false
    var coupons: Bool = false
}

struct SettingsPayload: Codable {
    var currency: String = "CAD"
    var timezone: String = "America/Toronto"
    var deliveryFeeCents: Int = 0
    var freeDeliveryOverCents: Int?
    var pickupEnabled: Bool = true
    var address: String?
    var phone: String?
}

// MARK: - Auth / user

struct AuthResponse: Codable { let token: String; let user: User }

struct User: Codable {
    let id: String
    var name: String
    var email: String
    var phone: String?
    var role: String
    var marketingOptIn: Bool
}

struct UpdateMeRequest: Codable {
    var name: String?
    var phone: String?
    var marketingOptIn: Bool?
}

struct UserEnvelope: Codable { let user: User }

// MARK: - Catalog

struct CatalogResponse: Codable {
    let categories: [Category]
    let products: [CatalogProduct]
}

struct Category: Codable {
    let id: String
    let name: String
}

struct CatalogProduct: Codable, Identifiable {
    let id: String
    var categoryId: String?
    let name: String
    var description: String?
    let priceCents: Int
    var imageUrl: String?
    let soldOut: Bool
    var featured: Bool
}

// MARK: - Booking

struct ServiceModel: Codable, Identifiable {
    let id: String
    let name: String
    var description: String?
    let durationMin: Int
    let priceCents: Int
}

struct ServicesResponse: Codable { let services: [ServiceModel] }

struct StaffMember: Codable, Identifiable {
    let id: String
    let name: String
    var bio: String?
}

struct StaffResponse: Codable { let staff: [StaffMember] }

struct Slot: Codable, Identifiable {
    let startsAt: String
    let endsAt: String
    let staffId: String
    // Identifiable conformance for ForEach without decoding an id field.
    var id: String { "\(startsAt)-\(staffId)" }
}

struct AvailabilityResponse: Codable { let slots: [Slot] }

struct BookRequest: Codable {
    let serviceId: String
    var staffId: String?
    let startsAt: String
}

struct Appointment: Codable, Identifiable {
    let id: String
    var serviceName: String?
    var staffName: String?
    let startsAt: String
    var endsAt: String?
    let status: String
}

struct AppointmentEnvelope: Codable { let appointment: Appointment }
struct AppointmentsResponse: Codable { let appointments: [Appointment] }

// MARK: - Shop

struct CouponValidateRequest: Codable { let code: String; let subtotalCents: Int }
struct CouponValidateResponse: Codable { let valid: Bool; let discountCents: Int }

struct CartLineRequest: Codable { let productId: String; let qty: Int }
struct NewAddressInline: Codable { let line1: String; var city: String?; var postalCode: String? }

struct PlaceOrderRequest: Codable {
    let items: [CartLineRequest]
    let fulfillment: String
    var address: NewAddressInline?
    var addressId: String?
    var couponCode: String?
    var paymentMethod: String = "CASH"
}

struct OrderSummary: Codable, Identifiable {
    let id: String
    let status: String
    let fulfillment: String
    let totalCents: Int
    let placedAt: String
}

struct OrderEnvelope: Codable { let order: OrderSummary }
struct OrdersResponse: Codable { let orders: [OrderSummary] }

struct OrderItem: Codable { let name: String; let qty: Int; let unitPriceCents: Int }

struct PaymentInfo: Codable { let method: String; let status: String }

struct OrderDetail: Codable {
    let id: String
    let status: String
    let fulfillment: String
    var subtotalCents: Int
    var discountCents: Int
    var deliveryFeeCents: Int
    let totalCents: Int
    let placedAt: String
    let items: [OrderItem]
    var payment: PaymentInfo?
    struct DeliveryAddress: Codable { var line1: String?; var city: String? }
    var address: DeliveryAddress?
}

struct OrderDetailEnvelope: Codable { let order: OrderDetail }

// MARK: - Notifications

struct NotificationItem: Codable, Identifiable {
    let id: String
    let type: String
    let title: String
    var body: String?
    var deeplink: String?
    let read: Bool
    let createdAt: String
}

struct NotificationPage: Codable {
    let notifications: [NotificationItem]
    let nextCursor: String?
}

// MARK: - Devices

struct DeviceRequest: Codable {
    let token: String
    let platform: String = "ios"

    enum CodingKeys: String, CodingKey {
        case token = "fcmToken"
        case platform
        case apnsToken = "apnsToken" // future: direct APNs delivery
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(token, forKey: .token)
        try c.encode(platform, forKey: .platform)
    }
}

// MARK: - Errors

struct ErrorEnvelope: Decodable {
    struct Payload: Decodable { let code: String; let message: String }
    let error: Payload
}
