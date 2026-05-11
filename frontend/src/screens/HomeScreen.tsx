import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import type { RootStackParamList } from '../navigation/AppNavigator';

interface FeatureCard {
  key: string;
  icon: string;
  titleKey: string;
  descKey: string;
  screen: string;
  color: string;
}

export default function HomeScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const features: FeatureCard[] = [
    {
      key: 'ai',
      icon: '📸',
      titleKey: 'home.aiTitle',
      descKey: 'home.aiDesc',
      screen: 'Camera',
      color: '#4CAF50',
    },
    {
      key: 'record',
      icon: '🏋️',
      titleKey: 'home.recordTitle',
      descKey: 'home.recordDesc',
      screen: 'ExerciseRecord',
      color: '#3498DB',
    },
    {
      key: 'library',
      icon: '📚',
      titleKey: 'home.libraryTitle',
      descKey: 'home.libraryDesc',
      screen: 'ExerciseLibrary',
      color: '#9B59B6',
    },
    {
      key: 'plan',
      icon: '📋',
      titleKey: 'home.planTitle',
      descKey: 'home.planDesc',
      screen: 'Plan',
      color: '#F39C12',
    },
    {
      key: 'analytics',
      icon: '📊',
      titleKey: 'home.analyticsTitle',
      descKey: 'home.analyticsDesc',
      screen: 'Analytics',
      color: '#E74C3C',
    },
    {
      key: 'barcode',
      icon: '📱',
      titleKey: 'home.barcodeTitle',
      descKey: 'home.barcodeDesc',
      screen: 'Barcode',
      color: '#FF6B6B',
    },
    {
      key: 'bodyProgress',
      icon: '📏',
      titleKey: 'home.bodyProgressTitle',
      descKey: 'home.bodyProgressDesc',
      screen: 'BodyProgress',
      color: '#FF9800',
    },
  ];

  const handlePress = (feature: FeatureCard) => {
    navigation.navigate(feature.screen as any);
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.greeting}>{t('home.greeting')}</Text>
        <Text style={styles.subtitle}>{t('home.subtitle')}</Text>
        <View style={styles.grid}>
          {features.map((feature) => (
            <TouchableOpacity
              key={feature.key}
              style={styles.card}
              onPress={() => handlePress(feature)}
              activeOpacity={0.8}
            >
              <View style={[styles.iconWrap, { backgroundColor: feature.color + '22' }]}>
                <Text style={styles.icon}>{feature.icon}</Text>
              </View>
              <Text style={styles.cardTitle}>{t(feature.titleKey)}</Text>
              <Text style={styles.cardDesc}>{t(feature.descKey)}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  scrollContent: { padding: 16, paddingBottom: 40 },
  greeting: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#888',
    marginTop: 6,
    marginBottom: 28,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  card: {
    width: '48%',
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  icon: { fontSize: 24 },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 12,
    color: '#888',
    lineHeight: 16,
  },
});
