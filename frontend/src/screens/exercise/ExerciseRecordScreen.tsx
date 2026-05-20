import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  StyleSheet, Alert, KeyboardAvoidingView,
  Platform, ScrollView, Keyboard,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { getExerciseRecordsByDate, saveExerciseRecord, deleteExerciseRecord, getExerciseTimerSettings, saveExerciseTimerSettings } from '../../services/storage';
import { saveExerciseRecord as saveExerciseRecordRemote, deleteExerciseRecord as deleteExerciseRecordRemote, isBackendReachable, refreshBackendStatus } from '../../services/api';
import { workoutTimer } from '../../services/workoutTimer';
import { getLocalExercises } from '../../data/exerciseData';
import type { ExerciseInfo } from '../../services/api';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { takePendingPlan } from '../../services/planBridge';

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

function fmtLocal(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

const today = () => fmtLocal(new Date());
const genId = () => `rec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

function syncRecordToBackend(record: ExerciseRecord) {
  if (!isBackendReachable()) return;
  saveExerciseRecordRemote({
    id: record.id,
    exercise_name: record.exerciseName,
    date: record.date,
    sets: record.sets,
    muscle_group: record.muscleGroup,
    notes: record.notes,
  }).catch(() => {});
}

function syncDeleteToBackend(id: string) {
  if (!isBackendReachable()) return;
  deleteExerciseRecordRemote(id).catch(() => {});
}

function fmtDate(d: string) {
  const date = new Date(d);
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

const MUSCLE_OPTIONS = [
  { key: 'chest', label: '胸' },
  { key: 'back', label: '背' },
  { key: 'legs', label: '腿' },
  { key: 'shoulders', label: '肩' },
  { key: 'arms', label: '臂' },
  { key: 'core', label: '核心' },
  { key: 'full_body', label: '全身' },
];

const COMMON_EXERCISES: Record<string, string[]> = {
  chest: ['卧推', '上斜卧推', '哑铃飞鸟', '绳索夹胸', '俯卧撑', '上斜哑铃卧推', '双杠臂屈伸'],
  back: ['引体向上', '杠铃划船', '哑铃划船', '高位下拉', '坐姿划船', '窄距引体向上', '直臂下压'],
  legs: ['深蹲', '硬拉', '腿举', '腿弯举', '弓步蹲', '保加利亚分腿蹲', '罗马尼亚硬拉'],
  shoulders: ['哑铃推举', '侧平举', '前平举', '面拉', '阿诺德推举', '杠铃推举', '俯身飞鸟'],
  arms: ['杠铃弯举', '哑铃弯举', '锤式弯举', '绳索下压', '窄距卧推', '集中弯举', '仰卧臂屈伸'],
  core: ['平板支撑', '卷腹', '悬垂举腿', '俄罗斯转体', '仰卧抬腿', '侧平板', '登山者', '死虫式', '鸟狗式'],
  full_body: ['深蹲', '硬拉', '卧推', '引体向上', '划船', '推举', '实力推'],
};

const LOCAL_EXERCISES = getLocalExercises();

function fuzzyMatch(exercises: ExerciseInfo[], query: string): ExerciseInfo[] {
  if (!query.trim()) return [];
  const q = query.trim().toLowerCase();
  return exercises
    .filter((ex) =>
      ex.name.toLowerCase().includes(q) ||
      ex.nameEn.toLowerCase().includes(q)
    )
    .slice(0, 8);
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

  // Raw input states for float weight support
  const [weightInputs, setWeightInputs] = useState<Record<string, string>>({});

  // Exercise name editing
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [editingNameText, setEditingNameText] = useState('');

  // Fuzzy search results
  const [fuzzyResults, setFuzzyResults] = useState<ExerciseInfo[]>([]);
  const [addFuzzyResults, setAddFuzzyResults] = useState<ExerciseInfo[]>([]);

  // Timer settings UI
  const [showTimerInput, setShowTimerInput] = useState(false);
  const [restMinutes, setRestMinutes] = useState('1');
  const [restSeconds, setRestSeconds] = useState('30');
  const [alarmMinutes, setAlarmMinutes] = useState('0');
  const [alarmSeconds, setAlarmSeconds] = useState('30');
  const setCompleteAlertShown = useRef(false);
  const lastActiveExerciseRef = useRef<string>('');
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  // Force re-render from timer ticks
  const [, setTick] = useState(0);

  // Subscribe to global timer + keyboard visibility + check backend connectivity
  useEffect(() => {
    const unsub = workoutTimer.subscribe(() => setTick((t) => t + 1));
    refreshBackendStatus();

    const showSub = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));

    return () => {
      unsub();
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Load persisted timer settings on mount
  useEffect(() => {
    (async () => {
      const saved = await getExerciseTimerSettings();
      if (records.length > 0) {
        const first = records[0].exerciseName;
        if (saved[first]) {
          workoutTimer.setRestDuration(saved[first].restSec);
          workoutTimer.setAlarmDuration(saved[first].alarmSec);
          lastActiveExerciseRef.current = first;
        }
      }
    })();
  }, []);

  // Auto-apply timer settings when records change
  useEffect(() => {
    if (records.length === 0) return;
    (async () => {
      const saved = await getExerciseTimerSettings();
      const first = records[0].exerciseName;
      if (saved[first] && lastActiveExerciseRef.current !== first) {
        workoutTimer.setRestDuration(saved[first].restSec);
        workoutTimer.setAlarmDuration(saved[first].alarmSec);
        lastActiveExerciseRef.current = first;
      }
    })();
  }, [records]);

  const persistCurrentSettings = useCallback((rest: number, alarm: number) => {
    const name = lastActiveExerciseRef.current;
    if (name) {
      saveExerciseTimerSettings(name, rest, alarm);
    }
  }, []);

  const applyCustomRest = () => {
    const rm = parseInt(restMinutes) || 0;
    const rs = parseInt(restSeconds) || 0;
    const am = parseInt(alarmMinutes) || 0;
    const as = parseInt(alarmSeconds) || 0;
    const newRest = (rm * 60 + rs) || 90;
    const newAlarm = (am * 60 + as) || 30;
    workoutTimer.setRestDuration(newRest);
    workoutTimer.setAlarmDuration(newAlarm);
    setShowTimerInput(false);
    persistCurrentSettings(newRest, newAlarm);
  };

  const cycleRestDuration = () => {
    const presets = [60, 90, 120];
    const idx = presets.indexOf(workoutTimer.restDuration);
    const next = presets[(idx + 1) % presets.length];
    workoutTimer.setRestDuration(next);
    persistCurrentSettings(next, workoutTimer.alarmDuration);
  };

  const handleFinishWorkout = () => {
    Alert.alert(
      t('workoutTimer.finishConfirmTitle'),
      t('workoutTimer.finishConfirmMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.confirm'),
          style: 'destructive',
          onPress: () => workoutTimer.finishWorkout(),
        },
      ]
    );
  };

  const isExpanded = (id: string) => expandedStates[id] !== false;

  const toggleExpand = (id: string) => {
    setExpandedStates((prev) => ({ ...prev, [id]: !isExpanded(id) }));
  };

  // Show set-complete prompt
  useEffect(() => {
    if (!workoutTimer.showSetComplete || setCompleteAlertShown.current) return;
    setCompleteAlertShown.current = true;
    Alert.alert(
      t('workoutTimer.setComplete'),
      t('workoutTimer.setCompleteHint'),
      [{ text: t('workoutTimer.confirmDone'), onPress: () => workoutTimer.dismissSetComplete() }]
    );
  }, [workoutTimer.showSetComplete, workoutTimer.tick]);

  useEffect(() => {
    loadRecords();
  }, [date]);

  // Handle incoming params from PlanScreen or ExerciseLibrary.
  // Does NOT call setRecords directly — instead stores new records in a ref,
  // and loadRecords merges them after loading saved data from storage.
  const pendingParams = useRef<typeof route.params>(null);
  const pendingPlanRecordsRef = useRef<ExerciseRecord[] | null>(null);
  useEffect(() => {
    const params = route.params;
    if (!params?.exerciseName) return;
    // Skip if we already processed these params
    if (pendingParams.current === params) return;
    pendingParams.current = params;

    // Parse targetReps like "8-12" → 8, "30-60s" → 30, "15-20" → 15
    const parseDefaultReps = (tr: string): number => {
      const match = tr.match(/^(\d+)/);
      return match ? parseInt(match[1], 10) : 8;
    };

    // Check bridge first — PlanScreen stores full data there before navigating
    const pendingPlan = takePendingPlan();
    if (pendingPlan && pendingPlan.exercises.length > 0) {
      const newRecords: ExerciseRecord[] = pendingPlan.exercises.map((pe) => ({
        id: genId(),
        exerciseName: pe.exerciseName,
        muscleGroup: pendingPlan.muscleGroup || 'chest',
        date,
        sets: Array.from({ length: pe.targetSets }, () => ({
          weight: 0,
          reps: parseDefaultReps(pe.targetReps),
          rpe: null,
          completed: false,
        })),
        notes: '',
      }));
      pendingPlanRecordsRef.current = newRecords;
      for (const record of newRecords) {
        saveExerciseRecord(record).catch(() => {});
        syncRecordToBackend(record);
      }
    } else {
      // Fallback: parse exerciseName string (from ExerciseDetail or legacy Plan calls)
      const names = params.exerciseName
        .split(/[、,，\s]+/)
        .filter((n: string) => n.trim().length > 0);
      if (names.length > 1) {
        const newRecords: ExerciseRecord[] = names.map((name) => ({
          id: genId(),
          exerciseName: name.trim(),
          muscleGroup: params.muscleGroup || 'chest',
          date,
          sets: [],
          notes: '',
        }));
        pendingPlanRecordsRef.current = newRecords;
        for (const record of newRecords) {
          saveExerciseRecord(record).catch(() => {});
          syncRecordToBackend(record);
        }
      } else {
        setNewExerciseName(names[0]?.trim() || params.exerciseName);
        if (params.muscleGroup) setNewMuscleGroup(params.muscleGroup);
        setShowAdd(true);
      }
    }
  }, [route.params?.exerciseName, route.params?.muscleGroup, date]);

  const loadRecords = async () => {
    const data = await getExerciseRecordsByDate(date);
    const planRecords = pendingPlanRecordsRef.current;
    pendingPlanRecordsRef.current = null;
    if (planRecords && planRecords.length > 0) {
      const existingIds = new Set(data.map((r: ExerciseRecord) => r.id));
      const newRecords = planRecords.filter((r) => !existingIds.has(r.id));
      setRecords([...data, ...newRecords]);
    } else {
      setRecords(data);
    }
  };

  const kgToLbs = (kg: number) => Math.round(kg * 2.20462);
  const lbsToKg = (lbs: number) => Math.round(lbs / 2.20462);

  // ---- Optimistic CRUD helpers (problem #2 fix: update state immediately, persist async) ----

  const persistRecord = useCallback((record: ExerciseRecord) => {
    saveExerciseRecord(record).catch(() => {});
    syncRecordToBackend(record);
  }, []);

  const removeLocalRecord = useCallback((id: string) => {
    deleteExerciseRecord(id).catch(() => {});
    syncDeleteToBackend(id);
  }, []);

  // ---- Fuzzy search for add form ----
  const handleAddNameChange = (text: string) => {
    setNewExerciseName(text);
    setAddFuzzyResults(fuzzyMatch(LOCAL_EXERCISES, text));
  };

  const selectAddFuzzyResult = (name: string) => {
    setNewExerciseName(name);
    setAddFuzzyResults([]);
  };

  // ---- Fuzzy search for edit mode ----
  const handleEditNameChange = (text: string) => {
    setEditingNameText(text);
    setFuzzyResults(fuzzyMatch(LOCAL_EXERCISES, text));
  };

  const selectFuzzyResult = (name: string) => {
    setEditingNameText(name);
    setFuzzyResults([]);
  };

  const startEditName = (record: ExerciseRecord) => {
    setEditingNameId(record.id);
    setEditingNameText(record.exerciseName);
    setFuzzyResults([]);
  };

  const confirmEditName = () => {
    if (!editingNameId || !editingNameText.trim()) {
      setEditingNameId(null);
      return;
    }
    setRecords((prev) =>
      prev.map((r) =>
        r.id === editingNameId ? { ...r, exerciseName: editingNameText.trim() } : r
      )
    );
    // Persist the updated record
    const updated = records.find((r) => r.id === editingNameId);
    if (updated) {
      persistRecord({ ...updated, exerciseName: editingNameText.trim() });
    }
    setEditingNameId(null);
    setFuzzyResults([]);
  };

  // ---- Add exercise (optimistic) ----
  const addExercise = () => {
    if (!newExerciseName.trim()) return;
    const names = newExerciseName.trim()
      .split(/[、,，\s]+/)
      .filter((n: string) => n.trim().length > 0);
    const newRecords: ExerciseRecord[] = names.map((name) => ({
      id: genId(),
      exerciseName: name.trim(),
      muscleGroup: newMuscleGroup,
      date,
      sets: [],
      notes: '',
    }));
    setRecords((prev) => [...prev, ...newRecords]);
    for (const record of newRecords) {
      persistRecord(record);
    }
    setNewExerciseName('');
    setAddFuzzyResults([]);
    setShowAdd(false);
    if (names.length > 1) {
      Alert.alert('导入成功', `已导入 ${names.length} 个动作`);
    }
  };

  // ---- Sets CRUD (all optimistic: update state first, persist async) ----
  const addSet = useCallback((record: ExerciseRecord) => {
    const lastSet = record.sets.length > 0 ? record.sets[record.sets.length - 1] : null;
    const newSet: ExerciseSet = {
      weight: lastSet ? lastSet.weight : 0,
      reps: lastSet ? lastSet.reps : 0,
      rpe: null,
      completed: false,
    };
    const updated = { ...record, sets: [...record.sets, newSet] };
    setRecords((prev) => prev.map((r) => (r.id === record.id ? updated : r)));
    persistRecord(updated);
  }, [persistRecord]);

  const updateSet = useCallback((record: ExerciseRecord, setIdx: number, updates: Partial<ExerciseSet>) => {
    const newSets = record.sets.map((s, i) => (i === setIdx ? { ...s, ...updates } : s));
    const updated = { ...record, sets: newSets };
    setRecords((prev) => prev.map((r) => (r.id === record.id ? updated : r)));
    persistRecord(updated);
  }, [persistRecord]);

  const deleteSet = useCallback((record: ExerciseRecord, setIdx: number) => {
    const updated = { ...record, sets: record.sets.filter((_, i) => i !== setIdx) };
    setRecords((prev) => prev.map((r) => (r.id === record.id ? updated : r)));
    persistRecord(updated);
  }, [persistRecord]);

  const removeExercise = useCallback((id: string) => {
    Alert.alert(t('common.confirm'), t('exercise.confirmDelete'), [
      { text: t('common.cancel') },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => {
          setRecords((prev) => prev.filter((r) => r.id !== id));
          removeLocalRecord(id);
        },
      },
    ]);
  }, [t, removeLocalRecord]);

  // ---- Float-safe weight display ----
  const getWeightDisplay = (recordId: string, setIdx: number, kg: number): string => {
    const key = `${recordId}_${setIdx}_w`;
    if (weightInputs[key] !== undefined) return weightInputs[key];
    if (kg === 0) return '';
    return unit === 'kg' ? `${kg}` : `${kgToLbs(kg)}`;
  };

  const handleWeightChange = (record: ExerciseRecord, setIdx: number, v: string) => {
    if (v !== '' && !/^\d*\.?\d*$/.test(v)) return;
    const key = `${record.id}_${setIdx}_w`;
    setWeightInputs((prev) => ({ ...prev, [key]: v }));
  };

  const handleWeightBlur = (record: ExerciseRecord, setIdx: number) => {
    const key = `${record.id}_${setIdx}_w`;
    const raw = weightInputs[key];
    if (raw !== undefined) {
      const n = parseFloat(raw) || 0;
      const kgVal = unit === 'lbs' ? lbsToKg(n) : n;
      updateSet(record, setIdx, { weight: kgVal });
      setWeightInputs((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const changeDate = (offset: number) => {
    const d = new Date(date);
    d.setDate(d.getDate() + offset);
    setDate(fmtLocal(d));
  };

  const handleToggleComplete = useCallback((record: ExerciseRecord, si: number) => {
    const set = record.sets[si];
    const completing = !set.completed;
    if (completing) {
      lastActiveExerciseRef.current = record.exerciseName;
      if (workoutTimer.state === 'idle') workoutTimer.startWorkout();
      workoutTimer.startRest();
    }
    updateSet(record, si, { completed: completing });
  }, [updateSet]);

  // Timer computed values
  const elapsedSec = workoutTimer.getElapsedSec();
  const remainingRest = workoutTimer.getRemainingRest();
  const remainingAlarm = workoutTimer.getRemainingAlarm();

  const formatTime = (totalSec: number) => {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleMuscleGroupSelect = (key: string) => {
    setNewMuscleGroup(key);
    setAddFuzzyResults([]);
  };

  // Open timer modal — init fields from current timer settings
  const openTimerModal = () => {
    setRestMinutes(String(Math.floor(workoutTimer.restDuration / 60)));
    setRestSeconds(String(workoutTimer.restDuration % 60));
    setAlarmMinutes(String(Math.floor(workoutTimer.alarmDuration / 60)));
    setAlarmSeconds(String(workoutTimer.alarmDuration % 60));
    setShowTimerInput(true);
  };

  return (
    <View style={styles.container}>
      {/* Scrollable content area — shifts up with keyboard (problem #1 fix) */}
      <KeyboardAvoidingView
        style={styles.contentArea}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
      >
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

        {/* Unit toggle + add button */}
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
              onChangeText={handleAddNameChange}
              autoFocus
            />
            {addFuzzyResults.length > 0 && (
              <View style={styles.fuzzyDropdown}>
                <ScrollView keyboardShouldPersistTaps="always" style={{ maxHeight: 160 }}>
                  {addFuzzyResults.map((ex) => (
                    <TouchableOpacity
                      key={ex.id}
                      style={styles.fuzzyItem}
                      onPress={() => selectAddFuzzyResult(ex.name)}
                    >
                      <Text style={styles.fuzzyItemName}>{ex.name}</Text>
                      <Text style={styles.fuzzyItemEn}>{ex.nameEn}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
            <View style={styles.muscleRow}>
              {MUSCLE_OPTIONS.map((m) => (
                <TouchableOpacity
                  key={m.key}
                  style={[styles.muscleChip, newMuscleGroup === m.key && styles.muscleChipActive]}
                  onPress={() => handleMuscleGroupSelect(m.key)}
                >
                  <Text style={[styles.muscleChipText, newMuscleGroup === m.key && styles.muscleChipTextActive]}>
                    {m.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {COMMON_EXERCISES[newMuscleGroup] && (
              <View style={styles.commonRow}>
                <Text style={styles.commonLabel}>常用动作:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.commonScroll}>
                  {COMMON_EXERCISES[newMuscleGroup].map((name) => (
                    <TouchableOpacity
                      key={name}
                      style={styles.commonChip}
                      onPress={() => {
                        setNewExerciseName(name);
                        setAddFuzzyResults([]);
                      }}
                    >
                      <Text style={styles.commonChipText}>{name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
            <View style={styles.addFormActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => {
                setShowAdd(false);
                setAddFuzzyResults([]);
              }}>
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
          keyboardShouldPersistTaps="always"
          contentContainerStyle={[styles.list, workoutTimer.state !== 'idle' && { paddingBottom: 8 }]}
          renderItem={({ item: record }) => (
            <View style={styles.recordCard}>
              <View style={styles.recordHeader}>
                <View style={styles.recordHeaderLeft}>
                  {editingNameId !== record.id && (
                    <TouchableOpacity
                      style={styles.expandBtn}
                      onPress={() => toggleExpand(record.id)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Text style={styles.expandBtnText}>
                        {isExpanded(record.id) ? '▲' : '▼'}
                      </Text>
                    </TouchableOpacity>
                  )}
                  {editingNameId === record.id ? (
                    <View style={styles.editNameContainer}>
                      <View style={styles.editNameRow}>
                        <TextInput
                          style={styles.editNameInput}
                          value={editingNameText}
                          onChangeText={handleEditNameChange}
                          onBlur={confirmEditName}
                          autoFocus
                          onSubmitEditing={confirmEditName}
                        />
                        <TouchableOpacity style={styles.editConfirmBtn} onPress={confirmEditName}>
                          <Text style={styles.editConfirmBtnText}>{t('common.edit')}</Text>
                        </TouchableOpacity>
                      </View>
                      {fuzzyResults.length > 0 && (
                        <View style={styles.fuzzyDropdownInline}>
                          <ScrollView keyboardShouldPersistTaps="always" style={{ maxHeight: 140 }}>
                            {fuzzyResults.map((ex) => (
                              <TouchableOpacity
                                key={ex.id}
                                style={styles.fuzzyItem}
                                onPress={() => selectFuzzyResult(ex.name)}
                              >
                                <Text style={styles.fuzzyItemName}>{ex.name}</Text>
                                <Text style={styles.fuzzyItemEn}>{ex.nameEn}</Text>
                              </TouchableOpacity>
                            ))}
                          </ScrollView>
                        </View>
                      )}
                    </View>
                  ) : (
                    <TouchableOpacity onPress={() => startEditName(record)}>
                      <Text style={styles.recordName}>{record.exerciseName}</Text>
                    </TouchableOpacity>
                  )}
                </View>
                {editingNameId !== record.id && (
                  <TouchableOpacity onPress={() => removeExercise(record.id)}>
                    <Text style={styles.deleteBtn}>{t('common.delete')}</Text>
                  </TouchableOpacity>
                )}
              </View>
              {isExpanded(record.id) && editingNameId !== record.id && (
                <>
                  {record.sets.map((set, si) => (
                    <View key={si} style={styles.setRow}>
                      <Text style={styles.setNum}>#{si + 1}</Text>
                      <TextInput
                        style={styles.setInput}
                        keyboardType="decimal-pad"
                        placeholder={unit === 'kg' ? 'kg' : 'lbs'}
                        placeholderTextColor="#999"
                        value={getWeightDisplay(record.id, si, set.weight)}
                        onChangeText={(v) => handleWeightChange(record, si, v)}
                        onBlur={() => handleWeightBlur(record, si)}
                      />
                      <TextInput
                        style={styles.setInput}
                        keyboardType="number-pad"
                        placeholder={t('exercise.reps')}
                        placeholderTextColor="#999"
                        value={set.reps > 0 ? String(set.reps) : ''}
                        onChangeText={(v) => {
                          if (v === '' || /^\d+$/.test(v)) {
                            updateSet(record, si, { reps: parseInt(v) || 0 });
                          }
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
                        style={[styles.checkBtn, set.completed && styles.checkBtnDone]}
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
              {!isExpanded(record.id) && editingNameId !== record.id && (
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

        {/* Timer custom modal (inside KeyboardAvoidingView so it shifts with keyboard) */}
        {showTimerInput && (
          <TouchableOpacity
            style={styles.timerModalOverlay}
            activeOpacity={1}
            onPress={() => { setShowTimerInput(false); Keyboard.dismiss(); }}
          >
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
            >
              <TouchableOpacity activeOpacity={1} onPress={() => {}}>
                <View style={styles.timerModal}>
                  <Text style={styles.timerModalTitle}>{t('workoutTimer.customRest')}</Text>

                  <Text style={styles.timerSectionLabel}>{t('workoutTimer.restDuration')}</Text>
                  <View style={styles.timerInputRow}>
                    <View style={styles.timerInputGroup}>
                      <Text style={styles.timerInputLabel}>{t('workoutTimer.minutes')}</Text>
                      <TextInput
                        style={styles.timerFieldInput}
                        keyboardType="numeric"
                        value={restMinutes}
                        onChangeText={setRestMinutes}
                        placeholder="0"
                        placeholderTextColor="#999"
                        maxLength={2}
                      />
                    </View>
                    <Text style={styles.timerColon}>:</Text>
                    <View style={styles.timerInputGroup}>
                      <Text style={styles.timerInputLabel}>{t('workoutTimer.seconds')}</Text>
                      <TextInput
                        style={styles.timerFieldInput}
                        keyboardType="numeric"
                        value={restSeconds}
                        onChangeText={setRestSeconds}
                        placeholder="0"
                        placeholderTextColor="#999"
                        maxLength={2}
                      />
                    </View>
                  </View>
                  <View style={styles.timerPresetRow}>
                    {[60, 90, 120].map((sec) => (
                      <TouchableOpacity
                        key={`rest_${sec}`}
                        style={[styles.timerPresetChip, workoutTimer.restDuration === sec && styles.timerPresetChipActive]}
                        onPress={() => {
                          workoutTimer.setRestDuration(sec);
                          setRestMinutes(String(Math.floor(sec / 60)));
                          setRestSeconds(String(sec % 60));
                        }}
                      >
                        <Text style={[styles.timerPresetText, workoutTimer.restDuration === sec && styles.timerPresetTextActive]}>
                          {formatTime(sec)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={styles.timerSectionLabel}>{t('workoutTimer.alarmDuration')}</Text>
                  <View style={styles.timerInputRow}>
                    <View style={styles.timerInputGroup}>
                      <Text style={styles.timerInputLabel}>{t('workoutTimer.minutes')}</Text>
                      <TextInput
                        style={styles.timerFieldInput}
                        keyboardType="numeric"
                        value={alarmMinutes}
                        onChangeText={setAlarmMinutes}
                        placeholder="0"
                        placeholderTextColor="#999"
                        maxLength={2}
                      />
                    </View>
                    <Text style={styles.timerColon}>:</Text>
                    <View style={styles.timerInputGroup}>
                      <Text style={styles.timerInputLabel}>{t('workoutTimer.seconds')}</Text>
                      <TextInput
                        style={styles.timerFieldInput}
                        keyboardType="numeric"
                        value={alarmSeconds}
                        onChangeText={setAlarmSeconds}
                        placeholder="0"
                        placeholderTextColor="#999"
                        maxLength={2}
                      />
                    </View>
                  </View>
                  <View style={styles.timerPresetRow}>
                    {[15, 30, 45].map((sec) => (
                      <TouchableOpacity
                        key={`alarm_${sec}`}
                        style={[styles.timerPresetChip, workoutTimer.alarmDuration === sec && styles.timerPresetChipActive]}
                        onPress={() => {
                          workoutTimer.setAlarmDuration(sec);
                          setAlarmMinutes(String(Math.floor(sec / 60)));
                          setAlarmSeconds(String(sec % 60));
                        }}
                      >
                        <Text style={[styles.timerPresetText, workoutTimer.alarmDuration === sec && styles.timerPresetTextActive]}>
                          {formatTime(sec)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <View style={styles.timerModalActions}>
                    <TouchableOpacity style={styles.cancelBtn} onPress={() => { setShowTimerInput(false); Keyboard.dismiss(); }}>
                      <Text style={styles.cancelBtnText}>{t('common.cancel')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.confirmBtn} onPress={applyCustomRest}>
                      <Text style={styles.confirmBtnText}>{t('common.confirm')}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            </KeyboardAvoidingView>
          </TouchableOpacity>
        )}
      </KeyboardAvoidingView>

      {/* Timer bar — fixed outside KeyboardAvoidingView, hidden when keyboard is visible */}
      {!keyboardVisible && workoutTimer.state === 'idle' && records.length > 0 && (
        <View style={styles.startWorkoutBar}>
          <TouchableOpacity style={styles.startWorkoutBtn} onPress={() => workoutTimer.startWorkout()}>
            <Text style={styles.startWorkoutBtnText}>{t('workoutTimer.startWorkout')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {!keyboardVisible && workoutTimer.state !== 'idle' && (
        <View style={styles.timerBar}>
          <View style={styles.timerInfo}>
            <Text style={styles.timerElapsed}>
              {t('workoutTimer.elapsed')}: {formatTime(elapsedSec)}
            </Text>
            {workoutTimer.state === 'resting' ? (
              <View style={styles.timerRestRow}>
                <View style={styles.timerRestIndicator} />
                <Text style={styles.timerRestText}>
                  {t('workoutTimer.rest')}: {formatTime(remainingRest)}
                </Text>
                <TouchableOpacity onPress={() => workoutTimer.skipRest()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Text style={styles.timerSkipText}>{t('workoutTimer.tapToSkip')}</Text>
                </TouchableOpacity>
              </View>
            ) : workoutTimer.state === 'alarm' ? (
              <View style={styles.timerRestRow}>
                <View style={[styles.timerRestIndicator, { backgroundColor: '#FF5722' }]} />
                <Text style={[styles.timerRestText, { color: '#FF5722' }]}>
                  {t('workoutTimer.alarm')}: {formatTime(remainingAlarm)}
                </Text>
                <TouchableOpacity onPress={() => workoutTimer.skipAlarm()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Text style={styles.timerSkipText}>{t('workoutTimer.tapToSkip')}</Text>
                </TouchableOpacity>
              </View>
            ) : workoutTimer.state === 'paused' ? (
              <View style={styles.timerRestRow}>
                <View style={[styles.timerRestIndicator, { backgroundColor: '#FF9800' }]} />
                <Text style={[styles.timerRestText, { color: '#FF9800' }]}>
                  {t('workoutTimer.paused')}
                </Text>
              </View>
            ) : (
              <View>
                <TouchableOpacity onPress={cycleRestDuration} onLongPress={openTimerModal}>
                  {/* Problem #4 fix: two separate lines for rest and alarm */}
                  <Text style={styles.restSetting}>
                    {t('workoutTimer.restDuration')}: {formatTime(workoutTimer.restDuration)}
                  </Text>
                  <Text style={styles.restSetting}>
                    {t('workoutTimer.alarmDuration')}: {formatTime(workoutTimer.alarmDuration)}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={openTimerModal}>
                  <Text style={styles.restCustomHint}>{t('workoutTimer.tapToCustom')}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
          <View style={styles.timerActions}>
            {workoutTimer.state !== 'paused' ? (
              <TouchableOpacity
                style={[styles.timerActionBtn, styles.pauseBtn]}
                onPress={() => workoutTimer.pause()}
              >
                <Text style={styles.timerActionBtnText}>{t('workoutTimer.pauseTraining')}</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.timerActionBtn, styles.resumeBtn]}
                onPress={() => workoutTimer.resume()}
              >
                <Text style={styles.timerActionBtnText}>{t('workoutTimer.resume')}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[styles.timerActionBtn, styles.finishBtn]} onPress={handleFinishWorkout}>
              <Text style={styles.timerActionBtnText}>{t('workoutTimer.finishWorkout')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  contentArea: { flex: 1 },
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
  fuzzyDropdown: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginBottom: 8,
    marginTop: -4,
    overflow: 'hidden',
  },
  fuzzyDropdownInline: {
    position: 'absolute',
    top: 42,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    zIndex: 50,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  fuzzyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: '#f0f0f0',
  },
  fuzzyItemName: { fontSize: 14, fontWeight: '600', color: '#333' },
  fuzzyItemEn: { fontSize: 12, color: '#999' },
  editNameContainer: {
    flex: 1,
    position: 'relative',
  },
  editNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  editNameInput: {
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    fontSize: 15,
    color: '#333',
    flex: 1,
  },
  editConfirmBtn: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  editConfirmBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  commonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 10,
    gap: 8,
  },
  commonLabel: { fontSize: 12, color: '#888', flexShrink: 0 },
  commonScroll: { flex: 1 },
  commonChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: '#E8F5E9',
    marginRight: 6,
  },
  commonChipText: { fontSize: 12, color: '#4CAF50', fontWeight: '500' },
  muscleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
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
    marginTop: 8,
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
    width: 68,
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
    gap: 8,
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
  timerSkipText: { fontSize: 12, color: '#888' },
  restSetting: { fontSize: 12, color: '#888' },
  timerActions: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  timerActionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  timerActionBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  finishBtn: { backgroundColor: '#E74C3C' },
  pauseBtn: { backgroundColor: '#FF9800' },
  resumeBtn: { backgroundColor: '#4CAF50' },
  restCustomHint: { fontSize: 10, color: '#4CAF50', marginTop: 2 },
  timerModalOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  timerModal: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '85%',
    maxWidth: 400,
  },
  timerModalTitle: { fontSize: 17, fontWeight: '700', color: '#333', textAlign: 'center', marginBottom: 16 },
  timerSectionLabel: { fontSize: 13, fontWeight: '600', color: '#555', marginTop: 12, marginBottom: 8 },
  timerInputRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 16, marginBottom: 16 },
  timerInputGroup: { alignItems: 'center', gap: 4 },
  timerInputLabel: { fontSize: 12, color: '#999' },
  timerFieldInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 14,
    fontSize: 32,
    fontWeight: '700',
    color: '#333',
    width: 100,
    textAlign: 'center',
  },
  timerColon: { fontSize: 32, fontWeight: '700', color: '#333', paddingBottom: 14 },
  timerPresetRow: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginBottom: 16 },
  timerPresetChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#f0f0f0',
  },
  timerPresetChipActive: { backgroundColor: '#4CAF50' },
  timerPresetText: { fontSize: 14, fontWeight: '600', color: '#555' },
  timerPresetTextActive: { color: '#fff' },
  timerModalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 4 },
});
