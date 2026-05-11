import { useState, useCallback } from 'react'
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native'
import { useTranslation } from 'react-i18next'
import { useFocusEffect } from '@react-navigation/native'
import { getHistory, HistoryRecord } from '../services/api'
import i18n from '../i18n'

export default function HistoryScreen() {
  const { t } = useTranslation()
  const [records, setRecords] = useState<HistoryRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)

  useFocusEffect(
    useCallback(() => {
      loadHistory()
    }, [])
  )

  const loadHistory = async () => {
    try {
      setLoading(true)
      const res = await getHistory()
      if (res.success) {
        setRecords(res.records)
        setTotal(res.total)
      }
    } catch {
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    const month = (d.getMonth() + 1).toString().padStart(2, '0')
    const day = d.getDate().toString().padStart(2, '0')
    const hour = d.getHours().toString().padStart(2, '0')
    const min = d.getMinutes().toString().padStart(2, '0')
    return `${month}-${day} ${hour}:${min}`
  }

  const renderItem = ({ item }: { item: HistoryRecord }) => {
    let foods: any[] = []
    try {
      foods = JSON.parse(item.foods)
    } catch {}

    const foodNames = foods
      .map((f) => (i18n.language === 'zh' ? f.name : f.nameEn))
      .join('、')

    return (
      <View style={styles.card}>
        {item.image_thumbnail ? (
          <Image
            source={{ uri: `data:image/jpeg;base64,${item.image_thumbnail}` }}
            style={styles.thumbnail}
          />
        ) : (
          <View style={[styles.thumbnail, styles.placeholder]}>
            <Text style={styles.placeholderText}>📸</Text>
          </View>
        )}
        <View style={styles.cardContent}>
          <Text style={styles.foodNames} numberOfLines={2}>
            {foodNames}
          </Text>
          <Text style={styles.calories}>
            {item.total_calories.toFixed(0)} {t('common.kcal')}
          </Text>
          <Text style={styles.date}>{formatDate(item.created_at)}</Text>
        </View>
      </View>
    )
  }

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>
        {t('history.title')} ({total} {t('history.records')})
      </Text>
      {records.length === 0 ? (
        <View style={styles.centerContainer}>
          <Text style={styles.emptyText}>{t('history.empty')}</Text>
        </View>
      ) : (
        <FlatList
          data={records}
          renderItem={renderItem}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.list}
          onRefresh={loadHistory}
          refreshing={loading}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    padding: 16,
    paddingBottom: 8,
  },
  list: { padding: 16, paddingTop: 8 },
  card: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  thumbnail: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
  },
  placeholder: {
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: { fontSize: 24 },
  cardContent: { flex: 1, justifyContent: 'center' },
  foodNames: { fontSize: 15, fontWeight: '600', color: '#333' },
  calories: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4CAF50',
    marginTop: 4,
  },
  date: { fontSize: 12, color: '#999', marginTop: 2 },
  emptyText: { fontSize: 16, color: '#999' },
})
