import { useState, useEffect, useMemo, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, Image, Alert, Modal, Dimensions, Platform,
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';
import {
  getBodyStats, saveBodyStat, deleteBodyStat,
  BodyStatsEntry,
} from '../services/storage';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_WIDTH = SCREEN_WIDTH - 32;

function genId() { return `body_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`; }
function todayStr() { return new Date().toISOString().slice(0, 10); }

const PHOTO_DIR = `${FileSystem.documentDirectory}fitness_data/photos/`;

async function savePhoto(tempUri: string, entryId: string, type: string): Promise<string> {
  const dirInfo = await FileSystem.getInfoAsync(PHOTO_DIR);
  if (!dirInfo.exists) await FileSystem.makeDirectoryAsync(PHOTO_DIR, { intermediates: true });
  const filename = `${entryId}_${type}.jpg`;
  const dest = PHOTO_DIR + filename;
  await FileSystem.copyAsync({ from: tempUri, to: dest });
  return dest;
}

async function removePhoto(path: string | null) {
  if (!path) return;
  const info = await FileSystem.getInfoAsync(path);
  if (info.exists) await FileSystem.deleteAsync(path, { idempotent: true });
}

export default function BodyProgressScreen() {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<BodyStatsEntry[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<BodyStatsEntry | null>(null);
  const [photoCompare, setPhotoCompare] = useState(false);
  const [compareIdx, setCompareIdx] = useState(0);
  const [chartMode, setChartMode] = useState<'weight' | 'bodyFat' | 'chest' | 'waist' | 'arm' | 'leg'>('weight');

  // Form fields
  const [formDate, setFormDate] = useState(todayStr());
  const [formWeight, setFormWeight] = useState('');
  const [formBodyFat, setFormBodyFat] = useState('');
  const [formChest, setFormChest] = useState('');
  const [formWaist, setFormWaist] = useState('');
  const [formArm, setFormArm] = useState('');
  const [formLeg, setFormLeg] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formPhotoFront, setFormPhotoFront] = useState<string | null>(null);
  const [formPhotoSide, setFormPhotoSide] = useState<string | null>(null);
  const [formPhotoBack, setFormPhotoBack] = useState<string | null>(null);

  useEffect(() => { loadEntries(); }, []);

  const loadEntries = async () => {
    const data = await getBodyStats();
    setEntries(data);
  };

  const openAdd = () => {
    setEditingEntry(null);
    setFormDate(todayStr());
    setFormWeight('');
    setFormBodyFat('');
    setFormChest('');
    setFormWaist('');
    setFormArm('');
    setFormLeg('');
    setFormNotes('');
    setFormPhotoFront(null);
    setFormPhotoSide(null);
    setFormPhotoBack(null);
    setShowModal(true);
  };

  const openEdit = (entry: BodyStatsEntry) => {
    setEditingEntry(entry);
    setFormDate(entry.date);
    setFormWeight(entry.weightKg != null ? String(entry.weightKg) : '');
    setFormBodyFat(entry.bodyFatPct != null ? String(entry.bodyFatPct) : '');
    setFormChest(entry.chestCm != null ? String(entry.chestCm) : '');
    setFormWaist(entry.waistCm != null ? String(entry.waistCm) : '');
    setFormArm(entry.armCm != null ? String(entry.armCm) : '');
    setFormLeg(entry.legCm != null ? String(entry.legCm) : '');
    setFormNotes(entry.notes || '');
    setFormPhotoFront(entry.photoFront);
    setFormPhotoSide(entry.photoSide);
    setFormPhotoBack(entry.photoBack);
    setShowModal(true);
  };

  const pickPhoto = async (type: 'front' | 'side' | 'back') => {
    const perm = await ImagePicker.getMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      const result = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!result.granted) return;
    }
    const pickerResult = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.8,
    });
    if (!pickerResult.canceled && pickerResult.assets?.[0]?.uri) {
      const setter = type === 'front' ? setFormPhotoFront : type === 'side' ? setFormPhotoSide : setFormPhotoBack;
      setter(pickerResult.assets[0].uri);
    }
  };

  const removeFormPhoto = async (type: 'front' | 'side' | 'back') => {
    const currentPath = type === 'front' ? formPhotoFront : type === 'side' ? formPhotoSide : formPhotoBack;
    const setter = type === 'front' ? setFormPhotoFront : type === 'side' ? setFormPhotoSide : setFormPhotoBack;
    if (currentPath && !currentPath.startsWith('file://')) {
      // Already a permanent path — clean up later
    }
    setter(null);
  };

  const handleSave = async () => {
    if (!formDate) return;
    const entryId = editingEntry?.id || genId();

    // Save photos
    let photoFront = editingEntry?.photoFront || null;
    let photoSide = editingEntry?.photoSide || null;
    let photoBack = editingEntry?.photoBack || null;

    if (formPhotoFront && formPhotoFront !== editingEntry?.photoFront) {
      if (editingEntry?.photoFront) await removePhoto(editingEntry.photoFront);
      photoFront = await savePhoto(formPhotoFront, entryId, 'front');
    } else if (!formPhotoFront && editingEntry?.photoFront) {
      await removePhoto(editingEntry.photoFront);
      photoFront = null;
    }

    if (formPhotoSide && formPhotoSide !== editingEntry?.photoSide) {
      if (editingEntry?.photoSide) await removePhoto(editingEntry.photoSide);
      photoSide = await savePhoto(formPhotoSide, entryId, 'side');
    } else if (!formPhotoSide && editingEntry?.photoSide) {
      await removePhoto(editingEntry.photoSide);
      photoSide = null;
    }

    if (formPhotoBack && formPhotoBack !== editingEntry?.photoBack) {
      if (editingEntry?.photoBack) await removePhoto(editingEntry.photoBack);
      photoBack = await savePhoto(formPhotoBack, entryId, 'back');
    } else if (!formPhotoBack && editingEntry?.photoBack) {
      await removePhoto(editingEntry.photoBack);
      photoBack = null;
    }

    const entry: BodyStatsEntry = {
      id: entryId,
      date: formDate,
      weightKg: formWeight ? parseFloat(formWeight) : null,
      bodyFatPct: formBodyFat ? parseFloat(formBodyFat) : null,
      chestCm: formChest ? parseFloat(formChest) : null,
      waistCm: formWaist ? parseFloat(formWaist) : null,
      armCm: formArm ? parseFloat(formArm) : null,
      legCm: formLeg ? parseFloat(formLeg) : null,
      photoFront,
      photoSide,
      photoBack,
      notes: formNotes.trim(),
      createdAt: new Date().toISOString(),
    };

    await saveBodyStat(entry);
    setShowModal(false);
    loadEntries();
  };

  const handleDelete = (entry: BodyStatsEntry) => {
    Alert.alert(t('common.confirm'), t('bodyProgress.deleteConfirm'), [
      { text: t('common.cancel') },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          await removePhoto(entry.photoFront);
          await removePhoto(entry.photoSide);
          await removePhoto(entry.photoBack);
          await deleteBodyStat(entry.id);
          loadEntries();
        },
      },
    ]);
  };

  // Chart data: last 30 days
  const chartData = useMemo(() => {
    const days: { date: string; label: string; value: number | null }[] = [];
    const today = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const ds = d.toISOString().slice(0, 10);
      const label = i === 0 ? '今天' : `${d.getMonth() + 1}/${d.getDate()}`;
      days.push({ date: ds, label, value: null });
    }
    // Fill in actual values based on chart mode
    const valueMap = new Map<string, number>();
    entries.forEach((e) => {
      let v: number | null = null;
      switch (chartMode) {
        case 'weight': v = e.weightKg; break;
        case 'bodyFat': v = e.bodyFatPct; break;
        case 'chest': v = e.chestCm; break;
        case 'waist': v = e.waistCm; break;
        case 'arm': v = e.armCm; break;
        case 'leg': v = e.legCm; break;
      }
      if (v != null) valueMap.set(e.date, v);
    });
    days.forEach((day) => {
      day.value = valueMap.get(day.date) || null;
    });
    return days;
  }, [entries, chartMode]);

  const chartValues = chartData.filter((d) => d.value != null).map((d) => d.value!);
  const cMin = chartValues.length > 0 ? Math.min(...chartValues) : 0;
  const cMax = chartValues.length > 0 ? Math.max(...chartValues) : 100;
  const cRange = cMax - cMin || 10;
  const chartMin = cMin - cRange * 0.3;
  const chartMax = cMax + cRange * 0.1;

  const chartUnit = chartMode === 'weight' ? 'kg' : chartMode === 'bodyFat' ? '%' : 'cm';

  // Pre-compute chart elements
  const chartContent = useMemo(() => {
    if (entries.length === 0) return null;
    const N = chartData.length;
    const DOT_R = 4;
    const CHART_H = 120;
    const STEP = Math.max(14, Math.floor((CHART_WIDTH - 70) / (N - 1)));
    const CHART_W = (N - 1) * STEP + DOT_R * 2;
    const points = chartData.map((day, i) => ({
      x: i * STEP + DOT_R,
      y: CHART_H - ((day.value ?? chartMin) - chartMin) / (chartMax - chartMin) * CHART_H,
      value: day.value,
      label: day.label,
      isToday: i === N - 1,
    }));
    return { N, DOT_R, CHART_H, STEP, CHART_W, points };
  }, [chartData, chartMax, chartMin, entries.length]);

  const scrollRef = useRef<ScrollView>(null);

  const latest = entries.length > 0 ? entries[0] : null;
  const prev = entries.length > 1 ? entries[1] : null;
  const weightChange = latest?.weightKg != null && prev?.weightKg != null
    ? latest.weightKg - prev.weightKg
    : null;

  // Photos for comparison
  const entriesWithPhotos = entries.filter((e) => e.photoFront || e.photoSide || e.photoBack);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Chart */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('bodyProgress.weightTrend')} (30{t('bodyProgress.days')})</Text>
          {/* Data type selector */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chartTypeRow}>
            {([
              ['weight', t('bodyProgress.weight')],
              ['bodyFat', t('bodyProgress.bodyFat')],
              ['chest', t('bodyProgress.chest')],
              ['waist', t('bodyProgress.waist')],
              ['arm', t('bodyProgress.arm')],
              ['leg', t('bodyProgress.leg')],
            ] as const).map(([key, label]) => (
              <TouchableOpacity
                key={key}
                style={[styles.chartTypeChip, chartMode === key && styles.chartTypeChipActive]}
                onPress={() => setChartMode(key)}
              >
                <Text style={[styles.chartTypeText, chartMode === key && styles.chartTypeTextActive]}>
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          {entries.length === 0 ? (
            <View style={styles.emptyChart}>
              <Text style={styles.emptyText}>{t('bodyProgress.noDataHint')}</Text>
            </View>
          ) : chartContent && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              ref={scrollRef}
              onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
            >
              <View style={{ width: chartContent.CHART_W + 40, paddingHorizontal: 20 }}>
                <View style={{ position: 'relative', height: chartContent.CHART_H + 30 }}>
                  <Text style={[bsChart.yLabel, { top: -6 }]}>{chartMax.toFixed(1)}</Text>
                  <Text style={[bsChart.yLabel, { top: chartContent.CHART_H / 2 - 6 }]}>{((chartMax + chartMin) / 2).toFixed(1)}</Text>
                  <Text style={[bsChart.yLabel, { top: chartContent.CHART_H - 6 }]}>{chartMin.toFixed(1)}</Text>
                  <Text style={bsChart.yUnit}>{chartUnit}</Text>
                  <View style={[bsChart.grid, { top: 0 }]} />
                  <View style={[bsChart.grid, { top: chartContent.CHART_H / 2 }]} />
                  <View style={[bsChart.grid, { top: chartContent.CHART_H }]} />
                  <View style={{ position: 'absolute', left: 38 + chartContent.DOT_R, top: 0, width: chartContent.CHART_W, height: chartContent.CHART_H }}>
                    {chartContent.points.map((p, i) => (
                      <View key={`a_${i}`} style={{
                        position: 'absolute', left: p.x - chartContent.DOT_R, bottom: 0,
                        width: chartContent.STEP, height: p.value != null ? chartContent.CHART_H - p.y : 0,
                        backgroundColor: p.value != null ? 'rgba(76,175,80,0.10)' : 'transparent',
                      }} />
                    ))}
                    {chartContent.points.slice(0, -1).map((p, i) => {
                      const np = chartContent.points[i + 1];
                      if (p.value == null || np.value == null) return null;
                      const dx = np.x - p.x;
                      const dy = np.y - p.y;
                      const len = Math.sqrt(dx * dx + dy * dy);
                      if (len === 0) return null;
                      return (
                        <View key={`s_${i}`} style={{
                          position: 'absolute',
                          left: p.x + dx / 2 - len / 2, top: p.y + dy / 2 - 1,
                          width: len, height: 2, backgroundColor: '#4CAF50',
                          transform: [{ rotate: `${Math.atan2(dy, dx)}rad` }],
                        }} />
                      );
                    })}
                    {chartContent.points.map((p, i) => (
                      <View key={`d_${i}`} style={{
                        position: 'absolute',
                        left: p.x - chartContent.DOT_R, top: p.y - chartContent.DOT_R,
                        width: chartContent.DOT_R * 2, height: chartContent.DOT_R * 2, borderRadius: chartContent.DOT_R,
                        backgroundColor: p.value != null ? (p.isToday ? '#FF9800' : '#4CAF50') : '#ddd',
                      }} />
                    ))}
                  </View>
                  {chartContent.points.map((p, i) => {
                    if (i % 2 !== 0 && i !== chartContent.N - 1) return null;
                    return (
                      <Text key={`lb_${i}`} style={{
                        position: 'absolute', left: 38 + chartContent.DOT_R + p.x - 18,
                        top: chartContent.CHART_H + 8, width: 36, textAlign: 'center',
                        fontSize: 9, color: p.isToday ? '#FF9800' : '#888',
                        fontWeight: p.isToday ? '600' : '400',
                      }}>{p.label}</Text>
                    );
                  })}
                </View>
              </View>
            </ScrollView>
          )}
        </View>

        {/* Latest summary */}
        {latest && (
          <View style={styles.summaryRow}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>{t('bodyProgress.weight')}</Text>
              <Text style={styles.summaryValue}>
                {latest.weightKg != null ? `${latest.weightKg} kg` : '--'}
              </Text>
              {weightChange != null && (
                <Text style={[styles.summaryChange, weightChange < 0 ? styles.changeDown : styles.changeUp]}>
                  {weightChange > 0 ? '↑' : '↓'} {Math.abs(weightChange).toFixed(1)} kg
                </Text>
              )}
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>{t('bodyProgress.bodyFat')}</Text>
              <Text style={styles.summaryValue}>
                {latest.bodyFatPct != null ? `${latest.bodyFatPct}%` : '--'}
              </Text>
            </View>
          </View>
        )}

        {/* Measurements */}
        {latest && (latest.chestCm || latest.waistCm || latest.armCm || latest.legCm) ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('bodyProgress.measurements')}</Text>
            <View style={styles.measureGrid}>
              {latest.chestCm ? (
                <View style={styles.measureItem}>
                  <Text style={styles.measureValue}>{latest.chestCm}</Text>
                  <Text style={styles.measureLabel}>{t('bodyProgress.chest')} (cm)</Text>
                </View>
              ) : null}
              {latest.waistCm ? (
                <View style={styles.measureItem}>
                  <Text style={styles.measureValue}>{latest.waistCm}</Text>
                  <Text style={styles.measureLabel}>{t('bodyProgress.waist')} (cm)</Text>
                </View>
              ) : null}
              {latest.armCm ? (
                <View style={styles.measureItem}>
                  <Text style={styles.measureValue}>{latest.armCm}</Text>
                  <Text style={styles.measureLabel}>{t('bodyProgress.arm')} (cm)</Text>
                </View>
              ) : null}
              {latest.legCm ? (
                <View style={styles.measureItem}>
                  <Text style={styles.measureValue}>{latest.legCm}</Text>
                  <Text style={styles.measureLabel}>{t('bodyProgress.leg')} (cm)</Text>
                </View>
              ) : null}
            </View>
          </View>
        ) : null}

        {/* Progress photos */}
        {entriesWithPhotos.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t('bodyProgress.photos')}</Text>
              <TouchableOpacity onPress={() => setPhotoCompare(!photoCompare)}>
                <Text style={styles.compareToggle}>
                  {photoCompare ? t('common.back') : t('bodyProgress.compare')}
                </Text>
              </TouchableOpacity>
            </View>

            {photoCompare && entriesWithPhotos.length >= 2 ? (
              <View>
                <View style={styles.compareSelector}>
                  {entriesWithPhotos.map((e, i) => (
                    <TouchableOpacity
                      key={e.id}
                      style={[styles.compareDateChip, i === compareIdx && styles.compareDateActive]}
                      onPress={() => setCompareIdx(i)}
                    >
                      <Text style={[styles.compareDateText, i === compareIdx && styles.compareDateTextActive]}>
                        {e.date.slice(5)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <ComparePhotos
                  entry={entriesWithPhotos[compareIdx]}
                  prevEntry={entriesWithPhotos[Math.min(compareIdx + 1, entriesWithPhotos.length - 1)]}
                />
              </View>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoStrip}>
                {entriesWithPhotos.slice(0, 5).map((e) => (
                  <View key={e.id} style={styles.photoCard}>
                    {e.photoFront ? (
                      <Image source={{ uri: e.photoFront }} style={styles.photoThumb} />
                    ) : null}
                    <Text style={styles.photoDate}>{e.date.slice(5)}</Text>
                    <Text style={styles.photoWeight}>
                      {e.weightKg != null ? `${e.weightKg}kg` : ''}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        )}

        {/* History list */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t('common.delete')} ({entries.length} {t('bodyProgress.entries')})
          </Text>
          {entries.length === 0 ? (
            <Text style={styles.emptyText}>{t('bodyProgress.noData')}</Text>
          ) : (
            entries.map((entry) => (
              <View key={entry.id} style={styles.historyCard}>
                <View style={styles.historyInfo}>
                  <Text style={styles.historyDate}>{entry.date}</Text>
                  <View style={styles.historyStats}>
                    {entry.weightKg != null && (
                      <Text style={styles.historyWeight}>{entry.weightKg} kg</Text>
                    )}
                    {entry.bodyFatPct != null && (
                      <Text style={styles.historyBf}>{entry.bodyFatPct}% BF</Text>
                    )}
                  </View>
                  {entry.notes ? <Text style={styles.historyNotes} numberOfLines={1}>{entry.notes}</Text> : null}
                </View>
                <View style={styles.historyActions}>
                  <TouchableOpacity onPress={() => openEdit(entry)} style={styles.editBtn}>
                    <Text style={styles.editBtnText}>{t('common.edit')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDelete(entry)} style={styles.deleteBtn}>
                    <Text style={styles.deleteBtnText}>{t('common.delete')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={openAdd}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* Add/Edit Modal */}
      <Modal visible={showModal} animationType="slide" onRequestClose={() => setShowModal(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowModal(false)}>
              <Text style={styles.modalCancel}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {editingEntry ? t('bodyProgress.editEntry') : t('bodyProgress.addEntry')}
            </Text>
            <TouchableOpacity onPress={handleSave}>
              <Text style={styles.modalSave}>{t('common.save')}</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} contentContainerStyle={styles.modalBodyContent}>
            {/* Date */}
            <Text style={styles.fieldLabel}>{t('bodyProgress.date')}</Text>
            <TextInput
              style={styles.fieldInput}
              value={formDate}
              onChangeText={setFormDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#666"
            />

            {/* Weight */}
            <Text style={styles.fieldLabel}>{t('bodyProgress.weight')} (kg)</Text>
            <TextInput
              style={styles.fieldInput}
              keyboardType="decimal-pad"
              value={formWeight}
              onChangeText={setFormWeight}
              placeholder="0.0"
              placeholderTextColor="#666"
            />

            {/* Body fat */}
            <Text style={styles.fieldLabel}>{t('bodyProgress.bodyFat')} (%)</Text>
            <TextInput
              style={styles.fieldInput}
              keyboardType="decimal-pad"
              value={formBodyFat}
              onChangeText={setFormBodyFat}
              placeholder="0.0"
              placeholderTextColor="#666"
            />

            {/* Measurements */}
            <Text style={styles.sectionLabel}>{t('bodyProgress.measurements')} (cm)</Text>
            <View style={styles.measureInputRow}>
              <View style={styles.measureInputHalf}>
                <Text style={styles.fieldLabel}>{t('bodyProgress.chest')}</Text>
                <TextInput style={styles.fieldInput} keyboardType="decimal-pad" value={formChest} onChangeText={setFormChest} placeholder="0" placeholderTextColor="#666" />
              </View>
              <View style={styles.measureInputHalf}>
                <Text style={styles.fieldLabel}>{t('bodyProgress.waist')}</Text>
                <TextInput style={styles.fieldInput} keyboardType="decimal-pad" value={formWaist} onChangeText={setFormWaist} placeholder="0" placeholderTextColor="#666" />
              </View>
            </View>
            <View style={styles.measureInputRow}>
              <View style={styles.measureInputHalf}>
                <Text style={styles.fieldLabel}>{t('bodyProgress.arm')}</Text>
                <TextInput style={styles.fieldInput} keyboardType="decimal-pad" value={formArm} onChangeText={setFormArm} placeholder="0" placeholderTextColor="#666" />
              </View>
              <View style={styles.measureInputHalf}>
                <Text style={styles.fieldLabel}>{t('bodyProgress.leg')}</Text>
                <TextInput style={styles.fieldInput} keyboardType="decimal-pad" value={formLeg} onChangeText={setFormLeg} placeholder="0" placeholderTextColor="#666" />
              </View>
            </View>

            {/* Photos */}
            <Text style={styles.sectionLabel}>{t('bodyProgress.photos')}</Text>
            {(['front', 'side', 'back'] as const).map((type) => {
              const photoUri = type === 'front' ? formPhotoFront : type === 'side' ? formPhotoSide : formPhotoBack;
              const label = type === 'front' ? t('bodyProgress.frontPhoto') : type === 'side' ? t('bodyProgress.sidePhoto') : t('bodyProgress.backPhoto');
              return (
                <View key={type} style={styles.photoField}>
                  <Text style={styles.fieldLabel}>{label}</Text>
                  {photoUri ? (
                    <View style={styles.photoPreviewRow}>
                      <Image source={{ uri: photoUri }} style={styles.photoPreview} />
                      <TouchableOpacity onPress={() => removeFormPhoto(type)}>
                        <Text style={styles.removePhotoText}>{t('common.delete')}</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity style={styles.addPhotoBtn} onPress={() => pickPhoto(type)}>
                      <Text style={styles.addPhotoText}>+ {t('bodyProgress.addPhoto')}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}

            {/* Notes */}
            <Text style={styles.fieldLabel}>{t('bodyProgress.notes')}</Text>
            <TextInput
              style={[styles.fieldInput, styles.notesInput]}
              value={formNotes}
              onChangeText={setFormNotes}
              placeholder={t('bodyProgress.notes')}
              placeholderTextColor="#666"
              multiline
              numberOfLines={3}
            />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

function ComparePhotos({ entry, prevEntry }: { entry: BodyStatsEntry; prevEntry: BodyStatsEntry }) {
  const { t } = useTranslation();
  const types: ('photoFront' | 'photoSide' | 'photoBack')[] = ['photoFront', 'photoSide', 'photoBack'];
  const labels = [t('bodyProgress.frontPhoto'), t('bodyProgress.sidePhoto'), t('bodyProgress.backPhoto')];

  return (
    <View style={compareStyles.container}>
      {types.map((type, i) => {
        const hasBoth = entry[type] && prevEntry[type];
        if (!hasBoth) return null;
        return (
          <View key={type} style={compareStyles.row}>
            <Text style={compareStyles.label}>{labels[i]}</Text>
            <View style={compareStyles.sideBySide}>
              <View style={compareStyles.photoWrap}>
                <Image source={{ uri: prevEntry[type]! }} style={compareStyles.photo} />
                <Text style={compareStyles.date}>{prevEntry.date.slice(5)}</Text>
              </View>
              <Text style={compareStyles.arrow}>→</Text>
              <View style={compareStyles.photoWrap}>
                <Image source={{ uri: entry[type]! }} style={compareStyles.photo} />
                <Text style={compareStyles.date}>{entry.date.slice(5)}</Text>
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const bsChart = StyleSheet.create({
  yLabel: { position: 'absolute', left: 0, fontSize: 10, color: '#aaa', width: 34, textAlign: 'right' },
  yUnit: { position: 'absolute', left: 0, top: -14, fontSize: 9, color: '#aaa', width: 34, textAlign: 'right' },
  grid: { position: 'absolute', left: 38, right: 0, height: 1, backgroundColor: '#eee' },
});

const compareStyles = StyleSheet.create({
  container: { gap: 16, marginTop: 8 },
  row: { alignItems: 'center' },
  label: { fontSize: 13, color: '#888', marginBottom: 6 },
  sideBySide: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  photoWrap: { alignItems: 'center' },
  photo: { width: 130, height: 173, borderRadius: 10, backgroundColor: '#222' },
  date: { fontSize: 12, color: '#888', marginTop: 4 },
  arrow: { fontSize: 18, color: '#4CAF50', marginHorizontal: 4 },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { padding: 16, paddingBottom: 100 },
  section: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 0,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#333', marginBottom: 12 },
  sectionLabel: { fontSize: 15, fontWeight: '700', color: '#333', marginTop: 20, marginBottom: 10 },

  // Chart
  emptyChart: { alignItems: 'center', paddingVertical: 30 },
  emptyText: { fontSize: 14, color: '#999', textAlign: 'center' },
  chartTypeRow: { marginBottom: 12 },
  chartTypeChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: '#e8e8e8',
    marginRight: 8,
  },
  chartTypeChipActive: { backgroundColor: '#4CAF50' },
  chartTypeText: { fontSize: 12, color: '#666', fontWeight: '600' },
  chartTypeTextActive: { color: '#fff' },

  // Summary
  summaryRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  summaryCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  summaryLabel: { fontSize: 13, color: '#888' },
  summaryValue: { fontSize: 24, fontWeight: 'bold', color: '#333', marginTop: 4 },
  summaryChange: { fontSize: 13, fontWeight: '600', marginTop: 4 },
  changeDown: { color: '#4CAF50' },
  changeUp: { color: '#E74C3C' },

  // Measurements
  measureGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  measureItem: {
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    minWidth: 70,
    flex: 1,
  },
  measureValue: { fontSize: 20, fontWeight: '700', color: '#4CAF50' },
  measureLabel: { fontSize: 11, color: '#888', marginTop: 4 },

  // Photos
  compareToggle: { fontSize: 13, color: '#4CAF50', fontWeight: '600' },
  compareSelector: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12, marginTop: 8 },
  compareDateChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#e0e0e0',
  },
  compareDateActive: { backgroundColor: '#4CAF50' },
  compareDateText: { fontSize: 12, color: '#555' },
  compareDateTextActive: { color: '#fff', fontWeight: '600' },
  photoStrip: { marginTop: 8 },
  photoCard: { alignItems: 'center', marginRight: 12 },
  photoThumb: { width: 80, height: 106, borderRadius: 8, backgroundColor: '#e0e0e0' },
  photoDate: { fontSize: 11, color: '#888', marginTop: 4 },
  photoWeight: { fontSize: 11, color: '#333', fontWeight: '600' },

  // History
  historyCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  historyInfo: { flex: 1 },
  historyDate: { fontSize: 14, fontWeight: '600', color: '#333' },
  historyStats: { flexDirection: 'row', gap: 10, marginTop: 2 },
  historyWeight: { fontSize: 13, color: '#333' },
  historyBf: { fontSize: 13, color: '#888' },
  historyNotes: { fontSize: 12, color: '#999', marginTop: 2 },
  historyActions: { flexDirection: 'row', gap: 8 },
  editBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, backgroundColor: '#e0e0e0' },
  editBtnText: { fontSize: 12, color: '#333' },
  deleteBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, backgroundColor: '#FEE' },
  deleteBtnText: { fontSize: 12, color: '#E74C3C' },

  // FAB
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  fabText: { color: '#fff', fontSize: 28, lineHeight: 30 },

  // Modal
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
  modalBody: { flex: 1 },
  modalBodyContent: { padding: 16, paddingBottom: 40 },
  fieldLabel: { fontSize: 14, fontWeight: '600', color: '#555', marginBottom: 6, marginTop: 12 },
  fieldInput: {
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#333',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  notesInput: { height: 80, textAlignVertical: 'top' },
  measureInputRow: { flexDirection: 'row', gap: 10 },
  measureInputHalf: { flex: 1 },
  photoField: { marginTop: 8 },
  photoPreviewRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  photoPreview: { width: 80, height: 106, borderRadius: 8, backgroundColor: '#e0e0e0' },
  removePhotoText: { fontSize: 13, color: '#E74C3C' },
  addPhotoBtn: {
    borderWidth: 1,
    borderColor: '#4CAF50',
    borderStyle: 'dashed',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  addPhotoText: { color: '#4CAF50', fontSize: 14 },
});
