// In-app owner/admin mode: today's book, customers, staff.
// Visible only for manager roles (OWNER / ADMIN / DEVELOPER); the API
// enforces the same rule server-side.
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { api } from '../api';
import { fonts, formatMoney, radius, type ThemeColors } from '../theme';
import { useTheme, useThemedStyles } from '../theme-context';
import { Card, EmptyState, ErrorNote, GhostButton, Screen } from '../ui';

interface Stats {
  revenueTodayCents: number;
  ordersToday: number;
  appointmentsToday: number;
  pendingOrders: number;
  lowStockCount: number;
}

interface AdminAppointment {
  id: string;
  startsAt: string;
  status: string;
  customer: { name: string; email: string; phone: string | null };
  service: { name: string; durationMin: number; priceCents: number };
  staff: { name: string };
}

interface CustomerRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  marketingOptIn: boolean;
  _count: { orders: number; appointments: number };
}

interface StaffRow {
  id: string;
  name: string;
  bio: string | null;
  active: boolean;
  serviceIds: string[];
}

type Segment = 'today' | 'customers' | 'staff';

export default function AdminScreen() {
  const [segment, setSegment] = useState<Segment>('today');
  const c = useTheme();
  const styles = useThemedStyles(makeStyles);

  return (
    <Screen>
      <SafeAreaView edges={['top']} style={{ flex: 0 }} />
      <View style={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 6 }}>
        <Text style={{ fontFamily: fonts.display, fontSize: 26, color: c.ink }}>Salon console</Text>
      </View>
      <View style={styles.segmentRow}>
        {(
          [
            ['today', 'Today', 'calendar-clear-outline'],
            ['customers', 'Customers', 'people-outline'],
            ['staff', 'Staff', 'cut-outline'],
          ] as Array<[Segment, string, keyof typeof Ionicons.glyphMap]>
        ).map(([key, label, icon]) => (
          <Pressable
            key={key}
            onPress={() => {
              Haptics.selectionAsync();
              setSegment(key);
            }}
            style={[styles.segmentBtn, segment === key && styles.segmentBtnActive]}
          >
            <Ionicons name={icon} size={15} color={segment === key ? c.primaryDark : c.muted} />
            <Text style={[styles.segmentText, segment === key && styles.segmentTextActive]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {segment === 'today' ? <TodayView /> : null}
      {segment === 'customers' ? <CustomersView /> : null}
      {segment === 'staff' ? <StaffView /> : null}
    </Screen>
  );
}

// ---------------- today ----------------

function TodayView() {
  const c = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [stats, setStats] = useState<Stats | null>(null);
  const [appointments, setAppointments] = useState<AdminAppointment[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [s, a] = await Promise.all([
        api.adminStats(),
        api.adminAppointments(new Date().toISOString().slice(0, 10)),
      ]);
      setStats(s as Stats);
      setAppointments(a.appointments);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function setStatus(id: string, status: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await api.adminSetAppointmentStatus(id, status);
      load();
    } catch {}
  }

  if (error) {
    return (
      <View style={{ padding: 20 }}>
        <ErrorNote message={error} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 20 }} showsVerticalScrollIndicator={false}>
      <View style={styles.statGrid}>
        <StatCard label="Revenue today" value={stats ? formatMoney(stats.revenueTodayCents) : '—'} />
        <StatCard label="Bookings today" value={stats ? String(stats.appointmentsToday) : '—'} />
        <StatCard label="Orders today" value={stats ? String(stats.ordersToday) : '—'} warn={(stats?.pendingOrders ?? 0) > 0} />
        <StatCard label="Pending orders" value={stats ? String(stats.pendingOrders) : '—'} warn={(stats?.pendingOrders ?? 0) > 0} />
      </View>

      <Text style={styles.listTitle}>Today's appointments</Text>
      {appointments === null ? (
        <Text style={{ fontFamily: fonts.body, color: c.muted }}>Loading…</Text>
      ) : appointments.length === 0 ? (
        <Card>
          <EmptyState icon="calendar-clear-outline" title="No bookings today" note="Enjoy the quiet — or push a promotion." />
        </Card>
      ) : (
        appointments.map((a) => (
          <Card key={a.id} style={{ marginBottom: 10 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
              <Text style={{ fontFamily: fonts.bodySemi, fontSize: 14.5, color: c.ink, flex: 1 }}>
                {new Date(a.startsAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })} · {a.service.name}
              </Text>
              <Text style={{ fontFamily: fonts.bodyBold, fontSize: 13.5, color: c.primaryDark }}>
                {formatMoney(a.service.priceCents)}
              </Text>
            </View>
            <Text style={{ fontFamily: fonts.body, fontSize: 12.5, color: c.muted }}>
              {a.customer.name}
              {a.customer.phone ? ` · ${a.customer.phone}` : ''} · with {a.staff.name} · {a.status}
            </Text>
            {a.status === 'CONFIRMED' || a.status === 'PENDING' ? (
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                {a.status === 'PENDING' ? (
                  <GhostButton label="Confirm" onPress={() => setStatus(a.id, 'CONFIRMED')} style={{ flex: 1, minHeight: 38 }} />
                ) : null}
                <GhostButton label="Complete" onPress={() => setStatus(a.id, 'COMPLETED')} style={{ flex: 1, minHeight: 38 }} />
                <GhostButton label="No-show" onPress={() => setStatus(a.id, 'NO_SHOW')} style={{ flex: 1, minHeight: 38 }} />
                <GhostButton label="Cancel" danger onPress={() => setStatus(a.id, 'CANCELLED')} style={{ flex: 1, minHeight: 38 }} />
              </View>
            ) : null}
          </Card>
        ))
      )}
    </ScrollView>
  );
}

function StatCard({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  const c = useTheme();
  return (
    <Card style={{ flex: 1 }}>
      <Text style={{ fontFamily: fonts.body, fontSize: 11.5, color: c.muted }}>{label}</Text>
      <Text style={{ fontFamily: fonts.display, fontSize: 21, color: warn ? '#B45309' : c.ink, marginTop: 4 }}>
        {value}
      </Text>
    </Card>
  );
}

// ---------------- customers ----------------

function CustomersView() {
  const c = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [customers, setCustomers] = useState<CustomerRow[] | null>(null);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api.adminCustomers(search.trim() || undefined);
      setCustomers(res.customers);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    }
  }, [search]);

  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  async function remove(id: string) {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    try {
      await api.adminRemoveCustomer(id);
      setConfirmingId(null);
      load();
    } catch {}
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <SearchInput value={search} onChangeText={setSearch} />
      <ErrorNote message={error} />
      {customers === null ? (
        <Text style={{ fontFamily: fonts.body, color: c.muted }}>Loading…</Text>
      ) : customers.length === 0 ? (
        <Card>
          <EmptyState icon="people-outline" title="No customers found" />
        </Card>
      ) : (
        customers.map((cust) => (
          <Card key={cust.id} style={{ marginBottom: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {cust.name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.bodySemi, fontSize: 14.5, color: c.ink }}>{cust.name}</Text>
                <Text numberOfLines={1} style={{ fontFamily: fonts.body, fontSize: 12, color: c.muted }}>
                  {cust.email}
                  {cust.phone ? ` · ${cust.phone}` : ''}
                </Text>
                <Text style={{ fontFamily: fonts.body, fontSize: 11.5, color: c.muted, marginTop: 2 }}>
                  {cust._count.orders} orders · {cust._count.appointments} visits
                </Text>
              </View>
              {confirmingId === cust.id ? (
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <GhostButton label="Remove" danger onPress={() => remove(cust.id)} style={{ minHeight: 34, paddingHorizontal: 10 }} />
                  <GhostButton label="Keep" onPress={() => setConfirmingId(null)} style={{ minHeight: 34, paddingHorizontal: 10 }} />
                </View>
              ) : (
                <Pressable hitSlop={8} onPress={() => setConfirmingId(cust.id)}>
                  <Ionicons name="person-remove-outline" size={18} color={c.danger} />
                </Pressable>
              )}
            </View>
          </Card>
        ))
      )}
      <Text style={{ fontFamily: fonts.body, fontSize: 11, color: c.muted, textAlign: 'center', marginTop: 6 }}>
        Removing anonymizes the account; orders are kept for accounting.
      </Text>
    </ScrollView>
  );
}

// ---------------- staff ----------------

function StaffView() {
  const c = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [staff, setStaff] = useState<StaffRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api.adminStaff();
      setStaff(res.staff);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function toggle(s: StaffRow) {
    Haptics.selectionAsync();
    try {
      if (s.active) await api.adminDeactivateStaff(s.id);
      else await api.adminUpdateStaff(s.id, { active: true });
      load();
    } catch {}
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 20 }} showsVerticalScrollIndicator={false}>
      <ErrorNote message={error} />
      {staff === null ? (
        <Text style={{ fontFamily: fonts.body, color: c.muted }}>Loading…</Text>
      ) : (
        staff.map((s) => (
          <Card key={s.id} style={{ marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={[styles.avatar, !s.active && { backgroundColor: '#B9B4A7' }]}>
              <Text style={styles.avatarText}>
                {s.name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.bodySemi, fontSize: 14.5, color: c.ink }}>{s.name}</Text>
              {s.bio ? (
                <Text style={{ fontFamily: fonts.body, fontSize: 12, color: c.muted }}>{s.bio}</Text>
              ) : null}
              <Text style={{ fontFamily: fonts.body, fontSize: 11.5, color: s.active ? c.primaryDark : c.muted, marginTop: 2 }}>
                {s.active ? 'Active — bookable' : 'Inactive — hidden from booking'}
              </Text>
            </View>
            <Toggle value={s.active} onChange={() => toggle(s)} />
          </Card>
        ))
      )}
      <Text style={{ fontFamily: fonts.body, fontSize: 11, color: c.muted, textAlign: 'center', marginTop: 6 }}>
        Full staff profiles live in NYX SYS desktop; this controls bookability.
      </Text>
    </ScrollView>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: () => void }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      onPress={onChange}
      style={[styles.toggle, value && styles.toggleOn]}
    >
      <View style={[styles.knob, value && styles.knobOn]} />
    </Pressable>
  );
}

function SearchInput({ value, onChangeText }: { value: string; onChangeText: (t: string) => void }) {
  const c = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.searchWrap}>
      <Ionicons name="search" size={15} color={c.muted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder="Search name, email or phone"
        placeholderTextColor="#B6B0A3"
        style={styles.searchInput}
      />
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    segmentRow: {
      flexDirection: 'row',
      gap: 8,
      paddingHorizontal: 20,
      paddingBottom: 10,
    },
    segmentBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      minHeight: 40,
      borderRadius: radius.pill,
      backgroundColor: 'rgba(27,26,23,0.06)',
    },
    segmentBtnActive: { backgroundColor: '#fff', elevation: 1 },
    segmentText: { fontFamily: fonts.bodySemi, fontSize: 12.5, color: c.muted },
    segmentTextActive: { color: c.primaryDark },
    statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    listTitle: {
      fontFamily: fonts.displayMed,
      fontSize: 18,
      color: c.ink,
      marginTop: 18,
      marginBottom: 10,
    },
    avatar: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: c.primaryDark,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: { color: '#fff', fontFamily: fonts.bodySemi, fontSize: 14 },
    toggle: { width: 44, height: 26, borderRadius: 13, backgroundColor: '#D9D4C7', padding: 3 },
    toggleOn: { backgroundColor: c.primary },
    knob: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' },
    knobOn: { alignSelf: 'flex-end' },
    searchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: '#fff',
      borderWidth: 1.5,
      borderColor: c.hairline,
      borderRadius: radius.sm + 2,
      paddingHorizontal: 12,
      marginBottom: 12,
    },
    searchInput: { flex: 1, minHeight: 44, fontFamily: fonts.body, fontSize: 14, color: c.ink },
  });
