import { Platform } from 'react-native';
import * as Device from 'expo-device';

export const getApiBaseUrl = () => {
  // If EXPO_PUBLIC_API_URL environment variable is provided
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL.replace(/\/$/, '');
  }

  // Auto-route to local dev server in development
  if (__DEV__) {
    if (Platform.OS === 'android') {
      return Device.isDevice ? 'http://192.168.31.46:3001' : 'http://10.0.2.2:3001';
    }
    return 'http://localhost:3001'; // Web / iOS simulator
  }

  return 'https://api.shoppersdeals.in';
};

export const API_BASE_URL = getApiBaseUrl();
