'use client';

import { useState, useEffect, useCallback } from 'react';
import { API_BASE_URL } from '@/lib/config';
import { useAuth } from '@/components/AuthProvider';

const DEVICE_ID_KEY = '@sd_push_device_id_v1';
const TRACKED_PRODUCTS_KEY = '@sd_tracked_products_v1';

/**
 * Converts a base64 string to a Uint8Array for PushManager subscribe applicationServerKey.
 */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Retrieves or initializes a unique device identifier stored in localStorage.
 */
export function getOrCreateDeviceId() {
  if (typeof window === 'undefined') return '';
  let id = window.localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = 'dev_' + Math.random().toString(36).substring(2, 12) + '_' + Date.now().toString(36);
    window.localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

export function usePushNotification() {
  const { user, token } = useAuth();
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState('default');
  const [subscription, setSubscription] = useState(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [trackedProducts, setTrackedProducts] = useState([]);
  const [error, setError] = useState(null);

  // Check support and load existing subscription state on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const supported =
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window;
    setIsSupported(supported);

    if (supported) {
      setPermission(Notification.permission);

      // Read locally stored tracked product IDs
      try {
        const saved = window.localStorage.getItem(TRACKED_PRODUCTS_KEY);
        if (saved) setTrackedProducts(JSON.parse(saved));
      } catch (e) {}

      // Check if already subscribed in service worker registration
      navigator.serviceWorker.ready
        .then((reg) => reg.pushManager.getSubscription())
        .then((sub) => {
          if (sub) {
            setSubscription(sub);
            setIsSubscribed(true);
          }
        })
        .catch(() => {});
    }
  }, []);

  // When user logs in with an active browser subscription, sync user to the push token
  useEffect(() => {
    if (isSubscribed && subscription && user && token) {
      fetch(`${API_BASE_URL}/api/push/subscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          subscription: subscription.toJSON ? subscription.toJSON() : subscription,
          deviceId: getOrCreateDeviceId(),
          platform: 'web',
        }),
      }).catch(() => {});
    }
  }, [isSubscribed, subscription, user, token]);

  /**
   * Request browser push permission and subscribe to PushManager
   */
  const subscribeToPush = useCallback(async (productId = null) => {
    if (!isSupported) {
      throw new Error('Browser push notifications are not supported on this device/browser.');
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Request permission
      const perm = await Notification.requestPermission();
      setPermission(perm);

      if (perm !== 'granted') {
        throw new Error('Notification permission was ' + perm);
      }

      // 2. Register service worker if needed
      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;

      // 3. Fetch public VAPID key from backend
      const vapidRes = await fetch(`${API_BASE_URL}/api/push/vapid-public-key`);
      const vapidData = await vapidRes.json();
      if (!vapidData.success || !vapidData.publicKey) {
        throw new Error('Failed to retrieve notification encryption key');
      }

      const convertedKey = urlBase64ToUint8Array(vapidData.publicKey);

      // 4. Subscribe with PushManager
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedKey,
        });
      }

      setSubscription(sub);
      setIsSubscribed(true);

      // 5. Send subscription to backend
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const deviceId = getOrCreateDeviceId();
      const res = await fetch(`${API_BASE_URL}/api/push/subscribe`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          subscription: sub.toJSON ? sub.toJSON() : sub,
          deviceId,
          platform: 'web',
          productId: productId || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to register subscription with server');
      }

      // Save locally tracked product if provided
      if (productId) {
        setTrackedProducts((prev) => {
          const updated = Array.from(new Set([...prev, productId]));
          window.localStorage.setItem(TRACKED_PRODUCTS_KEY, JSON.stringify(updated));
          return updated;
        });
      }

      return { success: true, subscription: sub };
    } catch (err) {
      console.error('[usePushNotification] Error subscribing:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [isSupported, token]);

  /**
   * Track a product with 1-click browser push
   */
  const trackProduct = useCallback(async (productId) => {
    if (!productId) return false;

    // If not subscribed yet, ask and subscribe
    if (!isSubscribed || !subscription) {
      const res = await subscribeToPush(productId);
      return res?.success || false;
    }

    setLoading(true);
    setError(null);

    try {
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE_URL}/api/push/track-product`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          productId,
          endpoint: subscription.endpoint,
          deviceId: getOrCreateDeviceId(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to track product');
      }

      setTrackedProducts((prev) => {
        const updated = Array.from(new Set([...prev, productId]));
        window.localStorage.setItem(TRACKED_PRODUCTS_KEY, JSON.stringify(updated));
        return updated;
      });

      return true;
    } catch (err) {
      console.error('[usePushNotification] Error tracking product:', err);
      setError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  }, [isSubscribed, subscription, subscribeToPush, token]);

  /**
   * Check if a specific product is currently tracked
   */
  const isProductTracked = useCallback((productId) => {
    return trackedProducts.includes(productId);
  }, [trackedProducts]);

  /**
   * Sends a quick test push notification to verify delivery
   */
  const sendTestNotification = useCallback(async () => {
    if (!isSubscribed && !subscription) {
      throw new Error('Not subscribed to push notifications yet');
    }

    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE_URL}/api/push/send-test`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        endpoint: subscription?.endpoint,
        deviceId: getOrCreateDeviceId(),
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Test notification failed');
    }

    return true;
  }, [isSubscribed, subscription, token]);

  return {
    isSupported,
    permission,
    isSubscribed,
    subscription,
    loading,
    error,
    trackedProducts,
    isProductTracked,
    subscribeToPush,
    trackProduct,
    sendTestNotification,
  };
}
