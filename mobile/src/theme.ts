// Northern Bloom Salon design system — warm cream, ink, and a gold accent.
// Fraunces display serif + Inter body. Brand colours (primary/accent) come from
// GET /config (tenant brand) and are applied at runtime via ThemeProvider /
// useTheme (see theme-context.tsx) so a colour change in the owner dashboard
// repaints the app. The palette below is the built-in fallback used before
// config loads or when the tenant leaves a colour unset. See docs/MANUAL.md.

export interface ThemeColors {
  bg: string;
  surface: string;
  ink: string;
  muted: string;
  hairline: string;
  primary: string;
  primaryDark: string;
  primaryTint: string;
  accent: string;
  danger: string;
  shadow: string;
}

// Structural tones (bg/surface/ink/muted/hairline/danger/shadow) are fixed;
// primary/primaryDark/primaryTint/accent are overridden at runtime by
// deriveColors() when the tenant config supplies brand colours.
export const colors: ThemeColors = {
  bg: '#FAF3E3',
  surface: '#FFFFFF',
  ink: '#1B1A17',
  muted: '#8A8578',
  hairline: 'rgba(28,26,23,0.10)',
  primary: '#1C1A17',
  primaryDark: '#0C0B09',
  primaryTint: '#F3ECDD',
  accent: '#C9A84C',
  danger: '#DC2626',
  shadow: 'rgba(28,26,23,0.10)',
};

// ---- brand colour derivation ----

function parseHex(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function toHex(r: number, g: number, b: number): string {
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${ch(r)}${ch(g)}${ch(b)}`;
}

// Mix a colour toward black — the gradient end / pressed tone.
function shade(hex: string, amount: number): string {
  const c = parseHex(hex);
  if (!c) return hex;
  return toHex(c.r * (1 - amount), c.g * (1 - amount), c.b * (1 - amount));
}

// Mix a colour toward white — soft "selected" backgrounds.
function tint(hex: string, amount: number): string {
  const c = parseHex(hex);
  if (!c) return hex;
  return toHex(c.r + (255 - c.r) * amount, c.g + (255 - c.g) * amount, c.b + (255 - c.b) * amount);
}

// Build the runtime palette from tenant brand colours, falling back to the
// built-in tones above when a colour is missing or unparseable. primaryDark and
// primaryTint are derived so a single primary+accent pair themes the whole app.
export function deriveColors(brand?: { primaryColor?: string; accentColor?: string } | null): ThemeColors {
  const p = brand?.primaryColor;
  const a = brand?.accentColor;
  const primary = p && parseHex(p) ? p : colors.primary;
  const accent = a && parseHex(a) ? a : colors.accent;
  return {
    ...colors,
    primary,
    primaryDark: shade(primary, 0.16),
    primaryTint: tint(accent, 0.82),
    accent,
  };
}

export const radius = { sm: 12, md: 18, lg: 24, pill: 999 };

export const spacing = (n: number) => n * 4;

import { Fraunces_400Regular, Fraunces_500Medium, Fraunces_600SemiBold } from '@expo-google-fonts/fraunces';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';

export const fontMap = {
  Fraunces_400Regular,
  Fraunces_500Medium,
  Fraunces_600SemiBold,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} as const;

export const fonts = {
  display: 'Fraunces_600SemiBold' as const,
  displayMed: 'Fraunces_500Medium' as const,
  body: 'Inter_400Regular' as const,
  bodyMed: 'Inter_500Medium' as const,
  bodySemi: 'Inter_600SemiBold' as const,
  bodyBold: 'Inter_700Bold' as const,
};

// ₹ with Indian digit grouping: ₹14,999.00. Currency code comes from tenant
// settings at runtime where available; INR is the default.
export function formatMoney(cents: number, currency = 'INR'): string {
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(cents / 100);
  } catch {
    return `₹${(cents / 100).toFixed(2)}`;
  }
}

export function formatISODateTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}
