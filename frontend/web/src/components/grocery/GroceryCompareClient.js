'use client';

import React, { useState, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  BlinkitLogo,
  InstamartLogo,
} from '@/components/BrandAndStoreLogos';
import {
  GWALIOR_STAPLES_CATALOG,
  GROCERY_CATEGORIES,
  searchGroceryCatalog,
} from '@/lib/groceryConfig';

export default function GroceryCompareClient() {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [products, setProducts] = useState(() => searchGroceryCatalog({ localityId: 'city-centre' }));
  const [isLoading, setIsLoading] = useState(false);
  const [dataSource, setDataSource] = useState('benchmark'); // 'live' | 'benchmark'
  const [liveEtas, setLiveEtas] = useState([]);
  const [basket, setBasket] = useState({}); // { itemId: quantity }
  const [isDetectingGps, setIsDetectingGps] = useState(false);
  const [userLocation, setUserLocation] = useState({
    lat: 28.6139,
    lng: 77.2090,
    localityName: 'Tap "Use My GPS" or enter location',
    city: '',
    pincode: '',
    isExactGps: false,
  });
  const [locationStatus, setLocationStatus] = useState(null);
  const [showBasketModal, setShowBasketModal] = useState(false);
  const [addressSearchQuery, setAddressSearchQuery] = useState('');
  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);
  const [showAddressSearch, setShowAddressSearch] = useState(false);
  const [isSyncingEtas, setIsSyncingEtas] = useState(false);

  // Auto-detect GPS on initial visit if allowed
  React.useEffect(() => {
    if (typeof window !== 'undefined' && 'geolocation' in navigator) {
      handleDetectGps({ silent: true });
    }
  }, []);

  // Derived live dark store objects
  const blinkitLive = useMemo(() => {
    return liveEtas.find((e) => (e.platform || '').toLowerCase().includes('blink'));
  }, [liveEtas]);

  const instamartLive = useMemo(() => {
    return liveEtas.find((e) => (e.platform || '').toLowerCase().includes('swiggy'));
  }, [liveEtas]);

  // Clean web URLs for Desktop Chrome & Universal App Links for Mobile
  const getBlinkitLink = (item) => {
    if (item.blinkit?.url && item.blinkit.url.startsWith('http')) {
      return item.blinkit.url;
    }
    if (item.blinkit?.deepLink && item.blinkit.deepLink.startsWith('http')) {
      return item.blinkit.deepLink;
    }
    return `https://blinkit.com/s/?q=${encodeURIComponent(item.name)}`;
  };

  const getInstamartLink = (item) => {
    if (item.instamart?.url && item.instamart.url.startsWith('http')) {
      return item.instamart.url;
    }
    if (item.instamart?.deepLink && item.instamart.deepLink.startsWith('http')) {
      return item.instamart.deepLink;
    }
    return `https://www.swiggy.com/instamart/search?query=${encodeURIComponent(item.name)}`;
  };

  // Live dark store data sync whenever userLocation or category changes
  React.useEffect(() => {
    let isCancelled = false;

    async function syncDarkStoreEtas() {
      setIsSyncingEtas(true);
      try {
        const { lat, lng, localityName, pincode, city } = userLocation;

        const url = `/api/grocery/compare?lat=${lat}&lng=${lng}&localityName=${encodeURIComponent(
          localityName
        )}&pincode=${pincode || ''}&city=${encodeURIComponent(city || 'Your Location')}&category=${selectedCategory}`;

        const res = await fetch(url);
        if (!res.ok) return;
        const data = await res.json();

        if (!isCancelled && data.success) {
          if (Array.isArray(data.storesEta) && data.storesEta.length > 0) {
            setLiveEtas(data.storesEta);
          }
          if (Array.isArray(data.results) && data.results.length > 0) {
            setProducts(data.results);
            setDataSource(data.source === 'live' ? 'live' : 'benchmark');
          }
        }
      } catch (err) {
        // Fallback safely to catalog
      } finally {
        if (!isCancelled) {
          setIsSyncingEtas(false);
        }
      }
    }

    syncDarkStoreEtas();

    return () => {
      isCancelled = true;
      setIsSyncingEtas(false);
    };
  }, [userLocation, selectedCategory]);

  // Instant local filtering + debounced background live search
  React.useEffect(() => {
    let isCancelled = false;
    const q = searchQuery.trim();

    if (!q) {
      return;
    }

    // 3. User typed a query (>= 2 chars): show subtle background sync while querying live dark stores
    setIsLoading(true);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 4500); // 4.5s max client timeout

    const timer = setTimeout(async () => {
      try {
        const { lat, lng, localityName, pincode, city } = userLocation;

        const url = `/api/grocery/compare?q=${encodeURIComponent(
          q
        )}&lat=${lat}&lng=${lng}&localityName=${encodeURIComponent(
          localityName
        )}&pincode=${pincode || ''}&city=${encodeURIComponent(city || 'Your Location')}&category=${selectedCategory}`;

        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) throw new Error('Failed to fetch');
        const data = await res.json();

        if (!isCancelled && data.success && Array.isArray(data.results) && data.results.length > 0) {
          setProducts(data.results);
          setDataSource(data.source === 'live' ? 'live' : 'benchmark');
          if (data.storesEta && data.storesEta.length > 0) {
            setLiveEtas(data.storesEta);
          }
        }
      } catch (err) {
        if (!isCancelled) {
          // Keep instant local benchmark results on timeout or error
          setDataSource('benchmark');
        }
      } finally {
        clearTimeout(timeoutId);
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }, 300);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
      clearTimeout(timeoutId);
      controller.abort();
      setIsLoading(false);
    };
  }, [searchQuery, selectedCategory, userLocation]);

  // Basket calculations
  const basketStats = useMemo(() => {
    let blinkitTotal = 0;
    let instamartTotal = 0;
    let totalItems = 0;
    const basketItemsList = [];

    Object.entries(basket).forEach(([id, qty]) => {
      if (qty <= 0) return;
      const product = products.find((p) => p.id === id) || GWALIOR_STAPLES_CATALOG.find((p) => p.id === id);
      if (!product) return;

      totalItems += qty;
      const bPrice = (product.blinkit?.price || product.mrp || 0) * qty;
      const iPrice = (product.instamart?.price || product.mrp || 0) * qty;
      blinkitTotal += bPrice;
      instamartTotal += iPrice;

      basketItemsList.push({
        ...product,
        quantity: qty,
        blinkitSubtotal: bPrice,
        instamartSubtotal: iPrice,
      });
    });

    const diff = Math.abs(blinkitTotal - instamartTotal);
    let recommendation = 'equal';
    if (blinkitTotal < instamartTotal) recommendation = 'blinkit';
    else if (instamartTotal < blinkitTotal) recommendation = 'instamart';

    return {
      totalItems,
      blinkitTotal,
      instamartTotal,
      difference: diff,
      recommendation,
      items: basketItemsList,
    };
  }, [basket]);

  // GPS Auto-detect handler (uses server proxy to bypass CORS)
  const handleDetectGps = (opts = {}) => {
    const silent = opts?.silent === true;
    if (!navigator.geolocation) {
      if (!silent) {
        setLocationStatus({
          type: 'error',
          message: 'Geolocation is not supported by your browser.',
        });
      }
      return;
    }

    setIsDetectingGps(true);
    if (!silent) setLocationStatus(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        setIsDetectingGps(false);
        const { latitude, longitude } = position.coords;

        let locationLabel = `Doorstep GPS (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`;
        let postalCode = '';
        let detectedCity = 'Your Location';

        try {
          const revRes = await fetch(
            `/api/grocery/geocode?reverse=1&lat=${latitude}&lng=${longitude}`
          );
          if (revRes.ok) {
            const revData = await revRes.json();
            if (revData.success && revData.localityName) {
              locationLabel = revData.localityName;
              postalCode = revData.pincode || '';
              detectedCity = revData.city || 'Your Location';
            }
          }
        } catch (_) {
          // If reverse geocoding fails, fallback to coordinates
        }

        setUserLocation({
          lat: latitude,
          lng: longitude,
          localityName: locationLabel,
          city: detectedCity,
          pincode: postalCode,
          isExactGps: true,
        });

        setLocationStatus({
          type: 'success',
          message: `📍 Exact GPS Locked (${latitude.toFixed(4)}, ${longitude.toFixed(4)}) — ${locationLabel}`,
        });
      },
      (error) => {
        setIsDetectingGps(false);
        if (!silent) {
          setLocationStatus({
            type: 'error',
            message:
              error.code === 1
                ? 'GPS permission denied. You can search your address or pincode below.'
                : 'Could not acquire precise GPS signal. Please search your address below.',
          });
        }
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  // Address search autocomplete handler
  const handleAddressSearch = async (val) => {
    setAddressSearchQuery(val);
    if (!val || val.trim().length < 3) {
      setAddressSuggestions([]);
      return;
    }

    setIsSearchingAddress(true);
    try {
      const res = await fetch(`/api/grocery/geocode?q=${encodeURIComponent(val.trim())}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.suggestions)) {
          setAddressSuggestions(data.suggestions);
        }
      }
    } catch (_) {
      // Ignore search error
    } finally {
      setIsSearchingAddress(false);
    }
  };

  const handleSelectSuggestion = (sug) => {
    const parts = (sug.label || '').split(',');
    const cityGuess = parts[parts.length - 1]?.trim() || 'Your Location';

    setUserLocation({
      lat: sug.lat,
      lng: sug.lng,
      localityName: sug.label,
      city: cityGuess,
      pincode: '',
      isExactGps: false,
    });
    setAddressSearchQuery('');
    setAddressSuggestions([]);
    setShowAddressSearch(false);
    setLocationStatus({
      type: 'success',
      message: `📍 Delivery location set to: ${sug.label}`,
    });
  };

  const updateBasketQuantity = (productId, delta) => {
    setBasket((prev) => {
      const current = prev[productId] || 0;
      const next = Math.max(0, current + delta);
      if (next === 0) {
        const copy = { ...prev };
        delete copy[productId];
        return copy;
      }
      return { ...prev, [productId]: next };
    });
  };

  return (
    <div className="w-full">
      {/* ── Top Hyperlocal Location & Hub Banner ── */}
      <section className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white py-8 px-4 sm:px-6 lg:px-8 border-b border-slate-700/60 shadow-lg">
        <div className="max-w-7xl mx-auto">
          {/* Breadcrumb & City Badge */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2 text-xs font-semibold tracking-wide text-slate-300">
              <Link href="/" className="hover:text-white transition-colors">Home</Link>
              <span>/</span>
              <Link href="/compare" className="hover:text-white transition-colors">Compare</Link>
              <span>/</span>
              <span className="text-amber-400">
                {userLocation.isExactGps && userLocation.city
                  ? `${userLocation.city} Quick Commerce`
                  : 'Quick Commerce'}
              </span>
            </div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-bold uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Live Dark Stores Connected
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            {/* Title & Headline */}
            <div className="lg:col-span-7">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white leading-tight">
                Blinkit vs Swiggy Instamart <br className="hidden sm:inline" />
                <span className="bg-gradient-to-r from-amber-300 via-orange-400 to-yellow-300 bg-clip-text text-transparent">
                  Real-Time Delivery & Price Comparison
                </span>
              </h1>
              <p className="mt-2 text-sm sm:text-base text-slate-300 max-w-2xl leading-relaxed">
                Live 10-minute grocery comparison at your exact doorstep. See real-time dark store delivery timings, stock availability, and lowest prices.
              </p>
            </div>

            {/* Hyperlocal User Location & Dark Store Status Card */}
            <div className="lg:col-span-5 bg-white/10 backdrop-blur-md rounded-2xl p-4 sm:p-5 border border-white/15 shadow-xl">
              {/* Active Location Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300 uppercase tracking-wider">
                    <svg className="w-4 h-4 text-rose-400 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                    </svg>
                    Your Delivery Location
                    {userLocation.isExactGps && (
                      <span className="text-[9px] font-black uppercase text-emerald-400 bg-emerald-500/20 px-1.5 py-0.5 rounded border border-emerald-400/30">
                        GPS Active
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-sm sm:text-base font-extrabold text-white truncate" title={userLocation.localityName}>
                    {userLocation.localityName}
                  </div>
                  {userLocation.pincode && (
                    <div className="text-[11px] text-slate-300">
                      Pincode: {userLocation.pincode}
                    </div>
                  )}
                </div>

                {/* 1-Tap GPS Button */}
                <button
                  type="button"
                  onClick={handleDetectGps}
                  disabled={isDetectingGps}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 transition-colors px-3 py-1.5 rounded-xl shadow-md shrink-0 active:scale-95"
                >
                  {isDetectingGps ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></span>
                      Locating...
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <circle cx="12" cy="12" r="10"/>
                        <circle cx="12" cy="12" r="3"/>
                        <line x1="12" y1="2" x2="12" y2="5"/>
                        <line x1="12" y1="19" x2="12" y2="22"/>
                        <line x1="2" y1="12" x2="5" y2="12"/>
                        <line x1="19" y1="12" x2="22" y2="12"/>
                      </svg>
                      Use My GPS
                    </>
                  )}
                </button>
              </div>

              {/* Address Search / Change Location Toggle */}
              <div className="mt-3 relative">
                {!showAddressSearch ? (
                  <button
                    type="button"
                    onClick={() => setShowAddressSearch(true)}
                    className="w-full text-left bg-slate-900/80 hover:bg-slate-900 text-slate-300 text-xs font-semibold px-3.5 py-2 rounded-xl border border-slate-700/80 flex items-center justify-between transition-colors shadow-inner"
                  >
                    <span className="flex items-center gap-2 truncate">
                      <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <circle cx="11" cy="11" r="8" strokeWidth="2"/>
                        <line x1="21" y1="21" x2="16.65" y2="16.65" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                      Search another street, area, or pincode across India...
                    </span>
                    <span className="text-[11px] font-bold text-amber-400 shrink-0 ml-2">Change</span>
                  </button>
                ) : (
                  <div className="relative">
                    <div className="relative">
                      <input
                        type="text"
                        autoFocus
                        value={addressSearchQuery}
                        onChange={(e) => handleAddressSearch(e.target.value)}
                        placeholder="Type area, landmark, or pincode (e.g. Indiranagar, Bandra, 474011)..."
                        className="w-full bg-slate-900 text-white placeholder:text-slate-400 text-xs font-semibold rounded-xl pl-9 pr-8 py-2.5 border border-amber-400/80 focus:outline-none focus:ring-2 focus:ring-amber-400 shadow-inner"
                      />
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        {isSearchingAddress ? (
                          <span className="w-3.5 h-3.5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin"></span>
                        ) : (
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <circle cx="11" cy="11" r="8" strokeWidth="2"/>
                            <line x1="21" y1="21" x2="16.65" y2="16.65" strokeWidth="2" strokeLinecap="round"/>
                          </svg>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setShowAddressSearch(false);
                          setAddressSearchQuery('');
                          setAddressSuggestions([]);
                        }}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white text-xs font-bold"
                      >
                        ✕
                      </button>
                    </div>

                    {/* Autocomplete Suggestions Dropdown */}
                    {addressSuggestions.length > 0 && (
                      <div className="absolute left-0 right-0 top-full mt-1.5 bg-slate-900/95 backdrop-blur-md rounded-xl border border-slate-700 shadow-2xl z-50 overflow-hidden divide-y divide-slate-800">
                        {addressSuggestions.map((sug, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => handleSelectSuggestion(sug)}
                            className="w-full text-left p-2.5 hover:bg-slate-800/80 transition-colors flex items-start gap-2 text-xs"
                          >
                            <span className="text-rose-400 mt-0.5">📍</span>
                            <div className="flex-1 min-w-0">
                              <div className="font-bold text-white truncate">{sug.label}</div>
                              <div className="text-[10px] text-slate-400 truncate">{sug.fullAddress}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Location Status Message */}
              {locationStatus && (
                <div
                  className={`mt-2.5 text-xs font-semibold p-2 rounded-lg flex items-center gap-1.5 ${
                    locationStatus.type === 'success'
                      ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/30'
                      : 'bg-rose-500/20 text-rose-200 border border-rose-400/30'
                  }`}
                >
                  <span>{locationStatus.type === 'success' ? '✓' : 'ℹ'}</span>
                  <span className="truncate">{locationStatus.message}</span>
                </div>
              )}

              {/* Live Dark Store Pod Info */}
              <div className="mt-3.5 pt-3 border-t border-white/10 grid grid-cols-2 gap-2 text-xs">
                {/* Blinkit Pod */}
                <div className="bg-slate-900/70 rounded-xl p-2.5 border border-yellow-500/30 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-bold text-yellow-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-yellow-400"></span>
                        Blinkit
                      </div>
                      {blinkitLive?.eta && blinkitLive.eta !== 'Closed' && blinkitLive.eta !== 'N/A' && (
                        <span className="flex items-center gap-1 text-[9px] font-black uppercase text-emerald-400 bg-emerald-500/20 px-1.5 py-0.5 rounded border border-emerald-400/30">
                          <span className="relative flex h-1.5 w-1.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                          </span>
                          Live Pod
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-300 truncate mt-1" title={blinkitLive?.storeId ? `Store #${blinkitLive.storeId}` : 'Blinkit Dark Store'}>
                      {blinkitLive?.storeId ? `Hub #${blinkitLive.storeId}` : 'Blinkit Dark Store'}
                    </div>
                  </div>
                  <div className="mt-1.5 pt-1.5 border-t border-white/5 flex items-center justify-between">
                    {isSyncingEtas ? (
                      <div className="flex items-center gap-1.5 text-xs text-amber-300">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping"></span>
                        <span className="font-semibold text-[11px]">Connecting pod...</span>
                      </div>
                    ) : blinkitLive?.open === false || blinkitLive?.eta === 'Closed' || blinkitLive?.eta === 'N/A' ? (
                      <span className="text-[11px] font-extrabold text-rose-400">🔴 Pod Closed</span>
                    ) : (
                      <div className="flex items-center gap-1 text-xs font-black text-emerald-400">
                        <span>⚡</span>
                        <span>{blinkitLive?.eta || '8–10 mins'}</span>
                      </div>
                    )}
                    <span className="text-[10px] text-slate-400 font-medium">Doorstep ETA</span>
                  </div>
                </div>

                {/* Swiggy Instamart Pod */}
                <div className="bg-slate-900/70 rounded-xl p-2.5 border border-orange-500/30 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-bold text-orange-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-orange-400"></span>
                        Instamart
                      </div>
                      {instamartLive?.eta && instamartLive.eta !== 'Closed' && instamartLive.eta !== 'N/A' && (
                        <span className="flex items-center gap-1 text-[9px] font-black uppercase text-emerald-400 bg-emerald-500/20 px-1.5 py-0.5 rounded border border-emerald-400/30">
                          <span className="relative flex h-1.5 w-1.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                          </span>
                          Live Pod
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-300 truncate mt-1" title={instamartLive?.storeId ? `Pod #${instamartLive.storeId}` : 'Instamart Pod'}>
                      {instamartLive?.storeId ? `Pod #${instamartLive.storeId}` : 'Instamart Pod'}
                    </div>
                  </div>
                  <div className="mt-1.5 pt-1.5 border-t border-white/5 flex items-center justify-between">
                    {isSyncingEtas ? (
                      <div className="flex items-center gap-1.5 text-xs text-amber-300">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping"></span>
                        <span className="font-semibold text-[11px]">Connecting pod...</span>
                      </div>
                    ) : instamartLive?.open === false || instamartLive?.eta === 'Closed' || instamartLive?.eta === 'N/A' ? (
                      <span className="text-[11px] font-extrabold text-rose-400">🔴 Pod Closed</span>
                    ) : (
                      <div className="flex items-center gap-1 text-xs font-black text-emerald-400">
                        <span>⚡</span>
                        <span>{instamartLive?.eta || '12–15 mins'}</span>
                      </div>
                    )}
                    <span className="text-[10px] text-slate-400 font-medium">Doorstep ETA</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Search Bar & Category Filters ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Real-time Search Box */}
          <div className="relative flex-1 max-w-lg">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search staples: milk, butter, atta, ghee, oil, maggi, surf..."
              className="w-full bg-white rounded-xl pl-11 pr-10 py-3 text-sm font-medium text-slate-800 border border-slate-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 placeholder:text-slate-400"
            />
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8" strokeWidth="2"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                Clear
              </button>
            )}
          </div>

          {/* Catalog Count Indicator & Live Sync Badge */}
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
            {dataSource === 'live' ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-black border border-emerald-300 shadow-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                100% Live Dark Store Sync
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-[11px] font-bold">
                Daily Dark Store Benchmark
              </span>
            )}
            <span>Showing <strong className="text-slate-900">{products.length}</strong> items {userLocation.city ? `in ${userLocation.city}` : ''}</span>
          </div>
        </div>

        {/* Live Loading Non-blocking Indicator */}
        {isLoading && (
          <div className="mt-4 px-3.5 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-900 text-xs font-semibold flex items-center justify-between shadow-xs transition-all">
            <div className="flex items-center gap-2.5">
              <span className="w-3.5 h-3.5 border-2 border-amber-600 border-t-transparent rounded-full animate-spin"></span>
              <span>Syncing live dark store prices & stock (Blinkit & Instamart)...</span>
            </div>
            <span className="text-[11px] text-amber-700 font-medium hidden sm:inline">
              Instant catalog displayed while updating
            </span>
          </div>
        )}

        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 pt-4 scrollbar-none">
          {GROCERY_CATEGORIES.map((cat) => {
            const isActive = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`whitespace-nowrap px-4 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-slate-900/20'
                    : 'bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200'
                }`}
              >
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>

        {/* ── Side-by-Side Product Comparison Cards Grid ── */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {products.map((item) => {
            const qty = basket[item.id] || 0;
            const hasBoth = !!(item.blinkit?.price && item.instamart?.price);
            const isInstamartCheaper = hasBoth && item.cheaperStore === 'instamart' && (item.savingCash || 0) > 0;
            const isBlinkitCheaper = hasBoth && item.cheaperStore === 'blinkit' && (item.savingCash || 0) > 0;
            const isEqual = hasBoth && (item.cheaperStore === 'equal' || (item.savingCash || 0) === 0);

            return (
              <div
                key={item.id}
                className="bg-white rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between overflow-hidden"
              >
                {/* Header: Category + Savings Badge */}
                <div className="p-4 pb-0">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      {item.categoryLabel}
                    </span>
                    {item.lootBadge && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-0.5 rounded-full bg-rose-600 text-white shadow-xs">
                        {item.lootBadge}
                      </span>
                    )}
                    {isInstamartCheaper && !item.lootBadge && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 border border-orange-200">
                        ⚡ Instamart saves ₹{item.savingCash}
                      </span>
                    )}
                    {isBlinkitCheaper && !item.lootBadge && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200">
                        ⚡ Blinkit saves ₹{item.savingCash}
                      </span>
                    )}
                    {isEqual && !item.lootBadge && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                        Same Price
                      </span>
                    )}
                    {!item.lootBadge && !hasBoth && item.instamart && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 border border-orange-100">
                        Only on Instamart {item.instamart.discountPct > 0 ? `(${item.instamart.discountPct}% off)` : ''}
                      </span>
                    )}
                    {!item.lootBadge && !hasBoth && item.blinkit && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-100">
                        Only on Blinkit {item.blinkit.discountPct > 0 ? `(${item.blinkit.discountPct}% off)` : ''}
                      </span>
                    )}
                  </div>

                  {/* Product Title & Pack Info */}
                  <div className="flex gap-3 items-start">
                    <div className="w-16 h-16 rounded-xl bg-slate-50 border border-slate-100 flex-shrink-0 flex items-center justify-center p-1 relative overflow-hidden">
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="w-full h-full object-contain"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-300 font-bold text-xs">
                          Staple
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold text-slate-900 line-clamp-2 leading-snug">
                        {item.name}
                      </h3>
                      <div className="mt-1 flex items-center gap-2 text-xs font-semibold text-slate-500">
                        <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-700 font-bold">
                          {item.unit}
                        </span>
                        <span>MRP: <del className="text-slate-400">₹{item.mrp}</del></span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Price Battle Box */}
                <div className="p-4 pt-3">
                  <div className="grid grid-cols-2 gap-2.5">
                    {/* Blinkit Card Column */}
                    {item.blinkit ? (
                      <div
                        className={`p-2.5 rounded-xl border flex flex-col justify-between transition-all ${
                          isBlinkitCheaper
                            ? 'bg-amber-50/70 border-amber-300 ring-2 ring-amber-400/40'
                            : 'bg-slate-50 border-slate-200/80'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between">
                            <BlinkitLogo className="h-4 w-auto" />
                            {isBlinkitCheaper && (
                              <span className="text-[10px] font-black uppercase text-amber-800 bg-amber-200/80 px-1.5 py-0.2 rounded">
                                Cheaper
                              </span>
                            )}
                            {!hasBoth && item.blinkit && (
                              <span className="text-[10px] font-black uppercase text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded">
                                In Stock
                              </span>
                            )}
                          </div>
                          <div className="mt-2 flex items-baseline gap-1 flex-wrap">
                            <span className="text-lg font-black text-slate-900">
                              ₹{item.blinkit.price}
                            </span>
                            {item.blinkit.priceDropCash > 0 ? (
                              <span className="text-[10px] font-black text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded">
                                📉 ₹{item.blinkit.priceDropCash} drop
                              </span>
                            ) : item.blinkit.discountPct > 0 ? (
                              <span className="text-[11px] font-bold text-emerald-600">
                                {item.blinkit.discountPct}% off
                              </span>
                            ) : null}
                          </div>
                          <div className="text-[10px] font-semibold text-slate-500 flex items-center justify-between mt-0.5">
                            <span className="flex items-center gap-0.5">
                              <span className="text-amber-500 font-bold">⚡</span>
                              <span className="font-bold text-slate-700">{item.blinkit.eta || blinkitLive?.eta || '8–10 mins'}</span>
                            </span>
                            {blinkitLive?.eta && blinkitLive.eta !== 'Closed' && blinkitLive.eta !== 'N/A' && (
                              <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200">
                                Live
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Launch Store Link */}
                        <a
                          href={getBlinkitLink(item)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2.5 block text-center py-1.5 px-2 bg-yellow-400 hover:bg-yellow-500 text-black font-extrabold text-[11px] rounded-lg transition-colors shadow-sm"
                        >
                          Open Blinkit
                        </a>
                      </div>
                    ) : (
                      <div className="p-2.5 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 flex flex-col justify-between text-center">
                        <div className="flex items-center justify-center pt-1">
                          <BlinkitLogo className="h-3.5 w-auto opacity-40 grayscale" />
                        </div>
                        <div className="my-3 text-[11px] font-bold text-slate-400">
                          Unavailable
                        </div>
                        <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 py-1 rounded">
                          Not listed in hub
                        </span>
                      </div>
                    )}

                    {/* Swiggy Instamart Card Column */}
                    {item.instamart ? (
                      <div
                        className={`p-2.5 rounded-xl border flex flex-col justify-between transition-all ${
                          isInstamartCheaper
                            ? 'bg-orange-50/70 border-orange-300 ring-2 ring-orange-400/40'
                            : 'bg-slate-50 border-slate-200/80'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between">
                            <InstamartLogo className="h-4 w-auto" />
                            {isInstamartCheaper && (
                              <span className="text-[10px] font-black uppercase text-orange-800 bg-orange-200/80 px-1.5 py-0.2 rounded">
                                Cheaper
                              </span>
                            )}
                            {!hasBoth && item.instamart && (
                              <span className="text-[10px] font-black uppercase text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded">
                                In Stock
                              </span>
                            )}
                          </div>
                          <div className="mt-2 flex items-baseline gap-1 flex-wrap">
                            <span className="text-lg font-black text-slate-900">
                              ₹{item.instamart.price}
                            </span>
                            {item.instamart.priceDropCash > 0 ? (
                              <span className="text-[10px] font-black text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded">
                                📉 ₹{item.instamart.priceDropCash} drop
                              </span>
                            ) : item.instamart.discountPct > 0 ? (
                              <span className="text-[11px] font-bold text-emerald-600">
                                {item.instamart.discountPct}% off
                              </span>
                            ) : null}
                          </div>
                          <div className="text-[10px] font-semibold text-slate-500 flex items-center justify-between mt-0.5">
                            <span className="flex items-center gap-0.5">
                              <span className="text-orange-500 font-bold">⚡</span>
                              <span className="font-bold text-slate-700">{item.instamart.eta || instamartLive?.eta || '12–15 mins'}</span>
                            </span>
                            {instamartLive?.eta && instamartLive.eta !== 'Closed' && instamartLive.eta !== 'N/A' && (
                              <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200">
                                Live
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Launch Store Link */}
                        <a
                          href={getInstamartLink(item)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2.5 block text-center py-1.5 px-2 bg-orange-500 hover:bg-orange-600 text-white font-extrabold text-[11px] rounded-lg transition-colors shadow-sm"
                        >
                          Open Instamart
                        </a>
                      </div>
                    ) : (
                      <div className="p-2.5 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 flex flex-col justify-between text-center">
                        <div className="flex items-center justify-center pt-1">
                          <InstamartLogo className="h-3.5 w-auto opacity-40 grayscale" />
                        </div>
                        <div className="my-3 text-[11px] font-bold text-slate-400">
                          Unavailable
                        </div>
                        <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 py-1 rounded">
                          Not listed in pod
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Add to Basket Action */}
                  <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500">
                      Add to price comparison basket:
                    </span>
                    {qty === 0 ? (
                      <button
                        type="button"
                        onClick={() => updateBasketQuantity(item.id, 1)}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-sm active:scale-95"
                      >
                        <span>+ Add</span>
                      </button>
                    ) : (
                      <div className="inline-flex items-center rounded-lg border border-slate-300 bg-white shadow-sm overflow-hidden">
                        <button
                          type="button"
                          onClick={() => updateBasketQuantity(item.id, -1)}
                          className="px-2.5 py-1 text-slate-700 hover:bg-slate-100 font-black text-xs"
                        >
                          −
                        </button>
                        <span className="px-2 font-bold text-xs text-slate-900">{qty}</span>
                        <button
                          type="button"
                          onClick={() => updateBasketQuantity(item.id, 1)}
                          className="px-2.5 py-1 text-slate-700 hover:bg-slate-100 font-black text-xs"
                        >
                          +
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Empty Search State */}
        {products.length === 0 && (
          <div className="text-center py-16 bg-white rounded-2xl border border-slate-200 mt-6 p-6">
            <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 flex items-center justify-center text-slate-400 text-xl font-bold">
              🔍
            </div>
            <h4 className="mt-3 text-base font-bold text-slate-800">No staples matched &quot;{searchQuery}&quot;</h4>
            <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
              Try searching for common essentials like &quot;butter&quot;, &quot;milk&quot;, &quot;atta&quot;, &quot;ghee&quot;, &quot;maggi&quot;, or clear the search query.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('all');
              }}
              className="mt-4 px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-lg hover:bg-slate-800 transition-colors"
            >
              Reset Filters
            </button>
          </div>
        )}
      </div>

      {/* ── Floating Sticky Basket Comparison Bar ── */}
      {basketStats.totalItems > 0 && (
        <aside aria-label="Floating Basket Comparison" className="fixed bottom-4 left-4 right-4 max-w-3xl mx-auto z-40">
          <div className="bg-slate-900/95 backdrop-blur-md text-white rounded-2xl p-4 shadow-2xl border border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-400 text-slate-950 font-black text-base flex items-center justify-center flex-shrink-0">
                {basketStats.totalItems}
              </div>
              <div>
                <div className="text-xs font-bold text-slate-300">
                  {basketStats.totalItems} item{basketStats.totalItems > 1 ? 's' : ''} in comparison basket
                </div>
                <div className="flex items-center gap-3 text-sm font-extrabold mt-0.5">
                  <span className="text-yellow-400">Blinkit: ₹{basketStats.blinkitTotal}</span>
                  <span className="text-slate-400">vs</span>
                  <span className="text-orange-400">Instamart: ₹{basketStats.instamartTotal}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              {basketStats.difference > 0 ? (
                <div className="text-right mr-2 hidden md:block">
                  <div className="text-[11px] font-bold text-slate-300">Net Verdict</div>
                  <div className="text-xs font-extrabold text-emerald-400">
                    Save ₹{basketStats.difference} on {basketStats.recommendation === 'blinkit' ? 'Blinkit' : 'Instamart'}
                  </div>
                </div>
              ) : null}

              <button
                type="button"
                onClick={() => setShowBasketModal(true)}
                className="px-4 py-2 bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-slate-950 font-black text-xs rounded-xl shadow-md transition-all active:scale-95"
              >
                View Full Basket Breakdown →
              </button>
            </div>
          </div>
        </aside>
      )}

      {/* ── Basket Breakdown Modal ── */}
      {showBasketModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-slate-900">
                  {userLocation.city ? `${userLocation.city} Grocery Basket Comparison` : 'Live Grocery Basket Comparison'}
                </h3>
                <p className="text-xs font-semibold text-slate-500">
                  Delivering to: {userLocation.localityName} {userLocation.pincode ? `(${userLocation.pincode})` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowBasketModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            {/* Modal Items List */}
            <div className="p-4 sm:p-5 overflow-y-auto flex-1 divide-y divide-slate-100">
              {basketStats.items.map((item) => (
                <div key={item.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-slate-900 truncate">{item.name}</div>
                    <div className="text-[11px] font-semibold text-slate-500">
                      {item.unit} × {item.quantity}
                    </div>
                  </div>
                  <div className="text-right text-xs">
                    <div className="font-bold text-slate-900">
                      <span className="text-yellow-600 font-extrabold">₹{item.blinkitSubtotal}</span>
                      <span className="text-slate-300 mx-1">/</span>
                      <span className="text-orange-600 font-extrabold">₹{item.instamartSubtotal}</span>
                    </div>
                    <div className="text-[10px] text-slate-500">Blinkit / Instamart</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Modal Footer / Savings Callout */}
            <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-100">
              <div className="flex items-center justify-between mb-3 text-sm font-extrabold">
                <span className="text-slate-700">Total Blinkit Cart:</span>
                <span className="text-slate-900">₹{basketStats.blinkitTotal}</span>
              </div>
              <div className="flex items-center justify-between mb-3 text-sm font-extrabold">
                <span className="text-slate-700">Total Instamart Cart:</span>
                <span className="text-slate-900">₹{basketStats.instamartTotal}</span>
              </div>

              {basketStats.difference > 0 ? (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold mb-4 flex items-center justify-between">
                  <span>🏆 Best Value Store:</span>
                  <span className="text-sm font-black text-emerald-700">
                    {basketStats.recommendation === 'blinkit' ? 'Blinkit' : 'Swiggy Instamart'} (Save ₹{basketStats.difference})
                  </span>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold mb-4 text-center">
                  Both stores offer identical total basket prices for these items!
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <a
                  href="https://blinkit.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-center py-2.5 px-3 bg-yellow-400 hover:bg-yellow-500 text-black font-black text-xs rounded-xl shadow-sm transition-colors"
                >
                  Order on Blinkit →
                </a>
                <a
                  href="https://www.swiggy.com/instamart"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-center py-2.5 px-3 bg-orange-500 hover:bg-orange-600 text-white font-black text-xs rounded-xl shadow-sm transition-colors"
                >
                  Order on Instamart →
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Educational Guide / Quick Commerce Deep Dive Section ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 mt-8 border-t border-slate-200">
        <div className="bg-slate-50 rounded-2xl p-6 sm:p-8 border border-slate-200/80">
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            How Quick Commerce Works: Blinkit vs Swiggy Instamart {userLocation.city ? `in ${userLocation.city}` : ''}
          </h2>
          <p className="mt-2 text-sm text-slate-600 leading-relaxed max-w-3xl">
            Quick commerce relies on hyperlocal dark store fulfillment hubs situated within 2.5–3.5 km of residential clusters. Both platforms establish dedicated micro-warehouses to maintain sub-15-minute delivery cycles.
          </p>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-slate-600">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="font-black text-sm text-slate-900 mb-1 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                Location Geo-Fencing
              </div>
              <p className="leading-relaxed">
                Prices and product availability depend strictly on your GPS coordinates. Blinkit routes to its nearest Hub (Govindpuri, Naukar Hospital, or Thatipur), while Swiggy Instamart resolves to its closest Pod.
              </p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="font-black text-sm text-slate-900 mb-1 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                Daily Price Re-Indexing
              </div>
              <p className="leading-relaxed">
                Fresh dairy (Amul Taaza, Paneer) and cooking oils fluctuate based on local distributor stock. ShoppersDeals benchmarks daily prices directly to protect consumers from sudden surge markups.
              </p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="font-black text-sm text-slate-900 mb-1 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                Free Delivery Thresholds
              </div>
              <p className="leading-relaxed">
                Blinkit typically offers free delivery above ₹99–₹199 depending on rush hours, whereas Swiggy Instamart pairs with Swiggy One membership for zero delivery fees across orders above ₹149.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
