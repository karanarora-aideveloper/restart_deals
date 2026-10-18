'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { API_BASE_URL } from '@/lib/config';
import { formatInr } from '@/lib/affiliate';
import { useAuth } from '@/components/AuthProvider';
import { usePushNotification } from '@/lib/usePushNotification';
import { trackPriceAlertCreate, trackEvent } from '@/lib/analytics';

export default function PriceAlertModal({ product, isOpen, onClose }) {
  const { user, token } = useAuth();
  const { isSupported: isPushSupported, permission: pushPermission, trackProduct } = usePushNotification();
  const currentPrice = Number(product?.price) || 0;

  const [mounted, setMounted] = useState(false);
  const [targetPrice, setTargetPrice] = useState(
    currentPrice > 0 ? String(Math.round(currentPrice * 0.9)) : ''
  );
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phoneNumber || '');
  const [enableBrowserPush, setEnableBrowserPush] = useState(true);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    setMounted(true);
  }, []);

  // Synchronize target price and reset error/success whenever product or open state changes
  useEffect(() => {
    if (currentPrice > 0) {
      setTargetPrice(String(Math.round(currentPrice * 0.9)));
    }
    setSuccess(false);
    setErrorMsg('');
  }, [product?._id, product?.productId, currentPrice, isOpen]);

  // Escape key to dismiss
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  if (!isOpen || !mounted) return null;

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
          if (!hasContact) {
            throw new Error('Please enable browser notifications or provide an email/WhatsApp number.');
          }
        }
      }

      // 2. Register price alert in database if contact info or product ID is provided
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

  const modalNode = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/65 backdrop-blur-xs p-3 sm:p-4 overscroll-contain"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="price-alert-modal-title"
    >
      <div
        className="relative w-full max-w-[460px] max-h-[min(90vh,640px)] flex flex-col rounded-2xl bg-white shadow-2xl border border-slate-200/90 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 1. Header (Pinned at top, never cropped) */}
        <div className="shrink-0 bg-[#0f172a] px-5 py-3.5 text-white flex items-center justify-between">
          <div className="min-w-0 pr-3">
            <h2 id="price-alert-modal-title" className="flex items-center gap-2 text-base font-black truncate">
              <span>🔔</span> Set Price Drop Alert
            </h2>
            <p className="mt-0.5 text-[11px] text-slate-400 truncate">
              We&apos;ll notify you the moment the price drops to your target.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        {/* 2. Scrollable Body */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5 space-y-3.5">
          {success ? (
            <div className="py-6 text-center space-y-3">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-2xl text-emerald-600 font-bold border border-emerald-200">
                ✓
              </div>
              <h3 className="text-base sm:text-lg font-black text-slate-900">Alert Activated!</h3>
              <p className="text-xs sm:text-sm text-slate-600 max-w-sm mx-auto leading-relaxed">
                We are actively monitoring <span className="font-bold text-slate-900">{product?.title || 'this product'}</span>. When the price falls to or below <span className="font-extrabold text-brand">{formatInr(Number(targetPrice), product?.country)}</span>, you will be notified immediately.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="mt-4 w-full rounded-xl bg-brand py-2.5 text-xs sm:text-sm font-bold text-white shadow-sm hover:bg-brand-dark transition-colors"
              >
                Done
              </button>
            </div>
          ) : (
            <form id="price-alert-form" onSubmit={handleSubscribe} className="space-y-3.5">
              {/* Product Reference Card */}
              <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-2.5 border border-slate-200/80">
                {product?.imageUrl && (
                  <img
                    src={product.imageUrl}
                    alt={product.title || 'Product'}
                    className="h-11 w-11 shrink-0 rounded-lg bg-white object-contain p-1 border border-slate-200/60"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-900 line-clamp-1">
                    {product?.title || 'Tracked Item'}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] text-slate-500 font-medium">Current Price:</span>
                    <span className="text-xs font-black text-slate-950">
                      {formatInr(currentPrice, product?.country)}
                    </span>
                    <span className="rounded bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 text-[9px] font-black text-emerald-800">
                      Live
                    </span>
                  </div>
                </div>
              </div>

              {/* 1-Tap Telegram Alert via Official @ShoppersDealsAlertBot */}
              <a
                href={`https://t.me/ShoppersDealsAlertBot?start=alert_${product?.productId || product?._id}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  trackEvent('telegram_alert_bot_clicked', {
                    product_id: product?.productId,
                    merchant: product?.merchant,
                    target_price: Number(targetPrice) || null,
                  });
                }}
                className="flex items-center justify-between gap-3 rounded-xl bg-gradient-to-r from-sky-50 to-sky-100/50 border border-sky-200 p-2.5 transition hover:border-sky-400 hover:shadow-2xs group"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#229ED9] text-white shadow-xs">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="22" y1="2" x2="11" y2="13"></line>
                      <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-black text-slate-900 group-hover:text-sky-700 transition-colors">
                        Instant Alert via Telegram Bot
                      </span>
                      <span className="rounded bg-sky-200/70 px-1.5 py-0.2 text-[8.5px] font-black text-sky-900 uppercase">
                        Fastest
                      </span>
                    </div>
                    <p className="text-[10.5px] text-slate-500 truncate">
                      1-Tap • 0s setup • Free DM when price drops
                    </p>
                  </div>
                </div>
                <span className="shrink-0 rounded-lg bg-[#229ED9] px-2.5 py-1 text-[10.5px] font-bold text-white shadow-2xs group-hover:bg-sky-600 transition-colors">
                  Open Bot ↗
                </span>
              </a>

              {/* Divider */}
              <div className="relative flex items-center justify-center my-1">
                <div className="border-t border-slate-200 w-full" />
                <span className="bg-white px-2.5 text-[9.5px] font-bold uppercase tracking-wider text-slate-400 absolute">
                  Or set custom target
                </span>
              </div>

              {/* Target Price */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="targetPriceInput" className="text-xs font-bold text-slate-700">
                    Alert me when price drops to:
                  </label>
                  {Number(targetPrice) > 0 && currentPrice > Number(targetPrice) && (
                    <span className="text-[10.5px] font-extrabold text-emerald-600">
                      Save ₹{(currentPrice - Number(targetPrice)).toLocaleString('en-IN')} ({Math.round(((currentPrice - Number(targetPrice)) / currentPrice) * 100)}% drop)
                    </span>
                  )}
                </div>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-black text-slate-500">₹</span>
                  <input
                    id="targetPriceInput"
                    type="number"
                    value={targetPrice}
                    onChange={(e) => setTargetPrice(e.target.value)}
                    required
                    placeholder="Enter target price"
                    className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-8 pr-4 text-sm font-extrabold text-slate-900 focus:border-brand focus:ring-1 focus:ring-brand focus:outline-none"
                  />
                </div>

                {/* Quick discount chips */}
                <div className="mt-1.5 flex items-center gap-1.5">
                  {[5, 10, 15, 20].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => setDiscountPct(pct)}
                      className="flex-1 rounded-lg border border-slate-200 bg-slate-50 py-1 text-[10.5px] font-bold text-slate-600 hover:border-brand hover:text-brand hover:bg-orange-50/50 transition-colors"
                    >
                      -{pct}%
                    </button>
                  ))}
                </div>
              </div>

              {/* Notification Channels */}
              <div className="space-y-2">
                <span className="block text-xs font-bold text-slate-700">
                  Delivery Channels:
                </span>

                {isPushSupported && (
                  <label className="flex items-center gap-2.5 rounded-xl border border-orange-200 bg-orange-50/60 p-2.5 cursor-pointer hover:bg-orange-50 transition-colors">
                    <input
                      type="checkbox"
                      checked={enableBrowserPush}
                      onChange={(e) => setEnableBrowserPush(e.target.checked)}
                      className="h-4 w-4 rounded accent-brand cursor-pointer"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-extrabold text-slate-900">⚡ Instant Browser Push</span>
                        <span className="rounded bg-brand/10 px-1.5 py-0.2 text-[9px] font-black text-brand uppercase">
                          Instant
                        </span>
                      </div>
                      <p className="text-[10.5px] text-slate-500 leading-tight">
                        Pop-up notification on this browser when price drops
                      </p>
                    </div>
                  </label>
                )}

                {/* Email / WhatsApp Inputs */}
                <div>
                  <label htmlFor="alertEmailInput" className="mb-1 block text-[11px] font-bold text-slate-600">
                    Email or WhatsApp {enableBrowserPush && isPushSupported ? <span className="font-normal text-slate-400">(Optional with browser push)</span> : <span className="text-rose-500">*</span>}
                  </label>
                  <div className="space-y-1.5">
                    <input
                      id="alertEmailInput"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Your Email Address (e.g. name@gmail.com)"
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-brand focus:outline-none"
                    />
                    <input
                      id="alertPhoneInput"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="Or WhatsApp Number (e.g. 9876543210)"
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-brand focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {errorMsg && (
                <p className="text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200 rounded-lg p-2">
                  {errorMsg}
                </p>
              )}
            </form>
          )}
        </div>

        {/* 3. Footer (Pinned at bottom, submit button never cut off) */}
        {!success && (
          <div className="shrink-0 bg-slate-50 border-t border-slate-200/80 px-4 py-3 sm:px-5">
            <button
              type="submit"
              form="price-alert-form"
              disabled={loading}
              className="w-full rounded-xl bg-brand py-2.5 text-xs sm:text-sm font-extrabold text-white shadow-sm hover:bg-brand-dark transition-colors disabled:opacity-60 flex items-center justify-center gap-1.5"
            >
              {loading ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Setting Alert…</span>
                </>
              ) : (
                <>
                  <span>🔔</span>
                  <span>Set Price Drop Alert</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modalNode, document.body);
}
