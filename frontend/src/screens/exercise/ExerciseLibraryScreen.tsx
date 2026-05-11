import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, Image, ActivityIndicator,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { getExercises, ExerciseInfo, ApiError } from '../../services/api';
import { MUSCLE_GROUPS } from '../../config/muscleGroups';
import { API_BASE_URL } from '../../config/api';
import type { RootStackParamList } from '../../navigation/AppNavigator';

function getImageUri(coverImage: string): string | undefined {
  if (!coverImage) return undefined;
  const encoded = coverImage.includes('%') ? coverImage : encodeURI(coverImage);
  return API_BASE_URL + encoded;
}

const CARD_HEIGHT = 88;

const ExerciseCard = ({ item, onPress, t }: {
  item: ExerciseInfo;
  onPress: (item: ExerciseInfo) => void;
  t: (key: string) => string;
}) => {
  const [imgError, setImgError] = useState(false);
  const group = MUSCLE_GROUPS[item.muscleGroup as keyof typeof MUSCLE_GROUPS];
  const imgUri = getImageUri(item.coverImage);

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress(item)}
      activeOpacity={0.7}
    >
      {imgUri && !imgError ? (
        <Image
          source={{ uri: imgUri }}
          style={styles.thumb}
          onError={() => setImgError(true)}
        />
      ) : (
        <View style={[styles.thumb, styles.thumbPlaceholder]}>
          <Text style={styles.thumbPlaceholderText}>🏋️</Text>
        </View>
      )}
      <View style={styles.cardContent}>
        <Text style={styles.exerciseName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.exerciseNameEn} numberOfLines={1}>{item.nameEn}</Text>
        <View style={styles.badges}>
          <View style={[styles.badge, { backgroundColor: group?.color + '33' }]}>
            <Text style={[styles.badgeText, { color: group?.color }]}>
              {group?.label || item.muscleGroup}
            </Text>
          </View>
          <Text style={styles.difficulty}>{t(`exercise.${item.difficulty}`)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

export default function ExerciseLibraryScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [exercises, setExercises] = useState<ExerciseInfo[]>([]);
  const [search, setSearch] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    loadExercises();
  }, []);

  const loadExercises = async () => {
    setError(false);
    setErrorMsg('');
    setLoading(true);
    try {
      const res = await getExercises();
      setExercises(res.exercises || []);
    } catch (e) {
      setError(true);
      setErrorMsg(e instanceof ApiError ? e.getUserMessage() : t('exercise.loadError'));
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    let result = exercises;
    if (selectedGroup !== 'all') {
      result = result.filter((e) => e.muscleGroup === selectedGroup);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (e) =>
          e.name.includes(q) ||
          e.nameEn.toLowerCase().includes(q) ||
          e.muscleGroup.includes(q)
      );
    }
    return result;
  }, [search, selectedGroup, exercises]);

  const handlePress = useCallback((exercise: ExerciseInfo) => {
    navigation.navigate('ExerciseDetail', {
      exerciseId: exercise.id,
      exerciseName: exercise.name,
    });
  }, [navigation]);

  const getItemLayout = useCallback(
    (_: any, index: number) => ({
      length: CARD_HEIGHT + 10,
      offset: (CARD_HEIGHT + 10) * index,
      index,
    }),
    []
  );

  const filterOptions = useMemo(
    () => [
      { key: 'all', label: t('exercise.all') },
      ...Object.entries(MUSCLE_GROUPS).map(([k, v]) => ({ key: k, label: v.label })),
    ],
    [t]
  );

  const renderItem = useCallback(
    ({ item }: { item: ExerciseInfo }) => (
      <ExerciseCard item={item} onPress={handlePress} t={t} />
    ),
    [handlePress, t]
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{errorMsg || t('exercise.loadError')}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={loadExercises}>
          <Text style={styles.retryBtnText}>{t('common.retry')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.searchBar}
        placeholder={t('exercise.searchPlaceholder')}
        placeholderTextColor="#666"
        value={search}
        onChangeText={setSearch}
      />
      <View style={styles.filterRow}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={filterOptions}
          renderItem={({ item: { key, label } }) => (
            <TouchableOpacity
              style={[styles.chip, selectedGroup === key && styles.chipActive]}
              onPress={() => setSelectedGroup(key)}
            >
              <Text style={[styles.chipText, selectedGroup === key && styles.chipTextActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          )}
          keyExtractor={(item) => item.key}
          contentContainerStyle={styles.chipList}
        />
      </View>
      <FlatList
        data={filtered}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        removeClippedSubviews
        maxToRenderPerBatch={15}
        windowSize={5}
        getItemLayout={getItemLayout}
        initialNumToRender={20}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5', gap: 16 },
  errorText: { fontSize: 15, color: '#999' },
  retryBtn: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  searchBar: {
    backgroundColor: '#fff',
    margin: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    fontSize: 15,
    color: '#333',
  },
  filterRow: { marginBottom: 8 },
  chipList: { paddingHorizontal: 12, gap: 8 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#e0e0e0',
  },
  chipActive: { backgroundColor: '#4CAF50' },
  chipText: { fontSize: 13, color: '#555', fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  list: { padding: 12 },
  card: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    alignItems: 'center',
  },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: 10,
    backgroundColor: '#e0e0e0',
    marginRight: 12,
  },
  thumbPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbPlaceholderText: {
    fontSize: 24,
  },
  cardContent: { flex: 1 },
  exerciseName: { fontSize: 16, fontWeight: '700', color: '#333' },
  exerciseNameEn: { fontSize: 13, color: '#999', marginTop: 2 },
  badges: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 8 },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  badgeText: { fontSize: 11, fontWeight: '600' },
  difficulty: { fontSize: 11, color: '#888' },
});
