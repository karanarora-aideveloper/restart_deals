import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TOP_LEVEL_CATEGORIES } from '../data/categoryTaxonomy';

// `icon` + `colors` are only used by the home screen's circular "Shop by Store" rail
// (StoreStrip in HomeSections.js, which imports this same list) — a store with a `logo` shows
// that inside its circle there, `icon` is the Ionicons fallback for the ones that don't
// (All Stores, Meesho). Exported so both surfaces stay backed by one list of merchant ids.
// `logoScale` corrects for the source images themselves: all three logo.webp files share the
// same 96x32 canvas, but Amazon's wordmark fills almost the whole frame while Flipkart's and
// Myntra's sit within visible padding — at identical display boxes with contentFit="contain",
// Amazon reads noticeably larger even though the box is the same size. Scaling its rendered
// image down (see wherever `logo` + `logoScale` are read together) puts all three at a matching
// apparent size instead of chasing it with a smaller box, which content-shifts non-Amazon logos.
export const MERCHANTS = [
  { id: 'all', label: 'All Stores', color: '#FF6B00', icon: 'storefront', colors: ['#FF6B00', '#c2410c'] },
  { id: 'amazon', label: '🛒 Amazon', color: '#FFB800', logo: require('../../assets/amazon.webp'), logoScale: 0.8, colors: ['#FFB800', '#B45309'] },
  { id: 'flipkart', label: '🛍️ Flipkart', color: '#2563eb', logo: require('../../assets/flipkart.webp'), colors: ['#2563eb', '#1e3a8a'] },
  { id: 'myntra', label: '👗 Myntra', color: '#FF6B00', logo: require('../../assets/myntra.webp'), colors: ['#FF6B00', '#9a3412'] },
  { id: 'nykaa', label: '💄 Nykaa', color: '#ec4899', icon: 'sparkles', colors: ['#ec4899', '#be185d'] },
  { id: 'ajio', label: '🕶️ Ajio', color: '#0f172a', icon: 'shirt', colors: ['#0f172a', '#334155'] },
  { id: 'meesho', label: '🎁 Meesho', color: '#9333ea', icon: 'gift', colors: ['#9333ea', '#6b21a8'] },
  { id: 'croma', label: '⚡ Croma', color: '#00b5b5', icon: 'flash', colors: ['#00b5b5', '#0f766e'] },
];

export default function FilterBar({
  searchQuery,
  setSearchQuery,
  categoryFilter,
  onSelectCategory,
  merchantFilter,
  setMerchantFilter,
  hideSearch = false,
  // The home screen has its own icon-based category strip, and the Deals ('hot') tab's category
  // pills were a redundant top row now that category is normally set via Home/Browse before
  // landing there — hidden on both. Still shown on Products, which has no strip of its own.
  hideCategories = false,
  // Home also has its own circular "Shop by Store" rail now (StoreStrip in HomeSections.js) —
  // same reasoning as hideCategories, these pills would just duplicate it there.
  hideMerchants = false,
}) {
  return (
    <View style={[styles.container, hideSearch && styles.containerDesktop]}>
      {/* Search Input (hidden on desktop web — lives in the top nav instead). Myntra-style: the
          app's own mark sits inside the pill itself instead of a plain magnifying-glass icon. */}
      {!hideSearch && (
        <View style={styles.searchBox}>
          <Image source={require('../../assets/icon.png')} style={styles.searchLogo} resizeMode="contain" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search deals, products, brands..."
            placeholderTextColor="#bbbbbb"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={16} color="#cccccc" />
            </TouchableOpacity>
          ) : null}
        </View>
      )}

      {/* Category Scroll Row */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.scrollRow, hideSearch && styles.scrollRowDesktop]}
      >
        {/* Myntra-style underline tabs — plain text, no filled pill, just a colored bottom
            border and matching text color on whichever one is active. */}
        {!hideCategories && TOP_LEVEL_CATEGORIES.map((cat) => {
          const isActive = categoryFilter === cat.id;
          return (
            <TouchableOpacity
              key={cat.id}
              style={[styles.categoryTab, isActive && { borderBottomColor: cat.color }]}
              onPress={() => onSelectCategory(cat.id)}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name={cat.icon} size={14} color={isActive ? cat.color : '#888888'} />
                <Text style={[styles.categoryTabText, isActive && { color: cat.color, fontWeight: '800' }]}>
                  {cat.label}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}

        {!hideCategories && !hideMerchants && <View style={styles.divider} />}

        {!hideMerchants && MERCHANTS.map((mer) => {
          const isActive = merchantFilter === mer.id;
          return (
            <TouchableOpacity
              key={mer.id}
              style={[
                styles.pill,
                isActive && (
                  mer.logo
                    ? { borderColor: mer.color, borderWidth: 2, backgroundColor: '#ffffff' }
                    : { backgroundColor: mer.color, borderColor: mer.color }
                ),
              ]}
              onPress={() => setMerchantFilter(isActive && mer.id !== 'all' ? 'all' : mer.id)}
            >
              {mer.logo ? (
                <Image
                  source={mer.logo}
                  style={{ height: 16, width: 45, transform: [{ scale: mer.logoScale || 1 }] }}
                  resizeMode="contain"
                />
              ) : (
                <Text style={[styles.pillText, isActive && styles.activePillText]}>
                  {mer.label}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

import { TextInput } from 'react-native';

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  containerDesktop: {
    paddingHorizontal: 0,
    paddingTop: 14,
    paddingBottom: 14,
    backgroundColor: 'transparent',
    borderBottomWidth: 0,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f7f7f7',
    borderRadius: 26,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#eeeeee',
    marginBottom: 10,
  },
  searchLogo: {
    width: 22,
    height: 22,
    borderRadius: 6,
    marginRight: 9,
  },
  searchInput: {
    flex: 1,
    color: '#1a1a1a',
    fontSize: 14,
    padding: 0,
  },
  scrollRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingBottom: 2,
  },
  scrollRowDesktop: {
    gap: 10,
    paddingVertical: 2,
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e8e8e8',
  },
  pillText: {
    color: '#555555',
    fontSize: 11.5,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  activePillText: {
    color: '#ffffff',
    fontWeight: '800',
  },
  categoryTab: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomWidth: 2.5,
    borderBottomColor: 'transparent',
  },
  categoryTabText: {
    color: '#666666',
    fontSize: 11.5,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  divider: {
    width: 1,
    height: 18,
    backgroundColor: '#e8e8e8',
    marginHorizontal: 4,
  },
});
