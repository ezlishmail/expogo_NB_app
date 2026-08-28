// Wire-format DTOs for the NB API. Field names match the backend JSON.
package com.northernbloom.customer.core.dto

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class ApiError(val code: String = "ERROR", val message: String = "Request failed")

@Serializable
data class ErrorEnvelope(val error: ApiError? = null)

@Serializable
data class TenantConfig(
    val tenantId: String? = null,
    val name: String? = null,
    val brand: Brand = Brand(),
    val features: Features = Features(),
    val settings: Settings = Settings(),
)

@Serializable
data class Brand(
    val name: String? = null,
    @SerialName("logoUrl") val logoUrl: String? = null,
    @SerialName("primaryColor") val primaryColor: String? = null,
    @SerialName("accentColor") val accentColor: String? = null,
)

@Serializable
data class Features(
    val appointments: Boolean = true,
    val shopping: Boolean = false,
    val delivery: Boolean = false,
    val pickup: Boolean = false,
    val coupons: Boolean = false,
)

@Serializable
data class Settings(
    val currency: String = "CAD",
    val timezone: String = "America/Toronto",
    @SerialName("deliveryFeeCents") val deliveryFeeCents: Int = 0,
    @SerialName("freeDeliveryOverCents") val freeDeliveryOverCents: Int? = null,
    @SerialName("pickupEnabled") val pickupEnabled: Boolean = true,
    val address: String? = null,
    val phone: String? = null,
)

@Serializable
data class AuthResponse(val token: String, val user: UserDto)

@Serializable
data class UserDto(
    val id: String,
    val name: String,
    val email: String,
    val phone: String? = null,
    val role: String = "CUSTOMER",
    @SerialName("marketingOptIn") val marketingOptIn: Boolean = true,
    val addresses: List<AddressDto> = emptyList(),
)

@Serializable
data class AddressDto(
    val id: String,
    val label: String? = null,
    val line1: String,
    val city: String? = null,
    val postalCode: String? = null,
    val notes: String? = null,
)

@Serializable
data class ServiceDto(
    val id: String,
    val name: String,
    val description: String? = null,
    val durationMin: Int,
    val priceCents: Int,
)

@Serializable
data class StaffDto(
    val id: String,
    val name: String,
    val bio: String? = null,
    val serviceIds: List<String> = emptyList(),
)

@Serializable
data class SlotDto(val startsAt: String, val endsAt: String, val staffId: String)

@Serializable
data class AppointmentDto(
    val id: String,
    val serviceName: String? = null,
    val staffName: String? = null,
    val startsAt: String,
    val endsAt: String? = null,
    val status: String,
    val notes: String? = null,
)

@Serializable
data class CategoryDto(val id: String, val name: String)

@Serializable
data class CatalogProductDto(
    val id: String,
    val categoryId: String? = null,
    val name: String,
    val description: String? = null,
    val priceCents: Int,
    val imageUrl: String? = null,
    val soldOut: Boolean = false,
    val featured: Boolean = false,
)

@Serializable
data class CatalogResponse(val categories: List<CategoryDto>, val products: List<CatalogProductDto>)

@Serializable
data class OrderItemDto(val name: String, val qty: Int, val unitPriceCents: Int)

@Serializable
data class OrderSummaryDto(
    val id: String,
    val status: String,
    val fulfillment: String,
    val totalCents: Int,
    val itemCount: Int = 0,
    val placedAt: String,
)

@Serializable
data class OrderDetailDto(
    val id: String,
    val status: String,
    val fulfillment: String,
    val address: AddressSnapshot? = null,
    val subtotalCents: Int,
    val discountCents: Int,
    val deliveryFeeCents: Int,
    val totalCents: Int,
    val notes: String? = null,
    val placedAt: String,
    val items: List<OrderItemDto>,
    val payment: PaymentDto? = null,
)

@Serializable
data class AddressSnapshot(
    val label: String? = null,
    val line1: String? = null,
    val city: String? = null,
    val postalCode: String? = null,
    val notes: String? = null,
)

@Serializable
data class PaymentDto(val method: String, val status: String)

@Serializable
data class NotificationDto(
    val id: String,
    val type: String,
    val title: String,
    val body: String? = null,
    val deeplink: String? = null,
    val read: Boolean = false,
    val createdAt: String,
)

@Serializable
data class NotificationPage(
    val notifications: List<NotificationDto>,
    val nextCursor: String? = null,
)
