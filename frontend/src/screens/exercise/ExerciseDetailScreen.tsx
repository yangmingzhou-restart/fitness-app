import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Image, Modal,
  StyleSheet, ActivityIndicator, Dimensions,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { VideoView, useVideoPlayer } from 'expo-video';
import { getExerciseDetail, ExerciseInfo } from '../../services/api';
import { getLocalExerciseById } from '../../data/exerciseData';
import { MUSCLE_GROUPS } from '../../config/muscleGroups';
import { API_BASE_URL } from '../../config/api';
import type { RootStackParamList } from '../../navigation/AppNavigator';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

function buildMediaUri(relativePath: string): string {
  if (!relativePath) return '';
  const encoded = relativePath.includes('%') ? relativePath : encodeURI(relativePath);
  return API_BASE_URL + encoded;
}

function isGifUrl(url: string): boolean {
  return url.toLowerCase().endsWith('.gif');
}

export default function ExerciseDetailScreen() {
  const { t } = useTranslation();
  const route = useRoute<RouteProp<RootStackParamList, 'ExerciseDetail'>>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { exerciseId } = route.params;
  const [exercise, setExercise] = useState<ExerciseInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedVideo, setSelectedVideo] = useState<{ angle: string; url: string } | null>(null);
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoError, setVideoError] = useState(false);

  const player = useVideoPlayer(null);

  useEffect(() => {
    if (!player) return;
    const sub = player.addListener('statusChange', (payload: { status: string }) => {
      if (payload.status === 'readyToPlay') setVideoLoading(false);
      if (payload.status === 'error') {
        setVideoLoading(false);
        setVideoError(true);
      }
    });
    return () => sub.remove();
  }, [player]);

  useEffect(() => {
    if (exerciseId) loadDetail();
  }, [exerciseId]);

  useEffect(() => {
    return () => {
      setSelectedVideo(null);
    };
  }, []);

  const loadDetail = async () => {
    try {
      const data = await getExerciseDetail(exerciseId);
      setExercise(data);
    } catch {
      // Offline fallback — load from bundled JSON
      const local = getLocalExerciseById(exerciseId);
      if (local) setExercise(local);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedVideo) return;
    // GIFs are rendered as animated Image, not through the video player
    if (isGifUrl(selectedVideo.url)) {
      setVideoLoading(false);
      setVideoError(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setVideoLoading(true);
      setVideoError(false);
      try {
        await player.replaceAsync({ uri: buildMediaUri(selectedVideo.url) });
        if (!cancelled) player.play();
      } catch {
        if (!cancelled) {
          setVideoLoading(false);
          setVideoError(true);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [selectedVideo]);

  const handleVideoPress = (video: { angle: string; url: string }) => {
    setSelectedVideo(video);
  };

  const handleCloseVideo = () => {
    player.pause();
    setSelectedVideo(null);
    setVideoLoading(false);
    setVideoError(false);
  };

  const group = exercise
    ? MUSCLE_GROUPS[exercise.muscleGroup as keyof typeof MUSCLE_GROUPS]
    : null;

  const handleAddToRecord = () => {
    if (exercise) {
      navigation.navigate('ExerciseRecord', {
        exerciseName: exercise.name,
        muscleGroup: exercise.muscleGroup,
      });
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  if (!exercise) {
    return (
      <View style={styles.center}>
        <Text style={styles.notFound}>{t('exercise.notFound')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {exercise.coverImage ? (
          <Image
            source={{ uri: buildMediaUri(exercise.coverImage) }}
            style={styles.cover}
            onError={() => {}}
          />
        ) : (
          <View style={[styles.cover, styles.coverPlaceholder]}>
            <Text style={styles.coverPlaceholderText}>🏋️</Text>
          </View>
        )}

        <View style={styles.infoSection}>
          <Text style={styles.name}>{exercise.name}</Text>
          <Text style={styles.nameEn}>{exercise.nameEn}</Text>
          <View style={styles.badges}>
            <View style={[styles.badge, { backgroundColor: group?.color + '33' }]}>
              <Text style={[styles.badgeText, { color: group?.color }]}>
                {group?.label || exercise.muscleGroup}
              </Text>
            </View>
            <Text style={styles.difficulty}>
              {t(`exercise.${exercise.difficulty}`)} · {exercise.equipment}
            </Text>
          </View>
        </View>

        {exercise.videos && exercise.videos.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('exercise.demoVideos')}</Text>
            {exercise.videos.map((v, i) => (
              <TouchableOpacity
                key={i}
                style={styles.videoCard}
                activeOpacity={0.8}
                onPress={() => handleVideoPress(v)}
              >
                <Text style={styles.videoAngle}>{v.angle}</Text>
                <Text style={styles.videoHint}>{t('exercise.tapToPlay')}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <Modal
          visible={selectedVideo !== null}
          animationType="fade"
          onRequestClose={handleCloseVideo}
        >
          <View style={styles.videoModal}>
            <TouchableOpacity
              style={styles.videoCloseBtn}
              onPress={handleCloseVideo}
            >
              <Text style={styles.videoCloseText}>✕</Text>
            </TouchableOpacity>
            {selectedVideo && (
              <>
                <Text style={styles.videoModalTitle}>{selectedVideo.angle}</Text>
                {isGifUrl(selectedVideo.url) ? (
                  <Image
                    source={{ uri: buildMediaUri(selectedVideo.url) }}
                    style={styles.gifPlayer}
                    resizeMode="contain"
                  />
                ) : (
                  <>
                    {videoLoading && (
                      <ActivityIndicator size="large" color="#4CAF50" style={styles.videoLoader} />
                    )}
                    {videoError && (
                      <View style={styles.videoErrorBox}>
                        <Text style={styles.videoErrorText}>{t('exercise.videoError')}</Text>
                      </View>
                    )}
                    <VideoView
                      player={player}
                      style={styles.videoPlayer}
                      nativeControls
                    />
                  </>
                )}
              </>
            )}
          </View>
        </Modal>

        {exercise.description ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('exercise.description')}</Text>
            <Text style={styles.descText}>{exercise.description}</Text>
          </View>
        ) : null}

        {exercise.tips && exercise.tips.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('exercise.tips')}</Text>
            {exercise.tips.map((tip, i) => (
              <Text key={i} style={styles.tipItem}>
                {i + 1}. {tip}
              </Text>
            ))}
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.addButton} onPress={handleAddToRecord}>
          <Text style={styles.addButtonText}>{t('exercise.addToRecord')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { paddingBottom: 80 },
  cover: { width: '100%', height: 250, backgroundColor: '#e0e0e0' },
  coverPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  coverPlaceholderText: { fontSize: 48 },
  infoSection: { padding: 16, backgroundColor: '#fff' },
  name: { fontSize: 22, fontWeight: 'bold', color: '#333' },
  nameEn: { fontSize: 15, color: '#999', marginTop: 4 },
  badges: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 8 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  difficulty: { fontSize: 12, color: '#888' },
  section: { marginTop: 12, backgroundColor: '#fff', padding: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#333', marginBottom: 10 },
  descText: { fontSize: 14, color: '#555', lineHeight: 22 },
  tipItem: { fontSize: 14, color: '#555', lineHeight: 22, marginBottom: 4 },
  videoCard: {
    backgroundColor: '#f0f0f0',
    padding: 16,
    borderRadius: 10,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  videoAngle: { fontSize: 15, fontWeight: '600', color: '#333' },
  videoHint: { fontSize: 13, color: '#4CAF50' },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  addButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  addButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  notFound: { fontSize: 16, color: '#999' },
  videoModal: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoCloseBtn: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoCloseText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  videoModalTitle: {
    position: 'absolute',
    top: 56,
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    zIndex: 9,
  },
  videoPlayer: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH * 0.75,
    backgroundColor: '#000',
  },
  gifPlayer: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH * 0.75,
    backgroundColor: '#000',
  },
  videoLoader: { position: 'absolute', zIndex: 5 },
  videoErrorBox: {
    position: 'absolute',
    zIndex: 5,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  videoErrorText: { color: '#E74C3C', fontSize: 14 },
});
