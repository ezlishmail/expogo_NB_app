// API client. Auto-resolves the dev-machine LAN IP inside Expo Go so a phone
// on the same WiFi hits the backend with zero configuration.
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = 'nb_token';

export class ApiError extends Error {
  code: string;
  status: number;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function resolveApiBase(): string {
  // 1. Explicit override (production builds): set EXPO_PUBLIC_API_URL.
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl) return envUrl.replace(/\/$/, '');

  // 2. Expo Go: derive the Metro host (your PC's LAN IP) and swap the port
  //    to the backend's. Works when phone + PC share WiFi.
  const c = Constants as any;
  const hostUri: string | undefined =
    c?.expoConfig?.hostUri ??
    c?.expoGoConfig?.developer?.host ??
    (typeof c?.manifest?.debuggerHost === 'string' ? c.manifest.debuggerHost : undefined);
  if (typeof hostUri === 'string' && hostUri.includes(':')) {
    const host = hostUri.split(':')[0];
    return `http://${host}:3000/api/v1`;
  }

  return 'http://localhost:3000/api/v1';
}

export const API_BASE = resolveApiBase();

let currentToken: string | null = null;
export async function loadToken(): Promise<string | null> {
  if (currentToken) return currentToken;
  currentToken = await AsyncStorage.getItem(TOKEN_KEY);
  return currentToken;
}
export async function saveToken(token: string | null): Promise<void> {
  currentToken = token;
  if (token) await AsyncStorage.setItem(TOKEN_KEY, token);
  else await AsyncStorage.removeItem(TOKEN_KEY);
}

async function request<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (currentToken) headers.authorization = `Bearer ${currentToken}`;

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method: init?.method ?? 'GET',
      headers,
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'NETWORK', `Can't reach the store API (${API_BASE}). Is the backend running?`);
  }

  if (!res.ok) {
    let code = 'ERROR';
    let message = `Request failed (${res.status})`;
    try {
      const json = (await res.json()) as { error?: { code?: string; message?: string } };
      code = json.error?.code ?? code;
      message = json.error?.message ?? message;
    } catch {
      // non-JSON error body
    }
    throw new ApiError(res.status, code, message);
  }
  return (await res.json()) as T;
}

// ---------- wire types ----------

export interface Brand { name?: string; logoUrl?: string; primaryColor?: string; accentColor?: string }
export interface Features { appointments: boolean; shopping: boolean; delivery: boolean; pickup: boolean; coupons: boolean }
export interface TenantSettings {
  currency: string; timezone: string;
  deliveryFeeCents: number; freeDeliveryOverCents: number | null;
  address: string | null; phone: string | null;
  codEnabled?: boolean; codChargeCents?: number; onlinePaymentEnabled?: boolean;
}
export interface TenantConfig {
  tenantId: string | null; name?: string;
  brand: Brand; features: Features; settings: TenantSettings;
}

export interface User { id: string; name: string; email: string; phone: string | null; role: string; marketingOptIn: boolean; addresses?: Address[] }
export interface Address { id: string; label: string | null; line1: string; city: string | null; postalCode: string | null }

export interface AuthResponse { token: string; user: User }
export interface ServiceModel { id: string; name: string; description: string | null; durationMin: number; priceCents: number; category: string | null; forGender: 'MALE' | 'FEMALE' | null }
export interface StaffMember { id: string; name: string; bio: string | null; serviceIds: string[]; gender: 'MALE' | 'FEMALE' | null; photoUrl: string | null; specialties: string[] }
export interface Slot { startsAt: string; endsAt: string; staffId: string; id: string }
export interface Appointment { id: string; serviceName: string | null; staffName: string | null; startsAt: string; endsAt: string | null; status: string }

export interface Category { id: string; name: string }
export interface CatalogProduct { id: string; categoryId: string | null; name: string; description: string | null; priceCents: number; imageUrl: string | null; soldOut: boolean; featured: boolean }
export interface CatalogResponse { categories: Category[]; products: CatalogProduct[] }

export interface OrderSummary { id: string; status: string; fulfillment: string; totalCents: number; itemCount?: number; placedAt: string }
export interface OrderItem { name: string; qty: number; unitPriceCents: number }
export interface OrderDetail extends Omit<OrderSummary, 'itemCount'> {
  subtotalCents: number; discountCents: number; deliveryFeeCents: number; codChargeCents: number;
  notes?: string | null;
  items: OrderItem[];
  payment?: { method: string; status: string } | null;
  address?: { line1?: string; city?: string } | null;
}

export interface NotificationItem { id: string; type: string; title: string; body: string | null; deeplink: string | null; read: boolean; createdAt: string }

// ---------- endpoints ----------

export const api = {
  config: () => request<TenantConfig>('/config'),

  register: (name: string, email: string, password: string) =>
    request<AuthResponse>('/auth/register', { method: 'POST', body: { name, email, password } }),
  login: (email: string, password: string) =>
    request<AuthResponse>('/auth/login', { method: 'POST', body: { email, password } }),

  me: () => request<{ user: User }>('/me'),
  updateMe: (patch: { name?: string; marketingOptIn?: boolean }) =>
    request<{ user: User }>('/me', { method: 'PATCH', body: patch }),
  deleteMe: () => request<null>('/me', { method: 'DELETE' }),

  services: () => request<{ services: ServiceModel[] }>('/services'),
  staff: () => request<{ staff: StaffMember[] }>('/staff'),
  availability: (serviceId: string, date: string, staffId?: string | null) =>
    request<{ slots: Array<Omit<Slot, 'id'>> }>(`/availability?serviceId=${serviceId}&date=${date}${staffId ? `&staffId=${staffId}` : ''}`)
      .then((r) => ({
        slots: r.slots.map((s) => ({ ...s, id: `${s.startsAt}|${s.staffId}` })) satisfies Slot[],
      })),
  book: (serviceId: string, startsAt: string, staffId?: string | null) =>
    request<{ appointment: Appointment }>('/appointments', { method: 'POST', body: { serviceId, startsAt, ...(staffId ? { staffId } : {}) } }),
  myAppointments: () =>
    request<{ appointments: Appointment[] }>('/appointments?upcoming=true'),
  cancelAppointment: (id: string) =>
    request<{ appointment: Appointment }>(`/appointments/${id}/cancel`, { method: 'PATCH' }),

  catalog: () => request<CatalogResponse>('/catalog'),
  validateCoupon: (code: string, subtotalCents: number) =>
    request<{ valid: boolean; discountCents: number }>('/coupons/validate', { method: 'POST', body: { code, subtotalCents } }),
  placeOrder: (body: {
    items: Array<{ productId: string; qty: number }>;
    fulfillment: 'PICKUP' | 'DELIVERY';
    address?: { line1: string; city?: string; postalCode?: string };
    couponCode?: string;
  }) => request<{ order: OrderSummary & { subtotalCents: number; discountCents: number; deliveryFeeCents: number; codChargeCents: number } }>('/orders', { method: 'POST', body }),
  orders: () => request<{ orders: OrderSummary[] }>('/orders'),
  orderDetail: (id: string) => request<{ order: OrderDetail }>(`/orders/${id}`),

  notifications: () => request<{ notifications: NotificationItem[] }>('/notifications'),
  markAllRead: () => request<{ ok: boolean }>('/notifications/read-all', { method: 'POST' }),

  // ---- owner/admin console (manager roles; enforced server-side) ----
  adminStats: () =>
    request<{ revenueTodayCents: number; ordersToday: number; appointmentsToday: number; pendingOrders: number; lowStockCount: number }>('/admin/stats'),
  adminAppointments: (date: string) =>
    request<{ appointments: Array<{ id: string; startsAt: string; status: string; customer: { name: string; email: string; phone: string | null }; service: { name: string; durationMin: number; priceCents: number }; staff: { name: string } }> }>(`/admin/appointments?date=${date}`),
  adminSetAppointmentStatus: (id: string, status: string) =>
    request<{ appointment: unknown }>(`/admin/appointments/${id}`, { method: 'PATCH', body: { status } }),
  adminCustomers: (search?: string) =>
    request<{ customers: Array<{ id: string; name: string; email: string; phone: string | null; marketingOptIn: boolean; _count: { orders: number; appointments: number } }> }>(`/admin/customers${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  adminRemoveCustomer: (id: string) => request<{ ok: boolean }>(`/admin/users/${id}`, { method: 'DELETE' }),
  adminStaff: () =>
    request<{ staff: Array<{ id: string; name: string; bio: string | null; active: boolean; serviceIds: string[] }> }>('/admin/staff'),
  adminUpdateStaff: (id: string, patch: { active?: boolean; name?: string; bio?: string | null }) =>
    request<{ ok: boolean }>(`/admin/staff/${id}`, { method: 'PATCH', body: patch }),
  adminDeactivateStaff: (id: string) => request<{ ok: boolean }>(`/admin/staff/${id}`, { method: 'DELETE' }),
};
