import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, TouchableWithoutFeedback, Platform, useWindowDimensions, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PRICE_BUCKETS, DISCOUNT_TAGS, SORT_OPTIONS } from '../data/filterOptions';
import { TOP_LEVEL_CATEGORIES } from '../data/categoryTaxonomy';
import { MERCHANTS } from './FilterBar';

/**
 * Sort + Store + Filter control bar for the deals page — the 'deals' tab once it's left the home
 * view (a category, subcategory, price, or discount refinement is active; see App.js
 * `isHomeView`). Myntra-style floating capsule: three icon-over-label buttons in a pill that
 * hovers a fixed gap above BottomTabBar (see the `capsuleWrap` positioning + App.js's
 * `innerContainer` relative anchor) rather than sitting inline in the page flow. Sort and Store
 * apply the moment a row is tapped; Filter stages category/price/discount choices (scrollable —
 * category alone is 8 rows) in local draft state until "Apply" so browsing chips doesn't refetch
 * the list on every tap. A row of removable chips (rendered inline, not part of the floating
 * capsule) echoes back whichever of category/price/discount/merchant is currently active, each
 * with its own × to drop just that one refinement.
 * (The pre-existing subcategory breadcrumb chip in App.js is left as its own bar — it also
 * applies to the Hot/Products tabs, which this component intentionally does not touch.)
 */
export default function SortFilterBar({
  sortOption,
  onSelectSort,
  categoryFilter,
  priceFilter,
  discountFilter,
  merchantFilter,
  onSelectMerchant,
  onApplyFilters,
  onClearPrice,
  onClearDiscount,
  onClearMerchant,
  onClearCategory,
}) {
  const [sortModalOpen, setSortModalOpen] = useState(false);
  const [storeModalOpen, setStoreModalOpen] = useState(false);
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [draftPrice, setDraftPrice] = useState(priceFilter);
  const [draftDiscount, setDraftDiscount] = useState(discountFilter);
  // Unset is represented as null here (like draftPrice/draftDiscount), not 'all' — converted back
  // to 'all' only when actually applied (see applyFilters), matching categoryFilter's own sentinel.
  const [draftCategory, setDraftCategory] = useState(
    categoryFilter && categoryFilter !== 'all' ? categoryFilter : null
  );
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === 'web' && width > 768;
  // BottomTabBar isn't rendered on desktop web at all (see App.js) — float just off the viewport
  // edge there; everywhere else, clear its approximate height (icon+label+padding) plus the
  // device's own safe-area inset so the capsule never sits on top of it.
  const capsuleBottom = isDesktopWeb ? 24 : 66 + insets.bottom;

  const activeSort = SORT_OPTIONS.find((s) => s.key === sortOption) || SORT_OPTIONS[0];
  // 'all' is the unfiltered default merchantFilter value (see App.js) — not a real selection,
  // so it never earns a chip of its own.
  const activeMerchant = merchantFilter && merchantFilter !== 'all'
    ? MERCHANTS.find((m) => m.id === merchantFilter)
    : null;
  // 'all' is categoryFilter's own unfiltered default (see App.js) — same sentinel convention as
  // merchantFilter above.
  const activeCategory = categoryFilter && categoryFilter !== 'all'
    ? TOP_LEVEL_CATEGORIES.find((c) => c.id === categoryFilter)
    : null;
  const filterCount = (priceFilter ? 1 : 0) + (discountFilter ? 1 : 0) + (activeCategory ? 1 : 0);
  const hasChips = !!priceFilter || !!discountFilter || !!activeMerchant || !!activeCategory;

  const openFilterModal = () => {
    // Re-seed the draft from whatever's actually committed each time the sheet opens, so a
    // cancel-by-backdrop-tap after a previous edit never leaks a stale draft into the next open.
    setDraftPrice(priceFilter);
    setDraftDiscount(discountFilter);
    setDraftCategory(categoryFilter && categoryFilter !== 'all' ? categoryFilter : null);
    setFilterModalOpen(true);
  };

  const applyFilters = () => {
    onApplyFilters(draftPrice, draftDiscount, draftCategory || 'all');
    setFilterModalOpen(false);
  };

  // MERCHANTS' labels carry a decorative emoji prefix (see FilterBar.js) — stripped here so the
  // chip and the capsule's Store button both just read e.g. "Amazon".
  const activeMerchantLabel = activeMerchant ? activeMerchant.label.replace(/^[^\w]+\s*/, '') : null;

  return (
    <>
      {hasChips && (
        <View style={styles.chipsWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
            {!!activeCategory && <Chip label={activeCategory.label} onClear={onClearCategory} />}
            {!!priceFilter && <Chip label={priceFilter.label} onClear={onClearPrice} />}
            {!!discountFilter && <Chip label={discountFilter.label} onClear={onClearDiscount} />}
            {!!activeMerchant && <Chip label={activeMerchantLabel} onClear={onClearMerchant} />}
          </ScrollView>
        </View>
      )}

      {/* Floating Sort/Store/Filter capsule — hovers above BottomTabBar instead of sitting
          inline in the page flow (see App.js's `innerContainer` for the positioning anchor). */}
      <View style={[styles.capsuleWrap, { bottom: capsuleBottom }]} pointerEvents="box-none">
        <View style={styles.capsule}>
          <CapsuleBtn icon="swap-vertical" label="Sort" onPress={() => setSortModalOpen(true)} />
          <View style={styles.capsuleDivider} />
          <CapsuleBtn
            icon="storefront-outline"
            label={activeMerchantLabel || 'Store'}
            active={!!activeMerchant}
            onPress={() => setStoreModalOpen(true)}
          />
          <View style={styles.capsuleDivider} />
          <CapsuleBtn
            icon="options-outline"
            label="Filter"
            active={filterCount > 0}
            badge={filterCount > 0 ? filterCount : null}
            onPress={openFilterModal}
          />
        </View>
      </View>

      {/* Sort bottom sheet — single tap selects and closes, no separate Apply step needed. */}
      <Modal visible={sortModalOpen} transparent animationType="slide" onRequestClose={() => setSortModalOpen(false)}>
        <TouchableWithoutFeedback onPress={() => setSortModalOpen(false)}>
          <View style={styles.overlay}>
            <TouchableWithoutFeedback>
              <View style={styles.sheet}>
                <View style={styles.sheetHeader}>
                  <Text style={styles.sheetTitle}>Sort By</Text>
                  <TouchableOpacity style={styles.closeBtn} onPress={() => setSortModalOpen(false)}>
                    <Ionicons name="close" size={18} color="#666666" />
                  </TouchableOpacity>
                </View>
                {SORT_OPTIONS.map((opt) => {
                  const isActive = opt.key === sortOption;
                  return (
                    <TouchableOpacity
                      key={opt.key}
                      style={styles.sortRow}
                      activeOpacity={0.7}
                      onPress={() => { onSelectSort(opt.key); setSortModalOpen(false); }}
                    >
                      <Ionicons name={opt.icon} size={18} color={isActive ? '#FF6B00' : '#666666'} />
                      <Text style={[styles.sortRowText, isActive && styles.sortRowTextActive]}>{opt.label}</Text>
                      {isActive && <Ionicons name="checkmark-circle" size={18} color="#FF6B00" />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Filter bottom sheet — price + discount chips stage locally until Apply is pressed. */}
      <Modal visible={filterModalOpen} transparent animationType="slide" onRequestClose={() => setFilterModalOpen(false)}>
        <TouchableWithoutFeedback onPress={() => setFilterModalOpen(false)}>
          <View style={styles.overlay}>
            <TouchableWithoutFeedback>
              <View style={styles.sheet}>
                <View style={styles.sheetHeader}>
                  <Text style={styles.sheetTitle}>Filter Deals</Text>
                  <TouchableOpacity style={styles.closeBtn} onPress={() => setFilterModalOpen(false)}>
                    <Ionicons name="close" size={18} color="#666666" />
                  </TouchableOpacity>
                </View>

                {/* Category/Price/Discount can run to ~17 rows combined (8 categories alone) —
                    scrollable with a capped height so the header and Apply/Reset footer below
                    always stay reachable on shorter screens, instead of the sheet just growing
                    past the viewport. */}
                <ScrollView style={{ maxHeight: height * 0.5 }} showsVerticalScrollIndicator={false}>
                  <Text style={styles.sheetSectionLabel}>Category</Text>
                  <View style={styles.tagWrap}>
                    {TOP_LEVEL_CATEGORIES.filter((c) => c.id !== 'all').map((c) => (
                      <TagChip
                        key={c.id}
                        label={c.label}
                        active={draftCategory === c.id}
                        onPress={() => setDraftCategory((prev) => (prev === c.id ? null : c.id))}
                      />
                    ))}
                  </View>

                  <Text style={styles.sheetSectionLabel}>Price Range</Text>
                  <View style={styles.tagWrap}>
                    {PRICE_BUCKETS.map((b) => (
                      <TagChip
                        key={b.key}
                        label={b.label}
                        active={draftPrice?.key === b.key}
                        onPress={() => setDraftPrice((prev) => (prev?.key === b.key ? null : b))}
                      />
                    ))}
                  </View>

                  <Text style={styles.sheetSectionLabel}>Discount</Text>
                  <View style={styles.tagWrap}>
                    {DISCOUNT_TAGS.map((d) => (
                      <TagChip
                        key={d.key}
                        label={d.short}
                        active={draftDiscount?.key === d.key}
                        onPress={() => setDraftDiscount((prev) => (prev?.key === d.key ? null : d))}
                      />
                    ))}
                  </View>
                </ScrollView>

                <View style={styles.sheetFooter}>
                  <TouchableOpacity
                    style={styles.resetBtn}
                    activeOpacity={0.8}
                    onPress={() => { setDraftPrice(null); setDraftDiscount(null); setDraftCategory(null); }}
                  >
                    <Text style={styles.resetBtnText}>Reset</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.applyBtn} activeOpacity={0.85} onPress={applyFilters}>
                    <Text style={styles.applyBtnText}>Apply Filters</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Store bottom sheet — same single-tap-and-close pattern as Sort, applies immediately. */}
      <Modal visible={storeModalOpen} transparent animationType="slide" onRequestClose={() => setStoreModalOpen(false)}>
        <TouchableWithoutFeedback onPress={() => setStoreModalOpen(false)}>
          <View style={styles.overlay}>
            <TouchableWithoutFeedback>
              <View style={styles.sheet}>
                <View style={styles.sheetHeader}>
                  <Text style={styles.sheetTitle}>Shop by Store</Text>
                  <TouchableOpacity style={styles.closeBtn} onPress={() => setStoreModalOpen(false)}>
                    <Ionicons name="close" size={18} color="#666666" />
                  </TouchableOpacity>
                </View>
                {MERCHANTS.map((mer) => {
                  const isActive = merchantFilter === mer.id;
                  return (
                    <TouchableOpacity
                      key={mer.id}
                      style={styles.sortRow}
                      activeOpacity={0.7}
                      onPress={() => {
                        onSelectMerchant(isActive && mer.id !== 'all' ? 'all' : mer.id);
                        setStoreModalOpen(false);
                      }}
                    >
                      {mer.logo ? (
                        <Image
                          source={mer.logo}
                          style={{ height: 16, width: 45, transform: [{ scale: mer.logoScale || 1 }] }}
                          resizeMode="contain"
                        />
                      ) : (
                        <Ionicons name={mer.icon} size={18} color={isActive ? '#FF6B00' : '#666666'} />
                      )}
                      <Text style={[styles.sortRowText, isActive && styles.sortRowTextActive]}>
                        {mer.label.replace(/^[^\w]+\s*/, '')}
                      </Text>
                      {isActive && <Ionicons name="checkmark-circle" size={18} color="#FF6B00" />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </>
  );
}

function CapsuleBtn({ icon, label, active, badge, onPress }) {
  return (
    <TouchableOpacity style={styles.capsuleBtn} activeOpacity={0.75} onPress={onPress}>
      <View>
        <Ionicons name={icon} size={19} color={active ? '#FF6B00' : '#333333'} />
        {!!badge && (
          <View style={styles.capsuleBadge}>
            <Text style={styles.capsuleBadgeText}>{badge}</Text>
          </View>
        )}
      </View>
      <Text style={[styles.capsuleBtnLabel, active && styles.capsuleBtnLabelActive]} numberOfLines={1}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// Curated, funner subset of SORT_OPTIONS as one-tap shortcuts — Myntra's "Deal of the
// Day / Top Brands" outlined pill row above the grid, adapted to sort (which we already have
// keys for) instead of a second, separate filter dimension. Tapping the already-active pill
// resets to the default 'newest' sort — deselect, not a no-op — same toggle feel as a filter chip.
const QUICK_FILTERS = [
  { key: 'discount', label: 'Hot Deals', icon: 'flame' },
  { key: 'newest', label: 'New Arrivals', icon: 'sparkles' },
  { key: 'price_asc', label: 'Cheapest First', icon: 'cash' },
  { key: 'rating', label: 'Top Rated', icon: 'star' },
];

export function QuickFilterPills({ sortOption, onSelectSort }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      // A bare ScrollView as a direct flex-column child (here, of App.js's `innerContainer`,
      // which also has an explicit flex:1 main-content sibling) defaults to flexGrow:1 and ends
      // up splitting the screen's remaining height with that sibling — pin it to content height.
      style={styles.quickFilterScrollView}
      contentContainerStyle={styles.quickFilterRow}
    >
      {QUICK_FILTERS.map((qf) => {
        const isActive = sortOption === qf.key;
        return (
          <TouchableOpacity
            key={qf.key}
            style={[styles.quickFilterPill, isActive && styles.quickFilterPillActive]}
            activeOpacity={0.8}
            onPress={() => onSelectSort(isActive ? 'newest' : qf.key)}
          >
            <Ionicons name={qf.icon} size={13} color={isActive ? '#ffffff' : '#FF6B00'} style={{ marginRight: 5 }} />
            <Text style={[styles.quickFilterPillText, isActive && styles.quickFilterPillTextActive]}>
              {qf.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

function Chip({ label, onClear }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipText} numberOfLines={1}>{label}</Text>
      <TouchableOpacity onPress={onClear} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Ionicons name="close-circle" size={15} color="#c2410c" />
      </TouchableOpacity>
    </View>
  );
}

function TagChip({ label, active, onPress }) {
  return (
    <TouchableOpacity style={[styles.tagChip, active && styles.tagChipActive]} activeOpacity={0.8} onPress={onPress}>
      <Text style={[styles.tagChipText, active && styles.tagChipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chipsWrap: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    paddingBottom: 10,
  },
  // Floating capsule positioning — absolute within App.js's `innerContainer` (its nearest
  // `position: relative` ancestor), horizontally centered, vertical offset set inline via
  // `capsuleBottom` so it clears BottomTabBar. `pointerEvents="box-none"` lets touches in the
  // transparent margin around the pill fall through to the content scrolling underneath.
  capsuleWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 30,
  },
  capsule: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 30,
    paddingVertical: 8,
    paddingHorizontal: 6,
    ...(Platform.OS === 'android' ? { elevation: 10 } : Platform.OS === 'web' ? {
      boxShadow: '0 6px 20px rgba(0,0,0,0.16)',
    } : {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.16,
      shadowRadius: 12,
    }),
  },
  capsuleBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 2,
    gap: 3,
  },
  capsuleBtnLabel: {
    color: '#333333',
    fontSize: 10.5,
    fontWeight: '700',
  },
  capsuleBtnLabelActive: {
    color: '#FF6B00',
    fontWeight: '800',
  },
  capsuleDivider: {
    width: 1,
    height: 26,
    backgroundColor: '#eeeeee',
    alignSelf: 'center',
  },
  capsuleBadge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: '#FF6B00',
    borderRadius: 7,
    minWidth: 14,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  capsuleBadgeText: {
    color: '#ffffff',
    fontSize: 8.5,
    fontWeight: '800',
  },
  quickFilterScrollView: {
    flexGrow: 0,
    flexShrink: 0,
  },
  quickFilterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  quickFilterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e8e8e8',
  },
  quickFilterPillActive: {
    backgroundColor: '#FF6B00',
    borderColor: '#FF6B00',
  },
  quickFilterPillText: {
    color: '#444444',
    fontSize: 12,
    fontWeight: '700',
  },
  quickFilterPillTextActive: {
    color: '#ffffff',
    fontWeight: '800',
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 14,
    paddingTop: 10,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff4ed',
    borderWidth: 1,
    borderColor: '#ffddc0',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipText: {
    color: '#c2410c',
    fontSize: 12,
    fontWeight: '700',
    maxWidth: 160,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 30,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f2f2f2',
    marginBottom: 6,
  },
  sheetTitle: {
    color: '#1a1a1a',
    fontSize: 17,
    fontWeight: '800',
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  sortRowText: {
    flex: 1,
    color: '#333333',
    fontSize: 14.5,
    fontWeight: '600',
  },
  sortRowTextActive: {
    color: '#FF6B00',
    fontWeight: '800',
  },
  sheetSectionLabel: {
    color: '#999999',
    fontSize: 11.5,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: 14,
    marginBottom: 10,
  },
  tagWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
  },
  tagChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 18,
    backgroundColor: '#f7f7f7',
    borderWidth: 1.5,
    borderColor: '#eeeeee',
  },
  tagChipActive: {
    backgroundColor: '#fff4ed',
    borderColor: '#FF6B00',
  },
  tagChipText: {
    color: '#555555',
    fontSize: 12.5,
    fontWeight: '700',
  },
  tagChipTextActive: {
    color: '#c2410c',
    fontWeight: '800',
  },
  sheetFooter: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 22,
  },
  resetBtn: {
    paddingHorizontal: 20,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e2e2e2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetBtnText: {
    color: '#555555',
    fontSize: 14,
    fontWeight: '800',
  },
  applyBtn: {
    flex: 1,
    backgroundColor: '#FF6B00',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
});
