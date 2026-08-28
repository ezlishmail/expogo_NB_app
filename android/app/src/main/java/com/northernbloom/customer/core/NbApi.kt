// Retrofit API surface. Mirrors backend /api/v1 exactly.
package com.northernbloom.customer.core

import com.northernbloom.customer.core.dto.AddressDto
import com.northernbloom.customer.core.dto.AppointmentDto
import com.northernbloom.customer.core.dto.AuthResponse
import com.northernbloom.customer.core.dto.CatalogResponse
import com.northernbloom.customer.core.dto.NotificationPage
import com.northernbloom.customer.core.dto.OrderDetailDto
import com.northernbloom.customer.core.dto.OrderSummaryDto
import com.northernbloom.customer.core.dto.ServiceDto
import com.northernbloom.customer.core.dto.SlotDto
import com.northernbloom.customer.core.dto.StaffDto
import com.northernbloom.customer.core.dto.TenantConfig
import com.northernbloom.customer.core.dto.UserDto
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

interface NbApi {
    @GET("config")
    suspend fun config(): TenantConfig

    @POST("auth/register")
    suspend fun register(@Body body: Map<String, String>): AuthResponse

    @POST("auth/login")
    suspend fun login(@Body body: Map<String, String>): AuthResponse

    @GET("me")
    suspend fun me(): MeResponse

    @PATCH("me")
    suspend fun updateMe(@Body body: UpdateMeRequest): MeEnvelope

    @DELETE("me")
    suspend fun deleteMe()

    @POST("me/addresses")
    suspend fun addAddress(@Body body: Map<String, String>): AddressResponse

    @GET("services")
    suspend fun services(): ServicesResponse

    @GET("staff")
    suspend fun staff(): StaffResponse

    @GET("availability")
    suspend fun availability(
        @Query("serviceId") serviceId: String,
        @Query("date") date: String,
        @Query("staffId") staffId: String? = null,
    ): AvailabilityResponse

    @POST("appointments")
    suspend fun bookAppointment(@Body body: BookRequest): AppointmentEnvelope

    @GET("appointments")
    suspend fun appointments(@Query("upcoming") upcoming: Boolean? = null): AppointmentsResponse

    @PATCH("appointments/{id}/cancel")
    suspend fun cancelAppointment(@Path("id") id: String): AppointmentEnvelope

    @GET("catalog")
    suspend fun catalog(): CatalogResponse

    @POST("coupons/validate")
    suspend fun validateCoupon(@Body body: CouponValidateRequest): CouponValidateResponse

    @POST("orders")
    suspend fun placeOrder(@Body body: PlaceOrderRequest): OrderEnvelope

    @GET("orders")
    suspend fun orders(): OrdersResponse

    @GET("orders/{id}")
    suspend fun order(@Path("id") id: String): OrderEnvelopeDetail

    @POST("devices")
    suspend fun registerDevice(@Body body: DeviceRequest)

    @DELETE("devices/{token}")
    suspend fun unregisterDevice(@Path("token") token: String)

    @GET("notifications")
    suspend fun notifications(@Query("cursor") cursor: String? = null): NotificationPage

    @PATCH("notifications/read-all")
    suspend fun markAllRead()
}

// --- request/response wrappers ---

@kotlinx.serialization.Serializable
data class MeResponse(val user: UserDto)

@kotlinx.serialization.Serializable
data class UpdateMeRequest(
    val name: String? = null,
    val phone: String? = null,
    val marketingOptIn: Boolean? = null,
)

@kotlinx.serialization.Serializable
data class MeEnvelope(val user: UserDto)

@kotlinx.serialization.Serializable
data class AddressResponse(val address: AddressDto)

@kotlinx.serialization.Serializable
data class ServicesResponse(val services: List<ServiceDto>)

@kotlinx.serialization.Serializable
data class StaffResponse(val staff: List<StaffDto>)

@kotlinx.serialization.Serializable
data class AvailabilityResponse(val slots: List<SlotDto>)

@kotlinx.serialization.Serializable
data class BookRequest(
    val serviceId: String,
    val staffId: String? = null,
    val startsAt: String,
)

@kotlinx.serialization.Serializable
data class AppointmentEnvelope(val appointment: AppointmentDto)

@kotlinx.serialization.Serializable
data class AppointmentsResponse(val appointments: List<AppointmentDto>)

@kotlinx.serialization.Serializable
data class CouponValidateRequest(val code: String, val subtotalCents: Int)

@kotlinx.serialization.Serializable
data class CouponValidateResponse(val valid: Boolean, val discountCents: Int)

@kotlinx.serialization.Serializable
data class CartLineRequest(val productId: String, val qty: Int)

@kotlinx.serialization.Serializable
data class NewAddressInline(val line1: String, val city: String? = null, val postalCode: String? = null)

@kotlinx.serialization.Serializable
data class PlaceOrderRequest(
    val items: List<CartLineRequest>,
    val fulfillment: String,
    val addressId: String? = null,
    val address: NewAddressInline? = null,
    val couponCode: String? = null,
    val paymentMethod: String = "CASH",
    val notes: String? = null,
)

@kotlinx.serialization.Serializable
data class OrderEnvelope(val order: OrderSummaryDto)

@kotlinx.serialization.Serializable
data class OrdersResponse(val orders: List<OrderSummaryDto>)

@kotlinx.serialization.Serializable
data class OrderEnvelopeDetail(val order: OrderDetailDto)

@kotlinx.serialization.Serializable
data class DeviceRequest(val fcmToken: String, val platform: String = "android")
