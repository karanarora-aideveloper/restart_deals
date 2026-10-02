import React, { useState } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, Linking, Platform, useWindowDimensions } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { logEvent } from '../utils/analytics';
import { ensureGridCardHoverStyles } from '../utils/webHoverStyles';

ensureGridCardHoverStyles();

function formatDealTime(createdAt) {
  if (!createdAt) return 'Just now';
  const now = new Date();
  const date = new Date(createdAt);
  const diffMs = Math.max(0, now - date);
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMins / 60);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

import { buildAffiliateUrl as getAffiliateUrl } from '../utils/affiliate';

/**
 * Myntra-style vertical grid card — image-forward, wishlist heart overlay,
 * discount ribbon, compact price row. Used in a 2-column grid on phones
 * (native + mobile web) and a density-scaled multi-column grid on desktop web.
 */
export default function DealCard({
  deal,
  isSaved = false,
  onToggleSave,
  isCompared = false,
  onToggleCompare,
  onPress,
  onImageUnavailable
}) {
  const [imgError, setImgError] = useState(false);
  const { width } = useWindowDimensions();
  const isCompact = width <= 640;

  const handleBuyPress = async () => {
    if (!deal.dealUrl) return;
    logEvent('click_deal', { item_id: deal._id || deal.id, item_name: deal.title });

    if (Platform.OS !== 'web') {
      const finalUrl = getAffiliateUrl(deal.dealUrl);
      try {
        await Linking.openURL(finalUrl);
      } catch (err) {
        console.error('Failed to open link:', err);
      }
    }
  };

  const urlString = (deal.dealUrl || '').toLowerCase();
  const isAmazon = urlString.includes('amazon') || urlString.includes('amzn');
  const isFlipkart = urlString.includes('flipkart') || urlString.includes('fkrt') || urlString.includes('fktr') || urlString.includes('affiliates.app.link');
  const isMyntra = urlString.includes('myntra');
  const isMeesho = urlString.includes('meesho');

  const getMerchantStyle = () => {
    // logoScale: 0.8 corrects for the source image itself — amazon.webp's wordmark fills nearly
    // its whole canvas while flipkart/myntra.webp have visible padding, so at the same display
    // box Amazon reads noticeably larger (see the matching note in FilterBar.js's MERCHANTS).
    if (isAmazon) return { label: '🛒 Amazon', btnColor: '#FFB800', textColor: '#7a5200', logo: require('../../assets/amazon.webp'), logoScale: 0.8 };
    if (isFlipkart) return { label: '🛍️ Flipkart', btnColor: '#FFB800', textColor: '#7a5200', logo: require('../../assets/flipkart.webp') };
    if (isMyntra) return { label: '👗 Myntra', btnColor: '#e11d48', textColor: '#ffffff', logo: require('../../assets/myntra.webp') };
    if (isMeesho) return { label: '🎁 Meesho', btnColor: '#7c3aed', textColor: '#ffffff' };
    return { label: '🏷️ Deal', btnColor: '#FF6B00', textColor: '#ffffff' };
  };

  const merchant = getMerchantStyle();

  const dealPriceStr = deal.dealPrice
    ? `₹${deal.dealPrice.toLocaleString('en-IN')}`
    : 'Special Price';

  // A price_history deal has no originalPrice by definition (that's precisely why it took that
  // path over an MRP-based one — see verifier.js), so this used to render no "was ₹X" price and
  // no savings line at all for it, despite deal.previousPrice holding exactly what it dropped
  // from. isPriceDrop distinguishes the two so the rest of the card can label it honestly.
  const isPriceDrop = deal.priceSource === 'price_history';
  const priorPrice = isPriceDrop ? deal.previousPrice : deal.originalPrice;

  const origPriceStr = priorPrice && priorPrice > (deal.dealPrice || 0)
    ? `₹${priorPrice.toLocaleString('en-IN')}`
    : null;

  const savings =
    priorPrice && deal.dealPrice && priorPrice > deal.dealPrice
      ? priorPrice - deal.dealPrice
      : null;

  const formattedTime = formatDealTime(deal.createdAt);
  const isHotDeal = !!(deal.discountPercentage && deal.discountPercentage >= 50);
  const hasDiscount = !!(deal.discountPercentage && deal.discountPercentage > 0);
  // Extra coupon the shopper applies on the merchant page (separate from the deal's own discount)
  const couponLabel = deal.coupon?.label || null;
  // Some deals never got a scraped/cached image — no point reserving a square of blank space
  // (or a generic bag icon) for it. The image block below only renders when there's a real
  // image; the wishlist heart and discount/hot badges it would normally carry move into the
  // info section instead so nothing functional is lost for imageless cards.
  const hasImage = !!deal.imageUrl && !imgError;

  const CardWrapper = onPress ? TouchableOpacity : View;

  const wishlistButton = onToggleSave && (
    <TouchableOpacity
      style={hasImage ? [styles.wishlistBtn, isCompact && styles.wishlistBtnCompact] : styles.wishlistBtnInline}
      activeOpacity={0.7}
      onPress={(e) => {
        if (e && e.stopPropagation) e.stopPropagation();
        onToggleSave(deal);
      }}
    >
      <Ionicons
        name={isSaved ? 'heart' : 'heart-outline'}
        size={isCompact ? 14 : 16}
        color={isSaved ? '#ff3f6c' : '#333333'}
      />
    </TouchableOpacity>
  );

  const compareButton = onToggleCompare && (
    <TouchableOpacity
      style={hasImage ? [styles.compareBtn, isCompared && styles.compareBtnActive, isCompact && styles.compareBtnCompact] : styles.compareBtnInline}
      activeOpacity={0.7}
      onPress={(e) => {
        if (e && e.stopPropagation) e.stopPropagation();
        onToggleCompare(deal);
      }}
      accessibilityLabel="Compare Product"
    >
      <Ionicons
        name="git-compare"
        size={isCompact ? 12 : 14}
        color={isCompared ? '#ffffff' : '#333333'}
      />
    </TouchableOpacity>
  );

  return (
    <CardWrapper
      style={styles.card}
      className="sd-grid-card"
      onPress={onPress}
      activeOpacity={0.95}
    >
      {/* Image — hidden entirely (not a placeholder) when the deal has none */}
      {hasImage && (
        <View style={styles.imageWrap}>
          <ExpoImage
            source={{ uri: deal.imageUrl }}
            style={styles.productImage}
            className="sd-grid-image"
            contentFit="contain"
            transition={200}
            cachePolicy="memory-disk"
            recyclingKey={String(deal._id || deal.id || deal.imageUrl)}
            onError={() => {
              setImgError(true);
              if (onImageUnavailable) onImageUnavailable(deal._id || deal.id);
            }}
            accessibilityLabel={deal.title || 'Product Image'}
            alt={deal.title || 'Product Image'}
          />

          {hasDiscount && (
            <View style={[styles.discountRibbon, isCompact && styles.discountRibbonCompact]}>
              <Text style={[styles.discountRibbonText, isCompact && styles.discountRibbonTextCompact]}>
                {deal.discountPercentage}% {isPriceDrop ? 'DROP' : 'OFF'}
              </Text>
            </View>
          )}

          {isHotDeal && !isCompact && (
            <View style={styles.hotBadge}>
              <Text style={styles.hotBadgeText}>🔥 HOT</Text>
            </View>
          )}

          {/* Myntra-style rating pill, bottom-left over the image — only when the scraped deal
              actually carries a rating (see api/src/db/models/deal.js `rating`), never fabricated. */}
          {!!deal.rating && (
            <View style={[styles.ratingPill, isCompact && styles.ratingPillCompact]}>
              <Ionicons name="star" size={isCompact ? 9 : 10} color="#ffd23f" />
              <Text style={[styles.ratingPillText, isCompact && styles.ratingPillTextCompact]}>
                {deal.rating.toFixed(1)}
              </Text>
            </View>
          )}

          {compareButton}
          {wishlistButton}
        </View>
      )}

      {/* Info */}
      <View style={[styles.info, isCompact && styles.infoCompact]}>
        {!hasImage && (hasDiscount || isHotDeal || onToggleSave) && (
          <View style={styles.noImageTopRow}>
            <View style={styles.noImageBadgeRow}>
              {hasDiscount && (
                <View style={styles.discountPillInline}>
                  <Text style={styles.discountRibbonText}>{deal.discountPercentage}% {isPriceDrop ? 'DROP' : 'OFF'}</Text>
                </View>
              )}
              {isHotDeal && (
                <View style={styles.hotBadgeInline}>
                  <Text style={styles.hotBadgeText}>🔥 HOT</Text>
                </View>
              )}
            </View>
            {wishlistButton}
          </View>
        )}

        <View style={styles.merchantRow}>
          {merchant.logo ? (
            <Image
              source={merchant.logo}
              style={{ height: 16, width: 48, transform: [{ scale: merchant.logoScale || 1 }] }}
              resizeMode="contain"
            />
          ) : (
            <Text style={[styles.merchantLabel, isCompact && styles.merchantLabelCompact]} numberOfLines={1}>{merchant.label}</Text>
          )}
        </View>

        <Text
          style={[styles.title, isCompact && styles.titleCompact]}
          numberOfLines={1}
          accessibilityRole={Platform.OS === 'web' ? 'heading' : 'header'}
          aria-level={3}
        >
          {deal.title || 'Featured Deal'}
        </Text>

        <View style={styles.priceRow}>
          <Text style={[styles.price, isCompact && styles.priceCompact]}>{dealPriceStr}</Text>
          {origPriceStr ? <Text style={[styles.strike, isCompact && styles.strikeCompact]}>{origPriceStr}</Text> : null}
          {hasDiscount ? <Text style={[styles.discountPct, isCompact && styles.discountPctCompact]}>{deal.discountPercentage}% {isPriceDrop ? 'price drop' : 'off'}</Text> : null}
        </View>

        {savings && savings > 0 && !isCompact ? (
          <Text style={styles.savingsText}>You save ₹{savings.toLocaleString('en-IN')}</Text>
        ) : null}

        {/* Extra coupon to apply on the merchant page, on top of the deal price */}
        {couponLabel ? (
          <View style={[styles.couponPill, isCompact && styles.couponPillCompact]}>
            <Ionicons name="pricetag" size={isCompact ? 9 : 10} color="#7a5200" style={{ marginRight: 4 }} />
            <Text
              style={[styles.couponText, isCompact && styles.couponTextCompact]}
              numberOfLines={1}
            >
              {couponLabel}
            </Text>
          </View>
        ) : null}

        {/* FlashList's grid mode gives every card in a row the same height (needed for its
            virtualization) — imageless cards end up taller than their own content. Rather than
            leave dead space below the button, this spacer soaks it up so GET DEAL sits flush at
            the bottom (a no-op when the card already exactly fits its content). */}
        <View style={{ flex: 1 }} />

        <TouchableOpacity
          style={[styles.buyBtn, isCompact && styles.buyBtnCompact, { backgroundColor: merchant.btnColor }]}
          activeOpacity={0.85}
          onPress={(e) => {
            if (e && e.stopPropagation) e.stopPropagation();
            handleBuyPress();
          }}
          accessibilityRole="link"
          href={Platform.OS === 'web' ? getAffiliateUrl(deal.dealUrl) : undefined}
          hrefAttrs={{ target: '_blank', rel: 'noopener noreferrer' }}
        >
          <Ionicons name="flash" size={isCompact ? 11 : 13} color={merchant.textColor} style={{ marginRight: 5 }} />
          <Text style={[styles.buyBtnText, isCompact && styles.buyBtnTextCompact, { color: merchant.textColor }]}>
            GET DEAL
          </Text>
        </TouchableOpacity>
      </View>
    </CardWrapper>
  );
}

// ─── Myntra-style grid card styles ───────────────────────────────────────────
const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    marginBottom: 16,
    overflow: 'hidden',
    // Very subtle border like Myntra, or none.
    borderWidth: 1,
    borderColor: '#f5f5f6',
  },
  imageWrap: {
    width: '100%',
    aspectRatio: 3/4,
    backgroundColor: '#f5f5f6',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  noImageTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  noImageBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  discountPillInline: {
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  hotBadgeInline: {
    backgroundColor: '#fff4ed',
    borderWidth: 1,
    borderColor: '#ffddc8',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  wishlistBtnInline: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#f7f7f7',
    alignItems: 'center',
    justifyContent: 'center',
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
  hotBadge: {
    position: 'absolute',
    top: 10,
    right: 44,
    backgroundColor: '#fff4ed',
    borderWidth: 1,
    borderColor: '#ffddc8',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  hotBadgeText: {
    color: '#FF6B00',
    fontSize: 9.5,
    fontWeight: '800',
  },
  ratingPill: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(26,26,26,0.82)',
    paddingHorizontal: 7,
    paddingVertical: 3.5,
    borderRadius: 6,
  },
  ratingPillCompact: {
    bottom: 6,
    left: 6,
    paddingHorizontal: 5,
    paddingVertical: 2.5,
    borderRadius: 5,
  },
  ratingPillText: {
    color: '#ffffff',
    fontSize: 10.5,
    fontWeight: '800',
  },
  ratingPillTextCompact: {
    fontSize: 9,
  },
  wishlistBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'android' ? { elevation: 2 } : Platform.OS === 'web' ? {
      boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
    } : {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.12,
      shadowRadius: 4,
    }),
  },
  wishlistBtnCompact: {
    top: 6,
    right: 6,
    width: 26,
    height: 26,
    borderRadius: 13,
  },
  compareBtn: {
    position: 'absolute',
    top: 8,
    right: 42,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'android' ? { elevation: 2 } : Platform.OS === 'web' ? {
      boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
    } : {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.12,
      shadowRadius: 4,
    }),
  },
  compareBtnActive: {
    backgroundColor: '#FF6B00',
  },
  compareBtnCompact: {
    top: 6,
    right: 36,
    width: 26,
    height: 26,
    borderRadius: 13,
  },
  compareBtnInline: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
    padding: 10,
  },
  infoCompact: {
    padding: 8,
  },
  merchantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  merchantLabel: {
    color: '#282C3F',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0,
  },
  merchantLabelCompact: {
    fontSize: 13,
  },
  timeLabel: {
    color: '#bbbbbb',
    fontSize: 10,
    fontWeight: '500',
  },
  timeLabelCompact: {
    fontSize: 9,
  },
  title: {
    color: '#535665',
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 16,
    marginBottom: 6,
  },
  titleCompact: {
    fontSize: 11,
    lineHeight: 14,
    marginBottom: 4,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 4,
  },
  price: {
    color: '#282C3F',
    fontSize: 14,
    fontWeight: '700',
  },
  priceCompact: {
    fontSize: 13,
  },
  strike: {
    color: '#7E818C',
    fontSize: 12,
    textDecorationLine: 'line-through',
  },
  strikeCompact: {
    fontSize: 10,
  },
  discountPct: {
    color: '#FF905A',
    fontSize: 12,
    fontWeight: '700',
  },
  discountPctCompact: {
    fontSize: 10,
  },
  savingsText: {
    color: '#16a34a',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 10,
  },
  couponPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#fff8e6',
    borderWidth: 1,
    borderColor: '#ffe0a3',
    borderRadius: 5,
    paddingHorizontal: 7,
    paddingVertical: 3,
    marginTop: 6,
    maxWidth: '100%',
  },
  couponPillCompact: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    marginTop: 4,
    borderRadius: 4,
  },
  couponText: {
    color: '#7a5200',
    fontSize: 10.5,
    fontWeight: '700',
    flexShrink: 1,
  },
  couponTextCompact: {
    fontSize: 9,
  },
  buyBtn: {
    borderRadius: 8,
    paddingVertical: 10,
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buyBtnCompact: {
    paddingVertical: 8,
    marginTop: 4,
    borderRadius: 7,
  },
  buyBtnText: {
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  buyBtnTextCompact: {
    fontSize: 10,
    letterSpacing: 0.3,
  },
});
