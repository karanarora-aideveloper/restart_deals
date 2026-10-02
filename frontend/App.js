import './global.css';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
  RefreshControl,
  Platform,
  TouchableOpacity,
  useWindowDimensions
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Updates from 'expo-updates';
import { Ionicons } from '@expo/vector-icons';
import Header from './src/components/Header';
import WebHeader from './src/components/WebHeader';
import FilterBar from './src/components/FilterBar';
import DealCard from './src/components/DealCard';
import { CategoryStrip, HotDealsCarousel, PriceBucketStrip, DiscountStrip, StoreStrip, StoreBannerCarousel, CategorySpotlightCarousel, TrendingPicksStrip, TrustBadgeStrip, WishlistCarousel, FeedSectionHeader } from './src/components/HomeSections';
import { MERCHANTS } from './src/components/FilterBar';
import { SUBCATEGORY_LOOKUP, CATEGORY_TAXONOMY } from './src/data/categoryTaxonomy';
import HeroCarousel from './src/components/HeroCarousel';
import SortFilterBar, { QuickFilterPills } from './src/components/SortFilterBar';
import ProductCard from './src/components/ProductCard';
import BottomTabBar from './src/components/BottomTabBar';
import CategoriesView from './src/components/CategoriesView';
import LoginProfileView from './src/components/LoginProfileView';
import PrivacyPolicyView from './src/components/PrivacyPolicyView';
import DealDetailView from './src/components/DealDetailView';
import BlogListView from './src/components/BlogListView';
import BlogPostView from './src/components/BlogPostView';
import WebFooter from './src/components/WebFooter';
import { API_BASE_URL } from './src/config';
import { getSavedDeals, saveDealItem, isDealSaved } from './src/utils/savedStorage';
import { isUsableImageUrl } from './src/utils/imageUtils';
import { searchAlgolia, hitToDeal, hitToProduct, DEALS_INDEX, PRODUCTS_INDEX } from './src/utils/algolia';
import { registerForPushNotifications } from './src/utils/pushNotifications';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { logEvent } from './src/utils/analytics';
import { GluestackUIProvider } from '@/components/ui/gluestack-ui-provider';

function MainAppContent() {
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === 'web';
  const isDesktopWeb = isWeb && width > 768;
  const desktopContentWidth = isDesktopWeb ? Math.min(width, 1440) - 64 : width;
  // Myntra-style grid everywhere: 2 columns on phones (native + mobile web),
  // density-scaled columns on desktop web.
  const numColumns = isDesktopWeb ? Math.max(2, Math.floor(desktopContentWidth / 280)) : 2;

  const { user, token, isLoggedIn } = useAuth();
  // Compose auth object for storage util (includes token for DB sync)
  const authUser = user && token ? { ...user, token } : null;

  const getInitialTab = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const path = window.location.pathname;
      if (path === '/privacy') return 'privacy';
      if (path === '/blog' || path === '/blog/') return 'blog';
      if (path.startsWith('/blog/')) return 'blogPost';
      if (path.startsWith('/deal/')) return 'dealDetail';
    }
    return 'deals';
  };
  const [activeTab, setActiveTab] = useState(getInitialTab()); 
  const [selectedDealId, setSelectedDealId] = useState(null);
  const [selectedBlogSlug, setSelectedBlogSlug] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  // Subcategory id (e.g. 'makeup'), sent as its own `subcategory` query param alongside
  // `category` — a real, AI-classified field on Deal/Product (see backend/src/listener/
  // verifier.js), not a client-side keyword guess. subcategoryLabel is just the human-readable
  // breadcrumb text for the active-filter chip.
  const [subcategoryQuery, setSubcategoryQuery] = useState('');
  const [subcategoryLabel, setSubcategoryLabel] = useState('');
  const [merchantFilter, setMerchantFilter] = useState('all');
  // Deals-tab sort/filter refinements — driven by the Home tab's "Shop by Budget" rail (which
  // hands off to the Deals tab, id 'hot', as soon as one is picked) and/or the Deals tab's own
  // Sort/Filter bottom sheets (SortFilterBar). Scoped to deals-type tabs (see isDealsType in
  // fetchData below) so they never bleed into 'products'. priceRangeFilter/discountFilter hold
  // the full bucket/tag object (see
  // src/data/filterOptions.js) — not just the raw number — so the removable chip UI has a label
  // to show without having to reverse-engineer one from the number.
  const [sortOption, setSortOption] = useState('newest');
  const [priceRangeFilter, setPriceRangeFilter] = useState(null);
  const [discountFilter, setDiscountFilter] = useState(null);

  const [items, setItems] = useState([]);
  const [tabTransitioning, setTabTransitioning] = useState(false);
  const [savedDeals, setSavedDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Pagination states
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Load persisted saved deals on launch
  useEffect(() => {
    (async () => {
      const saved = await getSavedDeals(authUser);
      setSavedDeals(saved);
    })();
  }, [user]);

  // Register for push notifications (Android first — see registerForPushNotifications).
  // Native only: this app's Platform.OS === 'web' path is the old Expo-web export, unused now
  // that the real web experience lives in frontend/web, and expo-notifications doesn't target it.
  useEffect(() => {
    if (Platform.OS !== 'web') {
      registerForPushNotifications();
    }
  }, []);

  // EAS Update (OTA): on native app start, silently check for a newer published JS bundle and
  // apply it — this is what lets screens like this one ship to installed apps without an app
  // store review. No-op on web (that ships via the normal Vercel deploy) and in dev/Expo Go
  // (expo-updates is inert there). Requires the running binary to already have expo-updates
  // compiled in — see the "publishing an OTA update" note in README/CLAUDE.md for the one-time
  // native build this needs before `eas update` can reach a device.
  useEffect(() => {
    if (Platform.OS === 'web' || __DEV__) return;
    (async () => {
      try {
        const result = await Updates.checkForUpdateAsync();
        if (result.isAvailable) {
          await Updates.fetchUpdateAsync();
          await Updates.reloadAsync();
        }
      } catch (err) {
        // Best-effort — offline, no update service reachable, etc. should never block the app
        // from running with whatever JS it already has.
        console.error('OTA update check failed:', err?.message);
      }
    })();
  }, []);

  const handleTabChange = (tabId) => {
    // 'saved' works guest-only via device storage regardless of sign-in state — no gating.
    if (tabId !== activeTab) {
      setTabTransitioning(true);
      setActiveTab(tabId);
      // Brief delay so JS thread unblocks, animation runs, and scroll resets
      setTimeout(() => {
        setTabTransitioning(false);
      }, 80);
    }
  };

  // FilterBar's category pills: switch category, always clear any active subcategory (a plain
  // top-level pill means "browse the whole category"), stay on the current tab. Used on the
  // Deals tab itself, where category pills should just refine the list in place.
  const handleFilterBarCategory = (catId) => {
    setCategoryFilter(catId);
    setSubcategoryQuery('');
    setSubcategoryLabel('');
  };

  // Home screen's category strip / hero spotlight: picking a category from Home jumps over to
  // the Deals tab with that category applied, rather than filtering in place — Home is a pure
  // landing page now, the Deals tab is where the filterable list actually lives.
  const handleSelectCategoryGoToDeals = (catId) => {
    setCategoryFilter(catId);
    setSubcategoryQuery('');
    setSubcategoryLabel('');
    handleTabChange('hot');
  };

  // Browse tab: either "Shop All {category}" (subQuery/subLabel empty) or a specific
  // subcategory chip — either way, jump to the Deals tab to show the result.
  const handleBrowseCategorySelect = (catId, subQuery = '', subLabel = '') => {
    setCategoryFilter(catId);
    setSubcategoryQuery(subQuery);
    setSubcategoryLabel(subLabel);
    handleTabChange('hot');
  };

  const handleClearSubcategory = () => {
    setSubcategoryQuery('');
    setSubcategoryLabel('');
  };

  // "Shop by Budget" circle tap (home) — sets the price filter and, like the category strip,
  // hands off to the Deals tab where that filter actually takes effect.
  const handleSelectPriceBucket = (bucket) => {
    setPriceRangeFilter(bucket);
    handleTabChange('hot');
  };

  // "Shop by Discount" circle tap (home) — same hand-off, but for the minDiscount tiers.
  const handleSelectDiscountBucket = (tag) => {
    setDiscountFilter(tag);
    handleTabChange('hot');
  };

  // "Shop by Store" circle tap (home) — same hand-off, but for the merchant filter FilterBar's
  // own pills set on the Deals tab.
  const handleSelectStore = (mer) => {
    setMerchantFilter(mer.id);
    handleTabChange('hot');
  };

  const handleSelectSort = (key) => setSortOption(key);

  // Filter sheet's "Apply" — commits the price, discount, and category draft all at once so the
  // list only refetches once, not up to three times, when a shopper changes more than one in the
  // same visit to the sheet. A category change here means "browse the whole category" same as
  // FilterBar's own category pills (handleFilterBarCategory) — clears any stale subcategory too.
  const handleApplyFilters = (price, discount, category) => {
    setPriceRangeFilter(price);
    setDiscountFilter(discount);
    setCategoryFilter(category || 'all');
    setSubcategoryQuery('');
    setSubcategoryLabel('');
  };

  const handleClearPrice = () => setPriceRangeFilter(null);
  const handleClearDiscount = () => setDiscountFilter(null);
  const handleClearCategory = () => setCategoryFilter('all');
  // 'all' is merchantFilter's unfiltered default (see useState above) — clearing means going back
  // to that, not null, so the FilterBar/StoreStrip pills correctly show "All Stores" as active again.
  const handleClearMerchant = () => setMerchantFilter('all');

  const handleToggleSave = async (deal) => {
    // saveDealItem falls back to device storage when signed out (authUser is null).
    const updated = await saveDealItem(deal, authUser);
    setSavedDeals(updated);
    if (!isDealSaved(deal._id || deal.id, savedDeals)) {
      logEvent('add_to_wishlist', { item_id: deal._id || deal.id, item_name: deal.title });
    }
  };

  // Backstop for the rare case an imageUrl looks valid (passes isUsableImageUrl) but still
  // fails to actually load — e.g. a genuinely dead external link, not just the known-localhost
  // pattern already filtered out in fetchData. Removes the item from view entirely rather than
  // leaving it visible without a photo.
  const handleImageUnavailable = useCallback((id) => {
    if (!id) return;
    setItems((prev) => prev.filter((i) => (i._id || i.id || i.productId) !== id));
  }, []);

  const handleSavedImageUnavailable = useCallback((id) => {
    if (!id) return;
    setSavedDeals((prev) => prev.filter((i) => (i._id || i.id) !== id));
  }, []);

  // Fetch Deals or Products from backend API
  const fetchData = useCallback(async (isRefresh = false, pageNum = 1, isLoadMore = false) => {
    if (activeTab === 'categories' || activeTab === 'saved' || activeTab === 'profile' || activeTab === 'privacy') {
      setLoading(false);
      return;
    }

    if (!isRefresh && !isLoadMore && items.length === 0) setLoading(true);

    const isDealsType = activeTab === 'deals' || activeTab === 'hot';
    const endpoint = isDealsType ? '/api/deals' : '/api/products';
    const isSearching = searchQuery.trim().length > 0;

    try {
      let dataList;
      let more;

      if (isSearching) {
        // A non-empty query is handled by Algolia instead of the backend's plain regex `q`
        // search — typo-tolerant, ranked by relevance/discount, and far faster. category/
        // merchant filters aren't wired up here (rare combination in practice — search box vs.
        // category chips), so this intentionally ignores them rather than silently pretending
        // to honor them.
        const indexName = isDealsType ? DEALS_INDEX : PRODUCTS_INDEX;
        const res = await searchAlgolia({
          indexName,
          query: searchQuery.trim(),
          page: pageNum - 1, // Algolia pages are 0-indexed
          hitsPerPage: 40,
        });
        dataList = res.hits.map(isDealsType ? hitToDeal : hitToProduct);
        more = pageNum < res.nbPages;
      } else {
        const params = new URLSearchParams({
          page: pageNum,
          limit: 40,
          q: '',
          category: categoryFilter,
          // A subcategory picked from Browse is its own real, AI-classified field on the
          // deal/product — filtered server-side alongside category, not a keyword guess.
          subcategory: subcategoryQuery || 'all',
          merchant: merchantFilter,
          country: 'in',
          // Sort/price/discount refinements are scoped to the deals-type tabs — 'deals' (Home)
          // and 'hot' (Deals) — only; 'products' keeps its existing recently_checked default.
          // Home never actually deviates from the defaults itself (picking a category/price/sort
          // on Home hands off to the Deals tab instead, see handleSelectCategoryGoToDeals/
          // handleSelectPriceBucket above), but sharing the scoping keeps both tabs consistent.
          sort: isDealsType ? sortOption : 'recently_checked',
        });
        if (isDealsType && priceRangeFilter?.maxPrice) {
          params.set('maxPrice', priceRangeFilter.maxPrice);
        }
        if (isDealsType && discountFilter?.minDiscount) {
          params.set('minDiscount', discountFilter.minDiscount);
        }
        const res = await fetch(`${API_BASE_URL}${endpoint}?${params}`);
        const json = await res.json();
        dataList = json.data || json.deals || [];
        more = dataList.length > 0;
      }

      // hasMore reflects what the API/index actually had for this page — checked before the
      // image filter below so a page that happens to be mostly imageless doesn't look like
      // "no more results" and cut pagination short.
      setHasMore(more);

      // Deals/products with no image, or a known-unreachable (localhost) image URL, are
      // dropped entirely rather than shown without a photo — a missing product image
      // undermines trust in the deal more than just not showing that deal at all.
      dataList = dataList.filter((d) => isUsableImageUrl(d.imageUrl));

      setItems((prev) => {
        if (isLoadMore) {
          // Append new unique items to the bottom
          const existingIds = new Set(prev.map(i => i._id || i.id || i.productId));
          const newItems = dataList.filter(i => !existingIds.has(i._id || i.id || i.productId));
          return [...prev, ...newItems];
        } else if (isRefresh && prev.length > 0 && pageNum === 1) {
          // Polling updates: Bump updated deals to the top and prepend new deals
          const dataListIds = new Set(dataList.map(i => i._id || i.id || i.productId));
          // Remove existing items that are in the new dataList (so they don't duplicate when prepended)
          const remainingList = prev.filter(i => !dataListIds.has(i._id || i.id || i.productId));
          // Prepend the new dataList (which is already sorted newest-first from the API)
          return [...dataList, ...remainingList];
        } else {
          // Initial load or filter change
          return dataList;
        }
      });
    } catch (err) {
      console.error(`Failed to fetch ${activeTab}:`, err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
      if (isLoadMore) setLoadingMore(false);
    }
  }, [activeTab, searchQuery, categoryFilter, subcategoryQuery, merchantFilter, sortOption, priceRangeFilter, discountFilter, items.length]);

  // Initial load and filter change trigger
  useEffect(() => {
    setPage(1);
    setHasMore(true);
    fetchData(false, 1, false);

    if (searchQuery.trim().length > 0) {
      logEvent('search', { search_term: searchQuery.trim() });
    }
    if (categoryFilter !== 'all') {
      logEvent('view_item_list', { item_category: categoryFilter, subcategory: subcategoryLabel || undefined });
    }
  }, [activeTab, searchQuery, categoryFilter, subcategoryQuery, merchantFilter, sortOption, priceRangeFilter, discountFilter]); // explicitly tracking dependencies instead of fetchData

  // Real-time polling every 4 seconds for live incoming deals when on live feeds. Skipped while
  // actively searching — re-querying Algolia every 4s would occasionally reorder a shopper's
  // search results mid-read, which reads as broken rather than "live" the way it does on the
  // unfiltered feed.
  useEffect(() => {
    if (activeTab === 'categories' || activeTab === 'saved' || activeTab === 'profile' || activeTab === 'privacy') return;
    if (searchQuery.trim().length > 0) return;
    const interval = setInterval(() => {
      fetchData(true, 1, false);
    }, 4000);
    return () => clearInterval(interval);
  }, [fetchData, activeTab, searchQuery]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData(true, 1, false);
  };

  const handleLoadMore = () => {
    if (loadingMore || !hasMore || loading) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    setPage(nextPage);
    fetchData(false, nextPage, true);
  };

  const handleOpenDeal = (dealId) => {
    logEvent('select_item', { item_id: dealId, item_list_name: activeTab });
    setSelectedDealId(dealId);
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.history.pushState({}, '', `/deal/${dealId}`);
    }
    setActiveTab('dealDetail');
  };

  const renderItem = ({ item }) => {
    if (activeTab === 'products') {
      return <ProductCard product={item} onImageUnavailable={handleImageUnavailable} />;
    }
    const saved = isDealSaved(item._id || item.id, savedDeals);
    return <DealCard deal={item} isSaved={saved} onToggleSave={handleToggleSave} onPress={() => handleOpenDeal(item._id || item.id)} onImageUnavailable={handleImageUnavailable} />;
  };

  // 'deals' id is the Home tab; 'hot' id is the Deals tab (the full filterable list) — see
  // BottomTabBar.js for the user-facing labels. Category/price-bucket taps on Home always hand
  // off to the Deals tab (see handleSelectCategoryGoToDeals/handleSelectPriceBucket above)
  // rather than filtering in place, so categoryFilter/sort/price/discount no longer gate Home's
  // own view — leftover Deals-tab filter state should never make Home itself look "filtered"
  // when the shopper switches back. The one thing that can still legitimately apply while on
  // Home is the shared search bar (WebHeader's search box works from any tab), so that's the
  // only thing that still flips Home from its landing layout to a plain filtered grid.
  const isHomeTab = activeTab === 'deals';
  const isHomeView = isHomeTab && searchQuery.trim().length === 0;

  // Home screen's "Hot Right Now" carousel — reuses whatever the Deals tab already has loaded
  // (no separate fetch) rather than re-querying the API for a second, slightly-different list.
  const hotHomeDeals = useMemo(() => {
    if (!isHomeView) return [];
    return items
      .filter((d) => d.discountPercentage && d.discountPercentage >= 40)
      .sort((a, b) => (b.discountPercentage || 0) - (a.discountPercentage || 0))
      .slice(0, 10);
  }, [items, isHomeView]);

  // Home's "Top Store Deals" banner carousel — for each real merchant (not the 'all' entry),
  // whichever of its deals in the already-loaded home feed has the biggest live discount right
  // now, mirroring DealCard's own dealUrl-substring merchant detection (see api's regex match on
  // the same field). A store with nothing live in the current feed simply gets no card — never
  // a fabricated "offer" standing in for a real one.
  const storeBanners = useMemo(() => {
    if (!isHomeView) return [];
    const detectors = {
      amazon: (u) => u.includes('amazon') || u.includes('amzn'),
      flipkart: (u) => u.includes('flipkart') || u.includes('fkrt') || u.includes('fktr') || u.includes('affiliates.app.link'),
      myntra: (u) => u.includes('myntra'),
      meesho: (u) => u.includes('meesho'),
    };
    return MERCHANTS.filter((m) => m.id !== 'all')
      .map((mer) => {
        const isMatch = detectors[mer.id];
        const best = items
          .filter((d) => isMatch((d.dealUrl || '').toLowerCase()) && d.discountPercentage > 0)
          .sort((a, b) => (b.discountPercentage || 0) - (a.discountPercentage || 0))[0];
        if (!best) return null;
        return {
          merchantId: mer.id,
          label: mer.label.replace(/^[^\w]+\s*/, ''),
          logo: mer.logo,
          logoScale: mer.logoScale,
          colors: mer.colors,
          bestDiscount: best.discountPercentage,
          dealTitle: best.title || '',
          dealImage: best.imageUrl && isUsableImageUrl(best.imageUrl) ? best.imageUrl : null,
        };
      })
      .filter(Boolean);
  }, [items, isHomeView]);

  // Home's "Trending Picks" rail — whichever subcategories actually have live deals right now
  // in the home feed, each card showing that subcategory's own cheapest live price. Grouped
  // straight off each deal's real classified `subcategory` field (see api's deal model), resolved
  // to a label/icon/color via SUBCATEGORY_LOOKUP — never a curated/seasonal pick list.
  const trendingPicks = useMemo(() => {
    if (!isHomeView) return [];
    const bySubcat = {};
    items.forEach((d) => {
      if (!d.subcategory || !d.dealPrice) return;
      const meta = SUBCATEGORY_LOOKUP[d.subcategory];
      if (!meta) return;
      const existing = bySubcat[d.subcategory];
      if (!existing) {
        bySubcat[d.subcategory] = { ...meta, subcategoryId: d.subcategory, fromPrice: d.dealPrice, count: 1 };
      } else {
        existing.count += 1;
        if (d.dealPrice < existing.fromPrice) existing.fromPrice = d.dealPrice;
      }
    });
    return Object.values(bySubcat)
      .sort((a, b) => b.count - a.count)
      .slice(0, 8)
      .map((p) => ({
        ...p,
        color: p.parentColor,
        fromPrice: p.fromPrice.toLocaleString('en-IN'),
      }));
  }, [items, isHomeView]);

  const handleSelectTrendingPick = (pick) => {
    handleBrowseCategorySelect(pick.parentCategoryId, pick.subcategoryId, `${pick.parentLabel.split(' & ')[0]} · ${pick.label}`);
  };

  // Home's "Category Spotlight" carousel — whichever top-level categories actually have the most
  // live deals right now in the home feed, each card showing that category's own deal count and
  // its single best-discount deal's real photo. Same real-data approach as storeBanners above,
  // grouped by `d.category` instead of merchant.
  const categorySpotlights = useMemo(() => {
    if (!isHomeView) return [];
    const byCategory = {};
    items.forEach((d) => {
      if (!d.category) return;
      const existing = byCategory[d.category];
      if (!existing) {
        byCategory[d.category] = { categoryId: d.category, count: 1, bestDeal: d };
      } else {
        existing.count += 1;
        if ((d.discountPercentage || 0) > (existing.bestDeal.discountPercentage || 0)) existing.bestDeal = d;
      }
    });
    return Object.values(byCategory)
      .map((entry) => {
        const meta = CATEGORY_TAXONOMY.find((c) => c.id === entry.categoryId);
        if (!meta) return null;
        return {
          categoryId: entry.categoryId,
          label: meta.pillLabel,
          icon: `${meta.icon}-outline`,
          color: meta.color,
          count: entry.count,
          dealImage: entry.bestDeal.imageUrl && isUsableImageUrl(entry.bestDeal.imageUrl) ? entry.bestDeal.imageUrl : null,
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [items, isHomeView]);

  const handleOpenCategorySpotlight = (catId) => handleSelectCategoryGoToDeals(catId);

  const renderMainContent = () => {
    if (tabTransitioning) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#FF6B00" />
        </View>
      );
    }

    if (activeTab === 'privacy') {
      return <PrivacyPolicyView setActiveTab={setActiveTab} />;
    }

    if (activeTab === 'blog') {
      return (
        <BlogListView 
          setActiveTab={setActiveTab}
          onPressBlog={(slug) => {
            setSelectedBlogSlug(slug);
            if (Platform.OS === 'web' && typeof window !== 'undefined') {
              window.history.pushState({}, '', `/blog/${slug}`);
            }
            setActiveTab('blogPost');
          }}
        />
      );
    }

    if (activeTab === 'blogPost') {
      let currentSlug = selectedBlogSlug;
      if (!currentSlug && Platform.OS === 'web' && typeof window !== 'undefined') {
        const path = window.location.pathname;
        if (path.startsWith('/blog/')) {
          currentSlug = path.split('/blog/')[1];
        }
      }
      return (
        <BlogPostView 
          slug={currentSlug}
          setActiveTab={setActiveTab}
          onBack={() => {
            setSelectedBlogSlug(null);
            if (Platform.OS === 'web' && typeof window !== 'undefined') {
              window.history.pushState({}, '', '/blog');
            }
            setActiveTab('blog');
          }}
        />
      );
    }

    if (activeTab === 'dealDetail') {
      let currentDealId = selectedDealId;
      if (!currentDealId && Platform.OS === 'web' && typeof window !== 'undefined') {
        const path = window.location.pathname;
        if (path.startsWith('/deal/')) {
          currentDealId = path.split('/deal/')[1];
        }
      }
      return (
        <DealDetailView 
          dealId={currentDealId} 
          setActiveTab={setActiveTab}
          onBack={() => {
            setSelectedDealId(null);
            if (Platform.OS === 'web' && typeof window !== 'undefined') {
              window.history.pushState({}, '', '/');
            }
            setActiveTab('deals');
          }} 
        />
      );
    }

    if (activeTab === 'profile') {
      return <LoginProfileView savedCount={savedDeals.length} setActiveTab={setActiveTab} />;
    }

    if (activeTab === 'categories') {
      return (
        <CategoriesView
          onSelectCategory={handleBrowseCategorySelect}
          setActiveTab={setActiveTab}
        />
      );
    }

    if (activeTab === 'saved') {
      return (
        <FlashList
          estimatedItemSize={200}
          key={`grid-saved-${numColumns}-${activeTab}`}
          numColumns={numColumns}
          columnWrapperStyle={{ gap: isDesktopWeb ? 20 : 10, alignItems: 'flex-start' }}
          data={savedDeals}
          keyExtractor={(item) => item._id || item.id || Math.random().toString()}
          renderItem={({ item }) => (
            <DealCard deal={item} isSaved={true} onToggleSave={handleToggleSave} onPress={() => handleOpenDeal(item._id || item.id)} onImageUnavailable={handleSavedImageUnavailable} />
          )}
          contentContainerStyle={isDesktopWeb ? styles.listPaddingDesktop : styles.listPadding}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              {isLoggedIn ? (
                <>
                  <Text style={styles.emptyTitle}>No Saved Deals Yet</Text>
                  <Text style={styles.emptySub}>
                    Tap the heart icon on any deal to save it for quick access later.
                  </Text>
                </>
              ) : (
                <>
                  <Ionicons name="heart-outline" size={40} color="#dddddd" style={{ marginBottom: 10 }} />
                  <Text style={styles.emptyTitle}>Log In to Save Deals</Text>
                  <Text style={styles.emptySub}>
                    Sign in to save deals across devices — we'll notify you if the price drops even lower.
                  </Text>
                  <TouchableOpacity
                    style={styles.emptyLoginBtn}
                    activeOpacity={0.85}
                    onPress={() => setActiveTab('profile')}
                  >
                    <Text style={styles.emptyLoginBtnText}>Log In</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          }
          ListFooterComponent={
            <View style={{ marginHorizontal: -12 }}>
              <WebFooter setActiveTab={setActiveTab} />
            </View>
          }
        />
      );
    }

    if (loading) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#ff6b00" />
          <Text style={styles.loadingText}>⚡ Fetching Latest Hot Deals...</Text>
          <Text style={styles.loadingSubText}>Scanning Amazon · Flipkart · Myntra</Text>
        </View>
      );
    }

    return (
      <FlashList
        estimatedItemSize={200}
        key={`grid-items-${numColumns}-${activeTab}`}
        numColumns={numColumns}
        columnWrapperStyle={{ gap: isDesktopWeb ? 20 : 10 }}
        data={items}
        keyExtractor={(item) => item._id || item.productId || Math.random().toString()}
        renderItem={renderItem}
        // Extra bottom padding while SortFilterBar's floating Sort/Store/Filter capsule is on
        // screen (Deals tab, not actively searching) so the last row can scroll clear of it.
        contentContainerStyle={
          activeTab === 'hot' && searchQuery.trim().length === 0
            ? {
                ...(isDesktopWeb ? styles.listPaddingDesktop : styles.listPadding),
                paddingBottom:
                  (isDesktopWeb ? styles.listPaddingDesktop.paddingBottom : styles.listPadding.paddingBottom) + 80,
              }
            : isDesktopWeb
            ? styles.listPaddingDesktop
            : styles.listPadding
        }
        ListHeaderComponent={
          <>
            {Platform.OS === 'web' && (
              <View style={{ position: 'absolute', opacity: 0, height: 0 }}>
                <Text accessibilityRole="heading" aria-level={2}>
                  Live Shopping Deals & Discounts - Save on Amazon & Flipkart
                </Text>
              </View>
            )}
            {/* Home screen sections — Swiggy/Myntra-style: a full-bleed hero carousel, a greeting,
                a circular category rail (always available so you can jump categories from home),
                a "Hot Right Now" carousel and a "Shop by Budget" price-bucket rail (home view
                only — hidden once a category/search/sort/filter narrows the feed, at which point
                SortFilterBar's sort/filter controls take over below FilterBar instead — see the
                showFilterBar block further down), then a labeled hand-off into the plain vertical
                feed FlashList renders below. */}
            {isHomeTab && isHomeView && (
              <View style={Platform.OS !== 'web' ? { marginHorizontal: -12, marginBottom: 4 } : { marginBottom: 4 }}>
                <HeroCarousel
                  topDeal={hotHomeDeals[0]}
                  onOpenDeal={handleOpenDeal}
                  onOpenHot={() => handleTabChange('hot')}
                  onOpenAccount={() => handleTabChange('profile')}
                  onSelectCategory={handleSelectCategoryGoToDeals}
                />
              </View>
            )}
            {isHomeTab && isHomeView && <TrustBadgeStrip />}
            {isHomeTab && (
              <CategoryStrip
                categoryFilter={categoryFilter}
                onSelectCategory={handleSelectCategoryGoToDeals}
                onOpenBrowse={() => handleTabChange('categories')}
              />
            )}
            {isHomeTab && isHomeView && (
              <HotDealsCarousel
                deals={hotHomeDeals}
                onOpenDeal={handleOpenDeal}
                savedDeals={savedDeals}
                onToggleSave={handleToggleSave}
                isDealSaved={isDealSaved}
                onImageUnavailable={handleImageUnavailable}
              />
            )}
            {isHomeTab && isHomeView && (
              <TrendingPicksStrip picks={trendingPicks} onSelectPick={handleSelectTrendingPick} />
            )}
            {isHomeTab && isHomeView && (
              <PriceBucketStrip onSelectBucket={handleSelectPriceBucket} />
            )}
            {isHomeTab && isHomeView && (
              <DiscountStrip onSelectDiscount={handleSelectDiscountBucket} />
            )}
            {isHomeTab && isHomeView && (
              <StoreBannerCarousel banners={storeBanners} onOpenBanner={(id) => handleSelectStore({ id })} />
            )}
            {isHomeTab && isHomeView && (
              <StoreStrip merchantFilter={merchantFilter} onSelectStore={handleSelectStore} />
            )}
            {isHomeTab && isHomeView && (
              <CategorySpotlightCarousel spotlights={categorySpotlights} onOpenSpotlight={handleOpenCategorySpotlight} />
            )}
            {isHomeTab && isHomeView && savedDeals.length > 0 && (
              <WishlistCarousel
                deals={savedDeals.slice(0, 10)}
                onOpenDeal={handleOpenDeal}
                savedDeals={savedDeals}
                onToggleSave={handleToggleSave}
                isDealSaved={isDealSaved}
                onImageUnavailable={handleImageUnavailable}
              />
            )}
            {isHomeTab && <FeedSectionHeader />}
          </>
        }
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh} 
            tintColor="#ff6b00" 
            colors={['#ff6b00']}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>No Deals Found</Text>
            <Text style={styles.emptySub}>
              Try clearing filters or check back in a few seconds as new live deals arrive.
            </Text>
          </View>
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          <View style={{ marginHorizontal: -12 }}>
            {loadingMore ? (
              <View style={{ padding: 20, alignItems: 'center' }}>
                <ActivityIndicator size="small" color="#ff6b00" />
              </View>
            ) : null}
            <WebFooter setActiveTab={setActiveTab} />
          </View>
        }
      />
    );
  };

  // On web, Home's and Deals' FilterBar would now render completely empty: hideSearch is already
  // true there (WebHeader owns the search box) and hideCategories/hideMerchants above hide the
  // rest — Home has its own CategoryStrip/StoreStrip, Deals now picks store via SortFilterBar's
  // floating Store button. Skip mounting it there entirely rather than leaving a blank bordered
  // bar. Native still needs it on both for its search input (Header has none of its own).
  const showFilterBar =
    ((activeTab === 'deals' || activeTab === 'hot') && !isWeb) || activeTab === 'products';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <StatusBar style="dark" backgroundColor="#ffffff" translucent={false} />
      <View style={styles.outerContainer}>
        
        {/* Shared web header (desktop + mobile web). Native app uses Header below instead. */}
        {isWeb && (
          <WebHeader
            activeTab={activeTab}
            setActiveTab={handleTabChange}
            savedCount={savedDeals.length}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
          />
        )}

        <View style={[styles.innerContainer, isDesktopWeb && styles.innerContainerDesktop]}>
          {/* Native app brand header (web uses WebHeader above instead) */}
          {!isWeb && (
            <Header
              activeTab={activeTab}
              setActiveTab={handleTabChange}
              savedCount={savedDeals.length}
            />
          )}

          {/* Search & Filter Control Pills (for deal & product lists) */}
          {showFilterBar && (
            <FilterBar
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              categoryFilter={categoryFilter}
              onSelectCategory={handleFilterBarCategory}
              merchantFilter={merchantFilter}
              setMerchantFilter={setMerchantFilter}
              hideSearch={isWeb}
              // Home has its own category strip, and the Deals tab's category pills were a
              // redundant top row now that category is normally set via Home/Browse before
              // landing here — hidden on both, still shown on Products where no such strip exists.
              hideCategories={isHomeTab || activeTab === 'hot'}
              // The Deals tab's store selection now lives in SortFilterBar's floating "Store"
              // button (a bottom-sheet list, same as Sort) instead of this always-visible pill
              // row — one less permanently-on-screen row, consistent with hiding categories above.
              hideMerchants={isHomeTab || activeTab === 'hot'}
            />
          )}

          {/* Sort/Filter controls — the Deals tab ('hot' id) only, hidden while actively
              searching, since a non-empty query is handled by Algolia and doesn't honor
              sort/price/discount (see fetchData's isSearching branch). */}
          {activeTab === 'hot' && searchQuery.trim().length === 0 && (
            <QuickFilterPills sortOption={sortOption} onSelectSort={handleSelectSort} />
          )}

          {activeTab === 'hot' && searchQuery.trim().length === 0 && (
            <SortFilterBar
              sortOption={sortOption}
              onSelectSort={handleSelectSort}
              categoryFilter={categoryFilter}
              priceFilter={priceRangeFilter}
              discountFilter={discountFilter}
              merchantFilter={merchantFilter}
              onSelectMerchant={setMerchantFilter}
              onApplyFilters={handleApplyFilters}
              onClearPrice={handleClearPrice}
              onClearDiscount={handleClearDiscount}
              onClearMerchant={handleClearMerchant}
              onClearCategory={handleClearCategory}
            />
          )}

          {/* Active subcategory breadcrumb (set via the Browse tab's category accordion, or
              Home's Trending Picks rail) — independent of FilterBar's own visibility (showFilterBar
              excludes web's Deals tab now, see above) since this is its own UI element, gated on
              the tab it's actually relevant to instead. */}
          {(activeTab === 'hot' || activeTab === 'products') && !!subcategoryLabel && (
            <View style={styles.subcategoryBar}>
              <View style={styles.subcategoryPill}>
                <Ionicons name="pricetag" size={12} color="#FF6B00" />
                <Text style={styles.subcategoryPillText} numberOfLines={1}>{subcategoryLabel}</Text>
                <TouchableOpacity onPress={handleClearSubcategory} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close-circle" size={16} color="#94a3b8" />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Main Content Area */}
          <View style={[{ flex: 1 }, isDesktopWeb && { width: '100%', maxWidth: 1440, alignSelf: 'center' }]}>
            {renderMainContent()}
          </View>

          {/* Bottom Navigation Bar with dynamic bottom inset */}
          {!isDesktopWeb && (
            <BottomTabBar 
              activeTab={activeTab} 
              setActiveTab={handleTabChange} 
              savedCount={savedDeals.length}
            />
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <GluestackUIProvider mode="light">
        <AuthProvider>
          <MainAppContent />
        </AuthProvider>
      </GluestackUIProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  outerContainer: {
    flex: 1,
    backgroundColor: '#f5f5f6',
    alignItems: 'center',
  },
  innerContainer: {
    flex: 1,
    width: '100%',
    backgroundColor: '#f5f5f6',
    // Positioning context for SortFilterBar's floating Sort/Store/Filter capsule, which pins
    // itself just above BottomTabBar via `position: absolute` (see SortFilterBar.js).
    position: 'relative',
  },
  innerContainerDesktop: {
    flex: 1,
    width: '100%',
    alignSelf: 'stretch',
    borderLeftWidth: 0,
    borderRightWidth: 0,
  },
  subcategoryBar: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
    backgroundColor: '#ffffff',
  },
  subcategoryPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff4ed',
    borderWidth: 1,
    borderColor: '#ffddc0',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    maxWidth: '100%',
  },
  subcategoryPillText: {
    color: '#c2410c',
    fontSize: 12.5,
    fontWeight: '700',
    flexShrink: 1,
  },
  listPadding: {
    padding: 12,
    paddingBottom: 100,
    backgroundColor: '#f5f5f6',
  },
  listPaddingDesktop: {
    paddingHorizontal: 0,
    paddingTop: 24,
    paddingBottom: 80,
    backgroundColor: '#f5f5f6',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    color: '#1a1a1a',
    fontSize: 14,
    marginTop: 14,
    fontWeight: '700',
  },
  loadingSubText: {
    color: '#999999',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
  },
  emptyContainer: {
    paddingVertical: 60,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    color: '#1a1a1a',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
  },
  emptySub: {
    color: '#999999',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyLoginBtn: {
    backgroundColor: '#FF6B00',
    borderRadius: 10,
    paddingHorizontal: 28,
    paddingVertical: 12,
    marginTop: 18,
  },
  emptyLoginBtnText: {
    color: '#ffffff',
    fontSize: 13.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});
