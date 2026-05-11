import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

interface Props {
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export default function MacroBar({ proteinG, carbsG, fatG }: Props) {
  const { t } = useTranslation();
  const total = proteinG + carbsG + fatG;
  if (total === 0) return null;

  const pct = (val: number) => ((val / total) * 100).toFixed(0);

  return (
    <View style={styles.wrap}>
      <View style={styles.bar}>
        {proteinG > 0 && (
          <View style={[styles.segment, styles.protein, { flex: proteinG }]}>
            {parseFloat(pct(proteinG)) > 10 && (
              <Text style={styles.label}>{pct(proteinG)}%</Text>
            )}
          </View>
        )}
        {carbsG > 0 && (
          <View style={[styles.segment, styles.carbs, { flex: carbsG }]}>
            {parseFloat(pct(carbsG)) > 10 && (
              <Text style={styles.label}>{pct(carbsG)}%</Text>
            )}
          </View>
        )}
        {fatG > 0 && (
          <View style={[styles.segment, styles.fat, { flex: fatG }]}>
            {parseFloat(pct(fatG)) > 10 && (
              <Text style={styles.label}>{pct(fatG)}%</Text>
            )}
          </View>
        )}
      </View>
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: '#E74C3C' }]} />
          <Text style={styles.legendText}>
            {t('result.protein')} {proteinG.toFixed(1)}g
          </Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: '#F39C12' }]} />
          <Text style={styles.legendText}>
            {t('result.carbs')} {carbsG.toFixed(1)}g
          </Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: '#3498DB' }]} />
          <Text style={styles.legendText}>
            {t('result.fat')} {fatG.toFixed(1)}g
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginVertical: 10 },
  bar: {
    flexDirection: 'row',
    height: 28,
    borderRadius: 14,
    overflow: 'hidden',
  },
  segment: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  protein: { backgroundColor: '#E74C3C' },
  carbs: { backgroundColor: '#F39C12' },
  fat: { backgroundColor: '#3498DB' },
  label: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 8,
    gap: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 12,
    color: '#888',
  },
});
