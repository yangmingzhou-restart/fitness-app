import { View, Text, StyleSheet } from 'react-native';

interface Segment {
  label: string;
  value: number;
  color: string;
}

interface Props {
  data: Segment[];
  size: number;
}

export default function DonutChart({ data, size }: Props) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const strokeWidth = 24;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  if (total === 0) {
    return (
      <View style={styles.wrap}>
        <View style={[styles.chart, { width: size, height: size }]}>
          <View style={[styles.ring, { width: size, height: size, borderRadius: size / 2, borderWidth: strokeWidth }]} />
          <Text style={styles.centerText}>0</Text>
        </View>
      </View>
    );
  }

  let cumulative = 0;
  const segments = data.map((d) => {
    const ratio = d.value / total;
    const start = cumulative;
    cumulative += ratio;
    return { ...d, ratio, start, end: cumulative };
  });

  return (
    <View style={styles.wrap}>
      <View style={[styles.chart, { width: size, height: size }]}>
        {segments.map((seg, i) => {
          const dashLength = circumference * seg.ratio;
          const gapLength = circumference - dashLength;
          const offset = -(circumference * seg.start);
          return (
            <View
              key={i}
              style={[
                styles.ring,
                {
                  width: size,
                  height: size,
                  borderRadius: size / 2,
                  borderWidth: strokeWidth,
                  borderColor: 'transparent',
                  borderTopColor: seg.color,
                  borderRightColor: seg.color,
                  borderBottomColor: seg.color,
                  transform: [{ rotate: `${offset / circumference * 360}deg` }],
                },
              ]}
            />
          );
        })}
        <View style={styles.centerWrap}>
          <Text style={styles.centerValue}>{total}</Text>
          <Text style={styles.centerUnit}>sets</Text>
        </View>
      </View>
      {/* Legend */}
      <View style={styles.legend}>
        {data.map((d, i) => (
          <View key={i} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: d.color }]} />
            <Text style={styles.legendLabel}>{d.label}</Text>
            <Text style={styles.legendValue}>{d.value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  chart: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  ring: {
    position: 'absolute',
    borderStyle: 'solid',
  },
  centerWrap: { alignItems: 'center' },
  centerValue: { fontSize: 32, fontWeight: 'bold', color: '#333' },
  centerUnit: { fontSize: 12, color: '#888' },
  centerText: { fontSize: 24, fontWeight: 'bold', color: '#ccc' },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 16,
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendLabel: { fontSize: 12, color: '#555' },
  legendValue: { fontSize: 12, fontWeight: '600', color: '#333' },
});
