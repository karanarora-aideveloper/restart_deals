'use client';

import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import { API_BASE_URL } from '@/lib/config';
import { auth, googleProvider, signInWithPopup, firebaseSignOut } from '@/lib/firebase';
import { identifyUser, resetUser } from '@/lib/analytics';

const AUTH_STORAGE_KEY = '@shoppers_deals_auth_v1';

const defaultAuthContext = {
  user: null,
  token: null,
  isLoading: false,
  isLoggedIn: false,
  loginWithFirebaseGoogle: async () => {},
  sendPhoneOtp: async () => {},
  verifyPhoneOtp: async () => {},
  logout: async () => {},
  deleteAccount: async () => {},
};

const AuthContext = createContext(defaultAuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const str = window.localStorage.getItem(AUTH_STORAGE_KEY);
      const saved = str ? JSON.parse(str) : null;
      if (saved?.token && saved?.user) {
        setToken(saved.token);
        setUser(saved.user);
        identifyUser(saved.user._id || saved.user.id || saved.user.email, {
          email: saved.user.email,
          name: saved.user.name,
          phone: saved.user.phone,
        });
      }
    } catch (err) {
      console.error('Failed to load auth state:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const saveAuthSession = useCallback((userObj, tokenStr) => {
    setUser(userObj);
    setToken(tokenStr);
    if (userObj) {
      identifyUser(userObj._id || userObj.id || userObj.email, {
        email: userObj.email,
        name: userObj.name,
        phone: userObj.phone,
      });
    }
    try {
      window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ user: userObj, token: tokenStr }));
    } catch (err) {
      console.error('Failed to persist auth session:', err);
    }
  }, []);

  const loginWithGooglePayload = useCallback(async (googlePayload) => {
    const res = await fetch(`${API_BASE_URL}/api/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(googlePayload),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.error || 'Google Login failed');
    }
    saveAuthSession(json.user, json.token);
    return json;
  }, [saveAuthSession]);

  const loginWithFirebaseGoogle = useCallback(async () => {
    const result = await signInWithPopup(auth, googleProvider);
    const fbUser = result.user;
    const idToken = await fbUser.getIdToken();

    const payload = {
      googleId: fbUser.uid,
      email: fbUser.email,
      name: fbUser.displayName || fbUser.email.split('@')[0],
      picture: fbUser.photoURL || '',
      firebaseIdToken: idToken,
      deviceType: 'web',
    };
    return loginWithGooglePayload(payload);
  }, [loginWithGooglePayload]);

  const sendPhoneOtp = useCallback(async (phoneNumber) => {
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
  }, []);

  const verifyPhoneOtp = useCallback(async (phoneNumber, otp) => {
    const res = await fetch(`${API_BASE_URL}/api/auth/phone/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber, otp, deviceType: 'web' }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.error || 'Invalid OTP. Enter 12345');
    }
    saveAuthSession(json.user, json.token);
    return json;
  }, [saveAuthSession]);

  const logout = useCallback(async () => {
    try {
      await firebaseSignOut(auth).catch(() => {});
    } finally {
      setUser(null);
      setToken(null);
      resetUser();
      try {
        window.localStorage.removeItem(AUTH_STORAGE_KEY);
      } catch {
        // ignore
      }
    }
  }, []);

  const deleteAccount = useCallback(async () => {
    if (!token) return;
    const res = await fetch(`${API_BASE_URL}/api/auth/delete`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.error || 'Failed to delete account');
    }
    if (auth?.currentUser?.delete) {
      await auth.currentUser.delete().catch(() => {});
    }
    await logout();
    return json;
  }, [token, logout]);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isLoggedIn: !!user,
        loginWithFirebaseGoogle,
        loginWithGooglePayload,
        sendPhoneOtp,
        verifyPhoneOtp,
        logout,
        deleteAccount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
