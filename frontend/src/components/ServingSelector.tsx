import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

interface Props {
  servings: number;
  onServingsChange: (servings: number) => void;
}

const SERVING_OPTIONS = [0.5, 1, 2, 3, 4];

export default function ServingSelector({ servings, onServingsChange }: Props) {
  const { t } = useTranslation();

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{t('result.servings')}</Text>
      <View style={styles.controls}>
        <TouchableOpacity
          style={styles.btn}
          onPress={() => onServingsChange(Math.max(0.5, servings - 0.5))}
        >
          <Text style={styles.btnText}>−</Text>
        </TouchableOpacity>
        <Text style={styles.value}>{servings}</Text>
        <TouchableOpacity
          style={styles.btn}
          onPress={() => onServingsChange(servings + 0.5)}
        >
          <Text style={styles.btnText}>+</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.presets}>
        {SERVING_OPTIONS.map((s) => (
          <TouchableOpacity
            key={s}
            style={[styles.preset, servings === s && styles.presetActive]}
            onPress={() => onServingsChange(s)}
          >
            <Text style={[styles.presetText, servings === s && styles.presetTextActive]}>
              {s}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 12,
    marginVertical: 10,
    alignItems: 'center',
  },
  label: {
    fontSize: 13,
    color: '#888',
    marginBottom: 8,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  btn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
  },
  value: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    minWidth: 50,
    textAlign: 'center',
  },
  presets: {
    flexDirection: 'row',
    marginTop: 10,
    gap: 8,
  },
  preset: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#e0e0e0',
  },
  presetActive: {
    backgroundColor: '#4CAF50',
  },
  presetText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#555',
  },
  presetTextActive: {
    color: '#fff',
  },
});
