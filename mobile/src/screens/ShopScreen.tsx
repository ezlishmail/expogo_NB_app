// Shop: category chips + 2-column product grid, cart button in header.
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import { api, type CatalogResponse } from '../api';
import { fonts, formatMoney, type ThemeColors } from '../theme';
import { useTheme, useThemedStyles } from '../theme-context';
import { useStore } from '../store';
import { Card, Chip, EmptyState, Screen, Skeleton } from '../ui';
import { ProductThumb } from './HomeScreen';

type Nav = ReturnType<typeof useNavigation<any>>;

const COLS = 2;

export default function ShopScreen() {
  const navigation = useNavigation<Nav>();
  const cartCount = useStore((s) => s.cart.reduce((n, l) => n + l.qty, 0));
  const c = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setCatalog(await api.catalog());
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const products = (catalog?.products ?? []).filter(
    (p) => selectedCategory === null || p.categoryId === selectedCategory,
  );

  return (
    <Screen>
      <SafeAreaView edges={['top']} style={{ flex: 0 }} />
      {/* header */}
      <View style={styles.header}>
        <Text style={{ fontFamily: fonts.display, fontSize: 26, color: c.ink }}>Shop</Text>
        <Pressable
          accessibilityLabel="Cart"
          onPress={() => {
            Haptics.selectionAsync();
            navigation.push('Cart');
          }}
          style={styles.cartBtn}
        >
          <Ionicons name="bag-handle-outline" size={20} color={c.ink} />
          {cartCount > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{cartCount > 9 ? '9+' : cartCount}</Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      {/* categories */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 4, gap: 2 }}
        style={{ flexGrow: 0 }}
      >
        <Chip label="All" active={selectedCategory === null} onPress={() => setSelectedCategory(null)} />
        {(catalog?.categories ?? []).map((cat) => (
          <Chip
            key={cat.id}
            label={cat.name}
            active={selectedCategory === cat.id}
            onPress={() => setSelectedCategory(cat.id)}
          />
        ))}
      </ScrollView>

      <ScrollView
        contentContainerStyle={styles.gridWrap}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={c.primary} />}
      >
        {loading ? (
          <View style={styles.grid}>
            {[0, 1, 2, 3].map((i) => (
              <Card key={i} style={styles.cell}>
                <Skeleton height={110} />
                <Skeleton width="80%" />
                <Skeleton width="40%" />
              </Card>
            ))}
          </View>
        ) : products.length === 0 ? (
          <Card>
            <EmptyState icon="storefront-outline" title="Nothing here yet" note="New products are on their way." />
          </Card>
        ) : (
          <View style={styles.grid}>
            {products.map((p) => (
              <Card key={p.id} style={styles.cell}>
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    navigation.push('ProductDetail', { productId: p.id });
                  }}
                >
                  <ProductThumb product={p} height={112} />
                  <Text numberOfLines={2} style={styles.name}>{p.name}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={styles.price}>{formatMoney(p.priceCents)}</Text>
                    {p.featured ? (
                      <Ionicons name="star" size={13} color={c.accent} />
                    ) : null}
                  </View>
                </Pressable>
              </Card>
            ))}
          </View>
        )}
      </ScrollView>
    </Screen>
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
      paddingBottom: 12,
    },
    cartBtn: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: '#fff',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: c.shadow,
      shadowOpacity: 1,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
    },
    badge: {
      position: 'absolute',
      top: -3,
      right: -3,
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      paddingHorizontal: 4,
      backgroundColor: c.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    badgeText: { color: '#fff', fontSize: 10, fontFamily: fonts.bodyBold },
    gridWrap: { padding: 20, paddingTop: 12, paddingBottom: 40 },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    cell: {
      width: `${(100 - COLS - 1) / COLS}%` as `${number}%`,
      padding: 10,
    },
    name: { fontFamily: fonts.bodySemi, fontSize: 13.5, color: c.ink, minHeight: 36 },
    price: { fontFamily: fonts.bodyBold, fontSize: 14, color: c.primaryDark },
  });
