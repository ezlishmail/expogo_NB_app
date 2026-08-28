// Home: greeting, gradient booking hero, featured products carousel.
import React, { useCallback, useEffect, useState } from 'react';
import { Dimensions, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { api, type CatalogProduct } from '../api';
import { fonts, formatMoney, radius, type ThemeColors } from '../theme';
import { useTheme, useThemedStyles } from '../theme-context';
import { useStore } from '../store';
import { Card, EmptyState, Screen, SectionTitle, Skeleton, T, BrandLogo } from '../ui';

type Nav = ReturnType<typeof useNavigation<any>>;

export default function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const user = useStore((s) => s.user);
  const config = useStore((s) => s.config);
  const unread = useStore((s) => s.unreadCount);
  const c = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [featured, setFeatured] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      if (!useStore.getState().token) return;
      const catalog = await api.catalog();
      setFeatured(catalog.products.filter((p) => p.featured).slice(0, 6));
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const firstName = user?.name.split(' ')[0] ?? 'there';

  return (
    <Screen>
      <SafeAreaView edges={['top']} style={{ flex: 0 }} />
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={c.primary} />}
      >
        {/* header */}
        <View style={styles.headerRow}>
          <View>
            <BrandLogo height={20} style={{ marginBottom: 10 }} />
            <Text style={T.small()}>Good to see you</Text>
            <Text style={[T.display(28), { marginTop: 2 }]}>Hi, {firstName}</Text>
          </View>
          <Pressable
            onPress={() => navigation.push('Notifications')}
            style={styles.bell}
            accessibilityLabel="Notifications"
          >
            <Ionicons name="notifications-outline" size={21} color={c.ink} />
            {unread > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text>
              </View>
            ) : null}
          </Pressable>
        </View>

        {/* booking hero */}
        {config?.features.appointments !== false && (
          <LinearGradient
            colors={[c.primary, c.primaryDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1.1, y: 1.2 }}
            style={[styles.hero, { marginTop: 18 }]}
          >
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={styles.heroKicker}>STUDIO</Text>
              <Text style={styles.heroTitle}>Book an appointment</Text>
              <Text style={styles.heroSub}>Haircuts, colour & bridal styling — pick your slot.</Text>
              <BookPill />
            </View>
            <View style={styles.heroFlower}>
              <Ionicons name="cut" size={54} color="#FFFFFFD9" />
            </View>
          </LinearGradient>
        )}

        <SectionTitle action={
          config?.features.shopping !== false ? (
            <Pressable onPress={() => navigation.navigate('Shop' as never)}>
              <Text style={styles.linkAll}>See all</Text>
            </Pressable>
          ) : null
        }>
          Featured for you
        </SectionTitle>

        {loading ? (
          <View style={{ flexDirection: 'row', gap: 12 }}>
            {[0, 1].map((i) => (
              <Card key={i} style={{ width: (Dimensions.get('window').width - 52) / 2, gap: 8 }}>
                <Skeleton height={120} />
                <Skeleton width="80%" />
                <Skeleton width="45%" />
              </Card>
            ))}
          </View>
        ) : featured.length === 0 ? (
          <Card>
            <EmptyState icon="sparkles-outline" title="Nothing featured yet" note="Check the store for the full range." />
          </Card>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 12, paddingRight: 20 }}
          >
            {featured.map((p) => (
              <Card key={p.id} style={{ width: 168 }}>
                <Pressable onPress={() => navigation.push('ProductDetail', { productId: p.id })}>
                  <ProductThumb product={p} height={116} />
                  <Text numberOfLines={1} style={styles.prodName}>{p.name}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={styles.prodPrice}>{formatMoney(p.priceCents)}</Text>
                    {p.soldOut ? (
                      <Text style={styles.soldOut}>Sold out</Text>
                    ) : (
                      <View style={styles.miniAdd}>
                        <Ionicons name="add" size={15} color={c.primaryDark} />
                      </View>
                    )}
                  </View>
                </Pressable>
              </Card>
            ))}
          </ScrollView>
        )}

        {/* business card */}
        {(config?.settings.phone || config?.settings.address) && (
          <>
            <SectionTitle>Visit us</SectionTitle>
            <Card style={{ gap: 8 }}>
              {config.settings.address ? (
                <View style={styles.infoRow}>
                  <Ionicons name="location-outline" size={16} color={c.primary} />
                  <Text style={[T.body(), { flex: 1 }]}>{config.settings.address}</Text>
                </View>
              ) : null}
              {config.settings.phone ? (
                <View style={styles.infoRow}>
                  <Ionicons name="call-outline" size={16} color={c.primary} />
                  <Text style={[T.body(), { flex: 1 }]}>{config.settings.phone}</Text>
                </View>
              ) : null}
            </Card>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function BookPill() {
  const navigation = useNavigation<Nav>();
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable
      onPress={() => navigation.navigate('Book' as never)}
      style={({ pressed }) => [styles.bookPill, pressed && { opacity: 0.85 }]}
    >
      <Ionicons name="calendar-clear" size={15} color="#fff" />
      <Text style={styles.bookPillText}>Pick a time</Text>
      <Ionicons name="arrow-forward" size={15} color="#fff" />
    </Pressable>
  );
}

export function ProductThumb({ product, height }: { product: CatalogProduct; height: number }) {
  const c = useTheme();
  if (product.imageUrl) {
    return (
      <View style={{ borderRadius: radius.sm, overflow: 'hidden', marginBottom: 10 }}>
        <Image source={{ uri: product.imageUrl }} style={{ width: '100%', height }} contentFit="cover" />
      </View>
    );
  }
  return (
    <LinearGradient
      colors={[c.primaryTint, c.bg]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ height, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}
    >
      <View style={{ opacity: 0.55 }}>
        <Ionicons name="sparkles" size={Math.round(height * 0.34)} color={c.primaryDark} />
      </View>
    </LinearGradient>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
    bell: {
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
    hero: {
      borderRadius: radius.lg,
      padding: 22,
      flexDirection: 'row',
      alignItems: 'center',
    },
    heroKicker: {
      fontFamily: fonts.bodyBold,
      fontSize: 11,
      letterSpacing: 2.5,
      color: '#FFFFFFB3',
    },
    heroTitle: {
      fontFamily: fonts.display,
      fontSize: 24,
      color: '#fff',
      marginTop: 6,
    },
    heroSub: {
      fontFamily: fonts.body,
      fontSize: 13,
      lineHeight: 18,
      color: '#FFFFFFCC',
      marginTop: 6,
      marginBottom: 14,
    },
    heroFlower: {
      width: 86,
      height: 86,
      borderRadius: 43,
      backgroundColor: '#FFFFFF1F',
      alignItems: 'center',
      justifyContent: 'center',
    },
    bookPill: {
      flexDirection: 'row',
      alignSelf: 'flex-start',
      alignItems: 'center',
      gap: 6,
      backgroundColor: '#FFFFFF26',
      borderWidth: 1,
      borderColor: '#FFFFFF59',
      borderRadius: radius.pill,
      paddingHorizontal: 14,
      paddingVertical: 9,
    },
    bookPillText: { color: '#fff', fontFamily: fonts.bodySemi, fontSize: 13 },
    prodName: { fontFamily: fonts.bodySemi, fontSize: 14, color: c.ink },
    prodPrice: { fontFamily: fonts.bodyBold, fontSize: 14, color: c.primaryDark },
    soldOut: { fontFamily: fonts.bodyMed, fontSize: 12, color: c.muted },
    miniAdd: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: c.primaryTint,
      alignItems: 'center',
      justifyContent: 'center',
    },
    linkAll: { fontFamily: fonts.bodySemi, fontSize: 13, color: c.primaryDark },
    infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  });
