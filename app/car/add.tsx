import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { DEFAULT_INTERVALS, MaintenanceType } from '../../types';
import { Colors } from '../../constants/theme';

const CURRENT_YEAR = new Date().getFullYear();

// Default maintenance types to auto-create schedules for new cars
const AUTO_SCHEDULES: MaintenanceType[] = [
  'oil_change', 'tire_rotation', 'air_filter', 'cabin_filter',
  'brake_fluid', 'coolant', 'battery', 'wiper_blades',
];

export default function AddCarScreen() {
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState(String(CURRENT_YEAR));
  const [mileage, setMileage] = useState('');
  const [nickname, setNickname] = useState('');
  const [color, setColor] = useState('');
  const [vin, setVin] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSave() {
    if (!make.trim() || !model.trim() || !year || !mileage) {
      Alert.alert('Error', 'Make, model, year, and mileage are required');
      return;
    }
    const yearNum = parseInt(year, 10);
    if (isNaN(yearNum) || yearNum < 1900 || yearNum > CURRENT_YEAR + 1) {
      Alert.alert('Error', `Year must be between 1900 and ${CURRENT_YEAR + 1}`);
      return;
    }
    const mileageNum = parseInt(mileage.replace(/,/g, ''), 10);
    if (isNaN(mileageNum) || mileageNum < 0) {
      Alert.alert('Error', 'Please enter a valid mileage');
      return;
    }

    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data: car, error } = await supabase
      .from('cars')
      .insert({
        user_id: user.id,
        make: make.trim(),
        model: model.trim(),
        year: yearNum,
        current_mileage: mileageNum,
        nickname: nickname.trim() || null,
        color: color.trim() || null,
        vin: vin.trim() || null,
      })
      .select()
      .single();

    if (error || !car) {
      setLoading(false);
      Alert.alert('Error', error?.message ?? 'Failed to save car');
      return;
    }

    // Create default schedules
    const schedules = AUTO_SCHEDULES.map((type) => {
      const interval = DEFAULT_INTERVALS[type] ?? {};
      return {
        car_id: car.id,
        type,
        interval_miles: interval.miles ?? null,
        interval_months: interval.months ?? null,
        is_active: true,
      };
    });

    await supabase.from('maintenance_schedules').insert(schedules);

    setLoading(false);
    router.replace(`/car/${car.id}`);
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.navBack}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.navTitle}>Add Car</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <FieldLabel required>Make</FieldLabel>
        <TextInput style={styles.input} placeholder="e.g. Toyota" placeholderTextColor={Colors.textDim}
          value={make} onChangeText={setMake} />

        <FieldLabel required>Model</FieldLabel>
        <TextInput style={styles.input} placeholder="e.g. Camry" placeholderTextColor={Colors.textDim}
          value={model} onChangeText={setModel} />

        <View style={styles.row}>
          <View style={styles.half}>
            <FieldLabel required>Year</FieldLabel>
            <TextInput style={styles.input} placeholder={String(CURRENT_YEAR)} placeholderTextColor={Colors.textDim}
              value={year} onChangeText={setYear} keyboardType="number-pad" maxLength={4} />
          </View>
          <View style={styles.half}>
            <FieldLabel required>Mileage</FieldLabel>
            <TextInput style={styles.input} placeholder="e.g. 45000" placeholderTextColor={Colors.textDim}
              value={mileage} onChangeText={setMileage} keyboardType="number-pad" />
          </View>
        </View>

        <FieldLabel>Nickname (optional)</FieldLabel>
        <TextInput style={styles.input} placeholder='e.g. "The Silver Bullet"' placeholderTextColor={Colors.textDim}
          value={nickname} onChangeText={setNickname} />

        <FieldLabel>Color (optional)</FieldLabel>
        <TextInput style={styles.input} placeholder="e.g. Midnight Blue" placeholderTextColor={Colors.textDim}
          value={color} onChangeText={setColor} />

        <FieldLabel>VIN (optional)</FieldLabel>
        <TextInput style={styles.input} placeholder="17-digit VIN" placeholderTextColor={Colors.textDim}
          value={vin} onChangeText={setVin} autoCapitalize="characters" maxLength={17} />

        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            📋 Default maintenance schedules (oil change, tire rotation, filters, etc.) will be set up automatically.
          </Text>
        </View>

        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={loading}>
          {loading ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.saveBtnText}>Add Car</Text>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function FieldLabel({ children, required }: { children: string; required?: boolean }) {
  return (
    <Text style={styles.label}>
      {children}{required ? <Text style={{ color: Colors.danger }}> *</Text> : null}
    </Text>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  navBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  navBack: { fontSize: 17, color: Colors.primary },
  navTitle: { fontSize: 17, fontWeight: '600', color: Colors.text },
  content: { padding: 20 },
  label: { fontSize: 13, fontWeight: '600', color: Colors.textMuted, marginBottom: 6, marginTop: 14, textTransform: 'uppercase', letterSpacing: 0.4 },
  input: {
    backgroundColor: Colors.surface, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13,
    fontSize: 16, color: Colors.text, borderWidth: 1, borderColor: Colors.border,
  },
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  infoBox: {
    marginTop: 20, backgroundColor: Colors.primary + '20', borderRadius: 12,
    padding: 14, borderWidth: 1, borderColor: Colors.primary + '40',
  },
  infoText: { fontSize: 13, color: Colors.textMuted, lineHeight: 18 },
  saveBtn: {
    backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', marginTop: 24, marginBottom: 20,
  },
  saveBtnText: { color: Colors.white, fontSize: 16, fontWeight: '600' },
});
