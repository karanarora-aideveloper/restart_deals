import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, useWindowDimensions, LayoutAnimation, UIManager } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import WebFooter from './WebFooter';
import { API_BASE_URL } from '../config';
import { CATEGORY_TAXONOMY } from '../data/categoryTaxonomy';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Subcategory grid on the right panel is a fixed 3-across layout — tile width is measured off
// the grid's actual rendered width (not guessed as a %) so 3 columns always fit edge-to-edge
// with no wasted margin, however wide the device is.
const GRID_COLUMNS = 3;
const GRID_GAP = 12;

/**
 * Browse tab: a pure category → subcategory browser, modeled on Flipkart's own Categories
 * screen — nothing else on this page. Real top-level categories (the exact set the backend's
 * AI classifier actually assigns — see categoryTaxonomy.js) sit in a vertically scrollable rail
 * on mobile/native; tapping one swaps the subcategory grid on the right. Desktop web keeps an
 * accordion list since a side rail doesn't suit a wide viewport. Live per-category deal counts
 * are fetched from the real API instead of hardcoded numbers.
 */
export default function CategoriesView({ onSelectCategory, setActiveTab }) {
  const { width } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === 'web' && width > 768;
  const [expandedId, setExpandedId] = useState(null);
  const [selectedCatId, setSelectedCatId] = useState(CATEGORY_TAXONOMY[0]?.id);
  const [counts, setCounts] = useState({});
  const [gridWidth, setGridWidth] = useState(0);
  const tileSize = gridWidth > 0 ? (gridWidth - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS : null;

  useEffect(() => {
    let cancelled = false;
    CATEGORY_TAXONOMY.forEach(async (cat) => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/deals?category=${cat.id}&limit=1&country=in`);
        const json = await res.json();
        const total = json.pagination?.total;
        if (!cancelled && typeof total === 'number') {
          setCounts((prev) => ({ ...prev, [cat.id]: total }));
        }
      } catch (err) {
        // Live count is a nice-to-have — silently skip on failure, card just omits the number.
      }
    });
    return () => { cancelled = true; };
  }, []);

  const toggleExpand = (catId) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedId((prev) => (prev === catId ? null : catId));
  };

  const selectRailCategory = (catId) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSelectedCatId(catId);
  };

  const handleShopAll = (cat) => {
    onSelectCategory(cat.id, '', '');
  };

  const handleSubcategory = (cat, sub) => {
    onSelectCategory(cat.id, sub.id, `${cat.label.split(' & ')[0]} · ${sub.label}`);
  };

  if (isDesktopWeb) {
    return (
      <ScrollView style={styles.container}>
        <View style={styles.contentPaddingDesktop}>
          <Text style={styles.sectionHeader} accessibilityRole="heading" aria-level={2}>Browse by Category</Text>
          <Text style={styles.sectionSub}>Tap a category to explore its subcategories</Text>

          <View style={styles.categoryList}>
            {CATEGORY_TAXONOMY.map((cat) => {
              const isExpanded = expandedId === cat.id;
              const count = counts[cat.id];
              return (
                <View key={cat.id} style={styles.categoryCard}>
                  <TouchableOpacity
                    style={styles.categoryHeader}
                    activeOpacity={0.7}
                    onPress={() => toggleExpand(cat.id)}
                  >
                    <View style={[styles.iconWrapper, { backgroundColor: cat.bgColor }]}>
                      <Ionicons name={cat.icon} size={22} color={cat.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.catName}>{cat.label}</Text>
                      <View style={styles.catCountRow}>
                        <View style={[styles.catCountDot, { backgroundColor: cat.color }]} />
                        <Text style={styles.catCount}>
                          {typeof count === 'number' ? `${count.toLocaleString('en-IN')} deals` : 'Loading…'}
                        </Text>
                        <Text style={styles.subcatHint}>· {cat.subcategories.length} subcategories</Text>
                      </View>
                    </View>
                    <Ionicons
                      name={isExpanded ? 'chevron-up' : 'chevron-down'}
                      size={20}
                      color="#bbbbbb"
                    />
                  </TouchableOpacity>

                  {isExpanded && (
                    <View style={styles.subcategoryPanel}>
                      <TouchableOpacity
                        style={[styles.shopAllChip, { borderColor: cat.color }]}
                        activeOpacity={0.75}
                        onPress={() => handleShopAll(cat)}
                      >
                        <Ionicons name="albums-outline" size={13} color={cat.color} />
                        <Text style={[styles.shopAllChipText, { color: cat.color }]}>
                          Shop All {cat.label.split(' & ')[0]}
                        </Text>
                      </TouchableOpacity>

                      <View style={styles.subcategoryGrid}>
                        {cat.subcategories.map((sub) => (
                          <TouchableOpacity
                            key={sub.id}
                            style={styles.subcategoryChip}
                            activeOpacity={0.7}
                            onPress={() => handleSubcategory(cat, sub)}
                          >
                            {!!sub.icon && <Ionicons name={sub.icon} size={14} color="#777777" />}
                            <Text style={styles.subcategoryChipText}>{sub.label}</Text>
                            <Ionicons name="chevron-forward" size={13} color="#bbbbbb" />
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </View>
        <WebFooter setActiveTab={setActiveTab} />
      </ScrollView>
    );
  }

  const selectedCat = CATEGORY_TAXONOMY.find((c) => c.id === selectedCatId) || CATEGORY_TAXONOMY[0];

  return (
    <View style={styles.container}>
      <View style={styles.splitContainer}>
        {/* Left: vertically scrollable category rail */}
        <ScrollView
          style={styles.railColumn}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.railContent}
        >
          {CATEGORY_TAXONOMY.map((cat) => {
            const isSelected = cat.id === selectedCat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[styles.railItem, isSelected && styles.railItemActive]}
                activeOpacity={0.7}
                onPress={() => selectRailCategory(cat.id)}
              >
                {isSelected && <View style={[styles.railActiveBar, { backgroundColor: cat.color }]} />}
                <View
                  style={[
                    styles.railIconWrapper,
                    { backgroundColor: isSelected ? cat.bgColor : '#eeeeee' },
                    isSelected && { borderColor: cat.color },
                  ]}
                >
                  <Ionicons name={cat.icon} size={20} color={isSelected ? cat.color : '#999999'} />
                  {isSelected && (
                    <View style={[styles.railCheckBadge, { backgroundColor: cat.color }]}>
                      <Ionicons name="checkmark" size={9} color="#ffffff" />
                    </View>
                  )}
                </View>
                <Text
                  style={[styles.railLabel, isSelected && { color: cat.color, fontWeight: '800' }]}
                  numberOfLines={2}
                >
                  {cat.label.split(' & ')[0]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Right: subcategories for the selected category */}
        <ScrollView
          style={styles.panelColumn}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.panelContent}
        >
          <View style={styles.panelHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.panelTitle}>{selectedCat.label}</Text>
              <Text style={styles.panelCount}>
                {typeof counts[selectedCat.id] === 'number'
                  ? `${counts[selectedCat.id].toLocaleString('en-IN')} deals`
                  : 'Loading…'}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.shopAllButton, { backgroundColor: selectedCat.color }]}
            activeOpacity={0.85}
            onPress={() => handleShopAll(selectedCat)}
          >
            <Ionicons name="albums-outline" size={14} color="#ffffff" />
            <Text style={styles.shopAllButtonText}>
              Shop All {selectedCat.label.split(' & ')[0]}
            </Text>
            <Ionicons name="arrow-forward" size={14} color="#ffffff" />
          </TouchableOpacity>

          <View
            style={styles.subcategoryGridPanel}
            onLayout={(e) => setGridWidth(e.nativeEvent.layout.width)}
          >
            {selectedCat.subcategories.map((sub) => (
              <TouchableOpacity
                key={sub.id}
                style={[styles.subcategoryTile, tileSize != null && { width: tileSize }]}
                activeOpacity={0.65}
                onPress={() => handleSubcategory(selectedCat, sub)}
              >
                <View
                  style={[
                    styles.subcategoryTileIcon,
                    { backgroundColor: selectedCat.bgColor },
                    tileSize != null && { width: tileSize * 0.8, height: tileSize * 0.8, borderRadius: tileSize * 0.24 },
                  ]}
                >
                  <Ionicons
                    name={sub.icon || 'pricetag-outline'}
                    size={tileSize != null ? Math.round(tileSize * 0.34) : 22}
                    color={selectedCat.color}
                  />
                </View>
                <Text style={styles.subcategoryTileText} numberOfLines={2}>{sub.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  contentPaddingDesktop: {
    maxWidth: 1440,
    width: '100%',
    alignSelf: 'center',
    padding: 24,
    paddingBottom: 60,
  },

  // Section Headers (desktop web only)
  sectionHeader: {
    color: '#1a1a1a',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.1,
  },
  sectionSub: {
    color: '#999999',
    fontSize: 12,
    marginTop: 2,
    marginBottom: 14,
  },

  // Category accordion (desktop web only)
  categoryList: {
    gap: 10,
  },
  categoryCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    overflow: 'hidden',
    alignSelf: 'stretch',
    ...(Platform.OS === 'android' ? { elevation: 1 } : {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
    }),
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  iconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catName: {
    color: '#1a1a1a',
    fontSize: 14.5,
    fontWeight: '800',
    marginBottom: 4,
  },
  catCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexWrap: 'wrap',
  },
  catCountDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  catCount: {
    color: '#999999',
    fontSize: 11.5,
    fontWeight: '600',
  },
  subcatHint: {
    color: '#cccccc',
    fontSize: 11,
    fontWeight: '500',
  },

  subcategoryPanel: {
    paddingHorizontal: 14,
    paddingBottom: 16,
    paddingTop: 2,
    borderTopWidth: 1,
    borderTopColor: '#f5f5f5',
  },
  shopAllChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    borderWidth: 1.5,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginTop: 12,
    marginBottom: 10,
  },
  shopAllChipText: {
    fontSize: 12,
    fontWeight: '800',
  },
  subcategoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  subcategoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f8f8f8',
    borderWidth: 1,
    borderColor: '#eeeeee',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  subcategoryChipText: {
    color: '#444444',
    fontSize: 12.5,
    fontWeight: '600',
  },

  // Flipkart-style 2-column split: left category rail (scrollable), right subcategory panel
  // (scrollable). This is the entire native/mobile-web Browse screen — no other content.
  splitContainer: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#ffffff',
  },
  railColumn: {
    width: '25%',
    flexGrow: 0,
    flexShrink: 0,
    backgroundColor: '#fafafa',
    borderRightWidth: 1,
    borderRightColor: '#efefef',
  },
  railContent: {
    paddingVertical: 4,
  },
  railItem: {
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 6,
    gap: 7,
    position: 'relative',
  },
  railItemActive: {
    backgroundColor: '#ffffff',
  },
  railActiveBar: {
    position: 'absolute',
    left: 0,
    top: 8,
    bottom: 8,
    width: 3,
    borderRadius: 2,
  },
  railIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  railCheckBadge: {
    position: 'absolute',
    bottom: -3,
    right: -3,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#ffffff',
  },
  railLabel: {
    color: '#8a8a8a',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 14,
  },
  panelColumn: {
    flex: 1,
  },
  panelContent: {
    padding: 16,
    paddingBottom: 32,
  },
  panelHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  panelTitle: {
    color: '#1a1a1a',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.1,
  },
  panelCount: {
    color: '#999999',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  shopAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    paddingVertical: 12,
    marginTop: 14,
    marginBottom: 18,
    ...(Platform.OS === 'android' ? { elevation: 1 } : {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.12,
      shadowRadius: 6,
    }),
  },
  shopAllButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  subcategoryGridPanel: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
  },
  subcategoryTile: {
    width: '30%',
    alignItems: 'center',
    gap: 8,
  },
  subcategoryTileIcon: {
    width: 58,
    height: 58,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subcategoryTileText: {
    color: '#3a3a3a',
    fontSize: 11.5,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 14,
  },
});
