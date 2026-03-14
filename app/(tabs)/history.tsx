import { useCallback, useState } from 'react';
import {
  View, Text, SectionList, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { Car, MaintenanceLog, MAINTENANCE_LABELS, MAINTENANCE_ICONS } from '../../types';
import { Colors } from '../../constants/theme';
import { format, parseISO } from 'date-fns';

interface Section {
  title: string;
  data: (MaintenanceLog & { car: Car })[];
}

export default function HistoryScreen() {
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadHistory = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [carsRes, logsRes] = await Promise.all([
      supabase.from('cars').select('*').eq('user_id', user.id),
      supabase.from('maintenance_logs')
        .select('*')
        .order('date', { ascending: false })
        .limit(200),
    ]);

    const carsMap = new Map<string, Car>((carsRes.data ?? []).map((c: Car) => [c.id, c]));
    const logs: (MaintenanceLog & { car: Car })[] = (logsRes.data ?? [])
      .filter((l: MaintenanceLog) => carsMap.has(l.car_id))
      .map((l: MaintenanceLog) => ({ ...l, car: carsMap.get(l.car_id)! }));

    // Group by month
    const groups = new Map<string, (MaintenanceLog & { car: Car })[]>();
    for (const log of logs) {
      const month = format(parseISO(log.date), 'MMMM yyyy');
      if (!groups.has(month)) groups.set(month, []);
      groups.get(month)!.push(log);
    }

    setSections(
      Array.from(groups.entries()).map(([title, data]) => ({ title, data }))
    );
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(useCallback(() => { loadHistory(); }, [loadHistory]));

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Maintenance History</Text>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadHistory(); }} tintColor={Colors.primary} />}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyText}>No maintenance logged yet</Text>
            <Text style={styles.emptyHint}>Go to a car to log maintenance</Text>
          </View>
        }
        renderItem={({ item }) => {
          const label = item.custom_label ?? MAINTENANCE_LABELS[item.type];
          const icon = MAINTENANCE_ICONS[item.type];
          const carName = `${item.car.year} ${item.car.make} ${item.car.model}`;
          return (
            <View style={styles.logCard}>
              <Text style={styles.logIcon}>{icon}</Text>
              <View style={styles.logInfo}>
                <Text style={styles.logLabel}>{label}</Text>
                <Text style={styles.logCar}>{carName}</Text>
                <Text style={styles.logMeta}>
                  {format(parseISO(item.date), 'MMM d, yyyy')} · {item.mileage_at_service.toLocaleString()} mi
                  {item.cost != null ? ` · $${item.cost.toFixed(2)}` : ''}
                </Text>
                {item.notes ? <Text style={styles.logNotes}>{item.notes}</Text> : null}
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  header: {
    paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  headerTitle: { fontSize: 22, fontWeight: '700', color: Colors.text },
  list: { padding: 16, paddingTop: 8 },
  sectionHeader: { backgroundColor: Colors.background, paddingVertical: 8 },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  logCard: {
    flexDirection: 'row', alignItems: 'flex-start', backgroundColor: Colors.surface,
    borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: Colors.border,
  },
  logIcon: { fontSize: 24, marginRight: 12, marginTop: 2 },
  logInfo: { flex: 1 },
  logLabel: { fontSize: 15, fontWeight: '600', color: Colors.text },
  logCar: { fontSize: 13, color: Colors.textMuted, marginTop: 2 },
  logMeta: { fontSize: 12, color: Colors.textDim, marginTop: 4 },
  logNotes: { fontSize: 12, color: Colors.textMuted, marginTop: 4, fontStyle: 'italic' },
  empty: { alignItems: 'center', paddingVertical: 80 },
  emptyIcon: { fontSize: 56, marginBottom: 12 },
  emptyText: { fontSize: 18, color: Colors.textMuted, fontWeight: '600' },
  emptyHint: { fontSize: 14, color: Colors.textDim, marginTop: 6 },
});
