import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { extractBrandFromTitle } from '../utils/specExtractor';

export default function CompareDock({
  compareItems = [],
  onRemoveItem,
  onClearAll,
  onCompareNow,
}) {
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;

  if (!compareItems || compareItems.length === 0) return null;

  return (
    <View style={[styles.dockContainer, isDesktop ? styles.dockDesktop : styles.dockMobile]}>
      <View style={styles.dockInner}>
        {/* Left Stats & Clear */}
        <View style={styles.leftMeta}>
          <View style={styles.badgeCount}>
            <Ionicons name="git-compare" size={14} color="#fff" />
            <Text style={styles.badgeText}>{compareItems.length}/4</Text>
          </View>
          <Text style={styles.dockTitle}>Compare</Text>
          <TouchableOpacity onPress={onClearAll} style={styles.clearBtn} activeOpacity={0.7}>
            <Text style={styles.clearText}>Clear</Text>
          </TouchableOpacity>
        </View>

        {/* Center Item Thumbs */}
        <View style={styles.thumbsRow}>
          {[0, 1, 2, 3].map((index) => {
            const item = compareItems[index];
            if (item) {
              const brand = extractBrandFromTitle(item.title);
              return (
                <View key={item._id || item.productId || index} style={styles.slotActive}>
                  <View style={styles.slotThumbWrap}>
                    {item.imageUrl ? (
                      <ExpoImage source={{ uri: item.imageUrl }} style={styles.slotThumb} contentFit="contain" />
                    ) : (
                      <Ionicons name="cube-outline" size={18} color="#888" />
                    )}
                  </View>
                  <TouchableOpacity
                    onPress={() => onRemoveItem(item._id || item.productId)}
                    style={styles.slotRemove}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="close" size={11} color="#fff" />
                  </TouchableOpacity>
                </View>
              );
            }
            return (
              <View key={`empty-${index}`} style={styles.slotEmpty}>
                <Ionicons name="add" size={14} color="#9ca3af" />
              </View>
            );
          })}
        </View>

        {/* Right CTA */}
        <TouchableOpacity
          disabled={compareItems.length < 2}
          onPress={onCompareNow}
          style={[styles.compareBtn, compareItems.length < 2 && styles.compareBtnDisabled]}
          activeOpacity={0.85}
        >
          <Text style={styles.compareBtnText}>
            {compareItems.length >= 2 ? `Compare Now (${compareItems.length})` : 'Add 1 More'}
          </Text>
          <Ionicons name="arrow-forward" size={14} color="#fff" style={{ marginLeft: 4 }} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dockContainer: {
    position: 'fixed',
    bottom: 24,
    left: 0,
    right: 0,
    zIndex: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'box-none',
  },
  dockDesktop: {
    paddingHorizontal: 20,
  },
  dockMobile: {
    bottom: 12,
    paddingHorizontal: 12,
  },
  dockInner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(17, 24, 39, 0.95)',
    borderRadius: 30,
    paddingVertical: 8,
    paddingHorizontal: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    backdropFilter: 'blur(12px)',
    gap: 12,
  },
  leftMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badgeCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FF6B00',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#fff',
  },
  dockTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#f3f4f6',
  },
  clearBtn: {
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  clearText: {
    fontSize: 11,
    color: '#9ca3af',
    textDecorationLine: 'underline',
  },
  thumbsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  slotActive: {
    position: 'relative',
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#fff',
    padding: 2,
    borderWidth: 1.5,
    borderColor: '#FF6B00',
  },
  slotThumbWrap: {
    width: '100%',
    height: '100%',
    borderRadius: 6,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotThumb: {
    width: '100%',
    height: '100%',
  },
  slotRemove: {
    position: 'absolute',
    top: -5,
    right: -5,
    width: 15,
    height: 15,
    borderRadius: 8,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotEmpty: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#4b5563',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  compareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF6B00',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
  },
  compareBtnDisabled: {
    backgroundColor: '#4b5563',
    opacity: 0.8,
  },
  compareBtnText: {
    color: '#fff',
    fontSize: 12.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  }
});
