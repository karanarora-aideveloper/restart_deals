'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { logEvent } from '@/lib/analytics';
import { usePushNotification } from '@/lib/usePushNotification';

export default function ProfilePage() {
  const { user, isLoggedIn, loginWithFirebaseGoogle, logout, deleteAccount } = useAuth();
  const {
    isSupported: isPushSupported,
    permission: pushPermission,
    isSubscribed: isPushSubscribed,
    subscribeToPush,
    sendTestNotification,
    loading: pushLoading,
    trackedProducts,
  } = usePushNotification();

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [testSent, setTestSent] = useState(false);
  const [pushStatusMsg, setPushStatusMsg] = useState('');

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      await loginWithFirebaseGoogle();
      logEvent('login', { method: 'Google' });
    } catch (err) {
      if (
        err?.code === 'auth/popup-closed-by-user' ||
        err?.code === 'auth/cancelled-popup-request' ||
        err?.message?.includes('popup-closed-by-user') ||
        err?.message?.includes('cancelled-popup-request')
      ) {
        // User voluntarily closed the popup, do not show error banner
        return;
      }
      setErrorMsg(err.message || 'Google Sign-In failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    setLoading(true);
    await logout().catch(() => {});
    setLoading(false);
  };

  const handleDeleteAccount = async () => {
    if (typeof window === 'undefined') return;
    if (!window.confirm('Are you sure you want to permanently delete your account? This action cannot be undone.')) return;
    setLoading(true);
    try {
      await deleteAccount();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to delete account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[560px] px-5 py-8 pb-16">
      <h1 className="sr-only">Your Account</h1>

      {isLoggedIn && user ? (
        <div className="rounded-2xl border border-[#efefef] bg-white p-6 text-center">
          {user.picture ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.picture} alt={user.name || 'Profile'} className="mx-auto mb-4 h-20 w-20 rounded-full border-2 border-brand object-cover" />
          ) : (
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-brand text-2xl font-bold text-white">
              {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </div>
          )}
          <p className="text-lg font-bold text-[#1a1a1a]">{user.name || 'ShoppersDeals User'}</p>
          {user.email && <p className="mt-1 text-sm text-[#6b7280]">{user.email}</p>}
          {user.phoneNumber && <p className="mt-1 text-sm text-[#6b7280]">{user.phoneNumber}</p>}

          <Link href="/saved" className="mt-6 block rounded-xl bg-brand py-3 text-sm font-bold text-white">
            View Saved Deals
          </Link>
          <button
            type="button"
            onClick={handleSignOut}
            disabled={loading}
            className="mt-3 block w-full rounded-xl border border-[#e5e7eb] py-3 text-sm font-bold text-[#1a1a1a]"
          >
            Sign Out
          </button>
          <button
            type="button"
            onClick={handleDeleteAccount}
            disabled={loading}
            className="mt-3 text-xs font-semibold text-[#dc2626] underline"
          >
            Delete Account
          </button>

          {errorMsg && <p className="mt-4 text-sm font-semibold text-[#dc2626]">{errorMsg}</p>}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[#efefef] bg-white">
          <div className="bg-[#0f172a] px-6 py-6">
            <p className="mb-1.5 text-xl font-extrabold text-white">
              Shoppers<span className="text-brand">Deals</span> 🛍️
            </p>
            <p className="text-sm leading-6 text-[#cbd5e1]">
              We scan Amazon, Flipkart &amp; Myntra around the clock — using AI to catch genuine price drops, flash sales, and hidden coupons the moment they go live, so you never overpay.
            </p>
          </div>

          <div className="p-6">
            <p className="mb-4 text-base font-extrabold text-[#1a1a1a]">Why sign in?</p>

            <ul className="mb-6 space-y-3.5">
              <li className="flex items-start gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#fff4ed] text-base" aria-hidden>💾</span>
                <span className="text-sm leading-5 text-[#4b5563]">
                  <span className="font-bold text-[#1a1a1a]">Your wishlist, everywhere.</span> Heart a deal on your phone, pick it back up on your laptop — saved deals sync across every device you sign in on.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#f0fdf4] text-base" aria-hidden>💸</span>
                <span className="text-sm leading-5 text-[#4b5563]">
                  <span className="font-bold text-[#1a1a1a]">100% free, always.</span> Signing in never costs you anything — we earn a small commission from retailers when you buy, never from you.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#eef2ff] text-base" aria-hidden>🔒</span>
                <span className="text-sm leading-5 text-[#4b5563]">
                  <span className="font-bold text-[#1a1a1a]">Quick and secure.</span> One tap with Google — no password to remember, and we never see your payment details or card info.
                </span>
              </li>
            </ul>

            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="flex w-full items-center justify-center gap-3 rounded-xl border border-[#e5e7eb] py-3 text-sm font-bold text-[#1a1a1a] disabled:opacity-60"
            >
              <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.07 5.07 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" /><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" /><path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.77.43 3.45 1.18 4.94l3.66-2.84z" /><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1a11 11 0 0 0-9.82 6.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" /></svg>
              {loading ? 'Signing in…' : 'Continue with Google'}
            </button>

            {errorMsg && <p className="mt-4 text-sm font-semibold text-[#dc2626]">{errorMsg}</p>}
          </div>
        </div>
      )}

      {/* Browser Push Notifications Settings Card */}
      <section className="mt-6 rounded-2xl border border-[#efefef] bg-white p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-100 text-lg">
              🔔
            </span>
            <div>
              <h2 className="text-base font-extrabold text-[#1a1a1a]">Browser Push Notifications</h2>
              <p className="text-xs text-[#6b7280]">Instant desktop &amp; mobile alerts when prices drop</p>
            </div>
          </div>
          {isPushSupported && (
            <span
              className={`rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-wider ${
                isPushSubscribed
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {isPushSubscribed ? 'Active 🟢' : 'Off ⚪'}
            </span>
          )}
        </div>

        <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
          {!isPushSupported ? (
            <p className="text-xs text-gray-500">
              Web push notifications are not supported on this browser or platform.
            </p>
          ) : isPushSubscribed ? (
            <div>
              <p className="text-xs leading-5 text-gray-600">
                This browser is active and registered to receive instant alerts when tracked products drop in price.
                {trackedProducts?.length > 0 && (
                  <span className="block mt-1 font-bold text-brand">
                    Currently tracking {trackedProducts.length} product{trackedProducts.length > 1 ? 's' : ''} on this device.
                  </span>
                )}
              </p>
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    setPushStatusMsg('');
                    try {
                      await sendTestNotification();
                      setTestSent(true);
                      setPushStatusMsg('Test alert sent! Check your notification tray.');
                    } catch (err) {
                      setTestSent(false);
                      setPushStatusMsg(err.message || 'Failed to send test alert.');
                    }
                  }}
                  disabled={pushLoading}
                  className="rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2 text-xs font-bold text-gray-700 hover:bg-gray-100 active:scale-98"
                >
                  🚀 Send Test Alert
                </button>
              </div>
              {pushStatusMsg && (
                <p className={`mt-2 text-xs font-semibold ${testSent ? 'text-emerald-600' : 'text-red-500'}`}>
                  {pushStatusMsg}
                </p>
              )}
            </div>
          ) : (
            <div>
              <p className="text-xs leading-5 text-gray-600">
                Turn on browser push alerts to be the first to know when products on your watchlist drop in price — no spam, only verified price drops.
              </p>
              <button
                type="button"
                onClick={async () => {
                  setPushStatusMsg('');
                  try {
                    await subscribeToPush();
                    setPushStatusMsg('Push alerts enabled successfully!');
                  } catch (err) {
                    setPushStatusMsg(err.message || 'Could not enable push alerts.');
                  }
                }}
                disabled={pushLoading}
                className="mt-3 rounded-xl bg-brand px-4 py-2.5 text-xs font-extrabold text-white shadow-sm hover:opacity-95 active:scale-98 disabled:opacity-60"
              >
                {pushLoading ? 'Enabling…' : '🔔 Enable Instant Browser Alerts'}
              </button>
              {pushStatusMsg && (
                <p className="mt-2 text-xs font-semibold text-brand">
                  {pushStatusMsg}
                </p>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Affiliate disclosure — folded in from the native app's AffiliateDisclosureModal */}
      <section className="mt-6 rounded-2xl border border-[#efefef] bg-white p-6">
        <h2 className="mb-3 flex items-center gap-2 text-base font-extrabold text-[#1a1a1a]">
          <span aria-hidden>🛡️</span> Affiliate Disclosure & Transparency
        </h2>
        <p className="mb-3 text-sm leading-6 text-[#4b5563]">
          ShoppersDeals is a participant in the Amazon Services LLC Associates Program and the Flipkart Affiliate Program — advertising programs designed to let sites and apps earn advertising fees by linking to Amazon.in, Flipkart.com, and affiliate partners.
        </p>
        <ul className="mb-3 list-disc space-y-2 pl-5 text-sm leading-6 text-[#4b5563]">
          <li><strong className="text-[#1a1a1a]">Zero additional cost:</strong> the price you pay is exactly the same as going directly to the retailer.</li>
          <li><strong className="text-[#1a1a1a]">Unbiased selection:</strong> deals are chosen for genuine price drops and verified sellers, not affiliate rates.</li>
          <li><strong className="text-[#1a1a1a]">Secure checkout:</strong> all transactions happen directly on Amazon, Flipkart, or Myntra — we never collect payment details.</li>
        </ul>
        <p className="text-sm leading-6 text-[#4b5563]">
          Support through our links helps keep ShoppersDeals 100% free. Questions? <a href="mailto:support@shoppersdeals.in" className="font-semibold text-brand">support@shoppersdeals.in</a>
        </p>
      </section>
    </div>
  );
}
