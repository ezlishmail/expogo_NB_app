// Shared UI kit: gradient CTAs, soft cards, chips, skeletons, empty states.
// Brand colours come from useTheme() at render so the kit repaints when the
// tenant config changes; structural tones (ink/muted/danger) use the fallback.
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ImageStyle,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, radius, type ThemeColors } from './theme';
import { useTheme, useThemedStyles } from './theme-context';
import { useStore } from './store';
import { API_BASE } from './api';

// Bundled brand logo — the fallback when tenant config has no logoUrl (or the
// remote one fails to load). Keep in sync with mobile/assets/logo.png.
const BUNDLED_LOGO = require('../assets/logo.png');

export function Card({ style, children }: { style?: StyleProp<ViewStyle>; children: React.ReactNode }) {
  const styles = useThemedStyles(makeStyles);
  return <View style={[styles.card, style]}>{children}</View>;
}

// Config-driven brand logo. Renders config.brand.logoUrl when set (an absolute
// URL, or a "/path" resolved against the API origin), else the bundled asset;
// falls back to bundled if the remote image fails to load. Aspect ratio tracks
// the source wordmark's 480×280.
export function BrandLogo({
  height = 34,
  style,
}: {
  height?: number;
  style?: StyleProp<ImageStyle>;
}) {
  const logoUrl = useStore((s) => s.config?.brand?.logoUrl);
  const [failed, setFailed] = useState(false);
  const uri = failed ? null : resolveLogoUri(logoUrl);
  return (
    <Image
      source={uri ? { uri } : BUNDLED_LOGO}
      onError={() => setFailed(true)}
      contentFit="contain"
      accessibilityLabel="Northern Bloom"
      style={[{ height, width: height * (480 / 280) }, style]}
    />
  );
}

function resolveLogoUri(logoUrl?: string | null): string | null {
  if (!logoUrl) return null;
  if (/^https?:\/\//i.test(logoUrl)) return logoUrl;
  // A leading-slash path is relative to the API origin (drop the /api/v1).
  if (logoUrl.startsWith('/')) return `${API_BASE.replace(/\/api\/v\d+$/, '')}${logoUrl}`;
  return logoUrl;
}

export function GradientButton({
  label,
  onPress,
  disabled,
  busy,
  icon,
  style,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        if (disabled || busy) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onPress();
      }}
      style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }, style]}
    >
      <LinearGradient
        colors={disabled ? ['#C9CDC5', '#B7BDB4'] : [c.primary, c.primaryDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradBtn}
      >
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            {icon ? <Ionicons name={icon} size={18} color="#fff" style={{ marginRight: 8 }} /> : null}
            <Text style={styles.gradBtnText}>{label}</Text>
          </>
        )}
      </LinearGradient>
    </Pressable>
  );
}

export function GhostButton({
  label,
  onPress,
  danger,
  style,
}: {
  label: string;
  onPress: () => void;
  danger?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      style={({ pressed }) => [
        styles.ghostBtn,
        danger && styles.ghostBtnDanger,
        pressed && { opacity: 0.7 },
        style,
      ]}
    >
      <Text style={[styles.ghostBtnText, danger && { color: colors.danger }]}>{label}</Text>
    </Pressable>
  );
}

export function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress: () => void;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      style={[
        styles.chip,
        active && styles.chipActive,
      ]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

export function SectionTitle({ children, action }: { children: string; action?: React.ReactNode }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.sectionTitle}>{children}</Text>
      {action}
    </View>
  );
}

export function Skeleton({ width, height = 16, style }: { width?: number | `${number}%`; height?: number; style?: StyleProp<ViewStyle> }) {
  const opacity = useRef(new Animated.Value(0.45)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 650, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.45, duration: 650, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return (
    <Animated.View
      style={[
        { width: width ?? '100%', height, borderRadius: radius.sm, backgroundColor: '#EAE4D8', opacity },
        style,
      ]}
    />
  );
}

export function EmptyState({ icon, title, note }: { icon: keyof typeof Ionicons.glyphMap; title: string; note?: string }) {
  const c = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIconWrap}>
        <Ionicons name={icon} size={26} color={c.primary} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      {note ? <Text style={styles.emptyNote}>{note}</Text> : null}
    </View>
  );
}

export function ErrorNote({ message }: { message?: string | null }) {
  const styles = useThemedStyles(makeStyles);
  if (!message) return null;
  return (
    <View style={styles.errorNote}>
      <Ionicons name="alert-circle" size={15} color={colors.danger} />
      <Text style={styles.errorNoteText}>{message}</Text>
    </View>
  );
}

export function Input(props: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'numeric';
  autoCapitalize?: 'none' | 'sentences' | 'characters';
}) {
  const styles = useThemedStyles(makeStyles);
  const { value, onChangeText, placeholder, secureTextEntry, keyboardType, autoCapitalize } = props;
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor="#B6B0A3"
      secureTextEntry={secureTextEntry}
      keyboardType={keyboardType}
      autoCapitalize={autoCapitalize}
      style={styles.input}
    />
  );
}

export function Screen({ children, style }: { children?: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const c = useTheme();
  return <View style={[{ flex: 1, backgroundColor: c.bg }, style]}>{children}</View>;
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: c.surface,
      borderRadius: radius.md,
      padding: 14,
      shadowColor: c.shadow,
      shadowOpacity: 1,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 6 },
      elevation: 2,
    },
    gradBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.pill,
      minHeight: 52,
      paddingHorizontal: 20,
      shadowColor: c.primaryDark,
      shadowOpacity: 0.35,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 3,
    },
    gradBtnText: {
      color: '#fff',
      fontFamily: fonts.bodySemi,
      fontSize: 15.5,
      letterSpacing: 0.2,
    },
    ghostBtn: {
      borderRadius: radius.pill,
      borderWidth: 1.5,
      borderColor: c.hairline,
      minHeight: 48,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 18,
      backgroundColor: c.surface,
    },
    ghostBtnDanger: {
      borderColor: 'rgba(220,38,38,0.35)',
    },
    ghostBtnText: {
      color: c.ink,
      fontFamily: fonts.bodySemi,
      fontSize: 15,
    },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: radius.pill,
      backgroundColor: 'rgba(27,26,23,0.06)',
      marginRight: 8,
    },
    chipActive: {
      backgroundColor: c.ink,
    },
    chipText: {
      color: c.ink,
      fontFamily: fonts.bodyMed,
      fontSize: 13.5,
    },
    chipTextActive: {
      color: '#fff',
    },
    sectionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 22,
      marginBottom: 10,
    },
    sectionTitle: {
      fontFamily: fonts.displayMed,
      fontSize: 19,
      color: c.ink,
    },
    empty: { alignItems: 'center', paddingVertical: 42 },
    emptyIconWrap: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: c.primaryTint,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    emptyTitle: { fontFamily: fonts.bodySemi, fontSize: 15.5, color: c.ink },
    emptyNote: {
      fontFamily: fonts.body,
      fontSize: 13,
      color: c.muted,
      marginTop: 4,
      textAlign: 'center',
    },
    errorNote: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: 'rgba(220,38,38,0.08)',
      borderRadius: radius.sm,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginBottom: 10,
    },
    errorNoteText: { color: c.danger, fontFamily: fonts.bodyMed, fontSize: 13, flex: 1 },
    input: {
      backgroundColor: c.surface,
      borderWidth: 1.5,
      borderColor: c.hairline,
      borderRadius: radius.sm + 2,
      paddingHorizontal: 14,
      minHeight: 50,
      fontSize: 15,
      fontFamily: fonts.body,
      color: c.ink,
      marginBottom: 12,
    },
  });

// Typography helpers for consistent text roles. These use structural tones
// (ink/muted) that don't rebrand, so they read from the fallback palette.
export const T = {
  display: (size = 30): TextStyle => ({ fontFamily: fonts.display, fontSize: size, color: colors.ink, lineHeight: size * 1.15 }),
  title: (): TextStyle => ({ fontFamily: fonts.bodyBold, fontSize: 16, color: colors.ink }),
  body: (): TextStyle => ({ fontFamily: fonts.body, fontSize: 14, color: colors.muted, lineHeight: 20 }),
  small: (): TextStyle => ({ fontFamily: fonts.bodyMed, fontSize: 12.5, color: colors.muted }),
} as const;

export function useDebouncedFlag(ms = 400): [boolean, (v: boolean) => void] {
  const [value, setValue] = useState(false);
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  const set = (v: boolean) => {
    if (t.current) clearTimeout(t.current);
    t.current = setTimeout(() => setValue(v), ms);
  };
  return [value, set];
}
