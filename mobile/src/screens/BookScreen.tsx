// Booking flow: service → staff → day strip → time slots → confirmed.
// Also hosts "My bookings" toggle with upcoming appointments + cancel.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { api, type Appointment, type ServiceModel, type Slot, type StaffMember } from '../api';
import { fonts, formatISODateTime, formatMoney, radius, type ThemeColors } from '../theme';
import { useTheme, useThemedStyles } from '../theme-context';
import { useStore } from '../store';
import { Card, Chip, EmptyState, ErrorNote, GhostButton, GradientButton, SectionTitle, Screen } from '../ui';

const DAY_MS = 24 * 60 * 60 * 1000;

function slotLabel(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  } catch {
    return iso;
  }
}

// Build the YYYY-MM-DD key from LOCAL calendar fields — NOT toISOString(),
// which is UTC. In IST (UTC+5:30) a UTC date can fall on the previous calendar
// day, so the key and the device-local day label (below) would disagree and we
// would query/book the wrong day. getFullYear/getMonth/getDate read the same
// local date the user actually sees on the strip.
function localDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function dayChip(date: Date): { key: string; label: string; sub: string } {
  const key = localDateKey(date);
  const label = date.toLocaleDateString(undefined, { weekday: 'short' });
  const sub = String(date.getDate());
  return { key, label, sub };
}

export default function BookScreen() {
  const [tab, setTab] = useState<'book' | 'mine'>('book');
  const c = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <Screen>
      <SafeAreaView edges={['top']} style={{ flex: 0 }} />
      <View style={styles.header}>
        <Text style={{ fontFamily: fonts.display, fontSize: 26, color: c.ink }}>Appointments</Text>
        <View style={styles.tabSwitch}>
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              setTab('book');
            }}
            style={[styles.tabBtn, tab === 'book' && styles.tabBtnActive]}
          >
            <Text style={[styles.tabText, tab === 'book' && styles.tabTextActive]}>Book</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              setTab('mine');
            }}
            style={[styles.tabBtn, tab === 'mine' && styles.tabBtnActive]}
          >
            <Text style={[styles.tabText, tab === 'mine' && styles.tabTextActive]}>My bookings</Text>
          </Pressable>
        </View>
      </View>

      {tab === 'book' ? <BookingFlow /> : <MyAppointments />}
    </Screen>
  );
}

// ---------------- booking flow ----------------

function BookingFlow() {
  const config = useStore((s) => s.config);
  const c = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [services, setServices] = useState<ServiceModel[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [staffId, setStaffId] = useState<string | null>(null);
  const [serviceCat, setServiceCat] = useState<string | null>(null);
  const [staffGender, setStaffGender] = useState<'MALE' | 'FEMALE' | null>(null);
  const [dateKey, setDateKey] = useState(() => localDateKey(new Date(Date.now() + DAY_MS)));
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmedId, setConfirmedId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.services(), api.staff()])
      .then(([s, st]) => {
        setServices(s.services);
        setStaff(st.staff.filter((m) => m.serviceIds.length > 0));
        if (s.services[0]) setServiceId(s.services[0].id);
      })
      .catch(() => setError("Couldn't load services. Is the backend running?"));
  }, []);

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => dayChip(new Date(Date.now() + (i + 1) * DAY_MS))),
    [],
  );

  const loadSlots = useCallback(async () => {
    if (!serviceId) return;
    setLoadingSlots(true);
    setSlot(null);
    try {
      const res = await api.availability(serviceId, dateKey, staffId);
      setSlots(res.slots);
    } catch {
      setSlots([]);
    }
    setLoadingSlots(false);
  }, [serviceId, dateKey, staffId]);

  useEffect(() => {
    loadSlots();
  }, [loadSlots]);

  const selectedService = services.find((s) => s.id === serviceId);

  // Category chips (step 1) and the male/female stylist filter (step 2) are
  // derived from the loaded catalog. Picking a category that hides the current
  // service — or a gender that hides the current stylist — resets that choice so
  // steps 3/4 never query with a hidden selection.
  const categories = useMemo(
    () => [...new Set(services.map((s) => s.category).filter((x): x is string => !!x))].sort(),
    [services],
  );
  const visibleServices = useMemo(
    () => (serviceCat ? services.filter((s) => s.category === serviceCat) : services),
    [services, serviceCat],
  );
  const visibleStaff = useMemo(
    () => (staffGender ? staff.filter((s) => s.gender === staffGender) : staff),
    [staff, staffGender],
  );

  function pickCategory(cat: string | null) {
    setServiceCat(cat);
    const next = cat ? services.filter((s) => s.category === cat) : services;
    if (!next.some((s) => s.id === serviceId)) setServiceId(next[0]?.id ?? null);
  }
  function pickGender(g: 'MALE' | 'FEMALE' | null) {
    setStaffGender(g);
    if (staffId && g && staff.find((s) => s.id === staffId)?.gender !== g) setStaffId(null);
  }

  async function confirm() {
    if (!serviceId || !slot || confirming) return;
    setConfirming(true);
    setError(null);
    try {
      const res = await api.book(serviceId, slot.startsAt, slot.staffId);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setConfirmedId(res.appointment.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Booking failed');
      loadSlots();
    } finally {
      setConfirming(false);
    }
  }

  if (confirmedId) {
    return (
      <View style={{ flex: 1, padding: 20 }}>
        <Card style={{ alignItems: 'center', paddingVertical: 36, gap: 10 }}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark" size={30} color="#fff" />
          </View>
          <Text style={{ fontFamily: fonts.display, fontSize: 22, color: c.ink }}>You're booked</Text>
          <Text style={{ fontFamily: fonts.body, color: c.muted, textAlign: 'center', lineHeight: 20 }}>
            We'll remind you before your visit. See you soon!
          </Text>
          <GhostButton label="Done" onPress={() => setConfirmedId(null)} style={{ alignSelf: 'stretch', marginTop: 8 }} />
        </Card>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
      {/* step 1 — service */}
      <SectionTitle>1 · Choose a service</SectionTitle>
      {categories.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingRight: 20, paddingBottom: 12 }}
        >
          <Chip label="All" active={serviceCat === null} onPress={() => pickCategory(null)} />
          {categories.map((cat) => (
            <Chip key={cat} label={cat} active={serviceCat === cat} onPress={() => pickCategory(cat)} />
          ))}
        </ScrollView>
      ) : null}
      {visibleServices.map((svc) => {
        const active = svc.id === serviceId;
        return (
          <Pressable key={svc.id} onPress={() => { Haptics.selectionAsync(); setServiceId(svc.id); }}>
            <Card style={[styles.serviceCard, active && styles.serviceCardActive]}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <Text style={{ fontFamily: fonts.bodySemi, fontSize: 15, color: c.ink }}>{svc.name}</Text>
                  {svc.forGender ? (
                    <View style={styles.svcBadge}>
                      <Text style={styles.svcBadgeText}>{svc.forGender === 'MALE' ? 'Gents' : 'Ladies'}</Text>
                    </View>
                  ) : null}
                </View>
                {svc.description ? (
                  <Text numberOfLines={1} style={{ fontFamily: fonts.body, fontSize: 12.5, color: c.muted, marginTop: 2 }}>
                    {svc.description}
                  </Text>
                ) : null}
                <Text style={{ fontFamily: fonts.bodyMed, fontSize: 12, color: c.muted, marginTop: 4 }}>
                  {svc.durationMin} min
                </Text>
              </View>
              <Text style={{ fontFamily: fonts.bodyBold, fontSize: 14.5, color: c.primaryDark }}>
                {svc.priceCents === 0 ? 'Free consult' : formatMoney(svc.priceCents)}
              </Text>
            </Card>
          </Pressable>
        );
      })}

      {/* step 2 — staff */}
      <SectionTitle>2 · Pick your stylist</SectionTitle>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        <Chip label="All" active={staffGender === null} onPress={() => pickGender(null)} />
        <Chip label="Male" active={staffGender === 'MALE'} onPress={() => pickGender('MALE')} />
        <Chip label="Female" active={staffGender === 'FEMALE'} onPress={() => pickGender('FEMALE')} />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Pressable
          onPress={() => { Haptics.selectionAsync(); setStaffId(null); }}
          style={[styles.stylistCard, staffId === null && styles.stylistCardActive]}
        >
          <View style={[styles.stylistAvatar, styles.stylistAvatarFallback]}>
            <Ionicons name="people-outline" size={18} color={c.primaryDark} />
          </View>
          <Text numberOfLines={1} style={[styles.stylistName, staffId === null && styles.stylistNameActive]}>
            Anyone
          </Text>
        </Pressable>
        {visibleStaff.map((st) => {
          const active = staffId === st.id;
          return (
            <Pressable
              key={st.id}
              onPress={() => { Haptics.selectionAsync(); setStaffId(st.id); }}
              style={[styles.stylistCard, active && styles.stylistCardActive]}
            >
              {st.photoUrl ? (
                <Image source={{ uri: st.photoUrl }} style={styles.stylistAvatar} contentFit="cover" />
              ) : (
                <View style={[styles.stylistAvatar, styles.stylistAvatarFallback]}>
                  <Text style={{ fontFamily: fonts.bodyBold, fontSize: 16, color: c.primaryDark }}>
                    {st.name.slice(0, 1).toUpperCase()}
                  </Text>
                </View>
              )}
              <Text numberOfLines={1} style={[styles.stylistName, active && styles.stylistNameActive]}>
                {st.name}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {staff.length > 0 && visibleStaff.length === 0 ? (
        <Text style={{ fontFamily: fonts.body, fontSize: 12.5, color: c.muted, marginTop: 8 }}>
          No stylists match this filter yet — try “All”.
        </Text>
      ) : null}

      {/* step 3 — day */}
      <SectionTitle>3 · Pick a day</SectionTitle>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 20 }}>
        {days.map((d) => {
          const active = d.key === dateKey;
          return (
            <Pressable
              key={d.key}
              onPress={() => {
                Haptics.selectionAsync();
                setDateKey(d.key);
              }}
              style={[styles.dayCard, active && styles.dayCardActive]}
            >
              <Text style={[styles.dayLabel, active && styles.dayLabelActive]}>{d.label}</Text>
              <Text style={[styles.daySub, active && { color: '#fff' }]}>{d.sub}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* step 4 — time */}
      <SectionTitle>4 · Available times</SectionTitle>
      {selectedService ? (
        <Text style={{ fontFamily: fonts.body, fontSize: 12, color: c.muted, marginBottom: 10 }}>
          {selectedService.name} · {selectedService.durationMin} min
        </Text>
      ) : null}
      {error ? <ErrorNote message={error} /> : null}
      {loadingSlots ? (
        <Text style={{ fontFamily: fonts.body, color: c.muted }}>Checking the calendar…</Text>
      ) : slots.length === 0 ? (
        <EmptyState icon="calendar-clear-outline" title="No openings this day" note="Try another day — weekends fill fast." />
      ) : (
        <View style={styles.slotGrid}>
          {slots.slice(0, 18).map((s) => {
            const active = slot?.id === s.id;
            return (
              <Pressable
                key={s.id}
                onPress={() => {
                  Haptics.selectionAsync();
                  setSlot(s);
                }}
                style={[styles.slotPill, active && styles.slotPillActive]}
              >
                <Text style={[styles.slotText, active && styles.slotTextActive]}>{slotLabel(s.startsAt)}</Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {slot ? (
        <View style={{ marginTop: 18 }}>
          <GradientButton
            label={`Confirm ${formatISODateTime(slot.startsAt)}`}
            icon="checkmark"
            onPress={confirm}
            busy={confirming}
          />
        </View>
      ) : null}
    </ScrollView>
  );
}

// ---------------- my bookings ----------------

function MyAppointments() {
  const c = useTheme();
  const [appointments, setAppointments] = useState<Appointment[] | null>(null);

  const load = useCallback(() => {
    api
      .myAppointments()
      .then((r) => setAppointments(r.appointments))
      .catch(() => setAppointments([]));
  }, []);

  useEffect(load, [load]);

  async function cancel(id: string) {
    try {
      await api.cancelAppointment(id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      load();
    } catch {}
  }

  if (appointments === null) {
    return <Text style={{ padding: 20, fontFamily: fonts.body, color: c.muted }}>Loading…</Text>;
  }
  if (appointments.length === 0) {
    return (
      <View style={{ padding: 20 }}>
        <EmptyState icon="calendar-outline" title="No upcoming visits" note="Tap the Book tab to grab a slot." />
      </View>
    );
  }
  return (
    <ScrollView contentContainerStyle={{ padding: 20 }} showsVerticalScrollIndicator={false}>
      {appointments.map((a) => (
        <Card key={a.id} style={{ marginBottom: 10 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <Text style={{ fontFamily: fonts.bodySemi, fontSize: 15, color: c.ink }}>
              {a.serviceName ?? 'Appointment'}
            </Text>
            <StatusPill status={a.status} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="time-outline" size={13} color={c.primaryDark} />
            <Text style={{ fontFamily: fonts.bodyMed, fontSize: 13, color: c.primaryDark }}>
              {formatISODateTime(a.startsAt)}
            </Text>
          </View>
          {a.staffName ? (
            <Text style={{ fontFamily: fonts.body, fontSize: 12.5, color: c.muted, marginTop: 2 }}>
              with {a.staffName}
            </Text>
          ) : null}
          <GhostButton label="Cancel" danger onPress={() => cancel(a.id)} style={{ marginTop: 12, minHeight: 38 }} />
        </Card>
      ))}
    </ScrollView>
  );
}

export function StatusPill({ status }: { status: string }) {
  const c = useTheme();
  const map: Record<string, { bg: string; fg: string }> = {
    CONFIRMED: { bg: c.primaryTint, fg: c.primaryDark },
    COMPLETED: { bg: '#E7E5E4', fg: '#44403C' },
    CANCELLED: { bg: '#FEE2E2', fg: '#B91C1C' },
    NO_SHOW: { bg: '#FEF3C7', fg: '#B45309' },
    PENDING: { bg: '#E0F2FE', fg: '#0369A1' },
  };
  const s = map[status] ?? { bg: '#E7E5E4', fg: '#44403C' };
  return (
    <View style={{ backgroundColor: s.bg, borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 4 }}>
      <Text style={{ fontFamily: fonts.bodySemi, fontSize: 10.5, color: s.fg, letterSpacing: 0.4 }}>{status}</Text>
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
      paddingBottom: 10,
    },
    tabSwitch: {
      flexDirection: 'row',
      backgroundColor: 'rgba(27,26,23,0.06)',
      borderRadius: radius.pill,
      padding: 3,
    },
    tabBtn: { borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 7 },
    tabBtnActive: { backgroundColor: '#fff', elevation: 1 },
    tabText: { fontFamily: fonts.bodySemi, fontSize: 11.5, color: c.muted },
    tabTextActive: { color: c.ink },
    serviceCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 2, borderColor: 'transparent', marginBottom: 8 },
    serviceCardActive: { borderColor: c.primary },
    successIcon: {
      width: 62,
      height: 62,
      borderRadius: 31,
      backgroundColor: c.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dayCard: {
      width: 58,
      borderRadius: radius.md,
      backgroundColor: '#fff',
      borderWidth: 2,
      borderColor: 'transparent',
      alignItems: 'center',
      paddingVertical: 10,
      shadowColor: c.shadow,
      shadowOpacity: 1,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 1,
    },
    dayCardActive: { borderColor: c.primary, backgroundColor: c.primaryTint },
    dayLabel: { fontFamily: fonts.bodySemi, fontSize: 11.5, color: c.muted, textTransform: 'uppercase' },
    dayLabelActive: { color: c.primaryDark },
    daySub: { fontFamily: fonts.bodyBold, fontSize: 19, color: c.ink, marginTop: 2 },
    slotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    slotPill: {
      borderRadius: radius.pill,
      borderWidth: 1.5,
      borderColor: c.hairline,
      backgroundColor: '#fff',
      paddingHorizontal: 13,
      paddingVertical: 9,
    },
    slotPillActive: { borderColor: c.primary, backgroundColor: c.primaryTint },
    slotText: { fontFamily: fonts.bodySemi, fontSize: 12.5, color: c.ink },
    slotTextActive: { color: c.primaryDark },
    svcBadge: {
      backgroundColor: c.primaryTint,
      borderRadius: radius.pill,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    svcBadgeText: {
      fontFamily: fonts.bodySemi,
      fontSize: 10,
      color: c.primaryDark,
      textTransform: 'uppercase',
      letterSpacing: 0.3,
    },
    stylistCard: {
      width: 84,
      alignItems: 'center',
      gap: 6,
      paddingVertical: 10,
      paddingHorizontal: 4,
      borderRadius: radius.md,
      borderWidth: 2,
      borderColor: 'transparent',
      backgroundColor: '#fff',
    },
    stylistCardActive: { borderColor: c.primary, backgroundColor: c.primaryTint },
    stylistAvatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: c.primaryTint },
    stylistAvatarFallback: { alignItems: 'center', justifyContent: 'center' },
    stylistName: { fontFamily: fonts.bodySemi, fontSize: 12, color: c.ink, maxWidth: 76, textAlign: 'center' },
    stylistNameActive: { color: c.primaryDark },
  });
