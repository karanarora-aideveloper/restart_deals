'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { usePushNotification } from '@/lib/usePushNotification';
import { API_BASE_URL } from '@/lib/config';
import { formatInr, formatRelativeTime, getMerchantInfo, isUsableImageUrl, getAffiliateUrl } from '@/lib/affiliate';
import { renderStoreLogo } from '@/components/BrandAndStoreLogos';
import { logEvent } from '@/lib/analytics';
import V3SubHeader from '@/components/v3/V3SubHeader';
import PriceAlertModal from '@/components/PriceAlertModal';

export default function ProfileAlertsPage() {
  const { user, token, isLoggedIn, loginWithFirebaseGoogle } = useAuth();
  const {
    isSupported: isPushSupported,
    isSubscribed: isPushSubscribed,
    subscribeToPush,
    sendTestNotification,
    loading: pushLoading,
    trackedProducts,
    untrackProduct,
  } = usePushNotification();

  const [alerts, setAlerts] = useState([]);
  const [deviceProducts, setDeviceProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [actionMsg, setActionMsg] = useState('');
  const [testSent, setTestSent] = useState(false);

  // Manual lookup for users not logged in
  const [lookupInput, setLookupInput] = useState('');
  const [searchedEmailOrPhone, setSearchedEmailOrPhone] = useState('');

  // Quick track URL input
  const [quickTrackUrl, setQuickTrackUrl] = useState('');
  const [quickTrackModalProduct, setQuickTrackModalProduct] = useState(null);
  const [quickTrackLoading, setQuickTrackLoading] = useState(false);

  // Edit target price modal/dialog state
  const [editingAlert, setEditingAlert] = useState(null);
  const [newTargetPrice, setNewTargetPrice] = useState('');
  const [isUpdatingTarget, setIsUpdatingTarget] = useState(false);

  // Filter tabs
  const [filterTab, setFilterTab] = useState('all'); // 'all' | 'target_met' | 'monitoring'

  // Fetch alerts from API
  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const emailOrPhone = user?.email || searchedEmailOrPhone;
      let url = `${API_BASE_URL}/api/alerts`;
      const queryParams = new URLSearchParams();

      if (emailOrPhone) {
        if (emailOrPhone.includes('@')) {
          queryParams.set('email', emailOrPhone.trim().toLowerCase());
        } else {
          queryParams.set('phone', emailOrPhone.trim());
        }
      }

      if (queryParams.toString()) {
        url += `?${queryParams.toString()}`;
      }

      const headers = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      // If user has neither token nor email, skip API fetch
      if (!token && !emailOrPhone) {
        setAlerts([]);
        setLoading(false);
        return;
      }

      const res = await fetch(url, { headers });
      const json = await res.json();

      if (res.ok && json.success) {
        setAlerts(json.data || []);
      } else {
        if (!user && !searchedEmailOrPhone) {
          setAlerts([]);
        } else {
          setErrorMsg(json.error || 'Failed to fetch price alerts');
        }
      }
    } catch (err) {
      console.warn('[ProfileAlerts] Error fetching alerts:', err.message);
      setErrorMsg('Could not connect to alert service. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [user, token, searchedEmailOrPhone]);

  // Fetch device-tracked products from push notification localStorage
  const fetchDeviceProducts = useCallback(async () => {
    if (!Array.isArray(trackedProducts) || trackedProducts.length === 0) {
      setDeviceProducts([]);
      return;
    }

    try {
      const fetched = await Promise.all(
        trackedProducts.slice(0, 20).map(async (prodId) => {
          try {
            const res = await fetch(`${API_BASE_URL}/api/products/${prodId}`);
            if (!res.ok) return null;
            const data = await res.json();
            return data?.success ? data.data : null;
          } catch {
            return null;
          }
        })
      );
      setDeviceProducts(fetched.filter(Boolean));
    } catch (err) {
      console.warn('[ProfileAlerts] Error fetching device products:', err);
    }
  }, [trackedProducts]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  useEffect(() => {
    fetchDeviceProducts();
  }, [fetchDeviceProducts]);

  // Delete / Cancel synced alert
  const handleDeleteAlert = async (alertId) => {
    if (!window.confirm('Are you sure you want to stop tracking price drops for this product?')) {
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/alerts/${alertId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setAlerts((prev) => prev.filter((a) => a._id !== alertId));
        setActionMsg('Price alert cancelled successfully.');
        setTimeout(() => setActionMsg(''), 3000);
      } else {
        alert(data.error || 'Failed to delete alert');
      }
    } catch (err) {
      alert('Error deleting alert: ' + err.message);
    }
  };

  // Remove local device-tracked product
  const handleRemoveDeviceProduct = (prodId) => {
    if (untrackProduct) {
      untrackProduct(prodId);
    }
    setDeviceProducts((prev) => prev.filter((p) => p._id !== prodId && p.productId !== prodId));
    setActionMsg('Removed from local browser watchlist.');
    setTimeout(() => setActionMsg(''), 3000);
  };

  // Enable Browser Push
  const handleEnablePush = async () => {
    try {
      const res = await subscribeToPush();
      if (res?.success) {
        setActionMsg('✓ Chrome Web Push enabled! This browser is now ready for price drop notifications.');
        setTimeout(() => setActionMsg(''), 4000);
      } else if (res?.error) {
        setActionMsg(res.error);
      }
    } catch (err) {
      setActionMsg(err.message || 'Could not enable push notifications');
    }
  };

  // Save new target price
  const handleSaveTargetPrice = async () => {
    if (!editingAlert) return;
    const num = Number(newTargetPrice);
    if (!num || num <= 0) {
      alert('Please enter a valid target price');
      return;
    }

    setIsUpdatingTarget(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/alerts/${editingAlert._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetPrice: num }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setAlerts((prev) =>
          prev.map((a) => (a._id === editingAlert._id ? { ...a, targetPrice: num, targetMet: (a.currentPrice || a.initialPrice) <= num } : a))
        );
        setEditingAlert(null);
        setActionMsg(`Target price updated to ₹${num.toLocaleString('en-IN')}`);
        setTimeout(() => setActionMsg(''), 3000);
      } else {
        alert(data.error || 'Failed to update target price');
      }
    } catch (err) {
      alert('Error updating target: ' + err.message);
    } finally {
      setIsUpdatingTarget(false);
    }
  };

  // Quick track URL submit
  const handleQuickTrackSubmit = async (e) => {
    e.preventDefault();
    if (!quickTrackUrl.trim()) return;

    setQuickTrackLoading(true);
    try {
      const encodedUrl = encodeURIComponent(quickTrackUrl.trim());
      const res = await fetch(`${API_BASE_URL}/api/products/lookup?url=${encodedUrl}`);
      const data = await res.json();

      if (res.ok && data.success && data.data) {
        setQuickTrackModalProduct(data.data);
      } else {
        // Fallback: search products
        const searchRes = await fetch(`${API_BASE_URL}/api/products?q=${encodedUrl}&limit=1`);
        const searchData = await searchRes.json();
        const found = searchData?.data?.[0];
        if (found) {
          setQuickTrackModalProduct(found);
        } else {
          alert('Could not find product details for this link. Please paste a direct Amazon, Flipkart, or Myntra link.');
        }
      }
    } catch (err) {
      alert('Could not inspect product: ' + err.message);
    } finally {
      setQuickTrackLoading(false);
    }
  };

  // Filter alerts
  const filteredAlerts = alerts.filter((alert) => {
    if (filterTab === 'target_met') return alert.targetMet;
    if (filterTab === 'monitoring') return !alert.targetMet;
    return true;
  });

  const targetMetCount = alerts.filter((a) => a.targetMet).length;
  const monitoringCount = alerts.filter((a) => !a.targetMet).length;

  const hasSyncedAlerts = alerts.length > 0;
  const hasDeviceProducts = deviceProducts.length > 0;
  const isGuestWithNoAlerts = !isLoggedIn && !hasSyncedAlerts && !hasDeviceProducts && !searchedEmailOrPhone;

  return (
    <div className="min-h-screen bg-[#FAFAFC]">
      {/* 1. Sub-Header Navigation Strip with Alerts highlighted */}
      <V3SubHeader activeTab="alerts" />

      <main className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6 lg:px-8">
        {/* Top Breadcrumb & User Info */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <Link href="/" className="font-bold text-slate-600 transition hover:text-indigo-600">
              Home
            </Link>
            <span>/</span>
            <Link href="/profile" className="font-bold text-slate-600 transition hover:text-indigo-600">
              Your Account
            </Link>
            <span>/</span>
            <span className="font-black text-slate-900">Price Drop Alerts</span>
          </div>

          {isLoggedIn && user ? (
            <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-700 shadow-2xs">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-bold text-slate-900">{user.name || user.email}</span>
              <span className="text-[10px] text-slate-400">· Cross-Device Sync Active</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={loginWithFirebaseGoogle}
              className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-3.5 py-1.5 font-bold text-indigo-700 transition hover:bg-indigo-100 shadow-2xs"
            >
              <span>🔑 Sign in with Google to sync alerts</span>
            </button>
          )}
        </div>

        {/* Action Notification Banner */}
        {actionMsg && (
          <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold text-emerald-800 animate-fadeIn flex items-center justify-between">
            <span>✓ {actionMsg}</span>
            <button type="button" onClick={() => setActionMsg('')} className="text-emerald-700 hover:text-emerald-900 font-black ml-2">✕</button>
          </div>
        )}

        {/* Error message */}
        {errorMsg && (
          <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-bold text-rose-800">
            ⚠️ {errorMsg}
          </div>
        )}

        {/* ========================================================================= */}
        {/* CASE 1: GUEST USER WITH ZERO ALERTS (The High-Converting Welcome Gateway) */}
        {/* ========================================================================= */}
        {isGuestWithNoAlerts && !loading && (
          <div className="space-y-6">
            {/* Hero Welcome Card */}
            <div className="rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-10 shadow-xs relative overflow-hidden">
              <div className="max-w-2xl">
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-rose-700">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75"></span>
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-500"></span>
                  </span>
                  <span>Autonomous 24/7 Price Radar</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-950 leading-tight">
                  Track Price Drops &amp; Never Overpay 🔔
                </h1>
                <p className="mt-2 text-sm sm:text-base text-slate-600 leading-relaxed">
                  Set your desired price on any product from Amazon, Flipkart, Myntra, or Nykaa. The exact second the price crashes to or below your target, our autonomous verification engine notifies you immediately.
                </p>
              </div>

              {/* Two Flexible Alert Delivery Choices */}
              <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Method 1: Google Login (Cross-Device Sync) */}
                <div className="rounded-2xl border-2 border-indigo-200 bg-gradient-to-br from-indigo-50/50 via-white to-indigo-50/20 p-5 flex flex-col justify-between shadow-xs">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="rounded-md bg-indigo-600 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white">
                        Recommended
                      </span>
                      <span className="text-xs font-bold text-indigo-700">1-Click Fast</span>
                    </div>
                    <h2 className="text-base font-black text-slate-900">
                      Sign In to Sync Across Devices 📲
                    </h2>
                    <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                      Connect once with Google to track items seamlessly across your phone, tablet, and PC. Receive multi-channel alerts via Telegram Bot, WhatsApp, and Email.
                    </p>
                    <ul className="mt-3 space-y-1.5 text-xs text-slate-700 font-semibold">
                      <li className="flex items-center gap-1.5">
                        <span className="text-emerald-600">✓</span> Instant Telegram Bot alerts (@ShoppersDealsAlertBot)
                      </li>
                      <li className="flex items-center gap-1.5">
                        <span className="text-emerald-600">✓</span> WhatsApp &amp; Email price crash notifications
                      </li>
                      <li className="flex items-center gap-1.5">
                        <span className="text-emerald-600">✓</span> Edit target prices and manage watchlist anywhere
                      </li>
                    </ul>
                  </div>

                  <button
                    type="button"
                    onClick={loginWithFirebaseGoogle}
                    className="mt-5 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-xs font-black text-white shadow-sm hover:bg-indigo-700 transition"
                  >
                    <span>🔑 Sign in with Google (1-Click)</span>
                  </button>
                </div>

                {/* Method 2: 1-Click Chrome Push (No Login Required!) */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5 flex flex-col justify-between shadow-2xs">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-800">
                        Zero Friction
                      </span>
                      <span className="text-xs font-bold text-slate-500">No Account Required</span>
                    </div>
                    <h2 className="text-base font-black text-slate-900">
                      1-Click Chrome Browser Push 🔔
                    </h2>
                    <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                      Don&apos;t want to sign in? Modern browsers generate an anonymous, secure Push Token. Get real-time desktop &amp; mobile notifications even when this tab is closed.
                    </p>
                    <ul className="mt-3 space-y-1.5 text-xs text-slate-700 font-semibold">
                      <li className="flex items-center gap-1.5">
                        <span className="text-emerald-600">✓</span> 100% Free &amp; Instant setup
                      </li>
                      <li className="flex items-center gap-1.5">
                        <span className="text-emerald-600">✓</span> Native system notifications on Mac, Windows &amp; Android
                      </li>
                      <li className="flex items-center gap-1.5">
                        <span className="text-emerald-600">✓</span> Works without sharing your email or password
                      </li>
                    </ul>
                  </div>

                  {isPushSubscribed ? (
                    <div className="mt-5 flex items-center justify-between rounded-xl bg-emerald-50 border border-emerald-200 p-2.5">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-xs font-black text-emerald-900">Chrome Push Active 🟢</span>
                      </div>
                      <button
                        type="button"
                        onClick={sendTestNotification}
                        className="text-xs font-bold text-emerald-800 underline hover:text-emerald-950"
                      >
                        Send Test
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleEnablePush}
                      disabled={pushLoading || !isPushSupported}
                      className="mt-5 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-xs font-black text-white shadow-sm hover:bg-slate-800 transition disabled:opacity-50"
                    >
                      <span>🔔 Enable 1-Click Browser Push</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Track Product URL Box */}
            <div className="rounded-3xl border border-indigo-200/80 bg-gradient-to-r from-indigo-50/70 via-blue-50/40 to-indigo-50/70 p-6 shadow-2xs">
              <h3 className="text-sm font-black text-slate-900">
                ⚡ Ready to track a product right now?
              </h3>
              <p className="text-xs text-slate-600 mt-0.5 mb-3">
                Paste any product URL from Amazon India, Flipkart, Myntra, or Nykaa to set your price alert:
              </p>
              <form onSubmit={handleQuickTrackSubmit} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm">🔗</span>
                  <input
                    type="text"
                    value={quickTrackUrl}
                    onChange={(e) => setQuickTrackUrl(e.target.value)}
                    placeholder="https://www.amazon.in/dp/B0... or https://www.flipkart.com/..."
                    className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-4 text-xs font-semibold text-slate-900 shadow-2xs placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  />
                </div>
                <button
                  type="submit"
                  disabled={quickTrackLoading || !quickTrackUrl.trim()}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-6 py-2.5 text-xs font-black text-white shadow-xs transition hover:bg-indigo-700 disabled:opacity-60"
                >
                  <span>{quickTrackLoading ? 'Inspecting Link…' : '⚡ Track Price Drop'}</span>
                </button>
              </form>
            </div>

            {/* Non-Logged In Email / Phone Lookup Banner */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 text-xs shadow-2xs">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <p className="font-black text-slate-900">Already set alerts with your Email or WhatsApp?</p>
                  <p className="text-slate-500 mt-0.5">Enter your email or phone below to view and manage all active monitors without signing in.</p>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <input
                    type="text"
                    value={lookupInput}
                    onChange={(e) => setLookupInput(e.target.value)}
                    placeholder="your-email@gmail.com"
                    className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 focus:border-indigo-400 focus:outline-none w-full sm:w-64"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (lookupInput.trim()) {
                        setSearchedEmailOrPhone(lookupInput.trim());
                      }
                    }}
                    className="rounded-xl bg-slate-900 px-4 py-2 font-bold text-white hover:bg-slate-800 shrink-0"
                  >
                    Lookup
                  </button>
                </div>
              </div>
            </div>

            {/* Popular Curated Categories to Explore */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-3">
                🔥 Popular Hubs with Live Price Drop Radar
              </h4>
              <div className="flex flex-wrap gap-2">
                <Link
                  href="/best/mobiles"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 hover:border-indigo-300 hover:bg-indigo-50/50 hover:text-indigo-600 transition"
                >
                  <span>📱 Smartphones Under ₹20,000</span>
                </Link>
                <Link
                  href="/best/laptops"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 hover:border-indigo-300 hover:bg-indigo-50/50 hover:text-indigo-600 transition"
                >
                  <span>💻 Student &amp; Gaming Laptops</span>
                </Link>
                <Link
                  href="/best/makeup"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 hover:border-indigo-300 hover:bg-indigo-50/50 hover:text-indigo-600 transition"
                >
                  <span>💄 Cosmetics &amp; Skincare Deals</span>
                </Link>
                <Link
                  href="/best/gym-equipment"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 hover:border-indigo-300 hover:bg-indigo-50/50 hover:text-indigo-600 transition"
                >
                  <span>🏋️ Whey Protein &amp; Fitness</span>
                </Link>
                <Link
                  href="/#deals"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-black text-rose-700 hover:bg-rose-100 transition"
                >
                  <span>🔥 Live Deals Feed</span>
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* CASE 2: GUEST WITH LOCAL BROWSER ALERTS (Feature Them Front & Center)   */}
        {/* ========================================================================= */}
        {!isLoggedIn && hasDeviceProducts && !hasSyncedAlerts && (
          <div className="space-y-6">
            {/* Active on this device banner */}
            <div className="rounded-3xl border border-emerald-200/90 bg-emerald-50/40 p-5 sm:p-6 shadow-xs">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300 bg-white px-3 py-0.5 text-[11px] font-black uppercase tracking-wider text-emerald-800 mb-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Active On This Device (Chrome Web Push)</span>
                  </div>
                  <h1 className="text-xl sm:text-2xl font-black text-slate-900">
                    Your Local Browser Watchlist ({deviceProducts.length}) 🔔
                  </h1>
                  <p className="mt-1 text-xs sm:text-sm text-slate-600 max-w-xl">
                    These items are tracked directly on this browser without requiring an account. You will receive real-time push notifications when prices drop.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto">
                  <button
                    type="button"
                    onClick={loginWithFirebaseGoogle}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-black text-white hover:bg-indigo-700 shadow-sm transition"
                  >
                    <span>🔑 Sign in with Google to Sync to Phone</span>
                  </button>
                  <button
                    type="button"
                    onClick={sendTestNotification}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-white px-3 py-2.5 text-xs font-bold text-emerald-800 hover:bg-emerald-50 transition shadow-2xs"
                  >
                    <span>🔔 Test Push</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Track Input Bar */}
            <div className="rounded-2xl border border-indigo-200/80 bg-gradient-to-r from-indigo-50/70 via-blue-50/40 to-indigo-50/70 p-4 shadow-2xs">
              <form onSubmit={handleQuickTrackSubmit} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm">🔗</span>
                  <input
                    type="text"
                    value={quickTrackUrl}
                    onChange={(e) => setQuickTrackUrl(e.target.value)}
                    placeholder="Track another product: paste any Amazon, Flipkart, or Myntra link..."
                    className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-4 text-xs font-semibold text-slate-900 shadow-2xs placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  />
                </div>
                <button
                  type="submit"
                  disabled={quickTrackLoading || !quickTrackUrl.trim()}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-black text-white shadow-xs transition hover:bg-indigo-700 disabled:opacity-60"
                >
                  <span>{quickTrackLoading ? 'Inspecting Link…' : '⚡ Track Price Drop'}</span>
                </button>
              </form>
            </div>

            {/* Grid of Device Products */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {deviceProducts.map((p) => {
                const prodId = p._id || p.productId;
                const merchant = getMerchantInfo(p.merchant || p.cleanUrl);
                const buyUrl = getAffiliateUrl(p.cleanUrl || p.dealUrl || '', p.merchant, 'web_alert_watchlist');
                return (
                  <div
                    key={prodId}
                    className="flex flex-col justify-between rounded-3xl border border-slate-200/90 bg-white p-5 shadow-xs transition hover:shadow-md"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-1.5">
                          {renderStoreLogo(merchant?.id || 'generic', 'w-4 h-4')}
                          <span className="text-xs font-extrabold text-slate-800 capitalize">
                            {merchant?.name || 'Store'}
                          </span>
                        </div>
                        <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-black text-emerald-700">
                          Active Radar 🟢
                        </span>
                      </div>

                      <div className="flex items-start gap-3">
                        <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-slate-50 p-2 border border-slate-100">
                          {isUsableImageUrl(p.imageUrl) ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={p.imageUrl} alt={p.title} className="h-full w-full object-contain" />
                          ) : (
                            <span className="text-3xl">🛍️</span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <Link href={`/product/${prodId}`} className="line-clamp-2 text-xs font-black text-slate-900 hover:text-indigo-600 transition">
                            {p.title}
                          </Link>
                          <p className="mt-1 text-base font-black text-indigo-700">
                            {formatInr(p.price)}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2">
                      {buyUrl && (
                        <a
                          href={buyUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 flex items-center justify-center gap-1 rounded-xl bg-indigo-600 py-2 px-2 text-xs font-black text-white hover:bg-indigo-700 shadow-xs transition"
                        >
                          <span>⚡ BUY NOW</span>
                        </a>
                      )}
                      <Link
                        href={`/product/${prodId}`}
                        className="rounded-xl border border-slate-200 bg-white p-2 text-slate-700 hover:border-indigo-300 hover:text-indigo-600 transition shadow-2xs"
                        title="View Price History"
                      >
                        <svg className="h-4 w-4 text-indigo-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                        </svg>
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleRemoveDeviceProduct(prodId)}
                        className="rounded-xl border border-rose-200 bg-white px-2.5 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 transition shadow-2xs"
                        title="Stop tracking alert"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* CASE 3: AUTHENTICATED OR SEARCHED EMAIL DASHBOARD                         */}
        {/* ========================================================================= */}
        {(isLoggedIn || hasSyncedAlerts || searchedEmailOrPhone) && (
          <div className="space-y-6">
            {/* Hero Section Header */}
            <div className="rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-4 sm:p-6 shadow-xs">
              <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-end">
                <div>
                  <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-rose-700">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75"></span>
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-500"></span>
                    </span>
                    <span>Autonomous 24/7 Price Radar</span>
                  </div>
                  <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
                    Your Price Drop Alerts &amp; Watchlist 🔔
                  </h1>
                  <p className="mt-1 text-xs sm:text-sm text-slate-600 max-w-2xl leading-relaxed">
                    Products monitored continuously across Amazon, Flipkart, Myntra &amp; Nykaa. When the live price drops to or below your target, we trigger instant alerts via Telegram, Browser WebPush, WhatsApp, and Email.
                  </p>
                </div>

                {/* Notification Channels Quick Summary */}
                <div className="flex flex-wrap items-center gap-2">
                  <a
                    href="https://t.me/ShoppersDealsAlertBot"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-black text-sky-700 transition hover:bg-sky-100"
                  >
                    <span>✈️ Telegram Bot</span>
                    <span className="text-[10px] rounded-md bg-sky-200/80 px-1 py-0.5 text-sky-900">98% Open</span>
                  </a>

                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await sendTestNotification();
                        setTestSent(true);
                        setActionMsg('Test alert sent to your browser! Check your notification tray.');
                        setTimeout(() => setActionMsg(''), 4000);
                      } catch (err) {
                        setActionMsg(err.message || 'Could not send test push.');
                      }
                    }}
                    disabled={pushLoading || !isPushSubscribed}
                    className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-black transition ${
                      isPushSubscribed
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                        : 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed'
                    }`}
                    title={isPushSubscribed ? 'Test instant browser notification' : 'Enable browser push below first'}
                  >
                    <span>🔔 Web Push</span>
                    <span className={`text-[10px] rounded-md px-1 py-0.5 ${isPushSubscribed ? 'bg-emerald-200 text-emerald-900' : 'bg-slate-200 text-slate-500'}`}>
                      {isPushSubscribed ? 'Active 🟢' : 'Off ⚪'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Summary Metrics Bar */}
              <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4 border-t border-slate-100 pt-4">
                <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3">
                  <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500">Total Tracked</span>
                  <p className="mt-0.5 text-xl font-black text-slate-900">
                    {alerts.length + deviceProducts.length}
                  </p>
                  <span className="text-[10px] text-slate-400">Products in radar</span>
                </div>

                <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-3">
                  <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-emerald-800">Target Reached</span>
                  <p className="mt-0.5 text-xl font-black text-emerald-700">
                    {targetMetCount}
                  </p>
                  <span className="text-[10px] text-emerald-700 font-semibold">Ready to buy deals</span>
                </div>

                <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-3">
                  <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-amber-800">Monitoring 24/7</span>
                  <p className="mt-0.5 text-xl font-black text-amber-700">
                    {monitoringCount}
                  </p>
                  <span className="text-[10px] text-amber-700 font-semibold">Awaiting drop</span>
                </div>

                <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-3">
                  <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-indigo-800">Sync Channels</span>
                  <div className="mt-0.5 flex items-center gap-1.5 text-sm">
                    <span title="Telegram Bot">✈️</span>
                    <span title="Browser Web Push">🔔</span>
                    <span title="WhatsApp / Email">💬</span>
                  </div>
                  <span className="text-[10px] text-indigo-700 font-semibold">&lt; 60s dispatch</span>
                </div>
              </div>
            </div>

            {/* Quick URL Tracker Bar */}
            <div className="rounded-2xl border border-indigo-200/80 bg-gradient-to-r from-indigo-50/70 via-blue-50/40 to-indigo-50/70 p-4 shadow-2xs">
              <form onSubmit={handleQuickTrackSubmit} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm">🔗</span>
                  <input
                    type="text"
                    value={quickTrackUrl}
                    onChange={(e) => setQuickTrackUrl(e.target.value)}
                    placeholder="Paste any Amazon, Flipkart, Myntra product link to set an alert..."
                    className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-4 text-xs font-semibold text-slate-900 shadow-2xs placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  />
                </div>
                <button
                  type="submit"
                  disabled={quickTrackLoading || !quickTrackUrl.trim()}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-black text-white shadow-xs transition hover:bg-indigo-700 disabled:opacity-60"
                >
                  <span>{quickTrackLoading ? 'Inspecting Link…' : '⚡ Track Price Drop'}</span>
                </button>
              </form>
            </div>

            {/* Filter Tabs Strip */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setFilterTab('all')}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
                    filterTab === 'all'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  All Alerts ({alerts.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterTab('target_met')}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
                    filterTab === 'target_met'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  Target Met ({targetMetCount})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterTab('monitoring')}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
                    filterTab === 'monitoring'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  Monitoring ({monitoringCount})
                </button>
              </div>

              <button
                type="button"
                onClick={fetchAlerts}
                className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800"
              >
                <span>🔄 Refresh Prices</span>
              </button>
            </div>

            {/* Alerts Grid / List */}
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <span className="h-8 w-8 animate-spin rounded-full border-3 border-indigo-600 border-t-transparent" />
                <p className="mt-3 text-xs font-bold text-slate-500">Checking live store prices &amp; alert triggers…</p>
              </div>
            ) : filteredAlerts.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredAlerts.map((alert) => {
                  const alertId = alert._id;
                  const merchant = getMerchantInfo(alert.merchant || alert.cleanUrl);
                  const currentPrice = Number(alert.currentPrice || alert.initialPrice || 0);
                  const targetPrice = Number(alert.targetPrice || 0);
                  const isTargetMet = currentPrice > 0 && currentPrice <= targetPrice;
                  const priceDelta = currentPrice - targetPrice;
                  const dropFromInitial = (alert.initialPrice || 0) > currentPrice ? alert.initialPrice - currentPrice : 0;
                  const productHref = alert.linkedProductId ? `/product/${alert.linkedProductId}` : alert.cleanUrl || '#';
                  const buyUrl = getAffiliateUrl(alert.cleanUrl || '', alert.merchant, 'web_alert_card');

                  return (
                    <div
                      key={alertId}
                      className={`flex flex-col justify-between rounded-3xl border p-5 shadow-xs transition hover:shadow-md ${
                        isTargetMet
                          ? 'border-emerald-300 bg-gradient-to-b from-emerald-50/50 to-white ring-2 ring-emerald-500/20'
                          : 'border-slate-200/90 bg-white'
                      }`}
                    >
                      <div>
                        {/* Card Header: Store logo & Badge */}
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <div className="flex items-center gap-1.5">
                            {renderStoreLogo(merchant?.id || 'generic', 'w-4 h-4')}
                            <span className="text-xs font-extrabold text-slate-800 capitalize">
                              {merchant?.name || alert.merchant}
                            </span>
                          </div>

                          {isTargetMet ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-900 animate-pulse">
                              <span>🎯 TARGET HIT</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                              <span>⏳ MONITORING</span>
                            </span>
                          )}
                        </div>

                        {/* Product Title & Image */}
                        <div className="flex items-start gap-3">
                          <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-slate-50 p-2 border border-slate-100">
                            {isUsableImageUrl(alert.imageUrl) ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={alert.imageUrl} alt={alert.title} className="h-full w-full object-contain" />
                            ) : (
                              <span className="text-3xl">🛍️</span>
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <Link href={productHref} className="line-clamp-2 text-xs font-black text-slate-900 hover:text-indigo-600 transition">
                              {alert.title}
                            </Link>
                            <p className="mt-1 text-[10px] font-semibold text-slate-400">
                              Added {formatRelativeTime(alert.createdAt)}
                            </p>
                          </div>
                        </div>

                        {/* Pricing Benchmark Box */}
                        <div className="mt-3.5 rounded-2xl bg-slate-50/80 p-3 border border-slate-100">
                          <div className="flex items-baseline justify-between">
                            <div>
                              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Current Live Price</span>
                              <p className="text-lg font-black tracking-tight text-slate-950">
                                {formatInr(currentPrice)}
                              </p>
                            </div>
                            <div className="text-right">
                              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Target Alert Price</span>
                              <p className="text-lg font-black tracking-tight text-indigo-700">
                                {formatInr(targetPrice)}
                              </p>
                            </div>
                          </div>

                          {/* Drop evaluation status */}
                          <div className="mt-2 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px] font-bold">
                            {isTargetMet ? (
                              <span className="text-emerald-700">
                                ✓ ₹{Math.abs(priceDelta).toLocaleString('en-IN')} below your target!
                              </span>
                            ) : (
                              <span className="text-amber-700">
                                ⏳ Needs ₹{priceDelta.toLocaleString('en-IN')} drop to trigger
                              </span>
                            )}

                            {dropFromInitial > 0 && (
                              <span className="text-emerald-600 font-extrabold text-[10px]">
                                📉 Down ₹{dropFromInitial.toLocaleString('en-IN')}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Actions & Buttons */}
                      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2">
                        {buyUrl && (
                          <a
                            href={buyUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`flex-1 flex items-center justify-center gap-1 rounded-xl py-2 px-2 text-xs font-black shadow-xs transition ${
                              isTargetMet
                                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                                : 'bg-indigo-600 text-white hover:bg-indigo-700'
                            }`}
                          >
                            <span>⚡ BUY NOW</span>
                          </a>
                        )}

                        <Link
                          href={productHref}
                          className="rounded-xl border border-slate-200 bg-white p-2 text-slate-700 hover:border-indigo-300 hover:text-indigo-600 transition shadow-2xs"
                          title="View 90-day price history chart"
                        >
                          <svg className="h-4 w-4 text-indigo-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                          </svg>
                        </Link>

                        <button
                          type="button"
                          onClick={() => {
                            setEditingAlert(alert);
                            setNewTargetPrice(String(alert.targetPrice));
                          }}
                          className="rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-bold text-slate-700 hover:border-slate-300 transition shadow-2xs"
                          title="Edit target price"
                        >
                          ✏️ Edit
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteAlert(alertId)}
                          className="rounded-xl border border-rose-200 bg-white px-2.5 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 transition shadow-2xs"
                          title="Stop tracking alert"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Empty State for logged-in user with 0 alerts */
              <div className="rounded-3xl border border-slate-200/90 bg-white p-8 sm:p-12 text-center shadow-xs">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-indigo-50 text-3xl">
                  🔔
                </div>
                <h2 className="text-xl font-extrabold text-slate-900">No Active Price Alerts Found</h2>
                <p className="mt-1.5 text-xs sm:text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
                  You haven&apos;t set any price drop alerts yet. Paste any store product link above, or tap the &quot;Alert&quot; button on any deal or product page to get notified the instant the price crashes.
                </p>

                <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                  <Link
                    href="/#deals"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-slate-800 transition"
                  >
                    <span>🔥 Browse Live Steals</span>
                  </Link>
                  <Link
                    href="/best/mobiles"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-bold text-slate-700 shadow-2xs hover:border-slate-400 transition"
                  >
                    <span>📱 Smartphone Price Radar</span>
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Edit Target Price Modal Dialog */}
      {editingAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl animate-scaleUp">
            <h3 className="text-base font-extrabold text-slate-900">Edit Alert Target Price</h3>
            <p className="mt-1 line-clamp-1 text-xs text-slate-500">{editingAlert.title}</p>

            <div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Current Price:</span>
                <span className="font-bold text-slate-900">{formatInr(editingAlert.currentPrice || editingAlert.initialPrice)}</span>
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Notify me when price drops below (₹):
              </label>
              <input
                type="number"
                value={newTargetPrice}
                onChange={(e) => setNewTargetPrice(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-base font-black text-slate-900 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            {/* Quick % drop pills */}
            <div className="mt-3 flex items-center gap-1.5">
              {[5, 10, 15, 20].map((pct) => {
                const base = Number(editingAlert.currentPrice || editingAlert.initialPrice || 0);
                const calc = Math.round(base * (1 - pct / 100));
                return (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => setNewTargetPrice(String(calc))}
                    className="flex-1 rounded-lg border border-slate-200 bg-slate-50 py-1 text-[11px] font-bold text-slate-700 hover:border-indigo-300"
                  >
                    -{pct}%
                  </button>
                );
              })}
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingAlert(null)}
                className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveTargetPrice}
                disabled={isUpdatingTarget}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-black text-white hover:bg-indigo-700 shadow-xs disabled:opacity-60"
              >
                {isUpdatingTarget ? 'Saving…' : 'Save Target'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Track Modal when product found */}
      {quickTrackModalProduct && (
        <PriceAlertModal
          product={quickTrackModalProduct}
          isOpen={Boolean(quickTrackModalProduct)}
          onClose={() => {
            setQuickTrackModalProduct(null);
            fetchAlerts();
            fetchDeviceProducts();
          }}
        />
      )}
    </div>
  );
}
