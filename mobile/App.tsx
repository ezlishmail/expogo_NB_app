// Northern Bloom — Expo Go customer app.
import React, { useEffect } from 'react';
import { Text } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { fontMap } from './src/theme';
import { ThemeProvider, useTheme } from './src/theme-context';
import { useStore } from './src/store';
import { Screen, BrandLogo, GradientButton, T } from './src/ui';
import type { RootStackParamList } from './src/navigation';

import AuthScreen from './src/screens/AuthScreen';
import HomeScreen from './src/screens/HomeScreen';
import ShopScreen from './src/screens/ShopScreen';
import ProductDetailScreen from './src/screens/ProductDetailScreen';
import CartScreen from './src/screens/CartScreen';
import CheckoutScreen from './src/screens/CheckoutScreen';
import BookScreen from './src/screens/BookScreen';
import { OrdersScreen, default as OrderDetailScreen } from './src/screens/OrdersScreens';
import ProfileScreen from './src/screens/ProfileScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';
import AdminScreen from './src/screens/AdminScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator();

const MANAGER_ROLES = new Set(['OWNER', 'ADMIN', 'DEVELOPER']);

function Splash() {
  return (
    <Screen style={{ alignItems: 'center', justifyContent: 'center' }}>
      <BrandLogo height={56} />
    </Screen>
  );
}

// Shown when we can't load the tenant config on first launch — better than
// silently running on the fallback theme/behaviour. Retries on demand.
function ConfigError() {
  const refreshConfig = useStore((s) => s.refreshConfig);
  const status = useStore((s) => s.configStatus);
  return (
    <Screen style={{ alignItems: 'center', justifyContent: 'center', padding: 28, gap: 14 }}>
      <BrandLogo height={40} />
      <Text style={[T.title(), { textAlign: 'center' }]}>We couldn't reach the salon</Text>
      <Text style={[T.body(), { textAlign: 'center' }]}>
        The app couldn't load the latest settings. Check your connection and try again.
      </Text>
      <GradientButton
        label="Try again"
        icon="refresh"
        busy={status === 'loading'}
        onPress={() => void refreshConfig()}
        style={{ alignSelf: 'stretch', marginTop: 4 }}
      />
    </Screen>
  );
}

function MainTabs() {
  const unread = useStore((s) => s.unreadCount);
  const role = useStore((s) => s.user?.role);
  const features = useStore((s) => s.config?.features);
  const c = useTheme();

  const isManager = role != null && MANAGER_ROLES.has(role);
  // Tabs are config-driven: hide Shop/Orders when shopping is off, Book when
  // appointments are off. Home and Profile are always present.
  const showShop = features?.shopping !== false;
  const showBook = features?.appointments !== false;

  return (
    <Tabs.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: c.primaryDark,
        tabBarInactiveTintColor: c.muted,
        tabBarLabelStyle: { fontFamily: 'Inter_600SemiBold' as const, fontSize: 11 },
        tabBarStyle: {
          backgroundColor: '#FFFFFFF2',
          borderTopColor: c.hairline,
          height: 84,
          paddingTop: 8,
        },
        tabBarIcon: ({ color, size }) => {
          const map: Record<string, keyof typeof Ionicons.glyphMap> = {
            Home: 'home-outline',
            Shop: 'storefront-outline',
            Book: 'calendar-clear-outline',
            Orders: 'receipt-outline',
            Profile: 'person-circle-outline',
            Admin: 'shield-half-outline',
          };
          return <Ionicons name={map[route.name] ?? 'ellipse-outline'} size={size + 1} color={color} />;
        },
      })}
    >
      <Tabs.Screen name="Home" component={HomeScreen} />
      {showShop ? <Tabs.Screen name="Shop" component={ShopScreen} /> : null}
      {showBook ? <Tabs.Screen name="Book" component={BookScreen} /> : null}
      {showShop ? <Tabs.Screen name="Orders" component={OrdersScreen} /> : null}
      {isManager ? <Tabs.Screen name="Admin" component={AdminScreen} /> : null}
      <Tabs.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ tabBarBadge: unread > 0 ? unread : undefined, tabBarBadgeStyle: { backgroundColor: c.accent } }}
      />
    </Tabs.Navigator>
  );
}

// Lives under ThemeProvider so the navigator + gate screens use the live
// palette. Gates on fonts, session bootstrap, and the first config load.
function AppShell({ fontsLoaded }: { fontsLoaded: boolean }) {
  const booted = useStore((s) => s.booted);
  const token = useStore((s) => s.token);
  const config = useStore((s) => s.config);
  const configStatus = useStore((s) => s.configStatus);
  const c = useTheme();

  if (!fontsLoaded || !booted) return <Splash />;
  // Block only while we have no config at all: a failed refresh after we
  // already have one keeps the user on the last known config.
  if (!config && configStatus === 'error') return <ConfigError />;
  if (!config) return <Splash />;

  const navTheme = {
    ...DefaultTheme,
    colors: { ...DefaultTheme.colors, background: c.bg, primary: c.primary },
  };

  return (
    <NavigationContainer theme={navTheme}>
      <StatusBar style="dark" />
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!token ? (
          <Stack.Screen name="Auth" component={AuthScreen} />
        ) : (
          <>
            <Stack.Screen name="Tabs" component={MainTabs} />
            <Stack.Screen name="ProductDetail" component={ProductDetailScreen} />
            <Stack.Screen name="Cart" component={CartScreen} />
            <Stack.Screen name="Checkout" component={CheckoutScreen} />
            <Stack.Screen name="OrderDetail" component={OrderDetailScreen} />
            <Stack.Screen name="Notifications" component={NotificationsScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts(fontMap);
  const token = useStore((s) => s.token);
  const bootstrap = useStore((s) => s.bootstrap);
  const refreshUnread = useStore((s) => s.refreshUnread);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  // Poll the inbox badge every minute while signed in.
  useEffect(() => {
    if (!token) return;
    refreshUnread();
    const t = setInterval(refreshUnread, 60_000);
    return () => clearInterval(t);
  }, [token, refreshUnread]);

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AppShell fontsLoaded={fontsLoaded} />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
