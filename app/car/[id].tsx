import { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Alert, ActivityIndicator, RefreshControl,
} from 'react-native';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { Car, MaintenanceLog, MaintenanceSchedule, MAINTENANCE_LABELS, MAINTENANCE_ICONS } from '../../types';
import { getAlertStatus } from '../../lib/maintenance';
import { Colors } from '../../constants/theme';
import { format, parseISO } from 'date-fns';

export default function CarDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [car, setCar] = useState<Car | null>(null);
  const [logs, setLogs] = useState<MaintenanceLog[]>([]);
  const [schedules, setSchedules] = useState<MaintenanceSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    const [carRes, logsRes, schedulesRes] = await Promise.all([
      supabase.from('cars').select('*').eq('id', id).single(),
      supabase.from('maintenance_logs').select('*').eq('car_id', id).order('date', { ascending: false }),
      supabase.from('maintenance_schedules').select('*').eq('car_id', id).eq('is_active', true),
    ]);
    setCar(carRes.data);
    setLogs(logsRes.data ?? []);
    setSchedules(schedulesRes.data ?? []);
    setLoading(false);
    setRefreshing(false);
  }, [id]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  async function handleDeleteCar() {
    Alert.alert(
      'Delete Car',
      `Delete ${car?.year} ${car?.make} ${car?.model}? This will remove all maintenance records.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive', onPress: async () => {
            await supabase.from('maintenance_logs').delete().eq('car_id', id);
            await supabase.from('maintenance_schedules').delete().eq('car_id', id);
            await supabase.from('cars').delete().eq('id', id);
            router.replace('/(tabs)/cars');
          },
        },
      ]
    );
  }

  async function handleUpdateMileage() {
    Alert.prompt(
      'Update Mileage',
      'Enter current odometer reading:',
      async (value) => {
        if (!value) return;
        const num = parseInt(value.replace(/,/g, ''), 10);
        if (isNaN(num)) return;
        await supabase.from('cars').update({ current_mileage: num }).eq('id', id);
        setCar((prev) => prev ? { ...prev, current_mileage: num } : prev);
      },
      'plain-text',
      String(car?.current_mileage ?? ''),
      'number-pad'
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!car) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Car not found</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: Colors.primary, marginTop: 12 }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={Colors.primary} />}
    >
      {/* Nav */}
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.navBack}>‹ Back</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleDeleteCar}>
          <Text style={styles.deleteText}>Delete</Text>
        </TouchableOpacity>
      </View>

      {/* Car hero */}
      <View style={styles.hero}>
        <Text style={styles.heroIcon}>🚗</Text>
        <Text style={styles.heroName}>{car.nickname ?? `${car.year} ${car.make} ${car.model}`}</Text>
        {car.nickname && <Text style={styles.heroSub}>{car.year} {car.make} {car.model}</Text>}
        {car.color && <Text style={styles.heroMeta}>{car.color}</Text>}
        <TouchableOpacity style={styles.mileageRow} onPress={handleUpdateMileage}>
          <Text style={styles.mileageValue}>{car.current_mileage.toLocaleString()}</Text>
          <Text style={styles.mileageUnit}> mi  ✏️</Text>
        </TouchableOpacity>
        {car.vin && <Text style={styles.vin}>VIN: {car.vin}</Text>}
      </View>

      {/* Log maintenance button */}
      <TouchableOpacity
        style={styles.logBtn}
        onPress={() => router.push(`/maintenance/add?carId=${id}`)}
      >
        <Text style={styles.logBtnText}>+ Log Maintenance</Text>
      </TouchableOpacity>

      {/* Schedules */}
      {schedules.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Maintenance Schedule</Text>
          {schedules.map((schedule) => {
            const { overdue, daysUntilDue, milesUntilDue } = getAlertStatus(schedule, car);
            const label = schedule.custom_label ?? MAINTENANCE_LABELS[schedule.type];
            const icon = MAINTENANCE_ICONS[schedule.type];

            let dueText = '—';
            let dueColor = Colors.textMuted;
            if (schedule.next_due_date) {
              dueText = format(parseISO(schedule.next_due_date), 'MMM d, yyyy');
            }
            if (schedule.next_due_mileage) {
              dueText = `${schedule.next_due_mileage.toLocaleString()} mi`;
            }
            if (overdue) dueColor = Colors.danger;
            else if (daysUntilDue !== undefined && daysUntilDue <= 14) dueColor = Colors.warning;
            else if (milesUntilDue !== undefined && milesUntilDue <= 500) dueColor = Colors.warning;

            return (
              <View key={schedule.id} style={[styles.scheduleRow, overdue && styles.scheduleRowOverdue]}>
                <Text style={styles.scheduleIcon}>{icon}</Text>
                <View style={styles.scheduleInfo}>
                  <Text style={styles.scheduleLabel}>{label}</Text>
                  {schedule.interval_miles && (
                    <Text style={styles.scheduleMeta}>Every {schedule.interval_miles.toLocaleString()} mi</Text>
                  )}
                  {schedule.interval_months && (
                    <Text style={styles.scheduleMeta}>Every {schedule.interval_months} months</Text>
                  )}
                </View>
                <View style={styles.scheduleDue}>
                  {overdue && <Text style={[styles.scheduleDueLabel, { color: Colors.danger }]}>OVERDUE</Text>}
                  <Text style={[styles.scheduleDueText, { color: dueColor }]}>{dueText}</Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Recent logs */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Maintenance</Text>
        {logs.length === 0 ? (
          <Text style={styles.noLogs}>No maintenance logged yet</Text>
        ) : (
          logs.slice(0, 10).map((log) => {
            const label = log.custom_label ?? MAINTENANCE_LABELS[log.type];
            const icon = MAINTENANCE_ICONS[log.type];
            return (
              <View key={log.id} style={styles.logCard}>
                <Text style={styles.logIcon}>{icon}</Text>
                <View style={styles.logInfo}>
                  <Text style={styles.logLabel}>{label}</Text>
                  <Text style={styles.logMeta}>
                    {format(parseISO(log.date), 'MMM d, yyyy')} · {log.mileage_at_service.toLocaleString()} mi
                    {log.cost != null ? ` · $${log.cost.toFixed(2)}` : ''}
                  </Text>
                  {log.notes ? <Text style={styles.logNotes}>{log.notes}</Text> : null}
                </View>
              </View>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: 40 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  errorText: { color: Colors.textMuted, fontSize: 16 },

  navBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16,
  },
  navBack: { fontSize: 17, color: Colors.primary },
  deleteText: { fontSize: 15, color: Colors.danger },

  hero: { alignItems: 'center', paddingVertical: 20, paddingHorizontal: 20 },
  heroIcon: { fontSize: 52, marginBottom: 10 },
  heroName: { fontSize: 22, fontWeight: '700', color: Colors.text, textAlign: 'center' },
  heroSub: { fontSize: 15, color: Colors.textMuted, marginTop: 4 },
  heroMeta: { fontSize: 14, color: Colors.textDim, marginTop: 2 },
  mileageRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 12 },
  mileageValue: { fontSize: 32, fontWeight: '700', color: Colors.primary },
  mileageUnit: { fontSize: 16, color: Colors.textMuted },
  vin: { fontSize: 11, color: Colors.textDim, marginTop: 6, fontFamily: 'monospace' },

  logBtn: {
    marginHorizontal: 20, backgroundColor: Colors.primary, borderRadius: 14,
    paddingVertical: 14, alignItems: 'center', marginBottom: 24,
  },
  logBtnText: { color: Colors.white, fontSize: 16, fontWeight: '600' },

  section: { paddingHorizontal: 20, marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.text, marginBottom: 12 },

  scheduleRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface,
    borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: Colors.border,
  },
  scheduleRowOverdue: { borderColor: Colors.danger + '60' },
  scheduleIcon: { fontSize: 22, marginRight: 12 },
  scheduleInfo: { flex: 1 },
  scheduleLabel: { fontSize: 14, fontWeight: '600', color: Colors.text },
  scheduleMeta: { fontSize: 12, color: Colors.textDim, marginTop: 2 },
  scheduleDue: { alignItems: 'flex-end' },
  scheduleDueLabel: { fontSize: 10, fontWeight: '700', marginBottom: 2 },
  scheduleDueText: { fontSize: 12, fontWeight: '500' },

  noLogs: { fontSize: 14, color: Colors.textDim, textAlign: 'center', paddingVertical: 20 },
  logCard: {
    flexDirection: 'row', alignItems: 'flex-start', backgroundColor: Colors.surface,
    borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: Colors.border,
  },
  logIcon: { fontSize: 22, marginRight: 12, marginTop: 2 },
  logInfo: { flex: 1 },
  logLabel: { fontSize: 14, fontWeight: '600', color: Colors.text },
  logMeta: { fontSize: 12, color: Colors.textDim, marginTop: 3 },
  logNotes: { fontSize: 12, color: Colors.textMuted, marginTop: 4, fontStyle: 'italic' },
});
