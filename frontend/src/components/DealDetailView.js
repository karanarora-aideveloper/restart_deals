import React, { useState, useEffect } from 'react';
import { View, Text, Image, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Linking, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { API_BASE_URL } from '../config';
import WebFooter from './WebFooter';

// Same affiliate-tag logic as DealCard.js/ProductCard.js — this screen had been opening
// deal.dealUrl raw with no tag at all, so any purchase made from the full detail page (as
// opposed to tapping "Get Deal" on a card) wasn't attributed to the affiliate account.
import { buildAffiliateUrl as getAffiliateUrl } from '../utils/affiliate';

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
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function DealDetailView({ dealId, onBack, setActiveTab }) {
  const [deal, setDeal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    const fetchDeal = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API_BASE_URL}/api/deals/${dealId}`);
        const json = await res.json();
        if (json.success && json.data) {
          setDeal(json.data);
        } else {
          setError('Deal not found.');
        }
      } catch (err) {
        console.error('Failed to fetch deal:', err);
        setError('Failed to load deal.');
      } finally {
        setLoading(false);
      }
    };
    if (dealId) {
      fetchDeal();
    }
  }, [dealId]);

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#FF6B00" />
      </View>
    );
  }

  if (error || !deal) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="alert-circle-outline" size={48} color="#dc2626" />
        <Text style={styles.errorText}>{error || 'Deal not found'}</Text>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleBuyPress = async () => {
    if (!deal.dealUrl) return;
    if (Platform.OS !== 'web') {
      try {
        await Linking.openURL(getAffiliateUrl(deal.dealUrl));
      } catch (err) {
        console.error('Failed to open link:', err);
      }
    }
    // Web: handled by the button's own href below instead of window-opening here, same
    // pattern as DealCard's buy button.
  };

  const isAmazon = (deal.dealUrl || '').toLowerCase().includes('amazon');
  const isFlipkart = (deal.dealUrl || '').toLowerCase().includes('flipkart');
  const isMyntra = (deal.dealUrl || '').toLowerCase().includes('myntra');
  const isMeesho = (deal.dealUrl || '').toLowerCase().includes('meesho');

  const getMerchantStyle = () => {
    if (isAmazon) return { label: '🛒 Amazon', btnColor: '#FFB800', textColor: '#7a5200', logo: require('../../assets/amazon.webp') };
    if (isFlipkart) return { label: '🛍️ Flipkart', btnColor: '#2563eb', textColor: '#ffffff', logo: require('../../assets/flipkart.webp') };
    if (isMyntra) return { label: '👗 Myntra', btnColor: '#e11d48', textColor: '#ffffff', logo: require('../../assets/myntra.webp') };
    if (isMeesho) return { label: '🎁 Meesho', btnColor: '#7c3aed', textColor: '#ffffff' };
    return { label: '🏷️ Deal', btnColor: '#FF6B00', textColor: '#ffffff' };
  };

  const merchant = getMerchantStyle();
  const dealPriceStr = deal.dealPrice ? `₹${deal.dealPrice.toLocaleString('en-IN')}` : 'Special Price';
  // A price_history deal has no originalPrice by definition (see verifier.js), so this used to
  // show neither a "was ₹X" price nor a savings line for it, despite deal.previousPrice holding
  // exactly what it dropped from.
  const isPriceDrop = deal.priceSource === 'price_history';
  const priorPrice = isPriceDrop ? deal.previousPrice : deal.originalPrice;
  const origPriceStr = priorPrice && priorPrice > (deal.dealPrice || 0)
    ? `₹${priorPrice.toLocaleString('en-IN')}`
    : null;
  const savings = priorPrice && deal.dealPrice && priorPrice > deal.dealPrice
    ? priorPrice - deal.dealPrice
    : null;

  const isHotDeal = !!(deal.discountPercentage && deal.discountPercentage >= 50);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.contentContainer}>
        <TouchableOpacity style={styles.headerBackBtn} onPress={onBack}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
          <Text style={styles.headerBackText}>Back</Text>
        </TouchableOpacity>

        <View style={styles.card}>
          {isHotDeal && (
          <View style={styles.hotStrip}>
            <Text style={styles.hotStripText}>🔥 HOT DEAL — {deal.discountPercentage}% {isPriceDrop ? 'DROP' : 'OFF'}</Text>
          </View>
        )}

        <View style={styles.imageWrapper}>
          {deal.imageUrl && !imgError ? (
            <Image
              source={{ uri: deal.imageUrl }}
              style={styles.productImage}
              resizeMode="contain"
              accessibilityLabel={deal.title || 'Deal Image'}
              alt={deal.title || 'Deal Image'}
              onError={() => setImgError(true)}
            />
          ) : (
            <Ionicons name="bag-handle-outline" size={64} color="#cccccc" />
          )}
        </View>

        <View style={styles.infoContainer}>
          <View style={styles.badgeRow}>
            {merchant.logo ? (
              <View style={[styles.merchantBadge, { paddingVertical: 4, paddingHorizontal: 8, justifyContent: 'center' }]}>
                <Image source={merchant.logo} style={{ height: 18, width: 60 }} resizeMode="contain" />
              </View>
            ) : (
              <Text style={styles.merchantBadge}>{merchant.label}</Text>
            )}
            <Text style={styles.timeBadge}>{formatDealTime(deal.createdAt)}</Text>
          </View>

          <Text style={styles.title}>{deal.title || 'Featured Deal'}</Text>
          {deal.description && <Text style={styles.description}>{deal.description}</Text>}

          <View style={styles.priceSection}>
            <Text style={styles.currentPrice}>{dealPriceStr}</Text>
            {origPriceStr && <Text style={styles.originalPrice}>{origPriceStr}</Text>}
            {deal.discountPercentage ? (
              <View style={styles.discountBadge}>
                <Text style={styles.discountText}>{deal.discountPercentage}% {isPriceDrop ? 'DROP' : 'OFF'}</Text>
              </View>
            ) : null}
          </View>

          {savings && (
            <Text style={styles.savingsText}>You save ₹{savings.toLocaleString('en-IN')}</Text>
          )}

          {/* Extra coupon to apply on the merchant's page — shown right above the buy button,
              since that's the moment the shopper needs to know to look for it. */}
          {deal.coupon?.label ? (
            <View style={styles.couponBox}>
              <Ionicons name="pricetag" size={16} color="#7a5200" style={{ marginRight: 8 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.couponLabel}>{deal.coupon.label}</Text>
                <Text style={styles.couponHint}>
                  {deal.coupon.code
                    ? 'Enter this code at checkout for an extra saving.'
                    : 'Tick the coupon box on the product page before you check out.'}
                </Text>
              </View>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.buyBtn, { backgroundColor: merchant.btnColor }]}
            onPress={handleBuyPress}
            activeOpacity={0.8}
            accessibilityRole="link"
            href={Platform.OS === 'web' ? getAffiliateUrl(deal.dealUrl) : undefined}
            hrefAttrs={{ target: '_blank', rel: 'noopener noreferrer' }}
          >
            <Text style={[styles.buyBtnText, { color: merchant.textColor }]}>Get Deal Now</Text>
            <Ionicons name="open-outline" size={20} color={merchant.textColor} style={{ marginLeft: 8 }} />
          </TouchableOpacity>
        </View>
      </View>
      </View>
      <WebFooter setActiveTab={setActiveTab} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
    maxWidth: 800,
    width: '100%',
    alignSelf: 'center',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: '#4b5563',
    marginTop: 16,
    marginBottom: 24,
  },
  backBtn: {
    backgroundColor: '#111827',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  headerBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingVertical: 8,
  },
  headerBackText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginLeft: 8,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8 },
      android: { elevation: 3 },
      web: { boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }
    }),
  },
  hotStrip: {
    backgroundColor: '#dc2626',
    paddingVertical: 8,
    alignItems: 'center',
  },
  hotStripText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 0.5,
  },
  imageWrapper: {
    height: 300,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  infoContainer: {
    padding: 24,
  },
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  merchantBadge: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4b5563',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  timeBadge: {
    fontSize: 13,
    color: '#6b7280',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
    lineHeight: 30,
  },
  description: {
    fontSize: 15,
    color: '#4b5563',
    lineHeight: 24,
    marginBottom: 20,
  },
  priceSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  currentPrice: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FF6B00',
    marginRight: 12,
  },
  originalPrice: {
    fontSize: 18,
    color: '#9ca3af',
    textDecorationLine: 'line-through',
    marginRight: 12,
  },
  discountBadge: {
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#34d399',
  },
  discountText: {
    color: '#059669',
    fontWeight: '700',
    fontSize: 13,
  },
  savingsText: {
    fontSize: 14,
    color: '#059669',
    fontWeight: '600',
    marginBottom: 24,
  },
  couponBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fff8e6',
    borderWidth: 1,
    borderColor: '#ffe0a3',
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
    marginTop: -8,
  },
  couponLabel: {
    color: '#7a5200',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 2,
  },
  couponHint: {
    color: '#9a7434',
    fontSize: 12,
    lineHeight: 16,
  },
  buyBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 8,
  },
  buyBtnText: {
    fontSize: 18,
    fontWeight: '700',
  },
});
