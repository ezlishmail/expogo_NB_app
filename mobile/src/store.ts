// Global state: session + tenant config + cart (zustand, no providers).
import { create } from 'zustand';
import { api, saveToken, loadToken, ApiError, type User, type TenantConfig, type CatalogProduct } from './api';

export interface CartLine {
  productId: string;
  name: string;
  priceCents: number;
  qty: number;
}

// 'idle' before the first attempt, 'loading' while fetching, 'ready' once we
// have a config, 'error' when the last fetch failed. The UI blocks the app on
// 'error' only while config is still null — a later failed refresh keeps the
// last known config rather than dropping the user onto defaults.
type ConfigStatus = 'idle' | 'loading' | 'ready' | 'error';

interface AppState {
  booted: boolean;
  token: string | null;
  user: User | null;
  config: TenantConfig | null;
  configStatus: ConfigStatus;
  cart: CartLine[];
  unreadCount: number;

  bootstrap: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  refreshUser: () => Promise<void>;
  refreshConfig: () => Promise<void>;
  refreshUnread: () => Promise<void>;
  setMarketingOptIn: (value: boolean) => Promise<void>;

  addToCart: (p: CatalogProduct) => void;
  setQty: (productId: string, qty: number) => void;
  clearCart: () => void;
}

export const useStore = create<AppState>((set, get) => ({
  booted: false,
  token: null,
  user: null,
  config: null,
  configStatus: 'idle',
  cart: [],
  unreadCount: 0,

  async bootstrap() {
    try {
      const token = await loadToken();
      if (token) {
        try {
          const me = await api.me();
          set({ token, user: me.user });
        } catch (err) {
          if (err instanceof ApiError && err.status === 401) await saveToken(null);
          else set({ token });
        }
      }
    } finally {
      set({ booted: true });
    }
    get().refreshConfig();
  },

  async refreshConfig() {
    set({ configStatus: 'loading' });
    try {
      const config = await api.config();
      set({ config, configStatus: 'ready' });
    } catch {
      // Surface the failure so the app can offer a retry instead of silently
      // running on the fallback theme. Any previously loaded config is kept.
      set({ configStatus: 'error' });
    }
  },

  async refreshUnread() {
    if (!get().token) return;
    try {
      const res = await api.notifications();
      set({ unreadCount: res.notifications.filter((n) => !n.read).length });
    } catch {}
  },

  async refreshUser() {
    try {
      const me = await api.me();
      set({ user: me.user });
    } catch {}
  },

  async signIn(email, password) {
    const res = await api.login(email.trim(), password);
    await saveToken(res.token);
    set({ token: res.token, user: res.user });
    get().refreshConfig();
    get().refreshUnread();
  },

  async register(name, email, password) {
    const res = await api.register(name.trim(), email.trim(), password);
    await saveToken(res.token);
    set({ token: res.token, user: res.user });
    get().refreshUnread();
  },

  async signOut() {
    await saveToken(null);
    set({ token: null, user: null, cart: [], unreadCount: 0 });
  },

  async deleteAccount() {
    try {
      await api.deleteMe();
    } catch {
      // even on failure drop the local session
    }
    await get().signOut();
  },

  async setMarketingOptIn(value) {
    const user = get().user;
    if (!user) return;
    set({ user: { ...user, marketingOptIn: value } }); // optimistic
    try {
      await api.updateMe({ marketingOptIn: value });
    } catch {
      set({ user: { ...user, marketingOptIn: !value } }); // revert
    }
  },

  addToCart(p) {
    const cart = [...get().cart];
    const i = cart.findIndex((l) => l.productId === p.id);
    if (i >= 0) cart[i] = { ...cart[i], qty: cart[i].qty + 1 };
    else cart.push({ productId: p.id, name: p.name, priceCents: p.priceCents, qty: 1 });
    set({ cart });
  },

  setQty(productId, qty) {
    let cart = get().cart.map((l) => (l.productId === productId ? { ...l, qty } : l));
    cart = cart.filter((l) => l.qty > 0);
    set({ cart });
  },

  clearCart() {
    set({ cart: [] });
  },
}));

export const cartSubtotal = (cart: CartLine[]) =>
  cart.reduce((sum, l) => sum + l.priceCents * l.qty, 0);
