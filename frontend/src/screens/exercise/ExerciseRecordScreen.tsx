import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  StyleSheet, Alert, LayoutAnimation, Vibration,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { getExerciseRecordsByDate, saveExerciseRecord, deleteExerciseRecord } from '../../services/storage';
import type { RootStackParamList } from '../../navigation/AppNavigator';

interface ExerciseSet {
  weight: number;
  reps: number;
  rpe: number | null;
  completed: boolean;
}

interface ExerciseRecord {
  id: string;
  exerciseName: string;
  muscleGroup: string;
  date: string;
  sets: ExerciseSet[];
  notes: string;
}

const today = () => new Date().toISOString().slice(0, 10);
const genId = () => `rec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

function fmtDate(d: string) {
  const date = new Date(d);
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

export default function ExerciseRecordScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'ExerciseRecord'>>();
  const [unit, setUnit] = useState<'kg' | 'lbs'>('kg');
  const [records, setRecords] = useState<ExerciseRecord[]>([]);
  const [date, setDate] = useState(today());
  const [newExerciseName, setNewExerciseName] = useState('');
  const [newMuscleGroup, setNewMuscleGroup] = useState('chest');
  const [showAdd, setShowAdd] = useState(false);
  const [expandedStates, setExpandedStates] = useState<Record<string, boolean>>({});

  // ---- Workout Timer ----
  const [timerState, setTimerState] = useState<'idle' | 'active' | 'resting'>('idle');
  const [tick, setTick] = useState(0);
  const [restDuration, setRestDuration] = useState(90);
  const startTimeRef = useRef(0);
  const restEndRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cycleRestDuration = () => {
    setRestDuration((prev) => (prev === 60 ? 90 : prev === 90 ? 120 : 60));
  };

  const startWorkout = () => {
    startTimeRef.current = Date.now();
    setTimerState('active');
  };

  const startRest = useCallback(() => {
    restEndRef.current = Date.now() + restDuration * 1000;
    setTimerState('resting');
  }, [restDuration]);

  const skipRest = () => {
    setTimerState('active');
  };

  const finishWorkout = () => {
    setTimerState('idle');
    setTick(0);
  };

  // Timer tick
  useEffect(() => {
    if (timerState === 'idle') {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      return;
    }
    if (!timerRef.current) {
      timerRef.current = setInterval(() => setTick((t) => t + 1), 1000);
    }
    return () => {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    };
  }, [timerState]);

  // Check rest completion
  useEffect(() => {
    if (timerState === 'resting' && Date.now() >= restEndRef.current) {
      Vibration.vibrate(500);
      setTimerState('active');
    }
  }, [tick, timerState]);

  // Cleanup on unmount
  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const elapsedSec = timerState !== 'idle' ? Math.floor((Date.now() - startTimeRef.current) / 1000) : 0;
  const remainingRest = timerState === 'resting'
    ? Math.max(0, Math.ceil((restEndRef.current - Date.now()) / 1000))
    : restDuration;

  const formatTime = (totalSec: number) => {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const toggleExpand = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedStates((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const isExpanded = (id: string) => expandedStates[id] !== false;

  useEffect(() => {
    loadRecords();
  }, [date]);

  useEffect(() => {
    const params = route.params;
    if (params?.exerciseName) {
      const names = params.exerciseName
        .split(/[、,，\s]+/)
        .filter((n: string) => n.trim().length > 0);
      if (names.length > 1) {
        (async () => {
          for (const name of names) {
            const record: ExerciseRecord = {
              id: genId(),
              exerciseName: name.trim(),
              muscleGroup: params.muscleGroup || 'chest',
              date,
              sets: [],
              notes: '',
            };
            await saveExerciseRecord(record);
          }
          loadRecords();
        })();
      } else {
        setNewExerciseName(names[0]?.trim() || params.exerciseName);
        if (params.muscleGroup) setNewMuscleGroup(params.muscleGroup);
        setShowAdd(true);
      }
    }
  }, [route.params]);

  const loadRecords = async () => {
    const data = await getExerciseRecordsByDate(date);
    setRecords(data);
  };

  const kgToLbs = (kg: number) => Math.round(kg * 2.20462);
  const lbsToKg = (lbs: number) => Math.round(lbs / 2.20462);

  const addExercise = async () => {
    if (!newExerciseName.trim()) return;
    const names = newExerciseName.trim()
      .split(/[、,，\s]+/)
      .filter((n: string) => n.trim().length > 0);
    for (const name of names) {
      const record: ExerciseRecord = {
        id: genId(),
        exerciseName: name.trim(),
        muscleGroup: newMuscleGroup,
        date,
        sets: [],
        notes: '',
      };
      await saveExerciseRecord(record);
    }
    setNewExerciseName('');
    setShowAdd(false);
    loadRecords();
    if (names.length > 1) {
      Alert.alert('导入成功', `已导入 ${names.length} 个动作`);
    }
  };

  const addSet = async (record: ExerciseRecord) => {
    const updated = {
      ...record,
      sets: [...record.sets, { weight: 0, reps: 0, rpe: null, completed: false }],
    };
    await saveExerciseRecord(updated);
    loadRecords();
  };

  const updateSet = async (record: ExerciseRecord, setIdx: number, updates: Partial<ExerciseSet>) => {
    const updated = { ...record };
    updated.sets = updated.sets.map((s, i) => (i === setIdx ? { ...s, ...updates } : s));
    await saveExerciseRecord(updated);
    loadRecords();
  };

  const deleteSet = async (record: ExerciseRecord, setIdx: number) => {
    const updated = { ...record };
    updated.sets = updated.sets.filter((_, i) => i !== setIdx);
    await saveExerciseRecord(updated);
    loadRecords();
  };

  const removeExercise = async (id: string) => {
    Alert.alert(t('common.confirm'), t('exercise.confirmDelete'), [
      { text: t('common.cancel') },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          await deleteExerciseRecord(id);
          loadRecords();
        },
      },
    ]);
  };

  const displayWeight = (kg: number) => {
    if (kg === 0) return '';
    return unit === 'kg' ? `${kg}` : `${kgToLbs(kg)}`;
  };

  const changeDate = (offset: number) => {
    const d = new Date(date);
    d.setDate(d.getDate() + offset);
    setDate(d.toISOString().slice(0, 10));
  };

  const handleToggleComplete = async (record: ExerciseRecord, si: number) => {
    const set = record.sets[si];
    const completing = !set.completed;
    if (completing) {
      if (timerState === 'idle') startWorkout();
      startRest();
    }
    await updateSet(record, si, { completed: completing });
  };

  const MUSCLE_OPTIONS = [
    { key: 'chest', label: '胸' },
    { key: 'back', label: '背' },
    { key: 'legs', label: '腿' },
    { key: 'shoulders', label: '肩' },
    { key: 'arms', label: '手臂' },
    { key: 'core', label: '腹' },
    { key: 'full_body', label: '全身' },
  ];

  return (
    <View style={styles.container}>
      {/* Date navigator */}
      <View style={styles.dateNav}>
        <TouchableOpacity onPress={() => changeDate(-1)}>
          <Text style={styles.dateArrow}>◀</Text>
        </TouchableOpacity>
        <Text style={styles.dateText}>{fmtDate(date)}</Text>
        <TouchableOpacity onPress={() => changeDate(1)}>
          <Text style={styles.dateArrow}>▶</Text>
        </TouchableOpacity>
      </View>

      {/* Unit toggle */}
      <View style={styles.toolbar}>
        <TouchableOpacity
          style={[styles.unitBtn, unit === 'kg' && styles.unitBtnActive]}
          onPress={() => setUnit('kg')}
        >
          <Text style={[styles.unitText, unit === 'kg' && styles.unitTextActive]}>kg</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.unitBtn, unit === 'lbs' && styles.unitBtnActive]}
          onPress={() => setUnit('lbs')}
        >
          <Text style={[styles.unitText, unit === 'lbs' && styles.unitTextActive]}>lbs</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        <TouchableOpacity
          style={styles.addExerciseBtn}
          onPress={() => setShowAdd(true)}
        >
          <Text style={styles.addExerciseBtnText}>+ {t('exercise.addExercise')}</Text>
        </TouchableOpacity>
      </View>

      {/* Add exercise form */}
      {showAdd && (
        <View style={styles.addForm}>
          <TextInput
            style={styles.input}
            placeholder={t('exercise.exerciseName')}
            placeholderTextColor="#666"
            value={newExerciseName}
            onChangeText={setNewExerciseName}
          />
          <View style={styles.muscleRow}>
            {MUSCLE_OPTIONS.map((m) => (
              <TouchableOpacity
                key={m.key}
                style={[styles.muscleChip, newMuscleGroup === m.key && styles.muscleChipActive]}
                onPress={() => setNewMuscleGroup(m.key)}
              >
                <Text style={[styles.muscleChipText, newMuscleGroup === m.key && styles.muscleChipTextActive]}>
                  {m.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.addFormActions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowAdd(false)}>
              <Text style={styles.cancelBtnText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmBtn} onPress={addExercise}>
              <Text style={styles.confirmBtnText}>{t('common.confirm')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Exercise records */}
      <FlatList
        data={records}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, timerState !== 'idle' && { paddingBottom: 80 }]}
        renderItem={({ item: record }) => (
          <View style={styles.recordCard}>
            <View style={styles.recordHeader}>
              <View style={styles.recordHeaderLeft}>
                <TouchableOpacity
                  style={styles.expandBtn}
                  onPress={() => toggleExpand(record.id)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={styles.expandBtnText}>
                    {isExpanded(record.id) ? '▲' : '▼'}
                  </Text>
                </TouchableOpacity>
                <Text style={styles.recordName}>{record.exerciseName}</Text>
              </View>
              <TouchableOpacity onPress={() => removeExercise(record.id)}>
                <Text style={styles.deleteBtn}>{t('common.delete')}</Text>
              </TouchableOpacity>
            </View>
            {isExpanded(record.id) && (
              <>
                {record.sets.map((set, si) => (
                  <View key={si} style={styles.setRow}>
                    <Text style={styles.setNum}>#{si + 1}</Text>
                    <TextInput
                      style={styles.setInput}
                      keyboardType="numeric"
                      placeholder={unit === 'kg' ? 'kg' : 'lbs'}
                      placeholderTextColor="#999"
                      value={displayWeight(set.weight)}
                      onChangeText={(v) => {
                        const n = parseFloat(v) || 0;
                        const kgVal = unit === 'lbs' ? lbsToKg(n) : n;
                        updateSet(record, si, { weight: kgVal });
                      }}
                    />
                    <TextInput
                      style={styles.setInput}
                      keyboardType="numeric"
                      placeholder={t('exercise.reps')}
                      placeholderTextColor="#999"
                      value={set.reps > 0 ? String(set.reps) : ''}
                      onChangeText={(v) => {
                        updateSet(record, si, { reps: parseInt(v) || 0 });
                      }}
                    />
                    <TouchableOpacity
                      style={[styles.rpeSelector, set.rpe !== null && styles.rpeSelected]}
                      onPress={() => {
                        const rpes = [null, 6, 7, 8, 9, 10];
                        const curIdx = rpes.indexOf(set.rpe);
                        const next = rpes[(curIdx + 1) % rpes.length];
                        updateSet(record, si, { rpe: next });
                      }}
                    >
                      <Text style={[styles.rpeText, set.rpe !== null && styles.rpeTextSelected]}>
                        {set.rpe !== null ? `RPE ${set.rpe}` : 'RPE'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleToggleComplete(record, si)}
                      style={[
                        styles.checkBtn,
                        set.completed && styles.checkBtnDone,
                      ]}
                    >
                      <Text style={styles.checkText}>
                        {set.completed ? '✓' : '○'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => deleteSet(record, si)}>
                      <Text style={styles.deleteSetBtn}>×</Text>
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity style={styles.addSetBtn} onPress={() => addSet(record)}>
                  <Text style={styles.addSetBtnText}>+ {t('exercise.addSet')}</Text>
                </TouchableOpacity>
              </>
            )}
            {!isExpanded(record.id) && (
              <Text style={styles.setsSummary}>
                {record.sets.length} {t('exercise.setsCountLabel')}
              </Text>
            )}
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{t('exercise.noRecords')}</Text>
          </View>
        }
      />

      {/* Start Workout button — shown when records exist but timer not started */}
      {timerState === 'idle' && records.length > 0 && (
        <View style={styles.startWorkoutBar}>
          <TouchableOpacity style={styles.startWorkoutBtn} onPress={startWorkout}>
            <Text style={styles.startWorkoutBtnText}>{t('workoutTimer.startWorkout')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Timer bar */}
      {timerState !== 'idle' && (
        <View style={styles.timerBar}>
          <View style={styles.timerInfo}>
            <Text style={styles.timerElapsed}>
              {t('workoutTimer.elapsed')}: {formatTime(elapsedSec)}
            </Text>
            {timerState === 'resting' ? (
              <View style={styles.timerRestRow}>
                <View style={styles.timerRestIndicator} />
                <Text style={styles.timerRestText}>
                  {t('workoutTimer.rest')}: {formatTime(remainingRest)}
                </Text>
                <TouchableOpacity onPress={skipRest} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Text style={styles.timerSkipText}>{t('workoutTimer.tapToSkip')}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity onPress={cycleRestDuration}>
                <Text style={styles.restSetting}>
                  {t('workoutTimer.restDuration')}: {restDuration}{t('workoutTimer.seconds')}
                </Text>
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity style={styles.finishBtn} onPress={finishWorkout}>
            <Text style={styles.finishBtnText}>{t('workoutTimer.finishWorkout')}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  dateNav: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    backgroundColor: '#fff',
    gap: 20,
  },
  dateArrow: { fontSize: 18, color: '#4CAF50' },
  dateText: { fontSize: 17, fontWeight: '700', color: '#333' },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 4,
  },
  unitBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#e0e0e0',
  },
  unitBtnActive: { backgroundColor: '#4CAF50' },
  unitText: { fontSize: 14, fontWeight: '600', color: '#555' },
  unitTextActive: { color: '#fff' },
  addExerciseBtn: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addExerciseBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  addForm: {
    backgroundColor: '#fff',
    padding: 12,
    marginHorizontal: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    fontSize: 15,
    color: '#333',
    marginBottom: 8,
  },
  muscleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  muscleChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: '#e0e0e0',
  },
  muscleChipActive: { backgroundColor: '#4CAF50' },
  muscleChipText: { fontSize: 12, color: '#555' },
  muscleChipTextActive: { color: '#fff' },
  addFormActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 10,
    gap: 10,
  },
  cancelBtn: { paddingHorizontal: 16, paddingVertical: 8 },
  cancelBtnText: { fontSize: 14, color: '#888' },
  confirmBtn: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
  },
  confirmBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  list: { padding: 12 },
  recordCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  recordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  recordHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  expandBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#eee',
    justifyContent: 'center',
    alignItems: 'center',
  },
  expandBtnText: { fontSize: 12, color: '#888' },
  recordName: { fontSize: 16, fontWeight: '700', color: '#333' },
  deleteBtn: { fontSize: 13, color: '#E74C3C' },
  setsSummary: {
    fontSize: 13,
    color: '#999',
    paddingVertical: 4,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  setNum: { fontSize: 13, color: '#999', width: 24 },
  setInput: {
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    fontSize: 14,
    color: '#333',
    width: 60,
    textAlign: 'center',
  },
  rpeSelector: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
  },
  rpeSelected: { backgroundColor: '#4CAF50' },
  rpeText: { fontSize: 12, color: '#888' },
  rpeTextSelected: { color: '#fff', fontWeight: '600' },
  checkBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  checkBtnDone: { backgroundColor: '#4CAF50' },
  checkText: { fontSize: 16, color: '#4CAF50' },
  deleteSetBtn: { fontSize: 18, color: '#E74C3C', paddingHorizontal: 4 },
  addSetBtn: {
    borderWidth: 1,
    borderColor: '#4CAF50',
    borderStyle: 'dashed',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    marginTop: 4,
  },
  addSetBtnText: { color: '#4CAF50', fontSize: 14 },
  empty: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 15, color: '#999' },
  // Timer styles
  startWorkoutBar: {
    padding: 12,
    paddingBottom: 24,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  startWorkoutBtn: {
    backgroundColor: '#4CAF50',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  startWorkoutBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  timerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 14,
    paddingVertical: 10,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: '#333',
    gap: 10,
  },
  timerInfo: { flex: 1 },
  timerElapsed: { fontSize: 12, color: '#888', marginBottom: 2 },
  timerRestRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  timerRestIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF9800',
  },
  timerRestText: { fontSize: 16, fontWeight: '700', color: '#FF9800' },
  timerActionText: { fontSize: 12, color: '#4CAF50', fontWeight: '600' },
  timerSkipText: { fontSize: 12, color: '#888' },
  restSetting: { fontSize: 12, color: '#888', marginTop: 2 },
  finishBtn: {
    backgroundColor: '#E74C3C',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  finishBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
});
