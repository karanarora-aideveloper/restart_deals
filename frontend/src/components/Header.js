import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';

/**
 * Native app header — mirrors WebHeader's mobile layout (black announcement
 * strip, logo, icon-only Wishlist + Account actions) so the brand feels the
 * same whether you're in the app or on mobile web. Search stays in FilterBar
 * below, unlike web where it lives in the header.
 */
export default function Header({ activeTab, setActiveTab, savedCount = 0 }) {
  const { user, isLoggedIn } = useAuth();

  return (
    <View style={styles.container}>
      {/* Main row */}
      <View style={styles.mainRow}>
        <TouchableOpacity
          style={styles.brand}
          activeOpacity={0.8}
          onPress={() => setActiveTab && setActiveTab('deals')}
        >
          <Image source={require('../../assets/icon.png')} style={styles.logo} resizeMode="contain" />
          <Text style={styles.brandTitle}>
            Shoppers<Text style={styles.brandTitleAccent}>Deals</Text>
          </Text>
        </TouchableOpacity>

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.actionBtn}
            activeOpacity={0.7}
            onPress={() => {}}
          >
            <Ionicons name="notifications-outline" size={21} color="#4a4a4a" />
            <View style={styles.badge}>
              <Text style={styles.badgeText}>1</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtn}
            activeOpacity={0.7}
            onPress={() => setActiveTab && setActiveTab(isLoggedIn ? 'saved' : 'profile')}
          >
            <Ionicons
              name={activeTab === 'saved' ? 'heart' : 'heart-outline'}
              size={21}
              color={activeTab === 'saved' ? '#ff6b00' : '#4a4a4a'}
            />
            {savedCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{savedCount > 99 ? '99+' : savedCount}</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtn}
            activeOpacity={0.7}
            onPress={() => setActiveTab && setActiveTab('profile')}
          >
            {isLoggedIn && user?.picture ? (
              <Image source={{ uri: user.picture }} style={styles.avatarImg} />
            ) : (
              <Ionicons
                name={activeTab === 'profile' ? 'person-circle' : 'person-circle-outline'}
                size={23}
                color={activeTab === 'profile' ? '#ff6b00' : '#4a4a4a'}
              />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#eeeeee',
    ...(Platform.OS === 'android' ? { elevation: 2 } : {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 4,
    }),
  },
  mainRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
  },
  logo: {
    width: 28,
    height: 28,
    borderRadius: 6,
    marginRight: 6,
  },
  brandTitle: {
    color: '#1a1a1a',
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  brandTitleAccent: {
    color: '#FF6B00',
    fontWeight: '900',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  avatarImg: {
    width: 26,
    height: 26,
    borderRadius: 13,
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 1,
    right: 1,
    backgroundColor: '#FF6B00',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '800',
  },
});
