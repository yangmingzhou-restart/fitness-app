import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, Alert, Modal,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { getPlans, savePlan } from '../../services/storage';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { setPendingPlan } from '../../services/planBridge';

interface PlanExercise {
  exerciseName: string;
  targetSets: number;
  targetReps: string;
}

interface Plan {
  id: string;
  name: string;
  nameEn: string;
  muscleGroup: string;
  exercises: PlanExercise[];
}

const PRESET_PLANS: Plan[] = [
  {
    id: 'chest_default',
    name: '胸肌训练',
    nameEn: 'Chest Workout',
    muscleGroup: 'chest',
    exercises: [
      { exerciseName: '杠铃卧推', targetSets: 4, targetReps: '8-12' },
      { exerciseName: '上斜哑铃卧推', targetSets: 3, targetReps: '10-12' },
      { exerciseName: '哑铃飞鸟', targetSets: 3, targetReps: '12-15' },
      { exerciseName: '臂屈伸', targetSets: 3, targetReps: '12-15' },
    ],
  },
  {
    id: 'back_default',
    name: '背部训练',
    nameEn: 'Back Workout',
    muscleGroup: 'back',
    exercises: [
      { exerciseName: '硬拉', targetSets: 4, targetReps: '5-8' },
      { exerciseName: '引体向上', targetSets: 3, targetReps: '8-12' },
      { exerciseName: '杠铃划船', targetSets: 3, targetReps: '8-12' },
      { exerciseName: '面拉', targetSets: 3, targetReps: '12-15' },
    ],
  },
  {
    id: 'legs_default',
    name: '腿部训练',
    nameEn: 'Leg Workout',
    muscleGroup: 'legs',
    exercises: [
      { exerciseName: '杠铃深蹲', targetSets: 4, targetReps: '8-12' },
      { exerciseName: '罗马尼亚硬拉', targetSets: 3, targetReps: '10-12' },
      { exerciseName: '腿举', targetSets: 3, targetReps: '12-15' },
      { exerciseName: '小腿提踵', targetSets: 4, targetReps: '15-20' },
    ],
  },
  {
    id: 'shoulders_default',
    name: '肩部训练',
    nameEn: 'Shoulder Workout',
    muscleGroup: 'shoulders',
    exercises: [
      { exerciseName: '杠铃推举', targetSets: 4, targetReps: '8-12' },
      { exerciseName: '侧平举', targetSets: 3, targetReps: '12-15' },
      { exerciseName: '俯身飞鸟', targetSets: 3, targetReps: '12-15' },
      { exerciseName: '阿诺德推举', targetSets: 3, targetReps: '10-12' },
    ],
  },
  {
    id: 'arms_default',
    name: '手臂训练',
    nameEn: 'Arm Workout',
    muscleGroup: 'arms',
    exercises: [
      { exerciseName: '杠铃弯举', targetSets: 3, targetReps: '10-12' },
      { exerciseName: '锤式弯举', targetSets: 3, targetReps: '10-12' },
      { exerciseName: '窄距卧推', targetSets: 3, targetReps: '10-12' },
      { exerciseName: '臂屈伸', targetSets: 3, targetReps: '12-15' },
    ],
  },
  {
    id: 'core_default',
    name: '核心训练',
    nameEn: 'Core Workout',
    muscleGroup: 'core',
    exercises: [
      { exerciseName: '卷腹', targetSets: 3, targetReps: '15-20' },
      { exerciseName: '平板支撑', targetSets: 3, targetReps: '30-60s' },
      { exerciseName: '俄罗斯转体', targetSets: 3, targetReps: '20' },
      { exerciseName: '悬垂举腿', targetSets: 3, targetReps: '10-15' },
    ],
  },
];

const MUSCLE_OPTIONS = [
  { key: 'chest', label: '胸' },
  { key: 'back', label: '背' },
  { key: 'legs', label: '腿' },
  { key: 'shoulders', label: '肩' },
  { key: 'arms', label: '臂' },
  { key: 'core', label: '核心' },
];

const genId = () => `plan_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const newPlanTemplate = (): Plan => ({
  id: genId(),
  name: '',
  nameEn: '',
  muscleGroup: 'chest',
  exercises: [],
});

export default function PlanScreen() {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [selectedGroup, setSelectedGroup] = useState('chest');
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [plans, setPlans] = useState<Plan[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    const saved = await getPlans();
    if (saved.length > 0) {
      setPlans(saved as Plan[]);
    } else {
      setPlans(PRESET_PLANS);
    }
  };

  const persistPlans = async (updated: Plan[]) => {
    setPlans(updated);
    for (const plan of updated) {
      await savePlan({ id: plan.id, name: plan.name, muscleGroup: plan.muscleGroup, exercises: plan.exercises });
    }
  };

  const groups = MUSCLE_OPTIONS;

  const filteredPlans = plans.filter((p) => p.muscleGroup === selectedGroup);

  const toggleCompleted = (planId: string, exerciseName: string) => {
    const key = `${planId}_${exerciseName}`;
    setCompleted((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleStartWorkout = (plan: Plan) => {
    if (!plan.exercises || plan.exercises.length === 0) {
      Alert.alert(t('common.error'), t('exercise.notFound'));
      return;
    }
    const exerciseName = plan.exercises.map((e) => e.exerciseName).join('、');
    setPendingPlan({
      exerciseNames: exerciseName,
      muscleGroup: plan.muscleGroup,
      exercises: plan.exercises.map((e) => ({
        exerciseName: e.exerciseName,
        targetSets: e.targetSets,
        targetReps: e.targetReps,
      })),
    });
    navigation.navigate('ExerciseRecord', {
      exerciseName,
      muscleGroup: plan.muscleGroup,
    });
  };

  const handleDeletePlan = (plan: Plan) => {
    Alert.alert(t('common.confirm'), t('exercise.deletePlan'), [
      { text: t('common.cancel') },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          const updated = plans.filter((p) => p.id !== plan.id);
          await persistPlans(updated);
        },
      },
    ]);
  };

  const handleResetDefault = () => {
    Alert.alert(t('exercise.resetDefault'), t('exercise.resetDefaultConfirm'), [
      { text: t('common.cancel') },
      {
        text: t('common.confirm'),
        onPress: async () => {
          setPlans(PRESET_PLANS);
          for (const plan of PRESET_PLANS) {
            await savePlan({
              id: plan.id,
              name: plan.name,
              muscleGroup: plan.muscleGroup,
              exercises: plan.exercises,
            });
          }
        },
      },
    ]);
  };

  const handleSaveNewPlan = async () => {
    if (!editingPlan) return;
    if (!editingPlan.name.trim()) {
      Alert.alert(t('common.error'), t('exercise.planNameRequired'));
      return;
    }
    const updated = [...plans, editingPlan];
    await persistPlans(updated);
    setShowAddModal(false);
    setEditingPlan(null);
  };

  const handleEditPlan = (plan: Plan) => {
    setEditingPlan({ ...plan, exercises: [...plan.exercises] });
    setShowAddModal(true);
  };

  const handleSaveEdit = async () => {
    if (!editingPlan) return;
    if (!editingPlan.name.trim()) {
      Alert.alert(t('common.error'), t('exercise.planNameRequired'));
      return;
    }
    const updated = plans.map((p) => (p.id === editingPlan.id ? editingPlan : p));
    await persistPlans(updated);
    setShowAddModal(false);
    setEditingPlan(null);
  };

  const isNewPlan = editingPlan && !plans.find((p) => p.id === editingPlan.id);

  const addExerciseToEdit = () => {
    if (!editingPlan) return;
    setEditingPlan({
      ...editingPlan,
      exercises: [...editingPlan.exercises, { exerciseName: '', targetSets: 3, targetReps: '8-12' }],
    });
  };

  const removeExerciseFromEdit = (idx: number) => {
    if (!editingPlan) return;
    const exs = editingPlan.exercises.filter((_, i) => i !== idx);
    setEditingPlan({ ...editingPlan, exercises: exs });
  };

  const moveExercise = (idx: number, direction: -1 | 1) => {
    if (!editingPlan) return;
    const exs = [...editingPlan.exercises];
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= exs.length) return;
    [exs[idx], exs[newIdx]] = [exs[newIdx], exs[idx]];
    setEditingPlan({ ...editingPlan, exercises: exs });
  };

  return (
    <View style={styles.container}>
      <ScrollView horizontal style={styles.tabRow} showsHorizontalScrollIndicator={false}>
        {groups.map((g) => (
          <TouchableOpacity
            key={g.key}
            style={[styles.tab, selectedGroup === g.key && styles.tabActive]}
            onPress={() => setSelectedGroup(g.key)}
          >
            <Text style={[styles.tabText, selectedGroup === g.key && styles.tabTextActive]}>
              {g.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView contentContainerStyle={styles.content}>
        {filteredPlans.map((plan) => (
          <View key={plan.id} style={styles.planCard}>
            <View style={styles.planHeader}>
              <Text style={styles.planName}>
                {i18n.language === 'zh' ? plan.name : plan.nameEn || plan.name}
              </Text>
              <View style={styles.planActions}>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => handleEditPlan(plan)}
                >
                  <Text style={styles.editBtnText}>{t('exercise.editPlan')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => handleDeletePlan(plan)}
                >
                  <Text style={styles.deleteBtnText}>{t('common.delete')}</Text>
                </TouchableOpacity>
              </View>
            </View>
            {plan.exercises.map((ex, i) => {
              const key = `${plan.id}_${ex.exerciseName}`;
              const isDone = completed.has(key);
              return (
                <TouchableOpacity
                  key={i}
                  style={[styles.exerciseRow, isDone && styles.exerciseRowDone]}
                  onPress={() => toggleCompleted(plan.id, ex.exerciseName)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.checkbox, isDone && styles.checkboxDone]}>
                    {isDone && <Text style={styles.checkMark}>✓</Text>}
                  </View>
                  <View style={styles.exerciseInfo}>
                    <Text style={[styles.exName, isDone && styles.exNameDone]}>
                      {ex.exerciseName}
                    </Text>
                    <Text style={styles.exParams}>
                      {ex.targetSets} {t('exercise.sets')} × {ex.targetReps} {t('exercise.reps')}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity
              style={styles.startBtn}
              onPress={() => handleStartWorkout(plan)}
            >
              <Text style={styles.startBtnText}>{t('exercise.startWorkout')}</Text>
            </TouchableOpacity>
          </View>
        ))}

        <TouchableOpacity
          style={styles.addPlanBtn}
          onPress={() => {
            setEditingPlan(newPlanTemplate());
            setShowAddModal(true);
          }}
        >
          <Text style={styles.addPlanBtnText}>+ {t('exercise.addPlan')}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.resetBtn} onPress={handleResetDefault}>
          <Text style={styles.resetBtnText}>{t('exercise.resetDefault')}</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={showAddModal} animationType="slide" onRequestClose={() => setShowAddModal(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => { setShowAddModal(false); setEditingPlan(null); }}>
              <Text style={styles.modalCancel}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {isNewPlan ? t('exercise.addPlan') : t('exercise.editPlan')}
            </Text>
            <TouchableOpacity onPress={isNewPlan ? handleSaveNewPlan : handleSaveEdit}>
              <Text style={styles.modalSave}>{t('common.confirm')}</Text>
            </TouchableOpacity>
          </View>

          {editingPlan && (
            <ScrollView contentContainerStyle={styles.modalContent}>
              <Text style={styles.fieldLabel}>{t('exercise.planName')}</Text>
              <TextInput
                style={styles.input}
                placeholder={t('exercise.planName')}
                placeholderTextColor="#999"
                value={editingPlan.name}
                onChangeText={(v) => setEditingPlan({ ...editingPlan, name: v, nameEn: v })}
              />
              <Text style={styles.fieldLabel}>{t('exercise.muscleGroup')}</Text>
              <View style={styles.muscleRow}>
                {MUSCLE_OPTIONS.map((m) => (
                  <TouchableOpacity
                    key={m.key}
                    style={[styles.muscleChip, editingPlan.muscleGroup === m.key && styles.muscleChipActive]}
                    onPress={() => setEditingPlan({ ...editingPlan, muscleGroup: m.key })}
                  >
                    <Text style={[styles.muscleChipText, editingPlan.muscleGroup === m.key && styles.muscleChipTextActive]}>
                      {m.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>{t('exercise.exercises')}</Text>
              {editingPlan.exercises.map((ex, i) => (
                <View key={i} style={styles.editExerciseRow}>
                  <View style={styles.reorderBtns}>
                    <TouchableOpacity
                      style={[styles.reorderBtn, i === 0 && styles.reorderBtnDisabled]}
                      onPress={() => moveExercise(i, -1)}
                      disabled={i === 0}
                    >
                      <Text style={[styles.reorderBtnText, i === 0 && styles.reorderBtnTextDisabled]}>▲</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.reorderBtn, i === editingPlan.exercises.length - 1 && styles.reorderBtnDisabled]}
                      onPress={() => moveExercise(i, 1)}
                      disabled={i === editingPlan.exercises.length - 1}
                    >
                      <Text style={[styles.reorderBtnText, i === editingPlan.exercises.length - 1 && styles.reorderBtnTextDisabled]}>▼</Text>
                    </TouchableOpacity>
                  </View>
                  <TextInput
                    style={styles.editExName}
                    placeholder={t('exercise.exerciseName')}
                    placeholderTextColor="#999"
                    value={ex.exerciseName}
                    onChangeText={(v) => {
                      const exs = editingPlan.exercises.map((e, idx) =>
                        idx === i ? { ...e, exerciseName: v } : e
                      );
                      setEditingPlan({ ...editingPlan, exercises: exs });
                    }}
                  />
                  <TextInput
                    style={styles.editSets}
                    keyboardType="numeric"
                    placeholder={t('exercise.sets')}
                    placeholderTextColor="#999"
                    value={String(ex.targetSets)}
                    onChangeText={(v) => {
                      const n = parseInt(v) || 0;
                      const exs = editingPlan.exercises.map((e, idx) =>
                        idx === i ? { ...e, targetSets: n } : e
                      );
                      setEditingPlan({ ...editingPlan, exercises: exs });
                    }}
                  />
                  <TextInput
                    style={styles.editReps}
                    placeholder={t('exercise.reps')}
                    placeholderTextColor="#999"
                    value={ex.targetReps}
                    onChangeText={(v) => {
                      const exs = editingPlan.exercises.map((e, idx) =>
                        idx === i ? { ...e, targetReps: v } : e
                      );
                      setEditingPlan({ ...editingPlan, exercises: exs });
                    }}
                  />
                  <TouchableOpacity onPress={() => removeExerciseFromEdit(i)}>
                    <Text style={styles.removeExBtn}>×</Text>
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity style={styles.addExBtn} onPress={addExerciseToEdit}>
                <Text style={styles.addExBtnText}>+ {t('exercise.addExercise')}</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  tabRow: {
    backgroundColor: '#fff',
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexGrow: 0,
  },
  tab: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#e0e0e0',
    marginRight: 8,
  },
  tabActive: { backgroundColor: '#4CAF50' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#555' },
  tabTextActive: { color: '#fff' },
  content: { padding: 12, paddingBottom: 40 },
  planCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  planName: { fontSize: 18, fontWeight: 'bold', color: '#333', flex: 1 },
  planActions: { flexDirection: 'row', gap: 8 },
  actionBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  editBtnText: { fontSize: 13, color: '#4CAF50' },
  deleteBtnText: { fontSize: 13, color: '#E74C3C' },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    marginBottom: 6,
  },
  exerciseRowDone: { backgroundColor: '#f0fff0' },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#ccc',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  checkboxDone: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  checkMark: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  exerciseInfo: { flex: 1 },
  exName: { fontSize: 15, fontWeight: '600', color: '#333' },
  exNameDone: { color: '#999', textDecorationLine: 'line-through' },
  exParams: { fontSize: 13, color: '#888', marginTop: 2 },
  startBtn: {
    backgroundColor: '#4CAF50',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  startBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  addPlanBtn: {
    borderWidth: 2,
    borderColor: '#4CAF50',
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  addPlanBtnText: { color: '#4CAF50', fontSize: 16, fontWeight: '600' },
  resetBtn: {
    backgroundColor: '#eee',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 20,
  },
  resetBtnText: { color: '#888', fontSize: 14 },
  modalContainer: { flex: 1, backgroundColor: '#f5f5f5' },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalCancel: { fontSize: 15, color: '#888' },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#333' },
  modalSave: { fontSize: 15, color: '#4CAF50', fontWeight: '600' },
  modalContent: { padding: 16 },
  fieldLabel: { fontSize: 14, fontWeight: '600', color: '#666', marginBottom: 8, marginTop: 12 },
  input: {
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    fontSize: 15,
    color: '#333',
  },
  muscleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  muscleChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: '#e0e0e0',
  },
  muscleChipActive: { backgroundColor: '#4CAF50' },
  muscleChipText: { fontSize: 13, color: '#555' },
  muscleChipTextActive: { color: '#fff' },
  editExerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    backgroundColor: '#fff',
    padding: 8,
    borderRadius: 10,
  },
  reorderBtns: { gap: 2 },
  reorderBtn: {
    width: 28,
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
  },
  reorderBtnDisabled: { opacity: 0.3 },
  reorderBtnText: { fontSize: 10, color: '#555' },
  reorderBtnTextDisabled: { color: '#ccc' },
  editExName: {
    flex: 2,
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    fontSize: 14,
    color: '#333',
  },
  editSets: {
    width: 50,
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 8,
    fontSize: 14,
    color: '#333',
    textAlign: 'center',
  },
  editReps: {
    width: 60,
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 8,
    fontSize: 14,
    color: '#333',
    textAlign: 'center',
  },
  removeExBtn: { fontSize: 20, color: '#E74C3C', paddingHorizontal: 4 },
  addExBtn: {
    borderWidth: 1,
    borderColor: '#4CAF50',
    borderStyle: 'dashed',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  addExBtnText: { color: '#4CAF50', fontSize: 14 },
});
