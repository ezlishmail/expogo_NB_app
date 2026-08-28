// App navigation. Bottom tabs are derived from the tenant feature flags so
// disabled features never show an empty screen (master prompt §49).
package com.northernbloom.customer.ui.nav

import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.ShoppingBag
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.northernbloom.customer.core.AppContainer
import com.northernbloom.customer.core.SessionState
import com.northernbloom.customer.feature.auth.AuthScreen
import com.northernbloom.customer.feature.book.BookingFlowScreen
import com.northernbloom.customer.feature.book.MyAppointmentsScreen
import com.northernbloom.customer.feature.home.HomeScreen
import com.northernbloom.customer.feature.orders.OrderDetailScreen
import com.northernbloom.customer.feature.orders.OrdersScreen
import com.northernbloom.customer.feature.profile.NotificationsScreen
import com.northernbloom.customer.feature.profile.ProfileScreen
import com.northernbloom.customer.feature.shop.CartScreen
import com.northernbloom.customer.feature.shop.CheckoutScreen
import com.northernbloom.customer.feature.shop.ProductDetailScreen
import com.northernbloom.customer.feature.shop.ShopScreen

object Routes {
    const val AUTH = "auth"
    const val HOME = "home"
    const val SHOP = "shop"
    const val PRODUCT = "product/{productId}"
    const val CART = "cart"
    const val CHECKOUT = "checkout"
    const val BOOKINGS_TAB = "bookings"
    const val BOOKING_FLOW = "booking"
    const val MY_APPOINTMENTS = "my-appointments"
    const val ORDERS_TAB = "orders"
    const val ORDER_DETAIL = "order/{orderId}"
    const val PROFILE_TAB = "profile"
    const val NOTIFICATIONS = "notifications"

    fun product(id: String) = "product/$id"
    fun order(id: String) = "order/$id"
}

private data class Tab(val route: String, val label: String, val icon: ImageVector)

@Composable
fun AppRoot(container: AppContainer, initialDeepLink: String?) {
    val navController = rememberNavController()
    val session by container.session.collectAsState()
    val config by container.config.collectAsState()

    // Route notification/QR deep links once per new link.
    LaunchedEffect(initialDeepLink) {
        initialDeepLink?.let { handleDeepLink(it)?.let(navController::navigate) }
    }

    if (session is SessionState.Loading) return

    when (session) {
        is SessionState.LoggedOut -> {
            AuthScreen(container = container)
        }
        is SessionState.LoggedIn -> {
            val features = config?.features
            val tabs = buildList {
                add(Tab(Routes.HOME, "Home", Icons.Default.Home))
                if (features?.shopping != false) add(Tab(Routes.SHOP, "Shop", Icons.Default.ShoppingBag))
                if (features?.appointments != false) add(Tab(Routes.BOOKINGS_TAB, "Book", Icons.Default.CalendarMonth))
                add(Tab(Routes.ORDERS_TAB, "Orders", Icons.Default.ShoppingBag))
                add(Tab(Routes.PROFILE_TAB, "Profile", Icons.Default.Person))
            }

            Scaffold(
                bottomBar = {
                    NavigationBar {
                        val backStack by navController.currentBackStackEntryAsState()
                        val currentRoute = backStack?.destination?.route
                        tabs.forEach { tab ->
                            NavigationBarItem(
                                selected = currentRoute == tab.route ||
                                    (tab.route == Routes.HOME && currentRoute == null),
                                onClick = {
                                    navController.navigate(tab.route) {
                                        popUpTo(navController.graph.findStartDestination().id) { saveState = true }
                                        launchSingleTop = true
                                        restoreState = true
                                    }
                                },
                                icon = { Icon(tab.icon, contentDescription = tab.label) },
                                label = { Text(tab.label) },
                            )
                        }
                    }
                },
            ) { padding ->
                NavHost(
                    navController = navController,
                    startDestination = Routes.HOME,
                    modifier = Modifier.padding(padding),
                ) {
                    composable(Routes.HOME) {
                        HomeScreen(
                            container = container,
                            onOpenProduct = { navController.navigate(Routes.product(it)) },
                            onOpenBooking = { navController.navigate(Routes.BOOKING_FLOW) },
                            onOpenNotifications = { navController.navigate(Routes.NOTIFICATIONS) },
                        )
                    }
                    composable(Routes.SHOP) {
                        ShopScreen(
                            container = container,
                            onOpenProduct = { navController.navigate(Routes.product(it)) },
                            onOpenCart = { navController.navigate(Routes.CART) },
                        )
                    }
                    composable(Routes.PRODUCT) { entry ->
                        ProductDetailScreen(
                            container = container,
                            productId = entry.arguments?.getString("productId") ?: "",
                            onBack = navController::popBackStack,
                            onOpenCart = { navController.navigate(Routes.CART) },
                        )
                    }
                    composable(Routes.CART) {
                        CartScreen(
                            onBack = navController::popBackStack,
                            onCheckout = { navController.navigate(Routes.CHECKOUT) },
                        )
                    }
                    composable(Routes.CHECKOUT) {
                        CheckoutScreen(container = container, onDone = { orderId ->
                            navController.navigate(Routes.order(orderId)) {
                                popUpTo(Routes.HOME)
                            }
                        })
                    }
                    composable(Routes.BOOKINGS_TAB) {
                        MyAppointmentsScreen(
                            container = container,
                            onBookNew = { navController.navigate(Routes.BOOKING_FLOW) },
                        )
                    }
                    composable(Routes.BOOKING_FLOW) {
                        BookingFlowScreen(container = container, onDone = { navController.popBackStack() })
                    }
                    composable(Routes.ORDERS_TAB) {
                        OrdersScreen(
                            container = container,
                            onOpenOrder = { navController.navigate(Routes.order(it)) },
                        )
                    }
                    composable(Routes.ORDER_DETAIL) { entry ->
                        OrderDetailScreen(
                            container = container,
                            orderId = entry.arguments?.getString("orderId") ?: "",
                            onBack = navController::popBackStack,
                        )
                    }
                    composable(Routes.PROFILE_TAB) {
                        ProfileScreen(
                            container = container,
                            onOpenNotifications = { navController.navigate(Routes.NOTIFICATIONS) },
                        )
                    }
                    composable(Routes.NOTIFICATIONS) {
                        NotificationsScreen(container = container, onBack = navController::popBackStack)
                    }
                }
            }
        }
        else -> Unit
    }
}

// nbcustomer://open/product/123 → Routes.product("123")
fun handleDeepLink(uri: String): String? {
    val segments = uri.removePrefix("nbcustomer://").trim('/').split("/")
    // [open, <kind>, <id>?]
    if (segments.firstOrNull() != "open") return null
    return when (segments.getOrNull(1)) {
        "product" -> segments.getOrNull(2)?.let { Routes.product(it) }
        "order" -> segments.getOrNull(2)?.let { Routes.order(it) }
        "appointment" -> Routes.MY_APPOINTMENTS
        "offers" -> Routes.SHOP
        else -> null
    }
}
