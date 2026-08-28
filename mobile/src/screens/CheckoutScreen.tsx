// Checkout: pickup/delivery, address, coupon, order placement.
// Totals are always recomputed server-side; we show estimates only.
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { ApiError, api } from '../api';
import { fonts, formatMoney, radius, type ThemeColors } from '../theme';
import { useTheme, useThemedStyles } from '../theme-context';
import { cartSubtotal, useStore } from '../store';
import { ErrorNote, GhostButton, GradientButton, Input, Screen } from '../ui';
import type { CheckoutProps } from '../navigation';

interface FulfilmentOption {
  value: 'PICKUP' | 'DELIVERY';
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}

function fulfilmentOptions(config: ReturnType<typeof useStore.getState>['config']): FulfilmentOption[] {
  const opts: FulfilmentOption[] = [];
  if (config?.features.pickup !== false) {
    opts.push({ value: 'PICKUP', label: 'Store pickup', icon: 'storefront-outline' });
  }
  if (config?.features.delivery !== false) {
    opts.push({ value: 'DELIVERY', label: 'Delivery', icon: 'bicycle-outline' });
  }
  return opts.length > 0 ? opts : [{ value: 'PICKUP', label: 'Store pickup', icon: 'storefront-outline' }];
}

export default function CheckoutScreen({ navigation }: CheckoutProps) {
  const cart = useStore((s) => s.cart);
  const clearCart = useStore((s) => s.clearCart);
  const config = useStore((s) => s.config);
  const c = useTheme();
  const styles = useThemedStyles(makeStyles);

  const [fulfillment, setFulfillment] = useState<'PICKUP' | 'DELIVERY'>(
    config?.features.pickup !== false ? 'PICKUP' : 'DELIVERY',
  );
  const [line1, setLine1] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [coupon, setCoupon] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subtotal = cartSubtotal(cart);
  // Estimate display only — the backend decides the real fee.
  const feeWaived =
    fulfillment === 'DELIVERY' &&
    typeof config?.settings.freeDeliveryOverCents === 'number' &&
    subtotal >= (config?.settings.freeDeliveryOverCents ?? Infinity);
  const estFee = fulfillment === 'DELIVERY' ? (feeWaived ? 0 : config?.settings.deliveryFeeCents ?? 0) : 0;
  // COD / handling surcharge — payments v1 is cash-only, so the owner-set charge
  // applies to every order. The server is authoritative; this is the estimate.
  const codEnabled = config?.settings.codEnabled !== false;
  const codCharge = codEnabled ? config?.settings.codChargeCents ?? 0 : 0;

  async function placeOrder() {
    if (busy || cart.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.placeOrder({
        items: cart.map((l) => ({ productId: l.productId, qty: l.qty })),
        fulfillment,
        ...(fulfillment === 'DELIVERY'
          ? {
              address: {
                line1: line1.trim(),
                ...(city.trim() ? { city: city.trim() } : {}),
                ...(postalCode.trim() ? { postalCode: postalCode.trim() } : {}),
              },
            }
          : {}),
        ...(coupon.trim() ? { couponCode: coupon.trim().toUpperCase() } : {}),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      clearCart();
      navigation.replace('OrderDetail', { orderId: res.order.id, justPlaced: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Checkout failed. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <SafeAreaView edges={['top']} style={{ flex: 0 }} />
      <View style={styles.header}>
        <GhostButton label="← Back" onPress={() => navigation.goBack()} style={{ minHeight: 38 }} />
        <Text style={{ fontFamily: fonts.display, fontSize: 24, color: c.ink }}>Checkout</Text>
        <Text>{'   '}</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {/* fulfilment selector */}
        <Text style={[styles.label]}>How would you like it?</Text>
        <View style={styles.fulfillRow}>
          {fulfilmentOptions(config).map((opt) => (
            <FulfilmentCard
              key={opt.value}
              icon={opt.icon}
              label={opt.label}
              active={fulfillment === opt.value}
              onPress={() => setFulfillment(opt.value)}
            />
          ))}
        </View>

        {fulfillment === 'DELIVERY' && (
          <>
            <Text style={styles.label}>Deliver to</Text>
            <Input value={line1} onChangeText={setLine1} placeholder="Street address" autoCapitalize="sentences" />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Input value={city} onChangeText={setCity} placeholder="City" autoCapitalize="sentences" />
              </View>
              <View style={{ flex: 1 }}>
                <Input value={postalCode} onChangeText={setPostalCode} placeholder="Postal code" autoCapitalize="characters" />
              </View>
            </View>
          </>
        )}

        <Text style={styles.label}>Coupon</Text>
        <Input value={coupon} onChangeText={(t) => setCoupon(t.toUpperCase())} placeholder="e.g. WELCOME10" autoCapitalize="characters" />

        {/* summary */}
        <View style={styles.summaryCard}>
          <SummaryLine label={`Items (${cart.reduce((n, l) => n + l.qty, 0)})`} value={formatMoney(subtotal)} />
          {estFee > 0 ? <SummaryLine label="Delivery (estimate)" value={formatMoney(estFee)} /> : null}
          {fulfillment === 'DELIVERY' && estFee === 0 && subtotal > 0 ? (
            <SummaryLine label="Delivery" value="Free over threshold" muted />
          ) : null}
          {codCharge > 0 ? <SummaryLine label="COD / handling" value={formatMoney(codCharge)} /> : null}
          <View style={styles.divider} />
          <SummaryLine label="Payable at store" value={formatMoney(subtotal + estFee + codCharge)} strong />
        </View>

        <ErrorNote message={error} />

        <GradientButton
          label="Place order · Pay at salon"
          icon="checkmark-circle"
          onPress={placeOrder}
          disabled={cart.length === 0 || (fulfillment === 'DELIVERY' && line1.trim().length === 0)}
          busy={busy}
        />

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14, justifyContent: 'center' }}>
          <Ionicons name="shield-checkmark-outline" size={13} color={c.muted} />
          <Text style={{ fontFamily: fonts.body, fontSize: 11.5, color: c.muted }}>
            Pay via UPI or cash at the salon. The store confirms the final total.
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

function FulfilmentCard({
  icon,
  label,
  active,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const c = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      style={[styles.fulfilCard, active && styles.fulfilCardActive]}
    >
      <Ionicons name={icon} size={19} color={active ? c.primaryDark : c.muted} />
      <Text style={[styles.fulfilLabel, active && styles.fulfilLabelActive]}>{label}</Text>
    </Pressable>
  );
}

function SummaryLine({ label, value, strong, muted }: { label: string; value: string; strong?: boolean; muted?: boolean }) {
  const c = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 }}>
      <Text style={{ fontFamily: strong ? fonts.bodyBold : fonts.bodyMed, fontSize: strong ? 15 : 13.5, color: muted ? c.muted : c.ink }}>
        {label}
      </Text>
      <Text style={{ fontFamily: strong ? fonts.bodyBold : fonts.bodySemi, fontSize: strong ? 16 : 13.5, color: muted ? c.muted : c.ink }}>
        {value}
      </Text>
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingTop: 14,
      paddingBottom: 6,
    },
    label: {
      fontFamily: fonts.bodyBold,
      fontSize: 13,
      color: c.ink,
      marginBottom: 8,
      marginTop: 16,
      letterSpacing: 0.2,
    },
    fulfillRow: { flexDirection: 'row', gap: 10 },
    fulfilCard: {
      flex: 1,
      alignItems: 'center',
      gap: 6,
      backgroundColor: '#fff',
      borderWidth: 2,
      borderColor: c.hairline,
      borderRadius: radius.md,
      paddingVertical: 16,
    },
    fulfilCardActive: { borderColor: c.primary, backgroundColor: c.primaryTint },
    fulfilLabel: { fontFamily: fonts.bodySemi, fontSize: 12.5, color: c.muted },
    fulfilLabelActive: { color: c.primaryDark },
    summaryCard: {
      backgroundColor: '#fff',
      borderRadius: radius.md,
      padding: 16,
      marginVertical: 18,
      shadowColor: c.shadow,
      shadowOpacity: 1,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 5 },
      elevation: 1,
    },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: c.hairline, marginVertical: 6 },
  });
