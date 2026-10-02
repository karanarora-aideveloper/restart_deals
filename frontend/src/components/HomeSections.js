import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import DealCard from './DealCard';
import { MERCHANTS } from './FilterBar';
import { TOP_LEVEL_CATEGORIES } from '../data/categoryTaxonomy';
import { PRICE_BUCKETS, DISCOUNT_TAGS } from '../data/filterOptions';
import { API_BASE_URL } from '../config';
import { isUsableImageUrl } from '../utils/imageUtils';

/**
 * Home tab header sections — everything that turns the tab from "just a list" into a proper
 * composed home screen, Swiggy/Myntra-style: a circular category rail (real product
 * photography, not generic icon tiles), a "Hot Right Now" carousel, a "Shop by Budget"
 * price-bucket rail, a "Shop by Discount" rail, a "Shop by Store" rail of merchant logo badges
 * (all circular badges, not full deal cards — tapping one is pure navigation into the Deals tab
 * with that filter applied, see PriceBucketStrip/DiscountStrip/StoreStrip below), a personalized
 * "From Your Wishlist" carousel (only when the shopper actually has saved deals, see
 * WishlistCarousel below), then a labeled hand-off into the main vertical feed that FlashList
 * renders below. Rendered as the FlashList's ListHeaderComponent on the Home tab only — the
 * Deals/products tabs stay plain lists (and keep FilterBar's own category/merchant pills
 * instead, see hideCategories/hideMerchants in FilterBar.js).
 */

const STRIP_GAP = 16;
const STRIP_PADDING = 16;

export function CategoryStrip({ categoryFilter, onSelectCategory, onOpenBrowse }) {
  // Uses the statically assigned localImage from TOP_LEVEL_CATEGORIES
  // which were extracted directly from the Myntra app.
  const [images, setImages] = useState({});

  return (
    <View style={styles.stripSection}>
      <View style={styles.sectionTitleRow}>
        <SectionTitle icon="grid" color="#FF6B00">Shop by Category</SectionTitle>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.stripGrid}
      >
        {TOP_LEVEL_CATEGORIES.map((cat) => {
          const isActive = categoryFilter === cat.id;
          const isAllChip = cat.id === 'all';
          const localImg = !isAllChip && cat.localImage;
          const ringSize = 78; // Fixed size for standard single-row carousel
          return (
            <TouchableOpacity
              key={cat.id}
              style={styles.stripItem}
              activeOpacity={0.75}
              onPress={() => (isAllChip && onOpenBrowse ? onOpenBrowse() : onSelectCategory(cat.id))}
            >
              <View
                style={[
                  styles.avatarRing,
                  {
                    borderColor: isActive ? cat.color : '#eef0f2',
                    width: ringSize,
                    height: ringSize,
                    borderRadius: ringSize / 2,
                  },
                  isActive && styles.avatarRingActive,
                ]}
              >
                <View style={[styles.avatarInner, { backgroundColor: `${cat.color}12`, borderRadius: (ringSize - 6) / 2 }]}>
                  {localImg ? (
                    <ExpoImage
                      source={localImg}
                      style={styles.avatarImage}
                      contentFit="cover"
                      transition={250}
                      cachePolicy="memory-disk"
                    />
                  ) : (
                    <Ionicons
                      name={isActive ? cat.icon.replace('-outline', '') : cat.icon}
                      size={Math.round(ringSize * 0.34)}
                      color={cat.color}
                    />
                  )}
                </View>
              </View>
              <Text
                style={[styles.stripLabel, { maxWidth: ringSize + 14 }, isActive && { color: cat.color, fontWeight: '800' }]}
                numberOfLines={1}
              >
                {cat.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

// Home screen's "Shop by Budget" rail — circular gradient price badges (₹99/₹199/₹299/₹499/₹999),
// horizontally scrollable, Flipkart/Amazon-style. Deliberately not full deal-card previews like
// DealCarousel below: tapping one is pure navigation, handing off to the deals page (App.js's
// SortFilterBar) with that price ceiling pre-applied, rather than a dead-end mini feed on the
// home screen itself.
export function PriceBucketStrip({ onSelectBucket }) {
  return (
    <View style={styles.bucketSection}>
      <View style={styles.sectionTitleRow}>
        <SectionTitle icon="wallet" color="#16a34a">Shop by Budget</SectionTitle>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.bucketRow}>
        {PRICE_BUCKETS.map((bucket) => (
          <TouchableOpacity key={bucket.key} activeOpacity={0.8} onPress={() => onSelectBucket(bucket)}>
            <LinearGradient colors={['#fff', `${bucket.colors[1]}20`]} style={[styles.bucketCard, { borderColor: `${bucket.colors[1]}40` }]}>
              <Text style={styles.bucketCardLabel} numberOfLines={2}>{bucket.label}</Text>
              <View style={[styles.bucketGraphic, { backgroundColor: bucket.colors[1] }]}>
                <Text style={styles.bucketCardPrice}>{bucket.short}</Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

// "Shop by Discount" rail — same circular-chip pattern as PriceBucketStrip, one tap away from
// the Deals tab pre-filtered to that minimum discount. Reuses the exact minDiscount tiers
// SortFilterBar's own Filter sheet already offers (src/data/filterOptions.js), so a shopper who
// just wants "give me the biggest discounts" never has to open a modal to get there.
export function DiscountStrip({ onSelectDiscount }) {
  return (
    <View style={styles.bucketSection}>
      <View style={styles.sectionTitleRow}>
        <SectionTitle icon="pricetags" color="#dc2626">Shop by Discount</SectionTitle>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.bucketRow}>
        {DISCOUNT_TAGS.map((tag) => (
          <TouchableOpacity key={tag.key} activeOpacity={0.8} onPress={() => onSelectDiscount(tag)}>
            <LinearGradient colors={['#fff', `${tag.colors[1]}20`]} style={[styles.bucketCard, { borderColor: `${tag.colors[1]}40` }]}>
              <Text style={styles.bucketCardLabel} numberOfLines={2}>{tag.label.toUpperCase()}</Text>
              <View style={[styles.bucketGraphic, { backgroundColor: tag.colors[1] }]}>
                <Text style={styles.bucketCardPrice}>{tag.short}</Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

// "Shop by Store" rail — same ring-with-a-photo-or-icon treatment CategoryStrip uses (real
// merchant logos here instead of product photos), one tap away from the Deals tab pre-filtered
// to that merchant. Reuses FilterBar's own MERCHANTS list (now exported from there) so a tap
// here and a pill selection on the Deals tab land on the exact same `merchant` query param.
export function StoreStrip({ merchantFilter, onSelectStore }) {
  return (
    <View style={styles.stripSection}>
      <View style={styles.sectionTitleRow}>
        <SectionTitle icon="storefront" color="#7c3aed">Shop by Store</SectionTitle>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.bucketRow}>
        {MERCHANTS.map((mer) => {
          const isActive = merchantFilter === mer.id;
          // MERCHANTS' labels carry a decorative emoji prefix FilterBar's own pills never
          // actually render (they show the logo image instead) — strip it here for a clean
          // caption under the circle.
          const cleanLabel = mer.label.replace(/^[^\w]+\s*/, '');
          return (
            <TouchableOpacity key={mer.id} style={styles.stripItem} activeOpacity={0.8} onPress={() => onSelectStore(mer)}>
              <View
                style={[
                  styles.avatarRing,
                  { width: 64, height: 64, borderRadius: 32, borderColor: isActive ? mer.colors[0] : '#eef0f2' },
                  isActive && styles.avatarRingActive,
                ]}
              >
                <View style={[styles.avatarInner, { backgroundColor: '#ffffff', borderRadius: 29 }]}>
                  {mer.logo ? (
                    <ExpoImage
                      source={mer.logo}
                      style={[styles.storeLogo, { transform: [{ scale: mer.logoScale || 1 }] }]}
                      contentFit="contain"
                    />
                  ) : (
                    <Ionicons name={mer.icon} size={26} color={mer.colors[0]} />
                  )}
                </View>
              </View>
              <Text style={[styles.bucketLabel, isActive && { color: mer.colors[1], fontWeight: '800' }]} numberOfLines={1}>
                {cleanLabel}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

// Myntra-home-style two-up promo cards (their Raymond/Rare Rabbit "Min 50% Off" banners) —
// adapted to real per-store data instead of brand ad creative: each card is whichever store's
// biggest *currently live* discount is, computed from the same deals already loaded for the home
// feed (see App.js `storeBanners`), with that deal's own photo standing in for the banner image.
// Nothing here is fabricated — a store with no live deals right now just doesn't get a card.
export function StoreBannerCarousel({ banners, onOpenBanner }) {
  if (!banners || banners.length === 0) return null;

  return (
    <View style={styles.stripSection}>
      <View style={styles.sectionTitleRow}>
        <SectionTitle icon="pricetag" color="#e11d48">Top Store Deals</SectionTitle>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.bannerRow}>
        {banners.map((banner) => (
          <TouchableOpacity
            key={banner.merchantId}
            style={styles.bannerCard}
            activeOpacity={0.9}
            onPress={() => onOpenBanner(banner.merchantId)}
          >
            <LinearGradient colors={banner.colors} style={styles.bannerGradient}>
              <View style={styles.bannerTextCol}>
                {banner.logo ? (
                  <ExpoImage
                    source={banner.logo}
                    style={[styles.bannerLogo, { transform: [{ scale: banner.logoScale || 1 }] }]}
                    contentFit="contain"
                  />
                ) : (
                  <Text style={styles.bannerLabel}>{banner.label}</Text>
                )}
                <Text style={styles.bannerDiscount}>Min {banner.bestDiscount}% Off</Text>
                <Text style={styles.bannerTagline} numberOfLines={2}>{banner.dealTitle}</Text>
                <View style={styles.bannerCta}>
                  <Text style={styles.bannerCtaText}>Shop Now</Text>
                  <Ionicons name="chevron-forward" size={12} color="#ffffff" />
                </View>
              </View>
              {!!banner.dealImage && (
                <View style={styles.bannerImageWrap}>
                  <ExpoImage source={{ uri: banner.dealImage }} style={styles.bannerImage} contentFit="contain" />
                </View>
              )}
            </LinearGradient>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

// Myntra-home-style small square "occasion" cards (their "GET READY FOR RAKHI" strip of Kurtas &
// Sets / Grooming Picks / etc., each tagged "Under ₹X") — adapted to real subcategory data
// instead of a seasonal marketing push: whichever subcategories actually have live deals right
// now in the home feed, each card showing that subcategory's own cheapest live price (see App.js
// `trendingPicks`). An icon-in-a-circle stands in for Myntra's product photography, consistent
// with the icon treatment everywhere else a real photo isn't available (CategoryStrip's fallback).
export function TrendingPicksStrip({ picks, onSelectPick }) {
  if (!picks || picks.length === 0) return null;

  return (
    <View style={styles.stripSection}>
      <View style={styles.sectionTitleRow}>
        <SectionTitle icon="trending-up" color="#0d9488">Trending Picks</SectionTitle>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pickRow}>
        {picks.map((pick) => (
          <TouchableOpacity
            key={pick.subcategoryId}
            style={styles.pickCard}
            activeOpacity={0.85}
            onPress={() => onSelectPick(pick)}
          >
            <View style={[styles.pickIconCircle, { backgroundColor: `${pick.color}15` }]}>
              <Ionicons name={pick.icon} size={22} color={pick.color} />
            </View>
            <Text style={styles.pickLabel} numberOfLines={2}>{pick.label}</Text>
            <Text style={[styles.pickPrice, { color: pick.color }]}>From ₹{pick.fromPrice}</Text>
            <Text style={styles.pickCount}>{pick.count} live deal{pick.count === 1 ? '' : 's'}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

// Myntra-home-style bordered two-up trust strip (their "Festive Partner / Gifting Partner" box)
// — adapted to two things that are actually true about this app right now, rather than a
// fabricated brand partnership: it costs nothing to use, and the deal feed refreshes live. Both
// lines echo copy already used elsewhere (AffiliateDisclosureModal's "100% Transparent • Zero
// Cost to You", Header's own "LIVE DEALS · Refreshed every few seconds" strip) so nothing here is
// a new claim, just a second, more visual place it shows up.
export function TrustBadgeStrip() {
  return (
    <View style={styles.trustStrip}>
      <View style={styles.trustHalf}>
        <Ionicons name="shield-checkmark" size={18} color="#16a34a" />
        <Text style={styles.trustLabel} numberOfLines={2}>100% Free{'\n'}No Hidden Cost</Text>
      </View>
      <View style={styles.trustDivider} />
      <View style={styles.trustHalf}>
        <Ionicons name="flash" size={18} color="#FF6B00" />
        <Text style={styles.trustLabel} numberOfLines={2}>Live Deals{'\n'}Refreshed Often</Text>
      </View>
    </View>
  );
}

// A second Myntra-home-style promo-card carousel (their large single-brand banners), scoped to
// category instead of store so it doesn't just repeat StoreBannerCarousel above: whichever
// top-level categories actually have the most live deals right now, each card showing that
// category's own deal count and its single best-discount deal's real photo. Solid category color
// instead of StoreBannerCarousel's two-tone gradient, so the two carousels read as related but
// distinct rather than the same component twice.
export function CategorySpotlightCarousel({ spotlights, onOpenSpotlight }) {
  if (!spotlights || spotlights.length === 0) return null;

  return (
    <View style={styles.stripSection}>
      <View style={styles.sectionTitleRow}>
        <SectionTitle icon="sparkles" color="#7c3aed">Category Spotlight</SectionTitle>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.bannerRow}>
        {spotlights.map((spot) => (
          <TouchableOpacity
            key={spot.categoryId}
            style={[styles.spotlightCard, { backgroundColor: spot.color }]}
            activeOpacity={0.9}
            onPress={() => onOpenSpotlight(spot.categoryId)}
          >
            <View style={styles.bannerTextCol}>
              <Ionicons name={spot.icon} size={20} color="#ffffff" />
              <Text style={styles.bannerDiscount} numberOfLines={1}>{spot.label}</Text>
              <Text style={styles.bannerTagline}>{spot.count} live deal{spot.count === 1 ? '' : 's'}</Text>
              <View style={styles.bannerCta}>
                <Text style={styles.bannerCtaText}>Explore</Text>
                <Ionicons name="chevron-forward" size={12} color="#ffffff" />
              </View>
            </View>
            {!!spot.dealImage && (
              <View style={styles.bannerImageWrap}>
                <ExpoImage source={{ uri: spot.dealImage }} style={styles.bannerImage} contentFit="contain" />
              </View>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

export function DealCarousel({ title, subtitle, deals, onOpenDeal, savedDeals, onToggleSave, isDealSaved, onImageUnavailable }) {
  if (!deals || deals.length === 0) return null;

  return (
    <View style={styles.carouselSection}>
      <View style={styles.sectionTitleRow}>
        <Text style={styles.sectionTitle} accessibilityRole={Platform.OS === 'web' ? 'heading' : 'header'} aria-level={2}>
          {title}
        </Text>
        {!!subtitle && <Text style={styles.sectionSub}>{subtitle}</Text>}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.carouselRow}
      >
        {deals.map((deal) => (
          <View key={deal._id || deal.id} style={styles.carouselCard}>
            <DealCard
              deal={deal}
              isSaved={isDealSaved(deal._id || deal.id, savedDeals)}
              onToggleSave={onToggleSave}
              onPress={() => onOpenDeal(deal._id || deal.id)}
              onImageUnavailable={onImageUnavailable}
            />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

export function HotDealsCarousel(props) {
  return <DealCarousel title="🔥 Hot Right Now" subtitle={'>='.concat('40% off, updating live')} {...props} />;
}

// Personalized "continue where you left off" rail — reuses the exact saved-deals list the heart
// icon already builds (src/utils/savedStorage.js), so it costs nothing new to fetch and is always
// in sync with the Wishlist tab. DealCarousel itself already returns null on an empty list, so
// this naturally disappears for guests/new users with nothing saved yet instead of showing an
// empty section.
export function WishlistCarousel(props) {
  return <DealCarousel title="❤️ From Your Wishlist" subtitle="Pick up where you left off" {...props} />;
}

export function FeedSectionHeader() {
  return (
    <View style={styles.feedHeaderRow}>
      <SectionTitle icon="flash" color="#FF6B00">All Live Deals</SectionTitle>
    </View>
  );
}

// Shared section-header treatment — a small colored Ionicon ahead of the label instead of an
// emoji prefix, closer to Myntra's own clean-line-icon home screen than the emoji headers this
// replaced. Kept local to this file since every section header here follows the same shape.
function SectionTitle({ icon, color = '#1a1a1a', children }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
      <Ionicons name={icon} size={16} color={color} />
      <Text style={styles.sectionTitle} accessibilityRole={Platform.OS === 'web' ? 'heading' : 'header'} aria-level={2}>
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // Category strip
  stripSection: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    paddingTop: 14,
    paddingBottom: 14,
  },
  stripGrid: {
    flexDirection: 'row',
    gap: STRIP_GAP,
    paddingHorizontal: STRIP_PADDING,
  },
  stripColumn: {
    gap: 16,
    alignItems: 'center',
  },
  stripItem: {
    alignItems: 'center',
    gap: 6,
  },
  avatarRing: {
    width: 74,
    height: 74,
    borderRadius: 37,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 3,
  },
  avatarRingActive: {
    borderWidth: 2.5,
    ...(Platform.OS === 'android' ? { elevation: 4 } : {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.14,
      shadowRadius: 8,
    }),
  },
  avatarInner: {
    width: '100%',
    height: '100%',
    borderRadius: 32,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  // StoreStrip's logo badges — smaller than the avatarInner circle they sit in (unlike category
  // photos, which fill it edge to edge) so a wide logo like Flipkart's never touches the ring.
  storeLogo: {
    width: '72%',
    height: '55%',
  },
  // Top Store Deals banner carousel
  bannerRow: {
    gap: 12,
    paddingHorizontal: STRIP_PADDING,
    paddingBottom: 2,
  },
  bannerCard: {
    width: 240,
    height: 140,
    borderRadius: 16,
    overflow: 'hidden',
  },
  spotlightCard: {
    width: 240,
    height: 140,
    borderRadius: 16,
    overflow: 'hidden',
    flexDirection: 'row',
    padding: 14,
  },
  bannerGradient: {
    flex: 1,
    flexDirection: 'row',
    padding: 14,
  },
  bannerTextCol: {
    flex: 1,
    justifyContent: 'space-between',
  },
  bannerLogo: {
    width: 60,
    height: 18,
    tintColor: '#ffffff',
  },
  bannerLabel: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  bannerDiscount: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '900',
  },
  bannerTagline: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 10.5,
    fontWeight: '600',
    lineHeight: 13,
  },
  bannerCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: 12,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  bannerCtaText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },
  bannerImageWrap: {
    width: 68,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerImage: {
    width: '100%',
    height: '82%',
  },
  // Trending Picks (subcategory) cards
  pickRow: {
    gap: 12,
    paddingHorizontal: STRIP_PADDING,
    paddingBottom: 2,
  },
  pickCard: {
    width: 108,
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#fafafa',
    borderWidth: 1,
    borderColor: '#f0f0f0',
    alignItems: 'flex-start',
  },
  pickIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  pickLabel: {
    color: '#1a1a1a',
    fontSize: 11.5,
    fontWeight: '800',
    lineHeight: 14,
    minHeight: 28,
    marginBottom: 4,
  },
  pickPrice: {
    fontSize: 12.5,
    fontWeight: '900',
  },
  pickCount: {
    color: '#999999',
    fontSize: 9.5,
    fontWeight: '600',
    marginTop: 1,
  },
  // Trust badge strip
  trustStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: STRIP_PADDING,
    marginVertical: 12,
    borderWidth: 1.5,
    borderColor: '#ffddc0',
    borderRadius: 14,
    backgroundColor: '#fff8f3',
    paddingVertical: 12,
  },
  trustHalf: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
  },
  trustDivider: {
    width: 1,
    height: 32,
    backgroundColor: '#ffddc0',
  },
  trustLabel: {
    color: '#444444',
    fontSize: 10.5,
    fontWeight: '700',
    lineHeight: 13,
  },
  stripLabel: {
    color: '#777777',
    fontSize: 10.5,
    fontWeight: '600',
    textAlign: 'center',
  },

  // "Shop by Budget" / Explore More style cards
  bucketSection: {
    backgroundColor: '#ffffff',
    paddingTop: 16,
    paddingBottom: 24,
    borderBottomWidth: 8,
    borderBottomColor: '#f5f5f6',
  },
  bucketRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
  },
  bucketCard: {
    width: 86,
    height: 94,
    borderRadius: 16,
    borderWidth: 1,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'space-between',
    ...(Platform.OS === 'android' ? { elevation: 2 } : {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 4,
    }),
  },
  bucketGraphic: {
    width: 44,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bucketCardPrice: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
  },
  bucketCardLabel: {
    color: '#282C3F',
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 12,
  },

  // Shared section title
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#1a1a1a',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.1,
  },
  sectionSub: {
    color: '#aaaaaa',
    fontSize: 11,
    fontWeight: '600',
  },

  // Deal carousel (Hot, price buckets)
  carouselSection: {
    backgroundColor: '#fafafa',
    paddingTop: 16,
    paddingBottom: 18,
    borderBottomWidth: 8,
    borderBottomColor: '#f0f0f0',
  },
  carouselRow: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    gap: 12,
  },
  carouselCard: {
    width: 168,
  },

  // Feed hand-off header
  feedHeaderRow: {
    paddingHorizontal: 14,
    paddingTop: 16,
    paddingBottom: 4,
  },
});
