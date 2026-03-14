import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { buildAlerts } from '../../lib/maintenance';
import { Car, MaintenanceSchedule, MaintenanceAlert, MAINTENANCE_LABELS, MAINTENANCE_ICONS } from '../../types';
import { Colors } from '../../constants/theme';
import { format, parseISO } from 'date-fns';

export default function DashboardScreen() {
  const [cars, setCars] = useState<Car[]>([]);
  const [alerts, setAlerts] = useState<MaintenanceAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [carsRes, schedulesRes] = await Promise.all([
      supabase.from('cars').select('*').eq('user_id', user.id).order('created_at'),
      supabase.from('maintenance_schedules').select('*').eq('is_active', true),
    ]);

    const carsData: Car[] = carsRes.data ?? [];
    const schedulesData: MaintenanceSchedule[] = schedulesRes.data ?? [];

    setCars(carsData);
    setAlerts(buildAlerts(carsData, schedulesData));
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const overdue = alerts.filter((a) => a.overdue);
  const upcoming = alerts.filter((a) => !a.overdue);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={Colors.primary} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Good {getTimeOfDay()}</Text>
          <Text style={styles.headerTitle}>Maintenance Dashboard</Text>
        </View>
        <TouchableOpacity onPress={handleSignOut} style={styles.signOutBtn}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <StatCard label="Cars" value={String(cars.length)} icon="🚗" />
        <StatCard label="Overdue" value={String(overdue.length)} icon="⚠️" danger={overdue.length > 0} />
        <StatCard label="Upcoming" value={String(upcoming.length)} icon="🔔" />
      </View>

      {/* Overdue alerts */}
      {overdue.length > 0 && (
        <Section title="⚠️ Overdue" titleColor={Colors.danger}>
          {overdue.map((alert) => (
            <AlertCard key={`${alert.car.id}-${alert.schedule.type}`} alert={alert} />
          ))}
        </Section>
      )}

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <Section title="🔔 Upcoming (next 30 days / 500 mi)">
          {upcoming.map((alert) => (
            <AlertCard key={`${alert.car.id}-${alert.schedule.type}`} alert={alert} />
          ))}
        </Section>
      )}

      {/* All clear */}
      {alerts.length === 0 && cars.length > 0 && (
        <View style={styles.allClear}>
          <Text style={styles.allClearIcon}>✅</Text>
          <Text style={styles.allClearText}>All maintenance is up to date!</Text>
        </View>
      )}

      {/* No cars */}
      {cars.length === 0 && (
        <View style={styles.allClear}>
          <Text style={styles.allClearIcon}>🚗</Text>
          <Text style={styles.allClearText}>No cars yet</Text>
          <TouchableOpacity style={styles.addCarBtn} onPress={() => router.push('/car/add')}>
            <Text style={styles.addCarBtnText}>Add Your First Car</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

function StatCard({ label, value, icon, danger }: { label: string; value: string; icon: string; danger?: boolean }) {
  return (
    <View style={[styles.statCard, danger && styles.statCardDanger]}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={[styles.statValue, danger && styles.statValueDanger]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Section({ title, titleColor, children }: { title: string; titleColor?: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, titleColor ? { color: titleColor } : {}]}>{title}</Text>
      {children}
    </View>
  );
}

function AlertCard({ alert }: { alert: MaintenanceAlert }) {
  const label = alert.schedule.custom_label ?? MAINTENANCE_LABELS[alert.schedule.type];
  const icon = MAINTENANCE_ICONS[alert.schedule.type];
  const carName = `${alert.car.year} ${alert.car.make} ${alert.car.model}`;

  let dueText = '';
  if (alert.overdue) {
    dueText = 'OVERDUE';
  } else if (alert.daysUntilDue !== undefined) {
    dueText = `Due in ${alert.daysUntilDue}d`;
  } else if (alert.milesUntilDue !== undefined) {
    dueText = `Due in ${alert.milesUntilDue.toLocaleString()} mi`;
  }

  return (
    <TouchableOpacity
      style={[styles.alertCard, alert.overdue && styles.alertCardOverdue]}
      onPress={() => router.push(`/car/${alert.car.id}`)}
    >
      <Text style={styles.alertIcon}>{icon}</Text>
      <View style={styles.alertInfo}>
        <Text style={styles.alertLabel}>{label}</Text>
        <Text style={styles.alertCar}>{carName}</Text>
      </View>
      <View style={[styles.alertBadge, alert.overdue ? styles.badgeDanger : styles.badgeWarning]}>
        <Text style={styles.alertBadgeText}>{dueText}</Text>
      </View>
    </TouchableOpacity>
  );
}

function getTimeOfDay() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 18) return 'afternoon';
  return 'evening';
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20, paddingTop: 56 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  greeting: { fontSize: 13, color: Colors.textMuted, marginBottom: 2 },
  headerTitle: { fontSize: 22, fontWeight: '700', color: Colors.text },
  signOutBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: Colors.surface },
  signOutText: { color: Colors.textMuted, fontSize: 13 },

  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  statCard: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', borderWidth: 1, borderColor: Colors.border,
  },
  statCardDanger: { borderColor: Colors.danger },
  statIcon: { fontSize: 20, marginBottom: 4 },
  statValue: { fontSize: 22, fontWeight: '700', color: Colors.text },
  statValueDanger: { color: Colors.danger },
  statLabel: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },

  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: Colors.text, marginBottom: 10 },

  alertCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface,
    borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: Colors.border,
  },
  alertCardOverdue: { borderColor: Colors.danger + '60' },
  alertIcon: { fontSize: 26, marginRight: 12 },
  alertInfo: { flex: 1 },
  alertLabel: { fontSize: 15, fontWeight: '600', color: Colors.text },
  alertCar: { fontSize: 13, color: Colors.textMuted, marginTop: 2 },
  alertBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeDanger: { backgroundColor: Colors.danger + '30' },
  badgeWarning: { backgroundColor: Colors.warning + '30' },
  alertBadgeText: { fontSize: 12, fontWeight: '600', color: Colors.text },

  allClear: { alignItems: 'center', paddingVertical: 60 },
  allClearIcon: { fontSize: 52, marginBottom: 12 },
  allClearText: { fontSize: 18, color: Colors.textMuted, fontWeight: '500' },
  addCarBtn: { marginTop: 20, backgroundColor: Colors.primary, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  addCarBtnText: { color: Colors.white, fontWeight: '600', fontSize: 15 },
});
