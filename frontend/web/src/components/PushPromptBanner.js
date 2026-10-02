'use client';

import React, { useState, useEffect } from 'react';
import { usePushNotification } from '@/lib/usePushNotification';

const PUSH_PROMPT_DISMISSED_KEY = '@sd_push_prompt_dismissed_until';

export default function PushPromptBanner() {
  const { isSupported, permission, isSubscribed, subscribeToPush, loading } = usePushNotification();
  const [isVisible, setIsVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!isSupported) return;
    if (isSubscribed) return;
    if (permission !== 'default') return;

    // Check if user dismissed recently (wait 3 days before showing again)
    try {
      const dismissedUntil = window.localStorage.getItem(PUSH_PROMPT_DISMISSED_KEY);
      if (dismissedUntil && Number(dismissedUntil) > Date.now()) {
        return;
      }
    } catch (e) {}

    // Show after 2.5 seconds so it doesn't jarringly block the initial render
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 2500);

    return () => clearTimeout(timer);
  }, [isSupported, isSubscribed, permission]);

  const handleAllow = async () => {
    try {
      const res = await subscribeToPush();
      if (res?.success) {
        setSuccessMsg('🎉 Notifications enabled! You will get instant alerts on price drops.');
        setTimeout(() => {
          setIsVisible(false);
        }, 2200);
      }
    } catch (err) {
      console.warn('[PushPromptBanner] User closed or denied permission:', err.message);
      setIsVisible(false);
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    setDismissed(true);
    try {
      // Don't show again for 3 days
      const expireTime = Date.now() + 3 * 24 * 60 * 60 * 1000;
      window.localStorage.setItem(PUSH_PROMPT_DISMISSED_KEY, String(expireTime));
    } catch (e) {}
  };

  if (!isVisible || dismissed) return null;

  return (
    <div
      role="dialog"
      aria-live="polite"
      className="fixed bottom-20 left-4 right-4 z-50 mx-auto max-w-md sm:bottom-6 sm:left-auto sm:right-6 animate-in fade-in slide-in-from-bottom-5 duration-300"
    >
      <div className="overflow-hidden rounded-2xl border border-orange-200 bg-white shadow-2xl shadow-orange-950/15">
        {/* Header stripe */}
        <div className="bg-gradient-to-r from-[#0f172a] via-[#1e293b] to-[#0f172a] px-4 py-3 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-500/20 text-base">
              🔔
            </span>
            <span className="text-xs font-black uppercase tracking-wider text-orange-400">
              Live Price Drop Alerts
            </span>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            className="flex h-6 w-6 items-center justify-center rounded-full text-gray-400 hover:bg-white/10 hover:text-white"
            aria-label="Close prompt"
          >
            ✕
          </button>
        </div>

        {/* Content body */}
        <div className="p-4">
          {successMsg ? (
            <div className="flex items-center gap-2.5 py-1 text-xs font-bold text-emerald-700">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 font-black">
                ✓
              </span>
              <span>{successMsg}</span>
            </div>
          ) : (
            <>
              <p className="text-xs leading-5 text-gray-700 font-medium">
                Want instant alerts when tracked products crash on <strong className="text-gray-900">Amazon &amp; Flipkart</strong>? We only notify you on genuine drops — zero spam.
              </p>

              <div className="mt-3.5 flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleAllow}
                  disabled={loading}
                  className="flex-1 rounded-xl bg-brand py-2.5 px-3 text-xs font-black text-white shadow-sm hover:brightness-105 active:scale-98 disabled:opacity-60 flex items-center justify-center gap-1.5"
                >
                  <span>{loading ? 'Opening Prompt…' : '⚡ Allow Notifications'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleDismiss}
                  className="rounded-xl border border-gray-200 bg-gray-50 py-2.5 px-3 text-xs font-bold text-gray-600 hover:bg-gray-100 active:scale-98"
                >
                  Later
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
