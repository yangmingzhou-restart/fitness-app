import { useState, useRef, useEffect } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator'
import * as ImagePicker from 'expo-image-picker'
import { useTranslation } from 'react-i18next'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { API_BASE_URL } from '../config/api'
import { analyzeImages, ApiError, checkHealth } from '../services/api'
import type { RootStackParamList } from '../navigation/AppNavigator'
import i18n from '../i18n'

const MAX_PHOTOS = 4

export default function CameraScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const { t } = useTranslation()
  const [permission, requestPermission] = useCameraPermissions()
  const cameraRef = useRef<CameraView>(null)
  const [photos, setPhotos] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [showCamera, setShowCamera] = useState(true)
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null)
  const [checkingConnection, setCheckingConnection] = useState(false)

  useEffect(() => {
    if (!permission?.granted) {
      requestPermission()
    }
  }, [])

  useEffect(() => {
    checkBackendHealth()
  }, [])

  const checkBackendHealth = async () => {
    setCheckingConnection(true)
    const result = await checkHealth()
    setBackendOnline(result.ok)
    setCheckingConnection(false)
  }

  const takePhoto = async () => {
    if (!cameraRef.current || photos.length >= MAX_PHOTOS) return
    try {
      const result = await cameraRef.current.takePictureAsync({
        quality: 0.9,
        base64: false,
      })
      if (result?.uri) {
        const t0 = Date.now()
        const manipulated = await manipulateAsync(
          result.uri,
          [{ resize: { width: 768 } }],
          { compress: 0.7, format: SaveFormat.JPEG, base64: true }
        )
        if (manipulated.base64) {
          console.log(`[timing] client compress: ${Date.now() - t0}ms, size: ${(manipulated.base64.length / 1024).toFixed(1)}KB`)
          setPhotos((prev) => [...prev, manipulated.base64!])
        }
        setShowCamera(false)
      }
    } catch (e) {
      Alert.alert(t('common.error'), String(e))
    }
  }

  const pickFromGallery = async () => {
    try {
      const permission = await ImagePicker.getMediaLibraryPermissionsAsync()
      if (!permission.granted) {
        const result = await ImagePicker.requestMediaLibraryPermissionsAsync()
        if (!result.granted) {
          Alert.alert(t('camera.galleryPermissionTitle'), t('camera.galleryPermissionMessage'))
          return
        }
      }
      const remaining = MAX_PHOTOS - photos.length
      if (remaining <= 0) return
      const pickerResult = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: remaining,
        quality: 0.9,
        base64: true,
      })
      if (!pickerResult.canceled && pickerResult.assets) {
        for (const asset of pickerResult.assets) {
          if (asset.base64) {
            const t0 = Date.now()
            const manipulated = await manipulateAsync(
              asset.uri,
              [{ resize: { width: 768 } }],
              { compress: 0.7, format: SaveFormat.JPEG, base64: true }
            )
            if (manipulated.base64) {
              console.log(`[timing] gallery compress: ${Date.now() - t0}ms, size: ${(manipulated.base64.length / 1024).toFixed(1)}KB`)
              setPhotos((prev) => [...prev, manipulated.base64!])
            }
          }
        }
        setShowCamera(false)
      }
    } catch (e) {
      Alert.alert(t('common.error'), String(e))
    }
  }

  const addMorePhotos = () => {
    setShowCamera(true)
  }

  const removeLastPhoto = () => {
    setPhotos((prev) => {
      const next = prev.slice(0, -1)
      if (next.length === 0) setShowCamera(true)
      return next
    })
  }

  const clearAllPhotos = () => {
    setPhotos([])
    setShowCamera(true)
  }

  const analyze = async () => {
    if (photos.length === 0) return
    setLoading(true)

    console.log(`[analyze] Starting — ${photos.length} photos, target: ${API_BASE_URL}/analyze`)
    const totalBodyKB = JSON.stringify({ images: photos, language: i18n.language }).length / 1024
    console.log(`[analyze] Request body size: ${totalBodyKB.toFixed(0)} KB`)

    // Pre-flight: health check
    const health = await checkHealth()
    console.log(`[analyze] Health check: ${health.ok ? 'OK' : 'FAIL'} (${health.latencyMs}ms${health.error ? ', ' + health.error : ''})`)
    if (!health.ok) {
      setLoading(false)
      setBackendOnline(false)
      Alert.alert(
        t('result.errorTitle'),
        (health.errorType === 'connection_refused')
          ? '无法连接服务器。\n\n可能原因：\n1. 后端程序未启动\n2. 手机开启了热点（热点模式下手机无法访问热点子网内的电脑，请改用ngrok隧道）'
          : (health.errorType === 'dns')
            ? '无法解析服务器地址。\n\n可能原因：\n1. API地址配置错误\n2. 手机开启了热点（请使用ngrok隧道，详见api.ts配置说明）'
            : health.errorType === 'timeout'
              ? '连接服务器超时，请检查WiFi或尝试重启后端'
              : t('camera.errorNetwork'),
        [
          { text: t('common.cancel') },
          { text: '重试连接', onPress: () => { checkBackendHealth(); } },
        ]
      )
      return
    }

    const t0 = Date.now()
    try {
      const res = await analyzeImages(photos, i18n.language, true)
      const roundTrip = Date.now() - t0
      console.log(`[timing] total round-trip: ${roundTrip}ms`)
      if (res.timing) {
        console.log(`[timing] backend breakdown: decode=${res.timing.decodeMs}ms ai+thumb=${res.timing.aiTotalMs}ms total=${res.timing.totalMs}ms`)
        console.log(`[timing] network overhead: ${roundTrip - res.timing.totalMs}ms`)
      }
      if (res.success && res.data) {
        navigation.navigate('Result', { result: res.data, timing: res.timing })
      } else {
        Alert.alert(t('result.errorTitle'), res.error || t('result.errorDesc'))
      }
    } catch (e) {
      let message: string
      if (e instanceof ApiError) {
        console.log(`[analyze] ApiError type=${e.type} status=${e.status} message=${e.message}`)
        message = e.getUserMessage()
      } else {
        console.log(`[analyze] Non-ApiError:`, e)
        message = t('camera.errorUnknown')
      }
      setBackendOnline(false)
      Alert.alert(t('result.errorTitle'), message, [
        { text: t('common.cancel') },
        { text: '重试连接', onPress: () => { checkBackendHealth(); } },
      ])
    } finally {
      setLoading(false)
    }
  }

  if (!permission?.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.permissionText}>{t('camera.permissionMessage')}</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>{t('camera.permissionTitle')}</Text>
        </TouchableOpacity>
      </View>
    )
  }

  if (showCamera) {
    return (
      <View style={styles.container}>
        <CameraView ref={cameraRef} style={styles.camera} facing="back" />
        <View style={styles.cameraOverlay}>
          <View style={styles.connectionDot}>
            <View style={[
              styles.dot,
              checkingConnection ? styles.dotChecking :
              backendOnline === true ? styles.dotOnline :
              backendOnline === false ? styles.dotOffline : styles.dotUnknown
            ]} />
            <Text style={styles.connectionText}>
              {checkingConnection ? '检测中...' :
               backendOnline === true ? '已连接' :
               backendOnline === false ? '未连接' : ''}
            </Text>
          </View>
          <Text style={styles.hint}>{t('camera.hint')}</Text>
          <Text style={styles.subHint}>{t('camera.multiHint')}</Text>
          {photos.length > 0 && (
            <View style={styles.photoCountBadge}>
              <Text style={styles.photoCountText}>
                {photos.length}/{MAX_PHOTOS}
              </Text>
            </View>
          )}
          <View style={styles.cameraButtonRow}>
            <TouchableOpacity style={styles.galleryButton} onPress={pickFromGallery}>
              <Text style={styles.galleryButtonText}>{t('camera.pickFromGallery')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.captureButton} onPress={takePhoto}>
              <View style={styles.captureInner} />
            </TouchableOpacity>
            <View style={styles.gallerySpacer} />
          </View>
          {photos.length > 0 && (
            <TouchableOpacity
              style={styles.backToPreviewButton}
              onPress={() => setShowCamera(false)}
            >
              <Text style={styles.backToPreviewText}>
                {t('camera.backToPreview').replace('{n}', String(photos.length + 1))}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        pagingEnabled
        style={styles.previewScroll}
        contentContainerStyle={styles.previewContent}
      >
        {photos.map((photo, index) => (
          <Image
            key={index}
            source={{ uri: `data:image/jpeg;base64,${photo}` }}
            style={styles.previewImage}
          />
        ))}
      </ScrollView>

      <View style={styles.photoStrip}>
        {photos.map((photo, index) => (
          <Image
            key={index}
            source={{ uri: `data:image/jpeg;base64,${photo}` }}
            style={[styles.thumb, index === photos.length - 1 && styles.thumbActive]}
          />
        ))}
        <Text style={styles.photoCount}>
          {photos.length}/{MAX_PHOTOS}
        </Text>
      </View>

      <View style={styles.actions}>
        <View style={styles.actionRow}>
          {photos.length < MAX_PHOTOS && (
            <TouchableOpacity style={styles.button} onPress={addMorePhotos}>
              <Text style={styles.buttonText}>{t('camera.addMore')}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.button} onPress={removeLastPhoto}>
            <Text style={styles.buttonText}>{t('camera.undo')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.button} onPress={clearAllPhotos}>
            <Text style={styles.buttonText}>{t('camera.retake')}</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={[styles.primaryButton, loading && styles.buttonDisabled]}
          onPress={analyze}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryButtonText}>
              {t('camera.analyze')} ({photos.length}{t('camera.photos')})
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  cameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 60,
  },
  connectionDot: {
    position: 'absolute',
    top: 12,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 6,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotOnline: { backgroundColor: '#4CAF50' },
  dotOffline: { backgroundColor: '#E74C3C' },
  dotChecking: { backgroundColor: '#F39C12' },
  dotUnknown: { backgroundColor: '#888' },
  connectionText: { color: '#fff', fontSize: 11 },
  hint: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  subHint: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    marginBottom: 30,
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 14,
  },
  photoCountBadge: {
    position: 'absolute',
    top: 60,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  photoCountText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  cameraButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  galleryButton: {
    width: 64,
    height: 64,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  galleryButtonText: { color: '#fff', fontSize: 11, fontWeight: '600', textAlign: 'center' },
  gallerySpacer: { width: 64 },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureInner: {
    width: 65,
    height: 65,
    borderRadius: 33,
    backgroundColor: '#fff',
  },
  backToPreviewButton: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: 'rgba(76,175,80,0.8)',
    borderRadius: 20,
  },
  backToPreviewText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  previewScroll: { flex: 1 },
  previewContent: { alignItems: 'center' },
  previewImage: {
    width: 360,
    height: 400,
    resizeMode: 'contain',
    marginHorizontal: 10,
  },
  photoStrip: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
    backgroundColor: '#111',
  },
  thumb: {
    width: 40,
    height: 40,
    borderRadius: 6,
    marginHorizontal: 4,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  thumbActive: { borderColor: '#4CAF50' },
  photoCount: { color: '#888', fontSize: 12, marginLeft: 8 },
  actions: {
    padding: 16,
    paddingBottom: 30,
    backgroundColor: '#1a1a1a',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 12,
  },
  button: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#444',
  },
  buttonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  primaryButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  buttonDisabled: { opacity: 0.5 },
  permissionText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    margin: 40,
  },
})
