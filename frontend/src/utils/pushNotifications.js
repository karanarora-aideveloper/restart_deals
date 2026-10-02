import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import {
  getMessaging,
  getToken,
  registerDeviceForRemoteMessages,
  isDeviceRegisteredForRemoteMessages,
} from '@react-native-firebase/messaging';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config';

const DEVICE_ID_KEY = '@shoppers_deals_device_id_v1';

// Foreground notifications still show a banner/alert — otherwise they'd arrive silently while
// the app is open, which defeats the point of a live-deal alert.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Logins are hidden on native for now (see AuthContext), so a push token isn't tied to a user
// account — it's tied to this installed app instance instead, identified by a locally-generated
// id that survives app restarts (but not reinstalls/uninstalls, same as the token itself).
async function getOrCreateDeviceId() {
  let id = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = `${Platform.OS}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    await AsyncStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

/**
 * Requests notification permission (if not already granted), sets up the Android notification
 * channel, retrieves this device's native FCM push token, and registers it with our backend so
 * the admin's "Send Notification" tool can reach it. Safe to call on every app launch — the
 * backend upserts by token, so re-registering the same token is a cheap no-op.
 */
export async function registerForPushNotifications() {
  try {
    if (!Device.isDevice) {
      // Most simulators/emulators can't get a real push token, but an Android emulator image
      // with Google Play Services (e.g. a "Google APIs" or "Google Play" AVD) genuinely can —
      // so attempt it here too rather than hard-skipping, and just let getDevicePushTokenAsync()
      // below fail (caught by the try/catch) on emulator images that don't have GMS.
      console.log("[Push] Running on a simulator/emulator — attempting anyway (works if it has Google Play Services).");
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Deals & Updates',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF6B00',
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.log('[Push] Permission not granted — skipping registration.');
      return null;
    }

    let token;
    if (Platform.OS === 'ios') {
      // expo-notifications only wraps raw APNs registration on iOS (no bundled Firebase
      // Messaging there), so it can't hand us an FCM token — our backend's Firebase Admin SDK
      // needs an actual FCM registration token, not a raw APNs device token. @react-native-firebase
      // /messaging does the APNs→FCM exchange for us: getToken() throws `messaging/unregistered`
      // unless the device has explicitly registered for remote messages first — the SDK's own
      // "auto-registration" warning turned out not to hold in practice for this app, so register
      // explicitly. (v22+ uses the modular API — free functions taking a messaging instance — not
      // the old `messaging()` default export.)
      const messagingInstance = getMessaging();
      if (!(await isDeviceRegisteredForRemoteMessages(messagingInstance))) {
        await registerDeviceForRemoteMessages(messagingInstance);
      }
      token = await getToken(messagingInstance);
    } else {
      // Android: raw native FCM token — sent straight to Firebase Admin SDK on our own backend,
      // no dependency on Expo's push relay service.
      const tokenResponse = await Notifications.getDevicePushTokenAsync();
      token = tokenResponse?.data;
    }
    if (!token) return null;

    const deviceId = await getOrCreateDeviceId();

    await fetch(`${API_BASE_URL}/api/notifications/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, platform: Platform.OS, deviceId }),
    }).catch((err) => console.warn('[Push] Failed to register token with backend:', err.message));

    console.log(`[Push] Registered ${Platform.OS} push token.`);
    return token;
  } catch (err) {
    console.warn('[Push] registerForPushNotifications failed:', err.message);
    return null;
  }
}
