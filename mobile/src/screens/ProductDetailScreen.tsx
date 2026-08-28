// Product detail with big thumb, price, add-to-cart bar.
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { api, type CatalogProduct } from '../api';
import { fonts, formatMoney, radius, type ThemeColors } from '../theme';
import { useTheme, useThemedStyles } from '../theme-context';
import { useStore } from '../store';
import { GradientButton, Screen } from '../ui';
import { ProductThumb } from './HomeScreen';
import type { ProductDetailProps } from '../navigation';

export default function ProductDetailScreen({ route, navigation }: ProductDetailProps) {
  const productId = route.params?.productId ?? '';
  const addToCart = useStore((s) => s.addToCart);
  const c = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [product, setProduct] = useState<CatalogProduct | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .catalog()
      .then((cat) => {
        if (alive) setProduct(cat.products.find((p) => p.id === productId) ?? null);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [productId]);

  return (
    <Screen>
      <SafeAreaView edges={['top']} style={{ flex: 0 }} />
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        {/* back */}
        <Pressable onPress={navigation.goBack} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={c.ink} />
          <Text style={styles.backText}>Shop</Text>
        </Pressable>

        <View style={{ paddingHorizontal: 20 }}>
          {product ? (
            <>
              <View style={{ marginTop: 8 }}>
                <ProductThumb product={product} height={230} />
              </View>
              {product.featured ? (
                <View style={styles.featuredPill}>
                  <Ionicons name="star" size={11} color="#B45309" />
                  <Text style={styles.featuredText}>Featured</Text>
                </View>
              ) : null}
              <Text style={[{ fontFamily: fonts.display, fontSize: 27, color: c.ink, marginTop: 10 }]}>
                {product.name}
              </Text>
              <Text style={{ fontFamily: fonts.bodyBold, fontSize: 21, color: c.primaryDark, marginTop: 6 }}>
                {formatMoney(product.priceCents)}
              </Text>
              {product.description ? (
                <Text style={{ fontFamily: fonts.body, fontSize: 14.5, lineHeight: 22, color: c.muted, marginTop: 12 }}>
                  {product.description}
                </Text>
              ) : null}
            </>
          ) : (
            <Text style={{ marginTop: 40, textAlign: 'center', color: c.muted }}>Loading…</Text>
          )}
        </View>
      </ScrollView>

      {/* sticky add-to-cart */}
      {product && (
        <SafeAreaView edges={['bottom']} style={styles.bottomBarWrap}>
          <View style={styles.bottomBar}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.bodyMed, fontSize: 11.5, color: c.muted }}>
                {product.soldOut ? '' : 'Pay at salon · UPI / Cash'}
              </Text>
              <Text style={{ fontFamily: fonts.bodyBold, fontSize: 17, color: c.ink }}>
                {formatMoney(product.priceCents)}
              </Text>
            </View>
            <View style={{ width: 190 }}>
              {product.soldOut ? (
                <View style={styles.soldOutBox}>
                  <Text style={{ color: '#fff', fontFamily: fonts.bodySemi }}>Sold out</Text>
                </View>
              ) : (
                <GradientButton
                  label="Add to cart"
                  icon="bag-handle"
                  onPress={() => {
                    addToCart(product);
                    navigation.push('Cart');
                  }}
                />
              )}
            </View>
          </View>
        </SafeAreaView>
      )}
    </Screen>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    backBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 20,
      paddingVertical: 8,
      alignSelf: 'flex-start',
    },
    backText: { fontFamily: fonts.bodySemi, fontSize: 15, color: c.ink },
    featuredPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      alignSelf: 'flex-start',
      backgroundColor: '#FEF3C7',
      borderRadius: radius.pill,
      paddingHorizontal: 9,
      paddingVertical: 4,
      marginTop: 8,
    },
    featuredText: { fontFamily: fonts.bodySemi, fontSize: 11, color: '#B45309' },
    bottomBarWrap: { position: 'absolute', left: 0, right: 0, bottom: 0 },
    bottomBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: '#FFFFFFFA',
      borderTopLeftRadius: radius.lg,
      borderTopRightRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.hairline,
      padding: 16,
      shadowColor: c.shadow,
      shadowOpacity: 1,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: -6 },
      elevation: 8,
    },
    soldOutBox: {
      minHeight: 52,
      borderRadius: radius.pill,
      backgroundColor: '#B9B4A7',
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
