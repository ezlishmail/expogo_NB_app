// Sign in / register — split layout with a brand panel on top.
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { fonts, radius, type ThemeColors } from '../theme';
import { useTheme, useThemedStyles } from '../theme-context';
import { useStore } from '../store';
import { ErrorNote, GradientButton, Input, Screen } from '../ui';

export default function AuthScreen() {
  const signIn = useStore((s) => s.signIn);
  const register = useStore((s) => s.register);
  const c = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (mode === 'login') await signIn(email, password);
      else await register(name, email, password);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  const canSubmit =
    !busy && email.includes('@') && password.length >= (mode === 'register' ? 8 : 1) &&
    (mode === 'login' || name.trim().length > 0);

  return (
    <Screen>
      <LinearGradient
        colors={[c.primaryDark, c.primary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1.2 }}
        style={styles.hero}
      >
        <SafeAreaView edges={['top']}>
          <View style={{ paddingHorizontal: 24, paddingTop: 26 }}>
            <View style={styles.brandRow}>
              <Ionicons name="cut" size={30} color="#FFFFFFE6" />
              <Text style={styles.brandName}>Northern Bloom</Text>
            </View>
            <Text style={styles.headline}>{'Your chair\nis waiting.'}</Text>
            <Text style={styles.sub}>Book your salon services and shop pro products in a couple of taps.</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.formWrap}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.pillSwitch}>
            {(['login', 'register'] as const).map((m) => (
              <Pressable
                key={m}
                onPress={() => {
                  Haptics.selectionAsync();
                  setMode(m);
                  setError(null);
                }}
                style={[styles.pillSwitchBtn, mode === m && styles.pillSwitchBtnActive]}
              >
                <Text style={[styles.pillSwitchText, mode === m && styles.pillSwitchTextActive]}>
                  {m === 'login' ? 'Sign in' : 'Create account'}
                </Text>
              </Pressable>
            ))}
          </View>

          <ErrorNote message={error} />

          {mode === 'register' ? (
            <Input value={name} onChangeText={setName} placeholder="Full name" autoCapitalize="sentences" />
          ) : null}
          <Input value={email} onChangeText={setEmail} placeholder="Email" keyboardType="email-address" autoCapitalize="none" />
          <Input
            value={password}
            onChangeText={setPassword}
            placeholder={mode === 'register' ? 'Password (8+ characters)' : 'Password'}
            secureTextEntry
          />

          <GradientButton
            label={mode === 'login' ? 'Sign in' : 'Create account'}
            onPress={submit}
            disabled={!canSubmit}
            busy={busy}
            style={{ marginTop: 4 }}
          />

          <Text style={styles.fineprint}>
            By continuing you agree to receive order updates. Marketing messages are opt-in.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    hero: {
      borderBottomLeftRadius: radius.lg + 8,
      borderBottomRightRadius: radius.lg + 8,
    },
    brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    brandName: {
      fontFamily: fonts.displayMed,
      fontSize: 17,
      color: '#FFFFFFF0',
      letterSpacing: 0.3,
    },
    headline: {
      fontFamily: fonts.display,
      fontSize: 38,
      lineHeight: 42,
      color: '#fff',
      marginTop: 18,
    },
    sub: {
      fontFamily: fonts.body,
      fontSize: 14,
      lineHeight: 20,
      color: '#FFFFFFCC',
      marginTop: 10,
      marginBottom: 26,
      maxWidth: 280,
    },
    formWrap: {
      padding: 20,
      paddingTop: 22,
    },
    pillSwitch: {
      flexDirection: 'row',
      backgroundColor: 'rgba(27,26,23,0.06)',
      borderRadius: radius.pill,
      padding: 4,
      marginBottom: 16,
    },
    pillSwitchBtn: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 40,
      borderRadius: radius.pill,
    },
    pillSwitchBtnActive: {
      backgroundColor: '#fff',
      shadowColor: c.shadow,
      shadowOpacity: 1,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 3 },
      elevation: 2,
    },
    pillSwitchText: { fontFamily: fonts.bodySemi, fontSize: 13.5, color: c.muted },
    pillSwitchTextActive: { color: c.ink },
    fineprint: {
      fontFamily: fonts.body,
      fontSize: 11.5,
      lineHeight: 16,
      color: c.muted,
      textAlign: 'center',
      marginTop: 14,
      paddingHorizontal: 12,
    },
  });
