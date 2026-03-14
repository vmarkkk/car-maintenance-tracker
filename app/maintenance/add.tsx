import { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, Modal, FlatList,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../lib/supabase';
import {
  Car, MaintenanceType, MaintenanceSchedule,
  MAINTENANCE_LABELS, MAINTENANCE_ICONS, DEFAULT_INTERVALS,
} from '../../types';
import { computeNextDue } from '../../lib/maintenance';
import { Colors } from '../../constants/theme';
import { format } from 'date-fns';

const ALL_TYPES = Object.keys(MAINTENANCE_LABELS) as MaintenanceType[];

export default function AddMaintenanceScreen() {
  const { carId } = useLocalSearchParams<{ carId: string }>();
  const [car, setCar] = useState<Car | null>(null);
  const [type, setType] = useState<MaintenanceType>('oil_change');
  const [customLabel, setCustomLabel] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [mileage, setMileage] = useState('');
  const [cost, setCost] = useState('');
  const [notes, setNotes] = useState('');
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.from('cars').select('*').eq('id', carId).single().then(({ data }) => {
      setCar(data);
      if (data) setMileage(String(data.current_mileage));
    });
  }, [carId]);

  async function handleSave() {
    if (!mileage || !date) {
      Alert.alert('Error', 'Date and mileage are required');
      return;
    }
    if (type === 'custom' && !customLabel.trim()) {
      Alert.alert('Error', 'Please enter a label for the custom service');
      return;
    }
    const mileageNum = parseInt(mileage.replace(/,/g, ''), 10);
    if (isNaN(mileageNum)) {
      Alert.alert('Error', 'Please enter a valid mileage');
      return;
    }
    const costNum = cost ? parseFloat(cost) : null;

    setLoading(true);

    // Insert the log
    const { data: log, error } = await supabase
      .from('maintenance_logs')
      .insert({
        car_id: carId,
        type,
        custom_label: type === 'custom' ? customLabel.trim() : null,
        date,
        mileage_at_service: mileageNum,
        cost: costNum,
        notes: notes.trim() || null,
      })
      .select()
      .single();

    if (error || !log) {
      setLoading(false);
      Alert.alert('Error', error?.message ?? 'Failed to log maintenance');
      return;
    }

    // Update car mileage if this service mileage is higher
    if (car && mileageNum > car.current_mileage) {
      await supabase.from('cars').update({ current_mileage: mileageNum }).eq('id', carId);
    }

    // Update or create schedule next due
    const { data: existingSchedule } = await supabase
      .from('maintenance_schedules')
      .select('*')
      .eq('car_id', carId)
      .eq('type', type)
      .single();

    const interval = DEFAULT_INTERVALS[type] ?? {};
    const schedule: Partial<MaintenanceSchedule> = existingSchedule ?? {
      car_id: carId,
      type,
      interval_miles: interval.miles ?? null,
      interval_months: interval.months ?? null,
      is_active: true,
    };

    const nextDue = computeNextDue(log, schedule as MaintenanceSchedule);

    if (existingSchedule) {
      await supabase
        .from('maintenance_schedules')
        .update({ ...nextDue })
        .eq('id', existingSchedule.id);
    } else {
      await supabase.from('maintenance_schedules').insert({
        ...schedule,
        ...nextDue,
      });
    }

    setLoading(false);
    router.back();
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.navBack}>‹ Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.navTitle}>Log Maintenance</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {car && (
          <Text style={styles.carLabel}>{car.year} {car.make} {car.model}</Text>
        )}

        {/* Type picker */}
        <Text style={styles.label}>Service Type *</Text>
        <TouchableOpacity style={styles.typePicker} onPress={() => setShowTypePicker(true)}>
          <Text style={styles.typePickerIcon}>{MAINTENANCE_ICONS[type]}</Text>
          <Text style={styles.typePickerText}>{MAINTENANCE_LABELS[type]}</Text>
          <Text style={styles.typePickerArrow}>›</Text>
        </TouchableOpacity>

        {/* Custom label */}
        {type === 'custom' && (
          <>
            <Text style={styles.label}>Service Label *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Transmission flush"
              placeholderTextColor={Colors.textDim}
              value={customLabel}
              onChangeText={setCustomLabel}
            />
          </>
        )}

        {/* Date */}
        <Text style={styles.label}>Date *</Text>
        <TextInput
          style={styles.input}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={Colors.textDim}
          value={date}
          onChangeText={setDate}
        />

        {/* Mileage */}
        <Text style={styles.label}>Mileage at Service *</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. 45000"
          placeholderTextColor={Colors.textDim}
          value={mileage}
          onChangeText={setMileage}
          keyboardType="number-pad"
        />

        {/* Cost */}
        <Text style={styles.label}>Cost (optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. 49.99"
          placeholderTextColor={Colors.textDim}
          value={cost}
          onChangeText={setCost}
          keyboardType="decimal-pad"
        />

        {/* Notes */}
        <Text style={styles.label}>Notes (optional)</Text>
        <TextInput
          style={[styles.input, styles.textarea]}
          placeholder="Shop name, parts used, observations..."
          placeholderTextColor={Colors.textDim}
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={3}
        />

        {/* Next due preview */}
        {DEFAULT_INTERVALS[type] && (
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              ⏱ Next reminder will be set automatically based on default intervals.
              {DEFAULT_INTERVALS[type]?.miles ? ` +${DEFAULT_INTERVALS[type]!.miles!.toLocaleString()} miles` : ''}
              {DEFAULT_INTERVALS[type]?.months ? ` / ${DEFAULT_INTERVALS[type]!.months} months` : ''}
            </Text>
          </View>
        )}

        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={loading}>
          {loading ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.saveBtnText}>Save Log</Text>}
        </TouchableOpacity>
      </ScrollView>

      {/* Type picker modal */}
      <Modal visible={showTypePicker} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Service Type</Text>
              <TouchableOpacity onPress={() => setShowTypePicker(false)}>
                <Text style={styles.modalClose}>Done</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={ALL_TYPES}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.typeRow, item === type && styles.typeRowSelected]}
                  onPress={() => { setType(item); setShowTypePicker(false); }}
                >
                  <Text style={styles.typeRowIcon}>{MAINTENANCE_ICONS[item]}</Text>
                  <Text style={[styles.typeRowText, item === type && styles.typeRowTextSelected]}>
                    {MAINTENANCE_LABELS[item]}
                  </Text>
                  {item === type && <Text style={styles.typeCheckmark}>✓</Text>}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
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
  carLabel: { fontSize: 15, color: Colors.primary, fontWeight: '600', marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: Colors.textMuted, marginBottom: 6, marginTop: 14, textTransform: 'uppercase', letterSpacing: 0.4 },
  input: {
    backgroundColor: Colors.surface, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13,
    fontSize: 16, color: Colors.text, borderWidth: 1, borderColor: Colors.border,
  },
  textarea: { height: 90, textAlignVertical: 'top' },
  typePicker: {
    backgroundColor: Colors.surface, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13,
    flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: Colors.border,
  },
  typePickerIcon: { fontSize: 22, marginRight: 12 },
  typePickerText: { flex: 1, fontSize: 16, color: Colors.text },
  typePickerArrow: { fontSize: 20, color: Colors.textDim },
  infoBox: {
    marginTop: 14, backgroundColor: Colors.primary + '20', borderRadius: 12,
    padding: 12, borderWidth: 1, borderColor: Colors.primary + '40',
  },
  infoText: { fontSize: 12, color: Colors.textMuted, lineHeight: 17 },
  saveBtn: {
    backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', marginTop: 24, marginBottom: 20,
  },
  saveBtnText: { color: Colors.white, fontSize: 16, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: '#000000aa', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: Colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    maxHeight: '75%',
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 18, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: Colors.text },
  modalClose: { fontSize: 16, color: Colors.primary, fontWeight: '600' },
  typeRow: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.border + '50',
  },
  typeRowSelected: { backgroundColor: Colors.primary + '15' },
  typeRowIcon: { fontSize: 22, marginRight: 14 },
  typeRowText: { flex: 1, fontSize: 15, color: Colors.text },
  typeRowTextSelected: { color: Colors.primary, fontWeight: '600' },
  typeCheckmark: { fontSize: 17, color: Colors.primary, fontWeight: '700' },
});
