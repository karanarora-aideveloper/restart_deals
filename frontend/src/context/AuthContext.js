import React, { createContext, useState, useEffect, useContext } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { API_BASE_URL } from '../config';
import { auth, googleProvider, signInWithPopup, firebaseSignOut } from '../firebaseConfig';

const AUTH_STORAGE_KEY = '@shoppers_deals_auth_v1';

const defaultAuthContext = {
  user: null,
  token: null,
  isLoading: false,
  isLoggedIn: false,
  loginWithGooglePayload: async () => {},
  loginWithFirebaseGoogle: async () => {},
  sendPhoneOtp: async () => {},
  verifyPhoneOtp: async () => {},
  logout: async () => {},
};

const AuthContext = createContext(defaultAuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load saved session on app launch
  useEffect(() => {
    (async () => {
      try {
        let savedData = null;
        if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
          const str = window.localStorage.getItem(AUTH_STORAGE_KEY);
          savedData = str ? JSON.parse(str) : null;
        } else if (AsyncStorage && typeof AsyncStorage.getItem === 'function') {
          const str = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
          savedData = str ? JSON.parse(str) : null;
        }

        if (savedData && savedData.token && savedData.user) {
          setToken(savedData.token);
          setUser(savedData.user);
        }

        if (Platform.OS !== 'web') {
          GoogleSignin.configure({
            webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '',
            iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '',
          });
        }
      } catch (err) {
        console.error('Failed to load auth state:', err);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const saveAuthSession = async (userObj, tokenStr) => {
    try {
      const data = { user: userObj, token: tokenStr };
      setUser(userObj);
      setToken(tokenStr);

      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(data));
      } else if (AsyncStorage && typeof AsyncStorage.setItem === 'function') {
        await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(data));
      }
    } catch (err) {
      console.error('Failed to persist auth session:', err);
    }
  };

  const loginWithGooglePayload = async (googlePayload) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(googlePayload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Google Login failed');
      }

      await saveAuthSession(json.user, json.token);

      return json;
    } catch (err) {
      console.error('loginWithGooglePayload error:', err.message);
      throw err;
    }
  };

  const loginWithFirebaseGoogle = async () => {
    try {
      if (Platform.OS === 'web') {
        const result = await signInWithPopup(auth, googleProvider);
        const fbUser = result.user;
        const idToken = await fbUser.getIdToken();

        const payload = {
          googleId: fbUser.uid,
          email: fbUser.email,
          name: fbUser.displayName || fbUser.email.split('@')[0],
          picture: fbUser.photoURL || '',
          firebaseIdToken: idToken,
          deviceType: Platform.OS,
        };

        return await loginWithGooglePayload(payload);
      } else {
        await GoogleSignin.hasPlayServices();
        const userInfo = await GoogleSignin.signIn();
        const idToken = userInfo.data?.idToken || userInfo.idToken;

        if (!idToken) {
          throw new Error('Failed to retrieve ID token from Google.');
        }

        const credential = GoogleAuthProvider.credential(idToken);
        const fbUserCredential = await signInWithCredential(auth, credential);
        const fbUser = fbUserCredential.user;
        const firebaseIdToken = await fbUser.getIdToken();

        const payload = {
          googleId: fbUser.uid,
          email: fbUser.email,
          name: fbUser.displayName || fbUser.email.split('@')[0],
          picture: fbUser.photoURL || '',
          firebaseIdToken: firebaseIdToken,
          deviceType: Platform.OS,
        };
        return await loginWithGooglePayload(payload);
      }
    } catch (err) {
      console.error('Firebase Google Sign-In error:', err);
      throw err;
    }
  };

  // Initiate Phone OTP Login
  const sendPhoneOtp = async (phoneNumber) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/phone/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to send OTP');
      }
      return json;
    } catch (err) {
      console.error('sendPhoneOtp error:', err.message);
      throw err;
    }
  };

  // Verify Phone OTP (static 12345)
  const verifyPhoneOtp = async (phoneNumber, otp) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/phone/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber, otp, deviceType: Platform.OS }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Invalid OTP. Enter 12345');
      }

      await saveAuthSession(json.user, json.token);

      return json;
    } catch (err) {
      console.error('verifyPhoneOtp error:', err.message);
      throw err;
    }
  };

  const logout = async () => {
    try {
      if (auth && typeof firebaseSignOut === 'function') {
        await firebaseSignOut(auth).catch(() => {});
      }
      if (Platform.OS !== 'web') {
        await GoogleSignin.signOut().catch(() => {});
      }
      setUser(null);
      setToken(null);

      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(AUTH_STORAGE_KEY);
      } else if (AsyncStorage && typeof AsyncStorage.removeItem === 'function') {
        await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
      }
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const deleteAccount = async () => {
    try {
      if (!token) return;
      
      const res = await fetch(`${API_BASE_URL}/api/auth/delete`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to delete account');
      }
      
      // If Firebase Auth is active, try to delete from Firebase client side as well
      if (auth && auth.currentUser) {
        if (typeof auth.currentUser.delete === 'function') {
          await auth.currentUser.delete().catch(e => console.log('Firebase delete warning:', e));
        }
      }
      
      await logout();
      return json;
    } catch (err) {
      console.error('Delete account error:', err.message);
      throw err;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        loginWithGooglePayload,
        loginWithFirebaseGoogle,
        sendPhoneOtp,
        verifyPhoneOtp,
        logout,
        deleteAccount,
        isLoggedIn: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    return defaultAuthContext;
  }
  return context;
}
