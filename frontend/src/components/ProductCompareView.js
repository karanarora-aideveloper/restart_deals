import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Switch,
  Platform,
  Linking,
  useWindowDimensions
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { compareProductList, extractBrandFromTitle } from '../utils/specExtractor';
import AddCompareProductModal from './AddCompareProductModal';
import { logEvent } from '../utils/analytics';

import { buildAffiliateUrl as getAffiliateUrl } from '../utils/affiliate';

export default function ProductCompareView({
  compareItems = [],
  onRemoveItem,
  onClearAll,
  onAddProduct,
  onNavigateBack,
}) {
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;
  const [highlightDiffs, setHighlightDiffs] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [copiedToast, setCopiedToast] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState({});

  const comparisonData = useMemo(() => {
    return compareProductList(compareItems);
  }, [compareItems]);

  const { items, sections, diffs, lowestPrice, highestDiscount, highestRating } = comparisonData;

  const toggleSection = (secId) => {
    setCollapsedSections(prev => ({ ...prev, [secId]: !prev[secId] }));
  };

  const handleBuyClick = async (url, title) => {
    if (!url) return;
    logEvent('compare_buy_click', { item_name: title });
    const finalUrl = getAffiliateUrl(url);
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.open(finalUrl, '_blank', 'noopener,noreferrer');
    } else {
      try {
        await Linking.openURL(finalUrl);
      } catch (err) {
        console.error('Failed to open link:', err);
      }
    }
  };

  const handleShareLink = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const pids = compareItems.map(p => p._id || p.productId).join(',');
      const shareUrl = `${window.location.origin}/?tab=compare&pids=${encodeURIComponent(pids)}`;
      if (navigator.clipboard) {
        navigator.clipboard.writeText(shareUrl);
        setCopiedToast(true);
        setTimeout(() => setCopiedToast(false), 2500);
      }
    }
  };

  // Compute column width based on number of items
  const colCount = Math.max(items.length, 2);
  const colWidth = isDesktop ? Math.max(260, Math.floor((Math.min(width, 1440) - 220) / Math.min(colCount, 4))) : 220;

  if (!items || items.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyCard}>
          <Ionicons name="git-compare-outline" size={64} color="#FF6B00" />
          <Text style={styles.emptyTitle}>No Products Selected for Comparison</Text>
          <Text style={styles.emptyDesc}>
            Add 2 to 4 smartphones, 4K TVs, performance laptops, or audio devices to compare specs and multi-store prices side-by-side.
          </Text>
          <TouchableOpacity
            onPress={() => setModalOpen(true)}
            style={styles.emptyCta}
            activeOpacity={0.85}
          >
            <Ionicons name="add-circle" size={18} color="#fff" style={{ marginRight: 6 }} />
            <Text style={styles.emptyCtaText}>Select High-Ticket Products</Text>
          </TouchableOpacity>
        </View>

        <AddCompareProductModal
          visible={modalOpen}
          onClose={() => setModalOpen(false)}
          onSelectProduct={onAddProduct}
          currentProductIds={[]}
        />
      </View>
    );
  }

  return (
    <View style={styles.pageContainer}>
      {/* Top Banner & Navigation Header */}
      <View style={styles.topControlBar}>
        <View style={styles.topControlLeft}>
          <TouchableOpacity onPress={onNavigateBack} style={styles.backBtn} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={18} color="#374151" />
            <Text style={styles.backBtnText}>Back to Catalog</Text>
          </TouchableOpacity>
          <View style={styles.titleGroup}>
            <Text style={styles.mainTitle}>Tech & Electronics Comparison</Text>
            <Text style={styles.itemCountBadge}>{items.length} of 4 Products</Text>
          </View>
        </View>

        {/* Action Controls */}
        <View style={styles.topControlRight}>
          {/* Highlight Differences Switch */}
          <View style={styles.switchWrap}>
            <Text style={styles.switchLabel}>Highlight Differences</Text>
            <Switch
              value={highlightDiffs}
              onValueChange={setHighlightDiffs}
              trackColor={{ false: '#d1d5db', true: '#FF6B00' }}
              thumbColor="#ffffff"
            />
          </View>

          {/* Add Slot Button (if < 4 items) */}
          {items.length < 4 && (
            <TouchableOpacity
              onPress={() => setModalOpen(true)}
              style={styles.addSlotBtn}
              activeOpacity={0.8}
            >
              <Ionicons name="add" size={16} color="#4f46e5" />
              <Text style={styles.addSlotBtnText}>+ Add Product</Text>
            </TouchableOpacity>
          )}

          {/* Share Link Button */}
          <TouchableOpacity onPress={handleShareLink} style={styles.shareBtn} activeOpacity={0.7}>
            <Ionicons name="share-social-outline" size={15} color="#374151" />
            <Text style={styles.shareBtnText}>{copiedToast ? 'Copied Link!' : 'Share'}</Text>
          </TouchableOpacity>

          {/* Clear All */}
          <TouchableOpacity onPress={onClearAll} style={styles.clearAllBtn} activeOpacity={0.7}>
            <Ionicons name="trash-outline" size={15} color="#ef4444" />
            <Text style={styles.clearAllText}>Clear All</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Comparison Matrix (Horizontal Scroll on Mobile, Full Width Table on Desktop) */}
      <ScrollView horizontal showsHorizontalScrollIndicator={true} style={styles.tableScroll} contentContainerStyle={styles.tableContent}>
        <View style={styles.tableWrap}>
          {/* 1. STICKY TOP PRODUCT HEADER ROW */}
          <View style={styles.headerRow}>
            {/* Left Label Column */}
            <View style={[styles.labelCol, { width: 180 }]}>
              <Text style={styles.colHeaderTitle}>Products & Specs</Text>
              <Text style={styles.colHeaderSub}>Side-by-side spec match</Text>
            </View>

            {/* Product Columns */}
            {items.map((item, idx) => {
              const prod = item.raw;
              const specs = item.specs;
              const brand = specs.brand;
              const price = specs.pricingStore.currentPrice;
              const origPrice = specs.pricingStore.originalPrice;
              const discount = specs.pricingStore.discountPct;
              const isLowestPrice = price > 0 && price === lowestPrice && items.length > 1;
              const isHighestRating = parseFloat(specs.pricingStore.rating) === highestRating && highestRating > 4.0;
              const merchant = (prod.merchant || 'Amazon').toLowerCase();
              const storeColor = merchant.includes('amazon') ? '#FFB800' : (merchant.includes('flipkart') ? '#2874F0' : '#e11d48');

              return (
                <View key={prod._id || prod.productId || idx} style={[styles.productHeaderCell, { width: colWidth }]}>
                  {/* Remove Button */}
                  <TouchableOpacity
                    onPress={() => onRemoveItem(prod._id || prod.productId)}
                    style={styles.removeSlotBtn}
                    title="Remove from comparison"
                  >
                    <Ionicons name="close" size={14} color="#666" />
                  </TouchableOpacity>

                  {/* Thumbnail */}
                  <View style={styles.headerImgWrap}>
                    {prod.imageUrl ? (
                      <ExpoImage source={{ uri: prod.imageUrl }} style={styles.headerImg} contentFit="contain" />
                    ) : (
                      <Ionicons name="cube-outline" size={40} color="#ccc" />
                    )}
                  </View>

                  {/* Brand & Badges */}
                  <View style={styles.headerBadgeRow}>
                    <Text style={styles.productBrandBadge}>{brand}</Text>
                    {isLowestPrice && (
                      <View style={styles.bestPriceBadge}>
                        <Ionicons name="sparkles" size={10} color="#065f46" />
                        <Text style={styles.bestPriceText}>Lowest Price</Text>
                      </View>
                    )}
                  </View>

                  {/* Title */}
                  <Text numberOfLines={2} style={styles.productHeaderTitle}>{prod.title}</Text>

                  {/* Pricing Row */}
                  <View style={styles.headerPriceRow}>
                    <Text style={styles.headerCurrentPrice}>₹{price.toLocaleString('en-IN')}</Text>
                    {origPrice && origPrice > price && (
                      <Text style={styles.headerOrigPrice}>₹{origPrice.toLocaleString('en-IN')}</Text>
                    )}
                    {discount && discount > 0 ? (
                      <View style={styles.headerDiscountBadge}>
                        <Text style={styles.headerDiscountText}>{discount}% OFF</Text>
                      </View>
                    ) : null}
                  </View>

                  {/* Rating & Verified Scrape */}
                  <View style={styles.headerRatingRow}>
                    <View style={styles.starBadge}>
                      <Ionicons name="star" size={11} color="#f59e0b" />
                      <Text style={styles.starText}>{specs.pricingStore.rating}</Text>
                    </View>
                    <Text style={styles.storePillBadge}>{specs.pricingStore.merchant}</Text>
                  </View>

                  {/* Buy Button */}
                  <TouchableOpacity
                    onPress={() => handleBuyClick(specs.pricingStore.cleanUrl, prod.title)}
                    style={[styles.buyBtn, { backgroundColor: storeColor }]}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.buyBtnText, { color: merchant.includes('amazon') ? '#7a5200' : '#fff' }]}>
                      Buy on {specs.pricingStore.merchant}
                    </Text>
                    <Ionicons
                      name="open-outline"
                      size={13}
                      color={merchant.includes('amazon') ? '#7a5200' : '#fff'}
                      style={{ marginLeft: 4 }}
                    />
                  </TouchableOpacity>
                </View>
              );
            })}

            {/* Empty Slot Placeholder if < 4 items */}
            {items.length < 4 && (
              <TouchableOpacity
                onPress={() => setModalOpen(true)}
                style={[styles.emptySlotCell, { width: colWidth }]}
                activeOpacity={0.7}
              >
                <View style={styles.emptySlotCircle}>
                  <Ionicons name="add" size={28} color="#FF6B00" />
                </View>
                <Text style={styles.emptySlotTitle}>+ Add Product</Text>
                <Text style={styles.emptySlotSub}>Compare up to 4 devices</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* 2. SPECIFICATION SECTIONS (ACCORDIONS) */}
          {sections.map(section => {
            const isCollapsed = collapsedSections[section.id];
            // Get all unique spec keys for this section
            const allKeys = new Set();
            items.forEach(item => {
              const secData = item.specs[section.id] || {};
              Object.keys(secData).forEach(k => allKeys.add(k));
            });
            const keyList = Array.from(allKeys);

            if (keyList.length === 0) return null;

            return (
              <View key={section.id} style={styles.sectionBlock}>
                {/* Section Header */}
                <TouchableOpacity
                  onPress={() => toggleSection(section.id)}
                  style={styles.sectionHeader}
                  activeOpacity={0.8}
                >
                  <Text style={styles.sectionTitle}>{section.title}</Text>
                  <Ionicons
                    name={isCollapsed ? 'chevron-down' : 'chevron-up'}
                    size={18}
                    color="#4b5563"
                  />
                </TouchableOpacity>

                {/* Section Rows */}
                {!isCollapsed && keyList.map((specKey, rowIdx) => {
                  const diffKey = `${section.id}_${specKey}`;
                  const isDiff = diffs[diffKey];
                  const shouldHighlight = highlightDiffs && isDiff;
                  const isDimmed = highlightDiffs && !isDiff;

                  return (
                    <View
                      key={specKey}
                      style={[
                        styles.specRow,
                        rowIdx % 2 === 1 && styles.specRowEven,
                        shouldHighlight && styles.specRowHighlighted,
                        isDimmed && styles.specRowDimmed,
                      ]}
                    >
                      {/* Row Label */}
                      <View style={[styles.labelCol, { width: 180 }]}>
                        <Text style={styles.specLabelText}>{specKey}</Text>
                        {shouldHighlight && (
                          <View style={styles.diffPill}>
                            <Text style={styles.diffPillText}>Differs</Text>
                          </View>
                        )}
                      </View>

                      {/* Product Values */}
                      {items.map((item, idx) => {
                        const val = item.specs[section.id]?.[specKey] ?? '—';
                        return (
                          <View
                            key={item.raw._id || idx}
                            style={[
                              styles.specValueCell,
                              { width: colWidth },
                              shouldHighlight && styles.specValueHighlighted
                            ]}
                          >
                            <Text style={[styles.specValueText, shouldHighlight && styles.specValueTextHighlighted]}>
                              {String(val)}
                            </Text>
                          </View>
                        );
                      })}

                      {/* Empty Column spacer */}
                      {items.length < 4 && (
                        <View style={[styles.specValueCell, { width: colWidth }]} />
                      )}
                    </View>
                  );
                })}
              </View>
            );
          })}

          {/* 3. AMAZON ASSOCIATES COMPLIANCE DISCLAIMER */}
          <View style={styles.disclaimerContainer}>
            <View style={styles.disclaimerInner}>
              <Ionicons name="information-circle-outline" size={18} color="#6b7280" style={{ marginTop: 2, marginRight: 8 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.disclaimerTitle}>Affiliate & Price Accuracy Disclosure</Text>
                <Text style={styles.disclaimerText}>
                  Product prices and availability are accurate as of the date/time indicated and are subject to change. Any price and availability information displayed on Amazon.in, Flipkart, or respective merchant stores at the time of purchase will apply to the purchase of this product. As an affiliate partner, we may earn a commission from qualifying purchases made through our links at no extra cost to you.
                </Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Add Product Modal */}
      <AddCompareProductModal
        visible={modalOpen}
        onClose={() => setModalOpen(false)}
        onSelectProduct={onAddProduct}
        currentProductIds={items.map(i => String(i.raw._id || i.raw.productId))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  pageContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
    minHeight: '100vh',
  },
  topControlBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingHorizontal: 24,
    paddingVertical: 14,
    gap: 16,
  },
  topControlLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  backBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#334155',
  },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  mainTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: -0.3,
  },
  itemCountBadge: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FF6B00',
    backgroundColor: '#fff7ed',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ffedd5',
  },
  topControlRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  switchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f8fafc',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  switchLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  addSlotBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#eef2ff',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#c7d2fe',
  },
  addSlotBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4f46e5',
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  shareBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  clearAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
  },
  clearAllText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ef4444',
  },
  tableScroll: {
    flex: 1,
  },
  tableContent: {
    padding: 24,
  },
  tableWrap: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
  },
  headerRow: {
    flexDirection: 'row',
    borderBottomWidth: 2,
    borderBottomColor: '#cbd5e1',
    backgroundColor: '#ffffff',
  },
  labelCol: {
    padding: 16,
    borderRightWidth: 1,
    borderRightColor: '#e2e8f0',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
  },
  colHeaderTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0f172a',
  },
  colHeaderSub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  productHeaderCell: {
    position: 'relative',
    padding: 16,
    borderRightWidth: 1,
    borderRightColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
  removeSlotBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  headerImgWrap: {
    width: '100%',
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  headerImg: {
    width: '100%',
    height: '100%',
  },
  headerBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  productBrandBadge: {
    fontSize: 11,
    fontWeight: '800',
    color: '#4f46e5',
    textTransform: 'uppercase',
  },
  bestPriceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#d1fae5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  bestPriceText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#065f46',
  },
  productHeaderTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e293b',
    lineHeight: 17,
    minHeight: 34,
    marginBottom: 8,
  },
  headerPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  headerCurrentPrice: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0f172a',
  },
  headerOrigPrice: {
    fontSize: 12,
    color: '#94a3b8',
    textDecorationLine: 'line-through',
  },
  headerDiscountBadge: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  headerDiscountText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#dc2626',
  },
  headerRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  starBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#fef3c7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  starText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#92400e',
  },
  storePillBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  buyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
  },
  buyBtnText: {
    fontSize: 12,
    fontWeight: '800',
  },
  emptySlotCell: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: '#e2e8f0',
    backgroundColor: '#fafbfc',
  },
  emptySlotCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#fff7ed',
    borderWidth: 1.5,
    borderColor: '#fed7aa',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  emptySlotTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FF6B00',
  },
  emptySlotSub: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  sectionBlock: {
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  sectionTitle: {
    fontSize: 13.5,
    fontWeight: '900',
    color: '#1e293b',
    letterSpacing: 0.2,
  },
  specRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    minHeight: 44,
  },
  specRowEven: {
    backgroundColor: '#fafafa',
  },
  specRowHighlighted: {
    backgroundColor: '#eff6ff',
  },
  specRowDimmed: {
    opacity: 0.45,
  },
  specLabelText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  diffPill: {
    backgroundColor: '#dbeafe',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginTop: 3,
  },
  diffPillText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#1d4ed8',
  },
  specValueCell: {
    padding: 14,
    borderRightWidth: 1,
    borderRightColor: '#f1f5f9',
    justifyContent: 'center',
  },
  specValueHighlighted: {
    backgroundColor: 'rgba(59, 130, 246, 0.05)',
  },
  specValueText: {
    fontSize: 12.5,
    color: '#1e293b',
    fontWeight: '500',
    lineHeight: 17,
  },
  specValueTextHighlighted: {
    fontWeight: '700',
    color: '#0f172a',
  },
  disclaimerContainer: {
    padding: 18,
    backgroundColor: '#f8fafc',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  disclaimerInner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  disclaimerTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#374151',
    marginBottom: 4,
  },
  disclaimerText: {
    fontSize: 11,
    color: '#64748b',
    lineHeight: 16,
  },
  emptyContainer: {
    flex: 1,
    minHeight: 450,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 36,
    alignItems: 'center',
    maxWidth: 540,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 15,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0f172a',
    marginTop: 16,
    textAlign: 'center',
  },
  emptyDesc: {
    fontSize: 13.5,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 8,
    marginBottom: 24,
  },
  emptyCta: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF6B00',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: '#FF6B00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  emptyCtaText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  }
});
