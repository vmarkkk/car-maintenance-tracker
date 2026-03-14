import { useCallback, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { Car } from '../../types';
import { Colors } from '../../constants/theme';

export default function CarsScreen() {
  const [cars, setCars] = useState<Car[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadCars = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('cars')
      .select('*')
      .eq('user_id', user.id)
      .order('year', { ascending: false });
    setCars(data ?? []);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(useCallback(() => { loadCars(); }, [loadCars]));

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
        <Text style={styles.headerTitle}>My Cars</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => router.push('/car/add')}>
          <Text style={styles.addBtnText}>+ Add Car</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={cars}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadCars(); }} tintColor={Colors.primary} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🚗</Text>
            <Text style={styles.emptyText}>No cars added yet</Text>
            <Text style={styles.emptyHint}>Tap "+ Add Car" to get started</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.carCard} onPress={() => router.push(`/car/${item.id}`)}>
            <View style={styles.carBadge}>
              <Text style={styles.carBadgeText}>{item.year}</Text>
            </View>
            <View style={styles.carInfo}>
              <Text style={styles.carName}>{item.nickname ?? `${item.year} ${item.make} ${item.model}`}</Text>
              {item.nickname && (
                <Text style={styles.carSub}>{item.make} {item.model}</Text>
              )}
              <Text style={styles.carMileage}>{item.current_mileage.toLocaleString()} miles</Text>
            </View>
            <Text style={styles.arrow}>›</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  headerTitle: { fontSize: 22, fontWeight: '700', color: Colors.text },
  addBtn: { backgroundColor: Colors.primary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  addBtnText: { color: Colors.white, fontWeight: '600', fontSize: 14 },
  list: { padding: 16 },
  carCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface,
    borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: Colors.border,
  },
  carBadge: {
    backgroundColor: Colors.primary + '30', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 6, marginRight: 14,
  },
  carBadgeText: { color: Colors.primary, fontWeight: '700', fontSize: 14 },
  carInfo: { flex: 1 },
  carName: { fontSize: 16, fontWeight: '600', color: Colors.text },
  carSub: { fontSize: 13, color: Colors.textMuted, marginTop: 2 },
  carMileage: { fontSize: 13, color: Colors.textDim, marginTop: 4 },
  arrow: { fontSize: 22, color: Colors.textDim, marginLeft: 8 },
  empty: { alignItems: 'center', paddingVertical: 80 },
  emptyIcon: { fontSize: 56, marginBottom: 12 },
  emptyText: { fontSize: 18, color: Colors.textMuted, fontWeight: '600' },
  emptyHint: { fontSize: 14, color: Colors.textDim, marginTop: 6 },
});
