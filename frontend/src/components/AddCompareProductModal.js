import React, { useState, useEffect } from 'react';
import { View, Text, Modal, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { API_BASE_URL } from '../config';
import { extractBrandFromTitle, detectDeviceType } from '../utils/specExtractor';

const QUICK_CATEGORIES = [
  { id: 'all', label: 'All Tech' },
  { id: 'mobile', label: '📱 Mobiles' },
  { id: 'tv', label: '📺 Smart TVs' },
  { id: 'laptop', label: '💻 Laptops' },
  { id: 'audio', label: '🎧 Audio / TWS' },
  { id: 'appliance', label: '❄️ Appliances' },
];

export default function AddCompareProductModal({
  visible,
  onClose,
  onSelectProduct,
  currentProductIds = [],
}) {
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);

  useEffect(() => {
    if (visible) {
      fetchCandidates(search, activeCategory);
    }
  }, [visible, activeCategory]);

  const fetchCandidates = async (query = '', cat = 'all') => {
    setLoading(true);
    try {
      let url = `${API_BASE_URL}/api/products?limit=24`;
      if (query.trim()) {
        url += `&search=${encodeURIComponent(query.trim())}`;
      } else if (cat !== 'all') {
        if (cat === 'mobile') url += '&category=electronics&subcategory=mobiles-and-tablets';
        else if (cat === 'tv') url += '&category=electronics&subcategory=tv-and-entertainment';
        else if (cat === 'laptop') url += '&category=electronics&subcategory=laptops-and-computers';
        else if (cat === 'audio') url += '&category=electronics&subcategory=audio';
        else if (cat === 'appliance') url += '&category=home&subcategory=large-appliances';
        else url += '&category=electronics';
      } else {
        url += '&category=electronics';
      }

      const res = await fetch(url);
      const data = await res.json();
      if (data.success && Array.isArray(data.products)) {
        setResults(data.products);
      } else if (Array.isArray(data)) {
        setResults(data);
      }
    } catch (err) {
      console.error('Failed to fetch candidate compare products:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = () => {
    fetchCandidates(search, activeCategory);
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.modalCard, { width: isDesktop ? 680 : '94%', maxHeight: isDesktop ? '80%' : '90%' }]}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>Add Product to Compare</Text>
              <Text style={styles.headerSubtitle}>Select high-ticket electronics or search the catalog</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={22} color="#666" />
            </TouchableOpacity>
          </View>

          {/* Search Row */}
          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color="#999" style={{ marginRight: 8 }} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              onSubmitEditing={handleSearchSubmit}
              placeholder="Search Samsung Galaxy, OLED TV, MacBook, boAt..."
              placeholderTextColor="#aaa"
              style={styles.searchInput}
              returnKeyType="search"
            />
            {!!search && (
              <TouchableOpacity onPress={() => { setSearch(''); fetchCandidates('', activeCategory); }}>
                <Ionicons name="close-circle" size={18} color="#ccc" />
              </TouchableOpacity>
            )}
          </View>

          {/* Category Chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow} contentContainerStyle={{ paddingHorizontal: 16 }}>
            {QUICK_CATEGORIES.map(c => {
              const isSelected = activeCategory === c.id;
              return (
                <TouchableOpacity
                  key={c.id}
                  onPress={() => setActiveCategory(c.id)}
                  style={[styles.chip, isSelected && styles.chipActive]}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>{c.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Results List */}
          <View style={styles.listContainer}>
            {loading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="large" color="#FF6B00" />
                <Text style={styles.loadingText}>Finding best tech products...</Text>
              </View>
            ) : results.length === 0 ? (
              <View style={styles.emptyBox}>
                <Ionicons name="cube-outline" size={44} color="#ccc" />
                <Text style={styles.emptyText}>No matching products found</Text>
                <Text style={styles.emptySubText}>Try searching by brand or model name</Text>
              </View>
            ) : (
              <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
                {results.map(prod => {
                  const id = prod._id || prod.productId;
                  const isAlreadyAdded = currentProductIds.includes(String(id));
                  const brand = extractBrandFromTitle(prod.title);
                  const price = prod.price || prod.dealPrice;
                  const priceStr = price ? `₹${price.toLocaleString('en-IN')}` : 'Check Price';

                  return (
                    <TouchableOpacity
                      key={id}
                      disabled={isAlreadyAdded}
                      onPress={() => {
                        onSelectProduct(prod);
                        onClose();
                      }}
                      style={[styles.productRow, isAlreadyAdded && styles.productRowDisabled]}
                      activeOpacity={0.7}
                    >
                      <View style={styles.thumbWrap}>
                        {prod.imageUrl ? (
                          <ExpoImage source={{ uri: prod.imageUrl }} style={styles.thumb} contentFit="contain" />
                        ) : (
                          <Ionicons name="image-outline" size={24} color="#ccc" />
                        )}
                      </View>

                      <View style={styles.prodDetails}>
                        <View style={styles.badgeRow}>
                          <Text style={styles.brandBadge}>{brand}</Text>
                          <Text style={styles.storeBadge}>{(prod.merchant || 'Store').toUpperCase()}</Text>
                        </View>
                        <Text numberOfLines={2} style={styles.prodTitle}>{prod.title}</Text>
                        <Text style={styles.prodPrice}>{priceStr}</Text>
                      </View>

                      <View style={styles.actionWrap}>
                        {isAlreadyAdded ? (
                          <View style={styles.addedBadge}>
                            <Ionicons name="checkmark-circle" size={16} color="#10b981" />
                            <Text style={styles.addedText}>Added</Text>
                          </View>
                        ) : (
                          <View style={styles.addBtn}>
                            <Ionicons name="add" size={16} color="#fff" />
                            <Text style={styles.addBtnText}>Select</Text>
                          </View>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e5e5',
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 10,
    paddingHorizontal: 14,
    height: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#111',
    outlineStyle: 'none',
  },
  chipRow: {
    maxHeight: 38,
    marginBottom: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    marginRight: 8,
  },
  chipActive: {
    backgroundColor: '#FF6B00',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4b5563',
  },
  chipTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  listContainer: {
    flex: 1,
    minHeight: 280,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    marginBottom: 8,
    backgroundColor: '#ffffff',
  },
  productRowDisabled: {
    opacity: 0.6,
    backgroundColor: '#fafafa',
  },
  thumbWrap: {
    width: 52,
    height: 52,
    borderRadius: 8,
    backgroundColor: '#f8f8f8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  thumb: {
    width: '90%',
    height: '90%',
  },
  prodDetails: {
    flex: 1,
    marginRight: 10,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  brandBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: '#4f46e5',
    textTransform: 'uppercase',
  },
  storeBadge: {
    fontSize: 9,
    fontWeight: '700',
    color: '#6b7280',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  prodTitle: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#1f2937',
    lineHeight: 16,
  },
  prodPrice: {
    fontSize: 13,
    fontWeight: '800',
    color: '#111827',
    marginTop: 3,
  },
  actionWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#FF6B00',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  addBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  addedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  addedText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#10b981',
  },
  loadingBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 10,
    fontWeight: '600',
  },
  emptyBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
    marginTop: 8,
  },
  emptySubText: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 2,
  }
});
