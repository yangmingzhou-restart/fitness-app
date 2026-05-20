import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

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
  const center = size / 2;

  if (total === 0) {
    return (
      <View style={styles.wrap}>
        <View style={[styles.chart, { width: size, height: size }]}>
          <Svg width={size} height={size}>
            <Circle
              cx={center}
              cy={center}
              r={radius}
              stroke="#e0e0e0"
              strokeWidth={strokeWidth}
              fill="none"
            />
          </Svg>
          <View style={styles.centerWrap}>
            <Text style={styles.centerValue}>0</Text>
            <Text style={styles.centerUnit}>sets</Text>
          </View>
        </View>
      </View>
    );
  }

  let cumulative = 0;
  const segments = data.map((d) => {
    const ratio = d.value / total;
    const start = cumulative;
    cumulative += ratio;
    return { ...d, ratio, dashLength: circumference * ratio, offset: circumference * (1 - start) };
  });

  return (
    <View style={styles.wrap}>
      <View style={[styles.chart, { width: size, height: size }]}>
        <Svg width={size} height={size}>
          {segments.map((seg, i) => (
            <Circle
              key={i}
              cx={center}
              cy={center}
              r={radius}
              stroke={seg.color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${seg.dashLength} ${circumference - seg.dashLength}`}
              strokeDashoffset={seg.offset}
              strokeLinecap="butt"
              fill="none"
              rotation={-90}
              origin={`${center}, ${center}`}
            />
          ))}
        </Svg>
        <View style={styles.centerWrap}>
          <Text style={styles.centerValue}>{total}</Text>
          <Text style={styles.centerUnit}>sets</Text>
        </View>
      </View>
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
  },
  centerWrap: { position: 'absolute', alignItems: 'center' },
  centerValue: { fontSize: 32, fontWeight: 'bold', color: '#333' },
  centerUnit: { fontSize: 12, color: '#888' },
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
