import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Linking, Platform } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { API_BASE_URL } from '../config';
import { CATEGORY_TAXONOMY } from '../data/categoryTaxonomy';
import { isUsableImageUrl } from '../utils/imageUtils';

const WHATSAPP_CHANNEL_URL = 'https://whatsapp.com/channel/0029VbBUJq0ICVfrijvMaz1y';
const ASPECT_RATIO = 1200 / 545;
const AUTO_ADVANCE_MS = 4500;

const BANNER_IMAGES = {
  'flash-sale': require('../../assets/hero/flash-sale.png'),
  whatsapp: require('../../assets/hero/whatsapp.png'),
  alerts: require('../../assets/hero/alerts.png'),
};

/**
 * Full-bleed, swipeable hero carousel at the very top of the home feed — the "this looks like a
 * real shopping app" opener, Flipkart/Amazon-style. A mix of live, data-driven slides (today's
 * top deal, a trending category — both pulled from what's already loaded/fetched, not stock
 * art) and static designed banners (flash sale, WhatsApp channel, price alerts — built the same
 * way as the Play Store feature graphic: real HTML/CSS composited to PNG in the app's own brand
 * colors, not AI-generated or stock imagery). Plain ScrollView + pagingEnabled, no carousel
 * library — swipe like any native paging view, auto-advances on a timer, pauses while the user
 * is actively dragging.
 */
export default function HeroCarousel({ topDeal, onOpenDeal, onOpenHot, onOpenAccount, onSelectCategory }) {
  const [width, setWidth] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [spotlightCategory, setSpotlightCategory] = useState(null);
  const scrollRef = useRef(null);
  const timerRef = useRef(null);
  // Mirrors activeIndex without the closure-staleness a plain state read inside setInterval
  // would have — the interval is created once per width/slide-count change, so it needs a live
  // read of "where are we now" every time it fires, not the value from when it was created.
  const activeIndexRef = useRef(0);

  // One lightweight fetch for a single "trending category" photo — rotates by day of month so
  // it isn't the same category every visit, without needing any extra state to remember it.
  useEffect(() => {
    let cancelled = false;
    const pool = CATEGORY_TAXONOMY;
    const cat = pool[new Date().getDate() % pool.length];
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/deals?category=${cat.id}&limit=1&sort=newest&country=in`);
        const json = await res.json();
        const total = json.pagination?.total;
        const deal = (json.data || json.deals || [])[0];
        if (!cancelled && deal?.imageUrl && isUsableImageUrl(deal.imageUrl)) {
          setSpotlightCategory({ ...cat, image: deal.imageUrl, count: total });
        }
      } catch (err) {
        // No spotlight this load — slide just doesn't appear, not worth surfacing.
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const slides = [];
  if (topDeal) slides.push({ type: 'top-deal', key: 'top-deal' });
  slides.push({ type: 'static', key: 'flash-sale', image: 'flash-sale', onPress: onOpenHot });
  slides.push({ type: 'static', key: 'whatsapp', image: 'whatsapp', onPress: () => Linking.openURL(WHATSAPP_CHANNEL_URL) });
  if (spotlightCategory) slides.push({ type: 'category', key: 'category' });
  slides.push({ type: 'static', key: 'alerts', image: 'alerts', onPress: onOpenAccount });

  const height = width > 0 ? width / ASPECT_RATIO : 0;

  const goToIndex = (index, animated = true) => {
    if (!scrollRef.current || width === 0) return;
    scrollRef.current.scrollTo({ x: index * width, animated });
    activeIndexRef.current = index;
    setActiveIndex(index);
  };

  const restartAutoAdvance = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      const next = (activeIndexRef.current + 1) % slides.length;
      scrollRef.current?.scrollTo({ x: next * width, animated: true });
      // Deliberately not setting state here — onScroll below is the single source of truth for
      // activeIndex, driven by the ScrollView's real position rather than an optimistic guess.
      // That's what was desyncing the dots from the visible slide before: this timer would mark
      // a slide "active" whether or not the platform's scrollTo actually finished moving there.
    }, AUTO_ADVANCE_MS);
  };

  useEffect(() => {
    if (width === 0 || slides.length < 2) return;
    restartAutoAdvance();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, slides.length]);

  const handleScroll = (e) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / width);
    if (index !== activeIndexRef.current) {
      activeIndexRef.current = index;
      setActiveIndex(index);
    }
  };

  if (height === 0) {
    // Reserve layout space before the first onLayout fires, so nothing above/below jumps.
    return <View style={styles.wrap} onLayout={(e) => setWidth(e.nativeEvent.layout.width)} />;
  }

  return (
    <View style={styles.wrap} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        onScrollBeginDrag={() => { if (timerRef.current) clearInterval(timerRef.current); }}
        onMomentumScrollEnd={restartAutoAdvance}
      >
        {slides.map((slide) => (
          <View key={slide.key} style={{ width, height }}>
            {slide.type === 'static' && (
              <TouchableOpacity activeOpacity={0.92} onPress={slide.onPress} style={styles.staticSlide}>
                <Image source={BANNER_IMAGES[slide.image]} style={styles.staticImage} resizeMode="cover" />
              </TouchableOpacity>
            )}

            {slide.type === 'top-deal' && topDeal && (
              <TouchableOpacity
                activeOpacity={0.92}
                style={[styles.dataSlide, { backgroundColor: '#0a0a0b' }]}
                onPress={() => onOpenDeal(topDeal._id || topDeal.id)}
              >
                <View style={[styles.glow, { backgroundColor: '#FF6B0022' }]} />
                <View style={styles.dataCopy}>
                  <Text style={styles.dataEyebrow}>🔥 TOP DEAL RIGHT NOW</Text>
                  <Text style={styles.dataHeadline} numberOfLines={2}>{topDeal.title}</Text>
                  <View style={styles.priceRow}>
                    <Text style={styles.dataPrice}>₹{Number(topDeal.dealPrice || 0).toLocaleString('en-IN')}</Text>
                    {topDeal.discountPercentage ? (
                      <Text style={styles.dataDiscount}>{topDeal.discountPercentage}% off</Text>
                    ) : null}
                  </View>
                  <View style={[styles.cta, { backgroundColor: '#FF6B00' }]}>
                    <Text style={styles.ctaText}>Grab it</Text>
                    <Ionicons name="arrow-forward" size={16} color="#3a1a00" />
                  </View>
                </View>
                {!!topDeal.imageUrl && (
                  <View style={styles.dataImageBox}>
                    <ExpoImage source={{ uri: topDeal.imageUrl }} style={styles.dataImage} contentFit="contain" cachePolicy="memory-disk" />
                  </View>
                )}
              </TouchableOpacity>
            )}

            {slide.type === 'category' && spotlightCategory && (
              <TouchableOpacity
                activeOpacity={0.92}
                style={[styles.dataSlide, { backgroundColor: '#0a0a0b' }]}
                onPress={() => onSelectCategory(spotlightCategory.id)}
              >
                <View style={[styles.glow, { backgroundColor: `${spotlightCategory.color}22` }]} />
                <View style={styles.dataCopy}>
                  <Text style={[styles.dataEyebrow, { color: spotlightCategory.color }]}>✨ TRENDING CATEGORY</Text>
                  <Text style={styles.dataHeadline} numberOfLines={2}>{spotlightCategory.label}</Text>
                  {typeof spotlightCategory.count === 'number' && (
                    <Text style={styles.dataSubtext}>{spotlightCategory.count.toLocaleString('en-IN')} live deals</Text>
                  )}
                  <View style={[styles.cta, { backgroundColor: spotlightCategory.color }]}>
                    <Text style={styles.ctaText}>Explore</Text>
                    <Ionicons name="arrow-forward" size={16} color="#ffffff" />
                  </View>
                </View>
                <View style={styles.spotlightRingWrap}>
                  <View style={[styles.spotlightRing, { borderColor: spotlightCategory.color }]}>
                    <ExpoImage source={{ uri: spotlightCategory.image }} style={styles.spotlightImage} contentFit="cover" cachePolicy="memory-disk" />
                  </View>
                </View>
              </TouchableOpacity>
            )}
          </View>
        ))}
      </ScrollView>

      {slides.length > 1 && (
        <View style={styles.dots}>
          {slides.map((slide, i) => (
            <TouchableOpacity key={slide.key} hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }} onPress={() => goToIndex(i)}>
              <View style={[styles.dot, i === activeIndex && styles.dotActive]} />
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
  },
  staticSlide: {
    flex: 1,
  },
  staticImage: {
    width: '100%',
    height: '100%',
  },
  dataSlide: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    paddingHorizontal: 20,
  },
  glow: {
    position: 'absolute',
    top: -60,
    right: -60,
    width: 220,
    height: 220,
    borderRadius: 110,
  },
  dataCopy: {
    flex: 1,
    paddingRight: 12,
  },
  dataEyebrow: {
    color: '#FFB800',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  dataHeadline: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 20,
    marginBottom: 6,
  },
  dataSubtext: {
    color: '#cbccd1',
    fontSize: 12.5,
    fontWeight: '600',
    marginBottom: 10,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginBottom: 10,
  },
  dataPrice: {
    color: '#ffffff',
    fontSize: 19,
    fontWeight: '900',
  },
  dataDiscount: {
    color: '#4ade80',
    fontSize: 12.5,
    fontWeight: '800',
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    borderRadius: 9,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  ctaText: {
    color: '#3a1a00',
    fontSize: 12.5,
    fontWeight: '800',
  },
  dataImageBox: {
    width: 96,
    height: 96,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  dataImage: {
    width: '100%',
    height: '100%',
  },
  spotlightRingWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  spotlightRing: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    padding: 4,
    backgroundColor: '#0a0a0b',
  },
  spotlightImage: {
    width: '100%',
    height: '100%',
    borderRadius: 46,
  },
  dots: {
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  dotActive: {
    width: 16,
    backgroundColor: '#ffffff',
  },
});
