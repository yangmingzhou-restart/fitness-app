import { useState, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, StyleSheet,
  Image, ActivityIndicator, ScrollView, Alert,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useTranslation } from 'react-i18next';
import { saveFoodRecord } from '../services/storage';

interface ProductInfo {
  name: string;
  nameEn: string;
  brand: string;
  imageUrl: string;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  servingWeightG: number;
}

const OFF_SEARCH = 'https://cn.openfoodfacts.org/cgi/search.pl?search_simple=1&json=1&page_size=20&lc=zh';
const OFF_PRODUCT = 'https://cn.openfoodfacts.org/api/v2/product';
const OFF_SEARCH_FALLBACK = 'https://world.openfoodfacts.org/cgi/search.pl?search_simple=1&json=1&page_size=20&lc=zh';

function parseProduct(data: any): ProductInfo | null {
  const p = data?.product;
  if (!p || (!p.product_name && !p.generic_name && !p.product_name_zh)) return null;
  const nutriments = p.nutriments || {};
  const nameZh = p.product_name_zh || p.product_name || p.generic_name || '';
  const nameEn = p.product_name_en || p.product_name || '';
  return {
    name: nameZh || nameEn || 'Unknown',
    nameEn: nameEn || nameZh,
    brand: p.brands || p.brands_tags?.[0] || '',
    imageUrl: p.image_url || p.image_front_url || p.image_thumb_url || '',
    caloriesPer100g: Math.round(nutriments['energy-kcal_100g'] || nutriments.energy_100g || 0),
    proteinPer100g: Math.round((nutriments.proteins_100g || 0) * 10) / 10,
    carbsPer100g: Math.round((nutriments.carbohydrates_100g || 0) * 10) / 10,
    fatPer100g: Math.round((nutriments.fat_100g || 0) * 10) / 10,
    servingWeightG: p.product_quantity || p.quantity_value || 100,
  };
}

export default function BarcodeScreen() {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'scan' | 'search'>('scan');
  const [permission, requestPermission] = useCameraPermissions();
  const [product, setProduct] = useState<ProductInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [servings, setServings] = useState(1);
  const [saved, setSaved] = useState(false);
  const scannedRef = useRef(false);

  const lookupBarcode = useCallback(async (barcode: string) => {
    if (scannedRef.current) return;
    scannedRef.current = true;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${OFF_PRODUCT}/${barcode}.json`);
      const data = await res.json();
      const info = parseProduct(data);
      if (info) {
        setProduct(info);
        setServings(1);
        setSaved(false);
      } else {
        setError(t('barcode.notFound'));
      }
    } catch {
      setError(t('common.error'));
    } finally {
      setLoading(false);
      setTimeout(() => { scannedRef.current = false; }, 3000);
    }
  }, [t]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setError('');
    try {
      const q = encodeURIComponent(searchQuery.trim());
      // Try Chinese mirror first, fallback to global
      let res = await fetch(`${OFF_SEARCH}&search_terms=${q}`);
      let data = await res.json();
      if (!data.products || data.products.length === 0) {
        res = await fetch(`${OFF_SEARCH_FALLBACK}&search_terms=${q}`);
        data = await res.json();
      }
      setSearchResults(data.products || []);
    } catch {
      setError(t('common.error'));
    } finally {
      setSearching(false);
    }
  };

  const selectSearchResult = (item: any) => {
    const info = parseProduct({ product: item });
    if (info) {
      setProduct(info);
      setServings(1);
      setSaved(false);
      setMode('scan'); // switch to show product card
    }
  };

  const handleSave = async () => {
    if (!product) return;
    const weightG = product.servingWeightG * servings;
    const ratio = weightG / 100;
    const foodItem = {
      name: product.name,
      nameEn: product.nameEn,
      category: product.brand || '',
      categoryEn: product.brand || '',
      caloriesPerKg: product.caloriesPer100g * 10,
      estimatedWeightG: Math.round(weightG),
      estimatedCalories: Math.round(product.caloriesPer100g * ratio),
      confidence: 0.95,
      reasoning: 'Barcode scan',
      macros: {
        proteinG: Math.round(product.proteinPer100g * ratio * 10) / 10,
        carbsG: Math.round(product.carbsPer100g * ratio * 10) / 10,
        fatG: Math.round(product.fatPer100g * ratio * 10) / 10,
        proteinGPer100g: product.proteinPer100g,
        carbsGPer100g: product.carbsPer100g,
        fatGPer100g: product.fatPer100g,
      },
    };
    await saveFoodRecord({
      id: `barcode_${Date.now()}`,
      imageThumbnail: product.imageUrl || '',
      foods: [foodItem],
      totalCalories: Math.round(product.caloriesPer100g * ratio),
      totalMacros: {
        proteinG: foodItem.macros!.proteinG,
        carbsG: foodItem.macros!.carbsG,
        fatG: foodItem.macros!.fatG,
      },
      createdAt: new Date().toISOString(),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const resetProduct = () => {
    setProduct(null);
    setError('');
  };

  if (mode === 'scan' && !permission?.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.permissionText}>{t('barcode.permissionMessage')}</Text>
        <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission}>
          <Text style={styles.permissionBtnText}>{t('barcode.permissionTitle')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Mode toggle */}
      <View style={styles.toggleRow}>
        <TouchableOpacity
          style={[styles.toggleBtn, mode === 'scan' && styles.toggleBtnActive]}
          onPress={() => setMode('scan')}
        >
          <Text style={[styles.toggleText, mode === 'scan' && styles.toggleTextActive]}>
            {t('barcode.scanMode')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleBtn, mode === 'search' && styles.toggleBtnActive]}
          onPress={() => setMode('search')}
        >
          <Text style={[styles.toggleText, mode === 'search' && styles.toggleTextActive]}>
            {t('barcode.searchMode')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Scan mode */}
      {mode === 'scan' && !product && (
        <View style={styles.scanContainer}>
          <CameraView
            style={styles.camera}
            facing="back"
            barcodeScannerSettings={{
              barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code39', 'code128'],
            }}
            onBarcodeScanned={(result) => {
              if (result.data) lookupBarcode(result.data);
            }}
          />
          <View style={styles.scanOverlay}>
            <View style={styles.scanFrame}>
              <View style={[styles.scanCorner, styles.topLeft]} />
              <View style={[styles.scanCorner, styles.topRight]} />
              <View style={[styles.scanCorner, styles.bottomLeft]} />
              <View style={[styles.scanCorner, styles.bottomRight]} />
            </View>
            <Text style={styles.scanHint}>{t('barcode.scanHint')}</Text>
          </View>
          {loading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#4CAF50" />
              <Text style={styles.loadingText}>{t('barcode.loadingProduct')}</Text>
            </View>
          )}
        </View>
      )}

      {/* Search mode */}
      {mode === 'search' && !product && (
        <View style={styles.searchContainer}>
          <View style={styles.searchRow}>
            <TextInput
              style={styles.searchInput}
              placeholder={t('barcode.searchPlaceholder')}
              placeholderTextColor="#666"
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearch}
            />
            <TouchableOpacity style={styles.searchBtn} onPress={handleSearch}>
              <Text style={styles.searchBtnText}>{t('barcode.searchBtn')}</Text>
            </TouchableOpacity>
          </View>
          {searching ? (
            <ActivityIndicator size="large" color="#4CAF50" style={{ marginTop: 40 }} />
          ) : (
            <ScrollView style={styles.searchResults}>
              {searchResults.map((item, i) => (
                <TouchableOpacity
                  key={item.code || i}
                  style={styles.searchCard}
                  onPress={() => selectSearchResult(item)}
                >
                  {item.image_thumb_url ? (
                    <Image source={{ uri: item.image_thumb_url }} style={styles.searchThumb} />
                  ) : (
                    <View style={[styles.searchThumb, styles.searchThumbPlaceholder]} />
                  )}
                  <View style={styles.searchInfo}>
                    <Text style={styles.searchName} numberOfLines={2}>
                      {item.product_name || item.generic_name || 'Unknown'}
                    </Text>
                    {item.brands ? (
                      <Text style={styles.searchBrand} numberOfLines={1}>{item.brands}</Text>
                    ) : null}
                    <Text style={styles.searchCal}>
                      {item.nutriments?.['energy-kcal_100g']
                        ? `${Math.round(item.nutriments['energy-kcal_100g'])} kcal/100g`
                        : ''}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
              {!searching && searchResults.length === 0 && searchQuery.length > 0 && (
                <Text style={styles.noResults}>{t('barcode.noResults')}</Text>
              )}
            </ScrollView>
          )}
        </View>
      )}

      {/* Error display */}
      {error && !product ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          {error === t('barcode.notFound') && (
            <Text style={styles.errorHint}>{t('barcode.notFoundHint')}</Text>
          )}
          <TouchableOpacity style={styles.retryBtn} onPress={resetProduct}>
            <Text style={styles.retryBtnText}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Product detail */}
      {product && (
        <ScrollView style={styles.productCard} contentContainerStyle={styles.productContent}>
          <TouchableOpacity style={styles.backBtn} onPress={resetProduct}>
            <Text style={styles.backBtnText}>← {t('common.back')}</Text>
          </TouchableOpacity>

          <View style={styles.productHeader}>
            {product.imageUrl ? (
              <Image source={{ uri: product.imageUrl }} style={styles.productImage} />
            ) : null}
            <Text style={styles.productName}>{product.name}</Text>
            {product.nameEn !== product.name ? (
              <Text style={styles.productNameEn}>{product.nameEn}</Text>
            ) : null}
            {product.brand ? (
              <Text style={styles.productBrand}>{t('barcode.brand')}: {product.brand}</Text>
            ) : null}
          </View>

          <View style={styles.nutritionCard}>
            <Text style={styles.nutritionTitle}>{t('barcode.perServing')} (100{t('common.gram')})</Text>
            <View style={styles.nutritionGrid}>
              <View style={styles.nutritionItem}>
                <Text style={styles.nutritionValue}>{product.caloriesPer100g}</Text>
                <Text style={styles.nutritionLabel}>{t('common.kcal')}</Text>
              </View>
              <View style={styles.nutritionItem}>
                <Text style={styles.nutritionValue}>{product.proteinPer100g}</Text>
                <Text style={styles.nutritionLabel}>{t('result.protein')}(g)</Text>
              </View>
              <View style={styles.nutritionItem}>
                <Text style={styles.nutritionValue}>{product.carbsPer100g}</Text>
                <Text style={styles.nutritionLabel}>{t('result.carbs')}(g)</Text>
              </View>
              <View style={styles.nutritionItem}>
                <Text style={styles.nutritionValue}>{product.fatPer100g}</Text>
                <Text style={styles.nutritionLabel}>{t('result.fat')}(g)</Text>
              </View>
            </View>
          </View>

          {/* Serving adjuster */}
          <View style={styles.servingCard}>
            <Text style={styles.servingLabel}>{t('barcode.servingSize')}</Text>
            <View style={styles.servingRow}>
              <TouchableOpacity
                style={styles.servingBtn}
                onPress={() => setServings((s) => Math.max(0.5, s - 0.5))}
              >
                <Text style={styles.servingBtnText}>−</Text>
              </TouchableOpacity>
              <View style={styles.servingDisplay}>
                <Text style={styles.servingValue}>{servings}</Text>
                <Text style={styles.servingUnit}>
                  {t('result.servings')} ({(product.servingWeightG * servings).toFixed(0)}g)
                </Text>
              </View>
              <TouchableOpacity
                style={styles.servingBtn}
                onPress={() => setServings((s) => Math.min(10, s + 0.5))}
              >
                <Text style={styles.servingBtnText}>+</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.totalCal}>
              {t('result.totalCalories')}: {Math.round(product.caloriesPer100g * servings * (product.servingWeightG / 100))} {t('common.kcal')}
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.saveBtn, saved && styles.saveBtnDone]}
            onPress={handleSave}
          >
            <Text style={styles.saveBtnText}>
              {saved ? t('barcode.saveSuccess') : t('barcode.saveToHistory')}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000', padding: 20 },
  permissionText: { color: '#fff', fontSize: 15, textAlign: 'center', marginBottom: 16 },
  permissionBtn: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  permissionBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  toggleRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    padding: 3,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  toggleBtnActive: { backgroundColor: '#4CAF50' },
  toggleText: { fontSize: 14, fontWeight: '600', color: '#888' },
  toggleTextActive: { color: '#fff' },
  scanContainer: { flex: 1, overflow: 'hidden' },
  camera: { flex: 1 },
  scanOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanFrame: {
    width: 250,
    height: 160,
    borderWidth: 0,
    position: 'relative',
  },
  scanCorner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: '#4CAF50',
  },
  topLeft: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 4 },
  topRight: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 4 },
  bottomLeft: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 4 },
  bottomRight: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 4 },
  scanHint: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    marginTop: 24,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 16,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: { color: '#fff', fontSize: 15, marginTop: 12 },
  searchContainer: { flex: 1, padding: 16 },
  searchRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  searchInput: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#fff',
  },
  searchBtn: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 20,
    borderRadius: 10,
    justifyContent: 'center',
  },
  searchBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  searchResults: { flex: 1 },
  searchCard: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    alignItems: 'center',
  },
  searchThumb: { width: 48, height: 48, borderRadius: 8, backgroundColor: '#333', marginRight: 12 },
  searchThumbPlaceholder: {},
  searchInfo: { flex: 1 },
  searchName: { fontSize: 15, fontWeight: '600', color: '#fff', marginBottom: 2 },
  searchBrand: { fontSize: 12, color: '#888', marginBottom: 2 },
  searchCal: { fontSize: 12, color: '#4CAF50' },
  noResults: { color: '#888', fontSize: 14, textAlign: 'center', marginTop: 40 },
  errorBox: { alignItems: 'center', padding: 20 },
  errorText: { color: '#E74C3C', fontSize: 15, textAlign: 'center' },
  errorHint: { color: '#888', fontSize: 13, marginTop: 8, textAlign: 'center' },
  retryBtn: {
    marginTop: 12,
    backgroundColor: '#4CAF50',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  productCard: { flex: 1, backgroundColor: '#111' },
  productContent: { padding: 16, paddingBottom: 40 },
  backBtn: { marginBottom: 12 },
  backBtnText: { color: '#4CAF50', fontSize: 14 },
  productHeader: { alignItems: 'center', marginBottom: 16 },
  productImage: { width: 160, height: 160, borderRadius: 12, backgroundColor: '#222', marginBottom: 12 },
  productName: { fontSize: 20, fontWeight: '700', color: '#fff', textAlign: 'center' },
  productNameEn: { fontSize: 14, color: '#888', marginTop: 4, textAlign: 'center' },
  productBrand: { fontSize: 13, color: '#888', marginTop: 4 },
  nutritionCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  nutritionTitle: { fontSize: 14, color: '#888', marginBottom: 10 },
  nutritionGrid: { flexDirection: 'row', justifyContent: 'space-around' },
  nutritionItem: { alignItems: 'center' },
  nutritionValue: { fontSize: 22, fontWeight: '700', color: '#4CAF50' },
  nutritionLabel: { fontSize: 12, color: '#888', marginTop: 2 },
  servingCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  servingLabel: { fontSize: 14, color: '#888', marginBottom: 10 },
  servingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20 },
  servingBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  servingBtnText: { fontSize: 22, color: '#fff', lineHeight: 24 },
  servingDisplay: { alignItems: 'center' },
  servingValue: { fontSize: 32, fontWeight: '700', color: '#fff' },
  servingUnit: { fontSize: 13, color: '#888', marginTop: 2 },
  totalCal: { fontSize: 15, fontWeight: '600', color: '#FF9800', textAlign: 'center', marginTop: 12 },
  saveBtn: {
    backgroundColor: '#4CAF50',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveBtnDone: { backgroundColor: '#888' },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
