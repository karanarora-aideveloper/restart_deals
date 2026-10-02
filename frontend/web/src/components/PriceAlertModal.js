'use client';

import React, { useState } from 'react';
import { API_BASE_URL } from '@/lib/config';
import { formatInr } from '@/lib/affiliate';
import { useAuth } from '@/components/AuthProvider';
import { usePushNotification } from '@/lib/usePushNotification';
import { trackPriceAlertCreate, trackEvent } from '@/lib/analytics';

export default function PriceAlertModal({ product, isOpen, onClose }) {
  const { user, token } = useAuth();
  const { isSupported: isPushSupported, permission: pushPermission, trackProduct } = usePushNotification();
  const currentPrice = Number(product?.price) || 0;

  const [targetPrice, setTargetPrice] = useState(
    currentPrice > 0 ? String(Math.round(currentPrice * 0.9)) : ''
  );
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phoneNumber || '');
  const [enableBrowserPush, setEnableBrowserPush] = useState(true);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const setDiscountPct = (pct) => {
    if (currentPrice > 0) {
      const calculated = Math.round(currentPrice * (1 - pct / 100));
      setTargetPrice(String(calculated));
    }
  };

  const handleSubscribe = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    const numTarget = Number(targetPrice);
    if (!numTarget || numTarget <= 0) {
      setErrorMsg('Please enter a valid target price.');
      setLoading(false);
      return;
    }

    const hasPush = enableBrowserPush && isPushSupported;
    const hasContact = Boolean(user || email.trim() || phone.trim());

    if (!hasPush && !hasContact) {
      setErrorMsg('Please select Browser Push or provide an email / WhatsApp number.');
      setLoading(false);
      return;
    }

    try {
      const prodId = product?._id || product?.productId;

      // 1. If Browser Push is enabled, register with PushManager & Server
      if (hasPush && prodId) {
        try {
          await trackProduct(prodId);
        } catch (pushErr) {
          console.warn('[WebPush] Error setting up push for product:', pushErr);
          // If browser push was the only selected channel and failed due to user denying permission:
          if (!hasContact) {
            throw new Error('Please enable browser notifications or provide an email/WhatsApp number.');
          }
        }
      }

      // 2. Register price alert in database if email/phone or logged-in user or target price specified
      if (hasContact || prodId) {
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch(`${API_BASE_URL}/api/alerts`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            productId: prodId,
            merchant: product?.merchant,
            targetPrice: numTarget,
            email: email.trim() || undefined,
            phone: phone.trim() || undefined,
          }),
        });

        const json = await res.json();
        if (!res.ok && !hasPush) {
          throw new Error(json.error || 'Failed to create price alert');
        }
      }

      trackPriceAlertCreate(product, numTarget, hasPush ? 'web_push' : email ? 'email' : 'whatsapp');
      setSuccess(true);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to set alert');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="bg-[#0f172a] px-6 py-5 text-white">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-black">
              <span>🔔</span> Set Price Drop Alert
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
              aria-label="Close modal"
            >
              ✕
            </button>
          </div>
          <p className="mt-1 text-xs text-[#94a3b8]">
            We&apos;ll notify you the moment the price drops to your target.
          </p>
        </div>

        <div className="p-6">
          {success ? (
            <div className="py-4 text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[#f0fdf4] text-2xl text-[#16a34a]">
                ✓
              </div>
              <h3 className="text-lg font-black text-[#111827]">Alert Activated!</h3>
              <p className="mt-1.5 text-sm text-[#4b5563]">
                We are actively monitoring <span className="font-bold text-[#111827]">{product?.title || 'this product'}</span>. When the price falls to or below <span className="font-extrabold text-brand">{formatInr(Number(targetPrice), product?.country)}</span>, you will be notified immediately.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="mt-6 w-full rounded-xl bg-brand py-3 text-sm font-bold text-white shadow-sm"
              >
                Done
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubscribe} className="space-y-4">
              {/* Current Price Reference */}
              <div className="flex items-center justify-between rounded-xl bg-[#f9fafb] p-3 border border-[#f0f0f0]">
                <div>
                  <span className="text-[11px] font-bold uppercase text-[#6b7280]">Current Price</span>
                  <p className="text-base font-black text-[#111827]">{formatInr(currentPrice, product?.country)}</p>
                </div>
                <span className="rounded-md bg-[#fff4ed] px-2 py-1 text-xs font-bold text-brand">
                  Live Tracked
                </span>
              </div>

              {/* Target Price */}
              <div>
                <label htmlFor="targetPriceInput" className="mb-1.5 block text-xs font-bold text-[#374151]">
                  Alert me when price drops to:
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-black text-[#6b7280]">₹</span>
                  <input
                    id="targetPriceInput"
                    type="number"
                    value={targetPrice}
                    onChange={(e) => setTargetPrice(e.target.value)}
                    required
                    placeholder="Enter target price"
                    className="w-full rounded-xl border border-[#d1d5db] bg-white py-2.5 pl-8 pr-4 text-sm font-extrabold text-[#111827] focus:border-brand focus:outline-none"
                  />
                </div>

                {/* Quick discount chips */}
                <div className="mt-2 flex items-center gap-1.5">
                  {[5, 10, 15, 20].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => setDiscountPct(pct)}
                      className="rounded-lg border border-[#e5e7eb] bg-[#f9fafb] px-2.5 py-1 text-[11px] font-bold text-[#4b5563] hover:border-brand hover:text-brand"
                    >
                      -{pct}% Drop
                    </button>
                  ))}
                </div>
              </div>

              {/* Notification Channels */}
              <div className="space-y-2">
                <span className="block text-xs font-bold text-[#374151]">
                  How should we notify you?
                </span>

                {/* Telegram Bot Direct 1-Click Link */}
                <a
                  href={`https://t.me/ShoppersDealsAlertBot?start=track_${product?.productId || product?._id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => {
                    trackEvent('telegram_alert_bot_clicked', {
                      product_id: product?.productId,
                      merchant: product?.merchant,
                      target_price: Number(targetPrice) || null,
                    });
                  }}
                  className="flex items-center justify-between rounded-xl border border-sky-200 bg-sky-50/70 p-2.5 transition-colors hover:bg-sky-100/70 group"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#229ED9] text-white">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <line x1="22" y1="2" x2="11" y2="13"></line>
                        <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                      </svg>
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-extrabold text-sky-950">Telegram Bot Alert</span>
                        <span className="rounded bg-sky-200/60 px-1.5 py-0.2 text-[9px] font-black text-sky-800 uppercase">Instant DM</span>
                      </div>
                      <p className="text-[11px] text-sky-800 truncate">1-Click Open @ShoppersDealsAlertBot</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-sky-700 group-hover:translate-x-0.5 transition-transform shrink-0">Open Bot ↗</span>
                </a>

                {isPushSupported && (
                  <label className="flex items-center gap-2.5 rounded-xl border border-orange-200 bg-orange-50/70 p-2.5 cursor-pointer hover:bg-orange-50 transition-colors">
                    <input
                      type="checkbox"
                      checked={enableBrowserPush}
                      onChange={(e) => setEnableBrowserPush(e.target.checked)}
                      className="h-4 w-4 rounded accent-brand cursor-pointer"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-extrabold text-gray-900">⚡ Instant Browser Push</span>
                        <span className="rounded bg-brand/10 px-1.5 py-0.5 text-[10px] font-black text-brand uppercase">Fastest</span>
                      </div>
                      <p className="text-[11px] text-gray-600">Direct pop-up alert on this browser even if tab is closed</p>
                    </div>
                  </label>
                )}
              </div>

              {/* Contact Information (Optional when Push is Active) */}
              <div>
                <label htmlFor="alertEmailInput" className="mb-1 block text-xs font-bold text-[#374151]">
                  Email or WhatsApp {enableBrowserPush && isPushSupported ? <span className="font-normal text-gray-500">(Optional with push)</span> : <span className="text-red-500">*</span>}
                </label>
                <input
                  id="alertEmailInput"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Your Email Address (e.g. name@gmail.com)"
                  className="mb-2 w-full rounded-xl border border-[#d1d5db] bg-white px-3.5 py-2.5 text-xs text-[#111827] focus:border-brand focus:outline-none"
                />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Or WhatsApp Number (e.g. 9876543210)"
                  className="w-full rounded-xl border border-[#d1d5db] bg-white px-3.5 py-2.5 text-xs text-[#111827] focus:border-brand focus:outline-none"
                />
              </div>

              {errorMsg && <p className="text-xs font-bold text-[#dc2626]">{errorMsg}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-brand py-3 text-sm font-extrabold text-white shadow-md disabled:opacity-60"
              >
                {loading ? 'Setting Alert…' : '🔔 Set Price Drop Alert'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
