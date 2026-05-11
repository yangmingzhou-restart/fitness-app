import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, TouchableOpacity, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
import CameraScreen from '../screens/CameraScreen';
import ResultScreen from '../screens/ResultScreen';
import HistoryScreen from '../screens/HistoryScreen';
import HomeScreen from '../screens/HomeScreen';
import ExerciseRecordScreen from '../screens/exercise/ExerciseRecordScreen';
import ExerciseLibraryScreen from '../screens/exercise/ExerciseLibraryScreen';
import ExerciseDetailScreen from '../screens/exercise/ExerciseDetailScreen';
import PlanScreen from '../screens/exercise/PlanScreen';
import AnalyticsScreen from '../screens/analytics/AnalyticsScreen';
import BarcodeScreen from '../screens/BarcodeScreen';
import BodyProgressScreen from '../screens/BodyProgressScreen';
import { AnalysisResult, TimingInfo } from '../services/api';

export type RootStackParamList = {
  MainTabs: undefined;
  Camera: undefined;
  Result: { result: AnalysisResult; timing?: TimingInfo };
  ExerciseLibrary: undefined;
  ExerciseDetail: { exerciseId: string; exerciseName: string };
  ExerciseRecord: { exerciseName?: string; muscleGroup?: string };
  Plan: undefined;
  Barcode: undefined;
  BodyProgress: undefined;
};

type TabParamList = {
  Home: undefined;
  History: undefined;
  Analytics: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

const DarkTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: '#000',
    card: '#1a1a1a',
    text: '#fff',
    border: '#333',
  },
};

function LanguageToggle() {
  const switchTo = (lang: string) => {
    i18n.changeLanguage(lang);
  };
  const isZh = i18n.language === 'zh';
  return (
    <View style={styles.langRow}>
      <TouchableOpacity
        style={[styles.langButton, isZh && styles.langActive]}
        onPress={() => switchTo('zh')}
      >
        <Text style={[styles.langText, isZh && styles.langActiveText]}>中文</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.langButton, !isZh && styles.langActive]}
        onPress={() => switchTo('en')}
      >
        <Text style={[styles.langText, !isZh && styles.langActiveText]}>EN</Text>
      </TouchableOpacity>
    </View>
  );
}

function TabNavigator() {
  const { t } = useTranslation();
  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#1a1a1a' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontSize: 18, fontWeight: '700' },
        headerRight: () => <LanguageToggle />,
        tabBarStyle: {
          backgroundColor: '#1a1a1a',
          borderTopColor: '#333',
          paddingBottom: 8,
          height: 60,
        },
        tabBarActiveTintColor: '#4CAF50',
        tabBarInactiveTintColor: '#888',
        tabBarLabelStyle: { fontSize: 11 },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          title: t('app.name'),
          tabBarLabel: t('nav.home'),
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>🏠</Text>,
        }}
      />
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{
          title: t('history.title'),
          tabBarLabel: t('nav.history'),
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>📋</Text>,
        }}
      />
      <Tab.Screen
        name="Analytics"
        component={AnalyticsScreen}
        options={{
          title: t('nav.analytics'),
          tabBarLabel: t('nav.analytics'),
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>📊</Text>,
        }}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      <NavigationContainer theme={DarkTheme}>
        <Stack.Navigator
          screenOptions={{
            headerStyle: { backgroundColor: '#1a1a1a' },
            headerTintColor: '#fff',
            headerTitleStyle: { fontSize: 18, fontWeight: '700' },
          }}
        >
          <Stack.Screen
            name="MainTabs"
            component={TabNavigator}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Camera"
            component={CameraScreen}
            options={{
              title: t('camera.title'),
              headerBackTitle: t('common.back'),
            }}
          />
          <Stack.Screen
            name="Result"
            component={ResultScreen}
            options={{
              title: t('result.title'),
              headerBackTitle: t('common.back'),
            }}
          />
          <Stack.Screen
            name="ExerciseLibrary"
            component={ExerciseLibraryScreen}
            options={{
              title: t('exercise.library'),
              headerBackTitle: t('common.back'),
            }}
          />
          <Stack.Screen
            name="ExerciseDetail"
            component={ExerciseDetailScreen}
            options={({ route }) => ({
              title: route.params.exerciseName,
              headerBackTitle: t('common.back'),
            })}
          />
          <Stack.Screen
            name="ExerciseRecord"
            component={ExerciseRecordScreen}
            options={{
              title: t('exercise.record'),
              headerBackTitle: t('common.back'),
            }}
          />
          <Stack.Screen
            name="Plan"
            component={PlanScreen}
            options={{
              title: t('exercise.plan'),
              headerBackTitle: t('common.back'),
            }}
          />
          <Stack.Screen
            name="Barcode"
            component={BarcodeScreen}
            options={{
              title: t('barcode.title'),
              headerBackTitle: t('common.back'),
            }}
          />
          <Stack.Screen
            name="BodyProgress"
            component={BodyProgressScreen}
            options={{
              title: t('bodyProgress.title'),
              headerBackTitle: t('common.back'),
            }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  langRow: {
    flexDirection: 'row',
    borderRadius: 16,
    backgroundColor: '#333',
    marginRight: 8,
    overflow: 'hidden',
  },
  langButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  langActive: {
    backgroundColor: '#4CAF50',
  },
  langText: { color: '#999', fontSize: 13, fontWeight: '600' },
  langActiveText: { color: '#fff' },
});
