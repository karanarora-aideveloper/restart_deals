import { Platform } from 'react-native';

/**
 * Safely logs an event to Google Analytics on the Web.
 * Does nothing on native mobile since window.gtag is undefined.
 */
export const logEvent = (eventName, params = {}) => {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', eventName, params);
  }
};
