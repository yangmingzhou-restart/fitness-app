import { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '../navigation/AppNavigator';
import MacroBar from '../components/MacroBar';
import ServingSelector from '../components/ServingSelector';
import { saveFoodRecord } from '../services/storage';
import { Macros } from '../services/api';

export default function ResultScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'Result'>>();
  const result = route.params.result;
  const timing = route.params.timing;
  const { t, i18n } = useTranslation();
  const isZh = i18n.language === 'zh';
  const [servings, setServings] = useState(1);
  const [showDetails, setShowDetails] = useState(false);

  const multiplier = servings;

  const scaledCalories = result.totalEstimatedCalories * multiplier;
  const scaledMacros: Macros | null = useMemo(() => {
    if (!result.totalMacros) return null;
    return {
      proteinG: result.totalMacros.proteinG * multiplier,
      carbsG: result.totalMacros.carbsG * multiplier,
      fatG: result.totalMacros.fatG * multiplier,
      proteinGPer100g: result.totalMacros.proteinGPer100g,
      carbsGPer100g: result.totalMacros.carbsGPer100g,
      fatGPer100g: result.totalMacros.fatGPer100g,
    };
  }, [result.totalMacros, multiplier]);

  const foodNames = result.foods
    .map((f) => (isZh ? f.name : f.nameEn))
    .join('、');

  const onReanalyze = () => {
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Multiplier badge */}
        {servings !== 1 && (
          <View style={styles.multiplierBadge}>
            <Text style={styles.multiplierText}>
              ×{servings} {t('result.servings')}
            </Text>
          </View>
        )}

        {/* Food names — compact 1-2 line chips */}
        <View style={styles.foodNamesWrap}>
          {result.foods.map((food, i) => (
            <View key={i} style={styles.foodChip}>
              <Text style={styles.foodChipText}>
                {isZh ? food.name : food.nameEn}
              </Text>
            </View>
          ))}
        </View>
        <Text style={styles.foodListText}>{foodNames}</Text>

        {/* Total calories — large */}
        <Text style={styles.totalCalories}>
          {scaledCalories.toFixed(0)}
        </Text>
        <Text style={styles.totalCalUnit}>{t('common.kcal')}</Text>

        {/* Macros bar */}
        {scaledMacros && (
          <MacroBar
            proteinG={scaledMacros.proteinG}
            carbsG={scaledMacros.carbsG}
            fatG={scaledMacros.fatG}
          />
        )}

        {/* Serving selector */}
        <ServingSelector servings={servings} onServingsChange={setServings} />

        {/* Expandable details */}
        <TouchableOpacity
          style={styles.detailToggle}
          onPress={() => setShowDetails(!showDetails)}
        >
          <Text style={styles.detailToggleText}>
            {showDetails ? t('result.hideDetails') : t('result.showDetails')}
          </Text>
          <Text style={styles.detailArrow}>{showDetails ? '▲' : '▼'}</Text>
        </TouchableOpacity>

        {showDetails && (
          <View style={styles.detailsWrap}>
            {result.foods.map((food, i) => (
              <View key={i} style={styles.foodDetailCard}>
                <View style={styles.foodDetailHeader}>
                  <Text style={styles.foodDetailName}>
                    {isZh ? food.name : food.nameEn}
                  </Text>
                  <Text style={styles.foodDetailCal}>
                    {(food.estimatedCalories * multiplier).toFixed(1)} {t('common.kcal')}
                  </Text>
                </View>
                <View style={styles.foodDetailGrid}>
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>{t('result.estimatedWeight')}</Text>
                    <Text style={styles.statValue}>
                      {(food.estimatedWeightG * multiplier).toFixed(0)}{t('common.gram')}
                    </Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>{t('result.caloriesPerKg')}</Text>
                    <Text style={styles.statValue}>{food.caloriesPerKg}</Text>
                  </View>
                  {food.macros && (
                    <View style={styles.statItem}>
                      <Text style={styles.statLabel}>{t('result.protein')}</Text>
                      <Text style={styles.statValue}>
                        {(food.macros.proteinG * multiplier).toFixed(1)}g
                      </Text>
                    </View>
                  )}
                  {food.macros && (
                    <View style={styles.statItem}>
                      <Text style={styles.statLabel}>{t('result.carbs')}</Text>
                      <Text style={styles.statValue}>
                        {(food.macros.carbsG * multiplier).toFixed(1)}g
                      </Text>
                    </View>
                  )}
                  {food.macros && (
                    <View style={styles.statItem}>
                      <Text style={styles.statLabel}>{t('result.fat')}</Text>
                      <Text style={styles.statValue}>
                        {(food.macros.fatG * multiplier).toFixed(1)}g
                      </Text>
                    </View>
                  )}
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>{t('result.confidence')}</Text>
                    <Text style={styles.statValue}>
                      {(food.confidence * 100).toFixed(0)}%
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.note}>{result.note}</Text>

        {timing && (
          <View style={styles.timingBox}>
            <Text style={styles.timingTitle}>Timing</Text>
            <View style={styles.timingRow}>
              <Text style={styles.timingLabel}>图片处理</Text>
              <Text style={styles.timingValue}>{timing.decodeMs}ms</Text>
            </View>
            <View style={styles.timingRow}>
              <Text style={styles.timingLabel}>AI分析+缩略图</Text>
              <Text style={styles.timingValue}>{timing.aiTotalMs}ms</Text>
            </View>
            <View style={styles.timingDivider} />
            <View style={styles.timingRow}>
              <Text style={styles.timingLabelBold}>后端总耗时</Text>
              <Text style={styles.timingValueBold}>{(timing.totalMs / 1000).toFixed(1)}s</Text>
            </View>
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.reanalyzeButton} onPress={onReanalyze}>
          <Text style={styles.reanalyzeButtonText}>{t('result.reanalyze')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, alignItems: 'center', paddingBottom: 20 },
  multiplierBadge: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 14,
    marginBottom: 12,
  },
  multiplierText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  foodNamesWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 6,
  },
  foodChip: {
    backgroundColor: '#e8f5e9',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
  },
  foodChipText: {
    color: '#4CAF50',
    fontSize: 13,
    fontWeight: '600',
  },
  foodListText: {
    fontSize: 13,
    color: '#999',
    textAlign: 'center',
    marginBottom: 12,
  },
  totalCalories: {
    fontSize: 52,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  totalCalUnit: {
    fontSize: 16,
    color: '#888',
    marginBottom: 16,
  },
  detailToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  detailToggleText: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '600',
  },
  detailArrow: {
    fontSize: 12,
    color: '#4CAF50',
  },
  detailsWrap: {
    width: '100%',
    marginTop: 4,
  },
  foodDetailCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  foodDetailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  foodDetailName: { fontSize: 16, fontWeight: '700', color: '#333' },
  foodDetailCal: { fontSize: 16, fontWeight: '700', color: '#4CAF50' },
  foodDetailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  statItem: { width: '50%', marginBottom: 8 },
  statLabel: { fontSize: 12, color: '#888' },
  statValue: { fontSize: 15, fontWeight: '700', color: '#333', marginTop: 2 },
  note: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginTop: 16,
  },
  footer: {
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  reanalyzeButton: {
    backgroundColor: '#333',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  reanalyzeButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  timingBox: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  timingTitle: { fontSize: 12, fontWeight: '700', color: '#888', marginBottom: 8 },
  timingRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  timingLabel: { fontSize: 13, color: '#888' },
  timingValue: { fontSize: 13, color: '#888', fontVariant: ['tabular-nums'] },
  timingLabelBold: { fontSize: 13, fontWeight: '700', color: '#333' },
  timingValueBold: { fontSize: 13, fontWeight: '700', color: '#4CAF50', fontVariant: ['tabular-nums'] },
  timingDivider: { height: 1, backgroundColor: '#eee', marginVertical: 6 },
});
