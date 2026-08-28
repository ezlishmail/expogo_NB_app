// Orders list + detail with server-computed totals breakdown.
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { api, type OrderDetail, type OrderSummary } from '../api';
import { fonts, formatISODateTime, formatMoney, radius } from '../theme';
import { useTheme } from '../theme-context';
import { Card, EmptyState, Screen } from '../ui';

type Props = NativeStackScreenProps<
  { OrderDetail: { orderId?: string; justPlaced?: boolean } | undefined },
  'OrderDetail'
>;

export function OrdersScreen() {
  const c = useTheme();
  const [orders, setOrders] = useState<OrderSummary[] | null>(null);

  useEffect(() => {
    api
      .orders()
      .then((r) => setOrders(r.orders))
      .catch(() => setOrders([]));
  }, []);

  return (
    <Screen>
      <SafeAreaView edges={['top']} style={{ flex: 0 }} />
      <View style={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 8 }}>
        <Text style={{ fontFamily: fonts.display, fontSize: 26, color: c.ink }}>Orders</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 20 }} showsVerticalScrollIndicator={false}>
        {orders === null ? (
          <Text style={{ fontFamily: fonts.body, color: c.muted }}>Loading…</Text>
        ) : orders.length === 0 ? (
          <EmptyState icon="receipt-outline" title="No orders yet" note="Your purchase history will live here." />
        ) : (
          orders.map((o) => (
            <Card key={o.id} style={{ marginBottom: 10 }}>
              <Pressable>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: fonts.bodySemi, fontSize: 14.5, color: c.ink }}>
                      #{o.id.slice(0, 8).toUpperCase()}
                    </Text>
                    <Text style={{ fontFamily: fonts.body, fontSize: 12.5, color: c.muted, marginTop: 2 }}>
                      {formatISODateTime(o.placedAt)} · {o.fulfillment === 'DELIVERY' ? 'Delivery' : 'Pickup'}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <Text style={{ fontFamily: fonts.bodyBold, fontSize: 15.5, color: c.ink }}>
                      {formatMoney(o.totalCents)}
                    </Text>
                    <StatusPill status={o.status} />
                  </View>
                </View>
              </Pressable>
            </Card>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

export function StatusPill({ status }: { status: string }) {
  const c = useTheme();
  const map: Record<string, { bg: string; fg: string }> = {
    PLACED: { bg: '#E0F2FE', fg: '#0369A1' },
    CONFIRMED: { bg: c.primaryTint, fg: c.primaryDark },
    READY: { bg: '#FEF3C7', fg: '#B45309' },
    OUT_FOR_DELIVERY: { bg: '#EDE9FE', fg: '#6D28D9' },
    DELIVERED: { bg: c.primaryTint, fg: c.primaryDark },
    COMPLETED: { bg: '#E7E5E4', fg: '#44403C' },
    CANCELLED: { bg: '#FEE2E2', fg: '#B91C1C' },
  };
  const s = map[status] ?? { bg: '#E7E5E4', fg: '#44403C' };
  return (
    <View style={{ backgroundColor: s.bg, borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 4 }}>
      <Text style={{ fontFamily: fonts.bodySemi, fontSize: 10, color: s.fg, letterSpacing: 0.3 }}>
        {status.replace(/_/g, ' ')}
      </Text>
    </View>
  );
}

// Route param typing lives on the shared Record; this screen reads orderId.
export default function OrderDetailScreen({ route }: Props) {
  const c = useTheme();
  const orderId = route.params?.orderId ?? '';
  const justPlaced = route.params?.justPlaced === true;
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api
      .orderDetail(orderId)
      .then((r) => setOrder(r.order))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'));
  }, [orderId]);

  useEffect(load, [load]);

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 20 }} showsVerticalScrollIndicator={false}>
        {justPlaced && order === null && !error ? (
          <Card style={{ alignItems: 'center', paddingVertical: 30, gap: 10, marginBottom: 16 }}>
            <View style={{ width: 58, height: 58, borderRadius: 29, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="checkmark" size={28} color="#fff" />
            </View>
            <Text style={{ fontFamily: fonts.display, fontSize: 21, color: c.ink }}>Order received</Text>
            <Text style={{ fontFamily: fonts.body, color: c.muted, textAlign: 'center' }}>
              The store will confirm it shortly — pay at pickup/delivery.
            </Text>
          </Card>
        ) : null}

        {error ? (
          <EmptyState icon="alert-circle-outline" title="Couldn't load order" note={error} />
        ) : order === null ? (
          <Text style={{ fontFamily: fonts.body, color: c.muted }}>Loading…</Text>
        ) : (
          <>
            <Text style={{ fontFamily: fonts.display, fontSize: 25, color: c.ink }}>
              #{order.id.slice(0, 8).toUpperCase()}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, marginBottom: 14 }}>
              <StatusPill status={order.status} />
              <Text style={{ fontFamily: fonts.body, fontSize: 12.5, color: c.muted }}>
                {formatISODateTime(order.placedAt)}
              </Text>
            </View>

            <Card style={{ marginBottom: 12 }}>
              {order.items.map((item, i) => (
                <View
                  key={`${item.name}-${i}`}
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    paddingVertical: 7,
                    borderBottomWidth: i < order.items.length - 1 ? StyleSheet.hairlineWidth : 0,
                    borderBottomColor: c.hairline,
                  }}
                >
                  <Text style={{ fontFamily: fonts.bodyMed, fontSize: 13.5, color: c.ink, flex: 1, paddingRight: 12 }}>
                    {item.qty}× {item.name}
                  </Text>
                  <Text style={{ fontFamily: fonts.bodySemi, fontSize: 13.5, color: c.ink }}>
                    {formatMoney(item.unitPriceCents * item.qty)}
                  </Text>
                </View>
              ))}
            </Card>

            <Card>
              <Row label="Subtotal" value={formatMoney(order.subtotalCents)} />
              {order.discountCents > 0 ? (
                <Row label="Coupon discount" value={`− ${formatMoney(order.discountCents)}`} accent />
              ) : null}
              {order.deliveryFeeCents > 0 ? (
                <Row label="Delivery" value={formatMoney(order.deliveryFeeCents)} />
              ) : null}
              {order.codChargeCents > 0 ? (
                <Row label="COD / handling" value={formatMoney(order.codChargeCents)} />
              ) : null}
              <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.hairline, marginVertical: 8 }} />
              <Row label="Total" value={formatMoney(order.totalCents)} strong />
              {order.payment ? (
                <Text style={{ fontFamily: fonts.body, fontSize: 11.5, color: c.muted, marginTop: 8 }}>
                  Payment: {order.payment.method} · {order.payment.status}
                </Text>
              ) : null}
              {order.address?.line1 ? (
                <Text style={{ fontFamily: fonts.body, fontSize: 11.5, color: c.muted, marginTop: 4 }}>
                  Deliver to: {order.address.line1}
                  {order.address.city ? `, ${order.address.city}` : ''}
                </Text>
              ) : null}
            </Card>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function Row({ label, value, strong, accent }: { label: string; value: string; strong?: boolean; accent?: boolean }) {
  const c = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
      <Text style={{ fontFamily: strong ? fonts.bodyBold : fonts.bodyMed, fontSize: strong ? 15 : 13, color: accent ? c.primaryDark : c.ink }}>
        {label}
      </Text>
      <Text style={{ fontFamily: strong ? fonts.bodyBold : fonts.bodySemi, fontSize: strong ? 16 : 13, color: accent ? c.primaryDark : c.ink }}>
        {value}
      </Text>
    </View>
  );
}
