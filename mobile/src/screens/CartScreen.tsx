// Cart: line items with steppers + subtotal, CTA to checkout.
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { fonts, formatMoney, radius, type ThemeColors } from '../theme';
import { useTheme, useThemedStyles } from '../theme-context';
import { cartSubtotal, useStore } from '../store';
import { EmptyState, GhostButton, GradientButton, Screen } from '../ui';
import type { CartProps } from '../navigation';

export default function CartScreen({ navigation }: CartProps) {
  const cart = useStore((s) => s.cart);
  const setQty = useStore((s) => s.setQty);
  const c = useTheme();
  const styles = useThemedStyles(makeStyles);

  return (
    <Screen>
      <SafeAreaView edges={['top']} style={{ flex: 0 }} />
      <View style={styles.header}>
        <Pressable onPress={navigation.goBack} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={c.ink} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <Text style={{ fontFamily: fonts.display, fontSize: 24, color: c.ink }}>Cart</Text>
        <Text>{'  '}</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20 }} showsVerticalScrollIndicator={false}>
        {cart.length === 0 ? (
          <EmptyState icon="bag-handle-outline" title="Your cart is empty" note="Add salon essentials from the store." />
        ) : (
          <>
            {cart.map((line) => (
              <View key={line.productId} style={styles.lineCard}>
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={{ fontFamily: fonts.bodySemi, fontSize: 15, color: c.ink }}>
                    {line.name}
                  </Text>
                  <Text style={{ fontFamily: fonts.bodyMed, fontSize: 13, color: c.muted, marginTop: 2 }}>
                    {formatMoney(line.priceCents)} each
                  </Text>
                </View>
                <Stepper qty={line.qty} onChange={(q) => setQty(line.productId, q)} />
              </View>
            ))}

            <View style={[styles.summaryRow, { marginTop: 18 }]}>
              <Text style={{ fontFamily: fonts.bodySemi, fontSize: 15, color: c.ink }}>Subtotal</Text>
              <Text style={{ fontFamily: fonts.bodyBold, fontSize: 18, color: c.ink }}>
                {formatMoney(cartSubtotal(cart))}
              </Text>
            </View>
            <Text style={{ fontFamily: fonts.body, fontSize: 12, color: c.muted, marginTop: 4 }}>
              Delivery fee and coupons are applied at checkout — the store confirms the final total.
            </Text>

            <GradientButton
              label="Checkout"
              icon="arrow-forward"
              onPress={() => navigation.push('Checkout')}
              style={{ marginTop: 18 }}
            />
            <GhostButton label="Keep shopping" onPress={() => navigation.popToTop()} style={{ marginTop: 10 }} />
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function Stepper({ qty, onChange }: { qty: number; onChange: (q: number) => void }) {
  const c = useTheme();
  const styles = useThemedStyles(makeStyles);
  const step = (delta: number) => {
    Haptics.selectionAsync();
    onChange(Math.max(0, Math.min(99, qty + delta)));
  };
  return (
    <View style={styles.stepper}>
      <Pressable onPress={() => step(-1)} hitSlop={8} style={styles.stepBtn}>
        <Ionicons name="remove" size={15} color={c.ink} />
      </Pressable>
      <Text style={styles.qty}>{qty}</Text>
      <Pressable onPress={() => step(1)} hitSlop={8} style={styles.stepBtn}>
        <Ionicons name="add" size={15} color={c.ink} />
      </Pressable>
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
    backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    backText: { fontFamily: fonts.bodySemi, fontSize: 15, color: c.ink },
    lineCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: '#fff',
      borderRadius: radius.md,
      padding: 14,
      marginBottom: 10,
      shadowColor: c.shadow,
      shadowOpacity: 1,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 5 },
      elevation: 1,
    },
    stepper: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: c.bg,
      borderRadius: radius.pill,
      padding: 5,
    },
    stepBtn: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: '#fff',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: c.shadow,
      shadowOpacity: 1,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
      elevation: 1,
    },
    qty: { minWidth: 18, textAlign: 'center', fontFamily: fonts.bodyBold, fontSize: 14, color: c.ink },
    summaryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
  });
