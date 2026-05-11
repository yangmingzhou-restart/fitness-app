import { useState, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, Dimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { getExerciseRecords } from '../../services/storage';
import DonutChart from '../../components/DonutChart';
import { MUSCLE_GROUPS } from '../../config/muscleGroups';

interface Stats {
  totalWorkouts: number;
  dailyFrequency: { date: string; count: number }[];
  muscleGroupTotals: { group: string; count: number }[];
}

const SCREEN_W = Dimensions.get('window').width;

function getWeekRange(): { start: string; end: string } {
  const now = new Date();
  const end = now.toISOString().slice(0, 10);
  const start = new Date(now.getTime() - 6 * 86400000).toISOString().slice(0, 10);
  return { start, end };
}

function getMonthRange(): { start: string; end: string } {
  const now = new Date();
  const end = now.toISOString().slice(0, 10);
  const start = new Date(now.getTime() - 29 * 86400000).toISOString().slice(0, 10);
  return { start, end };
}

function getDayLabel(dateStr: string, lang: string): string {
  const d = new Date(dateStr);
  const days = lang === 'zh' ? ['日', '一', '二', '三', '四', '五', '六'] : ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  return days[d.getDay()];
}

function getWeekDate(dateStr: string): string {
  return dateStr.slice(5); // MM-DD
}

export default function AnalyticsScreen() {
  const { t, i18n } = useTranslation();
  const [stats, setStats] = useState<Stats>({ totalWorkouts: 0, dailyFrequency: [], muscleGroupTotals: [] });
  const [period, setPeriod] = useState<'week' | 'month'>('week');

  useEffect(() => {
    loadStats();
  }, [period]);

  const loadStats = async () => {
    const range = period === 'week' ? getWeekRange() : getMonthRange();
    const allRecords = await getExerciseRecords();
    const filtered = allRecords.filter((r) => r.date >= range.start && r.date <= range.end);

    // Daily frequency
    const dateMap = new Map<string, number>();
    const start = new Date(range.start);
    const end = new Date(range.end);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      dateMap.set(d.toISOString().slice(0, 10), 0);
    }
    filtered.forEach((r) => {
      dateMap.set(r.date, (dateMap.get(r.date) || 0) + 1);
    });
    const dailyFrequency = Array.from(dateMap.entries()).map(([date, count]) => ({
      date,
      count,
    }));

    // Muscle group totals
    const groupMap = new Map<string, number>();
    filtered.forEach((r) => {
      const group = r.muscleGroup || 'other';
      groupMap.set(group, (groupMap.get(group) || 0) + 1);
    });
    const muscleGroupTotals = Array.from(groupMap.entries()).map(([group, count]) => ({
      group,
      count,
    }));

    setStats({
      totalWorkouts: filtered.length,
      dailyFrequency,
      muscleGroupTotals,
    });
  };

  const maxCount = Math.max(...stats.dailyFrequency.map((d) => d.count), 1);
  const donutData = useMemo(() => {
    const colors: Record<string, string> = {};
    Object.entries(MUSCLE_GROUPS).forEach(([k, v]) => {
      colors[k] = v.color;
    });
    return stats.muscleGroupTotals.map((item) => ({
      label: MUSCLE_GROUPS[item.group as keyof typeof MUSCLE_GROUPS]?.label || item.group,
      value: item.count,
      color: colors[item.group] || '#888',
    }));
  }, [stats.muscleGroupTotals]);

  const mostTrained = stats.muscleGroupTotals.length > 0
    ? stats.muscleGroupTotals.reduce((a, b) => (a.count > b.count ? a : b))
    : null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Period toggle */}
      <View style={styles.periodRow}>
        <View
          style={[styles.periodBtn, period === 'week' && styles.periodBtnActive]}
          onTouchEnd={() => setPeriod('week')}
        >
          <Text style={[styles.periodText, period === 'week' && styles.periodTextActive]}>
            {t('analytics.week')}
          </Text>
        </View>
        <View
          style={[styles.periodBtn, period === 'month' && styles.periodBtnActive]}
          onTouchEnd={() => setPeriod('month')}
        >
          <Text style={[styles.periodText, period === 'month' && styles.periodTextActive]}>
            {t('analytics.month')}
          </Text>
        </View>
      </View>

      {/* Summary cards */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{stats.totalWorkouts}</Text>
          <Text style={styles.summaryLabel}>{t('analytics.totalWorkouts')}</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>
            {mostTrained
              ? (MUSCLE_GROUPS[mostTrained.group as keyof typeof MUSCLE_GROUPS]?.label || mostTrained.group)
              : '-'}
          </Text>
          <Text style={styles.summaryLabel}>{t('analytics.mostTrained')}</Text>
        </View>
      </View>

      {/* Daily frequency chart */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('analytics.frequency')}</Text>
        {period === 'week' ? (
          <View style={styles.barChart}>
            {stats.dailyFrequency.map((day, i) => (
              <View key={i} style={styles.barCol}>
                <Text style={styles.barValue}>{day.count > 0 ? day.count : ''}</Text>
                <View
                  style={[
                    styles.bar,
                    {
                      height: day.count > 0 ? Math.max((day.count / maxCount) * 120, 8) : 0,
                      backgroundColor: day.count > 0 ? '#4CAF50' : '#e0e0e0',
                    },
                  ]}
                />
                <Text style={styles.barLabel}>{getDayLabel(day.date, i18n.language)}</Text>
                <Text style={styles.barDate}>{getWeekDate(day.date)}</Text>
              </View>
            ))}
          </View>
        ) : (
          (() => {
            const N = stats.dailyFrequency.length;
            const DOT_R = 4;
            const CHART_H = 130;
            const STEP = Math.max(16, Math.floor((SCREEN_W - 80) / (N - 1)));
            const CHART_W = (N - 1) * STEP + DOT_R * 2;
            const points = stats.dailyFrequency.map((day, i) => ({
              x: i * STEP + DOT_R,
              y: CHART_H - (day.count / maxCount) * CHART_H,
              count: day.count,
              date: day.date,
            }));
            return (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ width: CHART_W + 40, paddingHorizontal: 20 }}>
                  <View style={[styles.lineChartWrap, { height: CHART_H + 30 }]}>
                    {/* Y-axis labels */}
                    <Text style={styles.lineYTop}>{maxCount}</Text>
                    <Text style={styles.lineYMid}>{Math.round(maxCount / 2)}</Text>
                    <Text style={styles.lineYBot}>0</Text>
                    {/* Grid lines */}
                    <View style={[styles.lineGrid, { top: DOT_R }]} />
                    <View style={[styles.lineGrid, { top: CHART_H / 2 }]} />
                    <View style={[styles.lineGrid, { top: CHART_H }]} />
                    {/* Chart area */}
                    <View style={{ position: 'absolute', left: 38 + DOT_R, top: 0, width: CHART_W, height: CHART_H }}>
                      {/* Area fill strips */}
                      {points.map((p, i) => (
                        <View key={`area_${i}`} style={{
                          position: 'absolute',
                          left: p.x - DOT_R,
                          bottom: 0,
                          width: STEP,
                          height: CHART_H - p.y,
                          backgroundColor: p.count > 0 ? 'rgba(76,175,80,0.12)' : 'transparent',
                        }} />
                      ))}
                      {/* Line segments */}
                      {points.slice(0, -1).map((p, i) => {
                        const np = points[i + 1];
                        const dx = np.x - p.x;
                        const dy = np.y - p.y;
                        const len = Math.sqrt(dx * dx + dy * dy);
                        if (len === 0) return null;
                        const angle = Math.atan2(dy, dx);
                        return (
                          <View key={`seg_${i}`} style={{
                            position: 'absolute',
                            left: p.x + dx / 2 - len / 2,
                            top: p.y + dy / 2 - 1,
                            width: len,
                            height: 2,
                            backgroundColor: '#4CAF50',
                            transform: [{ rotate: `${angle}rad` }],
                          }} />
                        );
                      })}
                      {/* Dots */}
                      {points.map((p, i) => (
                        <View key={`dot_${i}`} style={{
                          position: 'absolute',
                          left: p.x - DOT_R,
                          top: p.y - DOT_R,
                          width: DOT_R * 2,
                          height: DOT_R * 2,
                          borderRadius: DOT_R,
                          backgroundColor: p.count > 0 ? '#4CAF50' : '#ddd',
                        }} />
                      ))}
                    </View>
                    {/* X-axis labels */}
                    {points.map((p, i) => {
                      const showLabel = i % 5 === 0 || i === N - 1;
                      return showLabel ? (
                        <Text key={`lb_${i}`} style={{
                          position: 'absolute',
                          left: 38 + DOT_R + p.x - 20,
                          top: CHART_H + 8,
                          width: 40,
                          textAlign: 'center',
                          fontSize: 9,
                          color: '#888',
                        }}>{getWeekDate(p.date)}</Text>
                      ) : null;
                    })}
                  </View>
                </View>
              </ScrollView>
            );
          })()
        )}
      </View>

      {/* Muscle group distribution */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('analytics.muscleDist')}</Text>
        <DonutChart data={donutData} size={200} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { padding: 16, paddingBottom: 40 },
  periodRow: {
    flexDirection: 'row',
    backgroundColor: '#e0e0e0',
    borderRadius: 12,
    padding: 3,
    marginBottom: 16,
  },
  periodBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 10,
  },
  periodBtnActive: { backgroundColor: '#fff' },
  periodText: { fontSize: 14, fontWeight: '600', color: '#888' },
  periodTextActive: { color: '#333' },
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  summaryValue: { fontSize: 28, fontWeight: 'bold', color: '#4CAF50' },
  summaryLabel: { fontSize: 13, color: '#888', marginTop: 4 },
  section: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 16,
  },
  barChart: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    height: 180,
    paddingTop: 20,
  },
  barCol: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    flex: 1,
  },
  barValue: {
    fontSize: 11,
    color: '#888',
    marginBottom: 4,
  },
  bar: {
    width: 20,
    borderRadius: 4,
    minHeight: 0,
  },
  barLabel: {
    fontSize: 12,
    color: '#888',
    marginTop: 6,
  },
  barDate: {
    fontSize: 10,
    color: '#aaa',
    marginTop: 2,
  },
  lineChartWrap: {
    position: 'relative',
    marginLeft: 0,
  },
  lineYTop: { position: 'absolute', left: 0, top: -6, fontSize: 10, color: '#aaa', width: 34, textAlign: 'right' },
  lineYMid: { position: 'absolute', left: 0, top: 130 / 2 - 6, fontSize: 10, color: '#aaa', width: 34, textAlign: 'right' },
  lineYBot: { position: 'absolute', left: 0, top: 130 - 6, fontSize: 10, color: '#aaa', width: 34, textAlign: 'right' },
  lineGrid: {
    position: 'absolute',
    left: 38,
    right: 0,
    height: 1,
    backgroundColor: '#eee',
  },
});
