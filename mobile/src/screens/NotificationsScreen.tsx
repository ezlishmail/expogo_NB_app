// Notifications inbox with unread badges + mark-all-read.
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api, type NotificationItem } from '../api';
import { fonts, formatISODateTime, type ThemeColors } from '../theme';
import { useTheme, useThemedStyles } from '../theme-context';
import { useStore } from '../store';
import { Card, EmptyState, Screen } from '../ui';
import type { NotificationsProps } from '../navigation';

const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  APPOINTMENT_CONFIRMED: 'calendar-outline',
  APPOINTMENT_RESCHEDULED: 'calendar-outline',
  APPOINTMENT_CANCELLED: 'calendar-clear-outline',
  REMINDER_24H: 'alarm-outline',
  REMINDER_2H: 'alarm-outline',
  ORDER_CONFIRMED: 'bag-handle-outline',
  ORDER_STATUS: 'bicycle-outline',
  PROMOTION: 'pricetags-outline',
  ANNOUNCEMENT: 'megaphone-outline',
};

export default function NotificationsScreen({ navigation }: NotificationsProps) {
  const c = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const refreshUnread = useStore((s) => s.refreshUnread);

  const load = useCallback(() => {
    api
      .notifications()
      .then((r) => setItems(r.notifications))
      .catch(() => setItems([]));
  }, []);

  useEffect(load, [load]);

  async function markAll() {
    try {
      await api.markAllRead();
      load();
      refreshUnread();
    } catch {}
  }

  return (
    <Screen>
      <SafeAreaView edges={['top']} style={{ flex: 0 }} />
      <View style={styles.header}>
        <Pressable onPress={navigation.goBack} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={c.ink} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <Text style={{ fontFamily: fonts.display, fontSize: 22, color: c.ink }}>Alerts</Text>
        <Pressable onPress={markAll} hitSlop={8}>
          <Text style={{ fontFamily: fonts.bodySemi, fontSize: 12.5, color: c.primaryDark }}>Mark all</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20 }} showsVerticalScrollIndicator={false}>
        {items === null ? (
          <Text style={{ fontFamily: fonts.body, color: c.muted }}>Loading…</Text>
        ) : items.length === 0 ? (
          <EmptyState icon="notifications-off-outline" title="You're all caught up" note="Order updates and offers will appear here." />
        ) : (
          items.map((n) => (
            <Card key={n.id} style={[styles.item, !n.read && styles.itemUnread]}>
              <View style={[styles.iconWrap, !n.read && styles.iconWrapUnread]}>
                <Ionicons name={ICONS[n.type] ?? 'notifications-outline'} size={17} color={!n.read ? '#fff' : c.primaryDark} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  {!n.read ? <View style={styles.dot} /> : null}
                  <Text style={{ fontFamily: fonts.bodySemi, fontSize: 13.5, color: c.ink, flex: 1 }} numberOfLines={1}>
                    {n.title}
                  </Text>
                </View>
                {n.body ? (
                  <Text style={{ fontFamily: fonts.body, fontSize: 12.5, color: c.muted, lineHeight: 17, marginTop: 2 }}>
                    {n.body}
                  </Text>
                ) : null}
                <Text style={{ fontFamily: fonts.body, fontSize: 10.5, color: '#B0AA9C', marginTop: 4 }}>
                  {formatISODateTime(n.createdAt)}
                </Text>
              </View>
            </Card>
          ))
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
      paddingBottom: 8,
    },
    backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    backText: { fontFamily: fonts.bodySemi, fontSize: 15, color: c.ink },
    item: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 10,
    },
    itemUnread: {
      borderWidth: 1.5,
      borderColor: c.accent,
    },
    iconWrap: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: c.primaryTint,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconWrapUnread: { backgroundColor: c.primary },
    dot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: c.accent,
    },
  });
