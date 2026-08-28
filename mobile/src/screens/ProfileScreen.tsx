// Profile: identity card, marketing opt-in, notifications, sign out, delete.
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import { fonts, radius, type ThemeColors } from '../theme';
import { useTheme, useThemedStyles } from '../theme-context';
import { useStore } from '../store';
import { Card, GhostButton, Screen, T } from '../ui';

type Nav = ReturnType<typeof useNavigation<any>>;

export default function ProfileScreen() {
  const navigation = useNavigation<Nav>();
  const user = useStore((s) => s.user);
  const config = useStore((s) => s.config);
  const unread = useStore((s) => s.unreadCount);
  const setMarketingOptIn = useStore((s) => s.setMarketingOptIn);
  const signOut = useStore((s) => s.signOut);
  const c = useTheme();
  const styles = useThemedStyles(makeStyles);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const deleteAccount = useStore((s) => s.deleteAccount);

  if (!user) return <Screen />;

  return (
    <Screen>
      <SafeAreaView edges={['top']} style={{ flex: 0 }} />
      <View style={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 8 }}>
        <Text style={{ fontFamily: fonts.display, fontSize: 26, color: c.ink }}>Profile</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20 }} showsVerticalScrollIndicator={false}>
        {/* identity card */}
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user.name
                .split(' ')
                .map((p) => p[0])
                .slice(0, 2)
                .join('')
                .toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.bodyBold, fontSize: 16.5, color: c.ink }}>{user.name}</Text>
            <Text style={{ fontFamily: fonts.body, fontSize: 13, color: c.muted }}>{user.email}</Text>
            {user.phone ? (
              <Text style={{ fontFamily: fonts.body, fontSize: 12.5, color: c.muted }}>{user.phone}</Text>
            ) : null}
          </View>
        </Card>

        {/* preferences */}
        <Text style={[T.small(), styles.sectionLabel]}>PREFERENCES</Text>
        <Card style={{ paddingVertical: 4 }}>
          <Row
            icon="notifications-outline"
            label="Promotional notifications"
            sub="Marketing only — order updates always come through"
            right={
              <Toggle value={user.marketingOptIn} onChange={(v) => setMarketingOptIn(v)} />
            }
          />
          <View style={styles.hairline} />
          <Pressable onPress={() => navigation.push('Notifications')}>
            <Row
              icon="chatbubble-ellipses-outline"
              label="Notifications"
              right={
                unread > 0 ? (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadBadgeText}>{unread}</Text>
                  </View>
                ) : (
                  <Ionicons name="chevron-forward" size={16} color={c.muted} />
                )
              }
            />
          </Pressable>
        </Card>

        {/* store info */}
        {(config?.settings.phone || config?.settings.address) && (
          <>
            <Text style={[T.small(), styles.sectionLabel]}>THE STORE</Text>
            <Card style={{ paddingVertical: 4 }}>
              {config?.settings.address ? (
                <Row icon="location-outline" label={config.settings.address} />
              ) : null}
              {config?.settings.phone ? (
                <>
                  <View style={styles.hairline} />
                  <Row icon="call-outline" label={config.settings.phone} />
                </>
              ) : null}
            </Card>
          </>
        )}

        {/* actions */}
        <Text style={[T.small(), styles.sectionLabel]}>ACCOUNT</Text>
        <GhostButton label="Sign out" onPress={() => void signOut()} style={{ minHeight: 48 }} />
        {!confirmDelete ? (
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              setConfirmDelete(true);
            }}
            style={({ pressed }) => [styles.deleteBtn, pressed && { opacity: 0.7 }]}
          >
            <Ionicons name="trash-outline" size={15} color={c.danger} />
            <Text style={styles.deleteText}>Delete my account</Text>
          </Pressable>
        ) : (
          <Card style={{ marginTop: 12, borderColor: 'rgba(220,38,38,0.3)', borderWidth: 1.5 }}>
            <Text style={{ fontFamily: fonts.bodySemi, fontSize: 13.5, color: c.ink }}>
              Delete your account?
            </Text>
            <Text style={{ fontFamily: fonts.body, fontSize: 12.5, color: c.muted, lineHeight: 18, marginTop: 4 }}>
              Orders are kept for accounting; everything else is erased and upcoming appointments cancelled.
            </Text>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
              <GhostButton label="Keep account" onPress={() => setConfirmDelete(false)} style={{ flex: 1, minHeight: 42 }} />
              <GhostButton
                label="Delete"
                danger
                onPress={() => void deleteAccount()}
                style={{ flex: 1, minHeight: 42 }}
              />
            </View>
          </Card>
        )}
      </ScrollView>
    </Screen>
  );
}

function Row({
  icon,
  label,
  sub,
  right,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sub?: string;
  right?: React.ReactNode;
}) {
  const c = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, paddingHorizontal: 4 }}>
      <Ionicons name={icon} size={19} color={c.primaryDark} />
      <View style={{ flex: 1 }}>
        <Text numberOfLines={sub ? 2 : 1} style={{ fontFamily: fonts.bodySemi, fontSize: 14, color: c.ink }}>
          {label}
        </Text>
        {sub ? (
          <Text style={{ fontFamily: fonts.body, fontSize: 11.5, color: c.muted }}>{sub}</Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      onPress={() => {
        Haptics.selectionAsync();
        onChange(!value);
      }}
      style={[styles.toggle, value && styles.toggleOn]}
    >
      <View style={[styles.knob, value && styles.knobOn]} />
    </Pressable>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    avatar: {
      width: 54,
      height: 54,
      borderRadius: 27,
      backgroundColor: c.primaryDark,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: { color: '#fff', fontFamily: fonts.displayMed, fontSize: 19 },
    sectionLabel: {
      letterSpacing: 2,
      marginTop: 22,
      marginBottom: 8,
      paddingHorizontal: 4,
      color: '#A39D8F',
    },
    hairline: { height: StyleSheet.hairlineWidth, backgroundColor: c.hairline },
    toggle: {
      width: 46,
      height: 28,
      borderRadius: 14,
      backgroundColor: '#D9D4C7',
      padding: 3,
    },
    toggleOn: { backgroundColor: c.primary },
    knob: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: '#fff',
    },
    knobOn: { alignSelf: 'flex-end' },
    unreadBadge: {
      minWidth: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: c.accent,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 5,
    },
    unreadBadgeText: { color: '#fff', fontSize: 11, fontFamily: fonts.bodyBold },
    deleteBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      minHeight: 44,
      borderRadius: radius.pill,
      borderWidth: 1.5,
      borderColor: 'rgba(220,38,38,0.35)',
      backgroundColor: '#fff',
      marginTop: 10,
    },
    deleteText: { fontFamily: fonts.bodySemi, fontSize: 14, color: c.danger },
  });
