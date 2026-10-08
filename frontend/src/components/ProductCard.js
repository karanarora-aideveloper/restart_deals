import React, { useState } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, Linking, Platform, useWindowDimensions } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { logEvent } from '../utils/analytics';
import { ensureGridCardHoverStyles } from '../utils/webHoverStyles';

ensureGridCardHoverStyles();

import { buildAffiliateUrl as getAffiliateUrl } from '../utils/affiliate';

/**
 * Myntra-style vertical grid card — image-forward, discount ribbon, compact
 * price row. Used in a 2-column grid on phones (native + mobile web) and a
 * density-scaled multi-column grid on desktop web.
 */
export default function ProductCard({
  product,
  isCompared = false,
  onToggleCompare,
  onImageUnavailable
}) {
  const [imgError, setImgError] = useState(false);
  const { width } = useWindowDimensions();
  const isCompact = width <= 640;

  const handleOpenProduct = async () => {
    if (!product.cleanUrl) return;

    logEvent('click_deal', { item_id: product._id || product.productId, item_name: product.title });

    if (Platform.OS !== 'web') {
      const finalUrl = getAffiliateUrl(product.cleanUrl);
      try {
        await Linking.openURL(finalUrl);
      } catch (err) {
        console.error('Failed to open link:', err);
      }
    }
  };

  const merchantString = (product.merchant || '').toLowerCase();
  const isAmazon = merchantString.includes('amazon') || merchantString.includes('amzn');
  const isFlipkart = merchantString.includes('flipkart') || merchantString.includes('fkrt') || merchantString.includes('fktr');
  const isMyntra = merchantString.includes('myntra');
  const isMeesho = merchantString.includes('meesho');

  const getMerchantStyle = () => {
    if (isAmazon) return { label: '🛒 Amazon', color: '#FFB800', logo: require('../../assets/amazon.webp') };
    if (isFlipkart) return { label: '🛍️ Flipkart', color: '#FFB800', logo: require('../../assets/flipkart.webp') };
    if (isMyntra) return { label: '👗 Myntra', color: '#e11d48', logo: require('../../assets/myntra.webp') };
    if (isMeesho) return { label: '🎁 Meesho', color: '#7c3aed' };
    if (merchantString.includes('nykaa')) return { label: '💄 Nykaa', color: '#ec4899' };
    if (merchantString.includes('ajio')) return { label: '🕶️ Ajio', color: '#0f172a' };
    if (merchantString.includes('croma')) return { label: '⚡ Croma', color: '#00b5b5' };
    return { label: '🏷️ ' + (product.merchant || 'Store').toUpperCase(), color: '#666' };
  };

  const merchant = getMerchantStyle();
  const priceDisplay = product.price ? `₹${product.price.toLocaleString('en-IN')}` : 'N/A';
  const origPriceDisplay = product.originalPrice ? `₹${product.originalPrice.toLocaleString('en-IN')}` : null;
  const savings = product.originalPrice && product.price ? product.originalPrice - product.price : null;
  const discountPct = savings && product.originalPrice ? Math.round((savings / product.originalPrice) * 100) : null;

  const timeDisplay = product.priceUpdatedAt
    ? new Date(product.priceUpdatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) +
      ' · ' +
      new Date(product.priceUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : 'Recently checked';

  const openBtnTextColor = merchant.color === '#FFB800' ? '#7a5200' : '#ffffff';
  // No point reserving a blank square (or a generic cube icon) for products that never got a
  // scraped/cached image — the image block only renders when there's a real image; its
  // discount/tracked badges move inline into the info section for imageless cards instead.
  const hasImage = !!product.imageUrl && !imgError;
  const hasDiscount = !!discountPct && discountPct > 0;

  return (
    <View style={styles.card} className="sd-grid-card">
      {hasImage && (
        <View style={styles.imageWrap}>
          <ExpoImage
            source={{ uri: product.imageUrl }}
            style={styles.productImage}
            className="sd-grid-image"
            contentFit="contain"
            transition={200}
            cachePolicy="memory-disk"
            recyclingKey={String(product._id || product.productId || product.imageUrl)}
            onError={() => {
              setImgError(true);
              if (onImageUnavailable) onImageUnavailable(product._id || product.productId);
            }}
            accessibilityLabel={product.title || 'Product Image'}
            alt={product.title || 'Product Image'}
          />

          {hasDiscount ? (
            <View style={[styles.discountRibbon, isCompact && styles.discountRibbonCompact]}>
              <Text style={[styles.discountRibbonText, isCompact && styles.discountRibbonTextCompact]}>
                {discountPct}% OFF
              </Text>
            </View>
          ) : null}

          {!isCompact && (
            <View style={styles.trackingBadge}>
              <Ionicons name="trending-up" size={11} color="#7c3aed" />
              <Text style={styles.trackingText}>Tracked</Text>
            </View>
          )}
        </View>
      )}

      <View style={[styles.info, isCompact && styles.infoCompact]}>
        {!hasImage && hasDiscount && (
          <View style={styles.noImageTopRow}>
            <View style={styles.discountPillInline}>
              <Text style={styles.discountRibbonText}>{discountPct}% OFF</Text>
            </View>
          </View>
        )}

        <View style={styles.merchantRow}>
          {merchant.logo ? (
            <Image source={merchant.logo} style={{ height: 12, width: 40 }} resizeMode="contain" />
          ) : (
            <Text style={styles.merchantLabel}>{merchant.label}</Text>
          )}
        </View>

        <Text
          style={[styles.title, isCompact && styles.titleCompact]}
          numberOfLines={2}
          accessibilityRole={Platform.OS === 'web' ? 'heading' : 'header'}
          aria-level={3}
        >
          {product.title || 'Product Item'}
        </Text>

        <View style={styles.priceRow}>
          <Text style={[styles.price, isCompact && styles.priceCompact]}>{priceDisplay}</Text>
          {origPriceDisplay ? <Text style={[styles.strike, isCompact && styles.strikeCompact]}>{origPriceDisplay}</Text> : null}
          {discountPct && discountPct > 0 ? (
            <Text style={[styles.discountPct, isCompact && styles.discountPctCompact]}>{discountPct}% off</Text>
          ) : null}
        </View>

        {!isCompact && (
          <View style={styles.metaRow}>
            <Ionicons name="time-outline" size={11} color="#aaaaaa" />
            <Text style={styles.metaText}>{timeDisplay}</Text>
          </View>
        )}

        {/* FlashList's grid mode gives every card in a row the same height — imageless cards
            end up taller than their own content. This spacer soaks up the extra space so the
            button sits flush at the bottom instead of leaving a void below it. */}
        <View style={{ flex: 1 }} />

        <TouchableOpacity
          style={[styles.buyBtn, isCompact && styles.buyBtnCompact, { backgroundColor: merchant.color }]}
          activeOpacity={0.85}
          onPress={handleOpenProduct}
          accessibilityRole="link"
          href={Platform.OS === 'web' ? getAffiliateUrl(product.cleanUrl) : undefined}
          hrefAttrs={{ target: '_blank', rel: 'noopener noreferrer' }}
        >
          <Ionicons name="open-outline" size={isCompact ? 11 : 13} color={openBtnTextColor} style={{ marginRight: 5 }} />
          <Text
            style={[styles.buyBtnText, isCompact && styles.buyBtnTextCompact, { color: openBtnTextColor }]}
            numberOfLines={1}
          >
            View on {(product.merchant || 'Store').split('.')[0]}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Myntra-style grid card styles ───────────────────────────────────────────
const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#efefef',
    overflow: 'hidden',
  },
  imageWrap: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#fafafa',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  productImage: {
    width: '78%',
    height: '78%',
  },
  noImageTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  discountPillInline: {
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  discountRibbon: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  discountRibbonText: {
    color: '#ffffff',
    fontSize: 10.5,
    fontWeight: '800',
  },
  discountRibbonCompact: {
    top: 6,
    left: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 5,
  },
  discountRibbonTextCompact: {
    fontSize: 9,
  },
  trackingBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#ddd6fe',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  trackingText: {
    color: '#7c3aed',
    fontSize: 9.5,
    fontWeight: '700',
  },
  info: {
    flex: 1,
    padding: 13,
  },
  infoCompact: {
    padding: 9,
  },
  merchantRow: {
    marginBottom: 6,
  },
  merchantLabel: {
    color: '#888888',
    fontSize: 10.5,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  title: {
    color: '#1a1a1a',
    fontSize: 13.5,
    fontWeight: '700',
    lineHeight: 18,
    marginBottom: 8,
    minHeight: 36,
  },
  titleCompact: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 5,
    minHeight: 32,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 6,
  },
  price: {
    color: '#1a1a1a',
    fontSize: 17,
    fontWeight: '900',
  },
  priceCompact: {
    fontSize: 14.5,
  },
  strike: {
    color: '#aaaaaa',
    fontSize: 12,
    textDecorationLine: 'line-through',
  },
  strikeCompact: {
    fontSize: 10.5,
  },
  discountPct: {
    color: '#e11d48',
    fontSize: 12,
    fontWeight: '800',
  },
  discountPctCompact: {
    fontSize: 10.5,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 10,
  },
  metaText: {
    color: '#aaaaaa',
    fontSize: 11,
    fontWeight: '500',
  },
  buyBtn: {
    borderRadius: 8,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buyBtnCompact: {
    paddingVertical: 8,
    borderRadius: 7,
  },
  buyBtnText: {
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  buyBtnTextCompact: {
    fontSize: 9.5,
    letterSpacing: 0.2,
  },
});
