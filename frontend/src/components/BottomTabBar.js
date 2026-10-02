import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function BottomTabBar({ activeTab, setActiveTab, savedCount = 0 }) {
  const insets = useSafeAreaInsets();
  const bottomPadding = insets.bottom;

  const tabs = [
    {
      id: 'deals',
      label: 'Home',
      iconActive: 'home',
      iconInactive: 'home-outline',
      badge: null,
      color: '#FF6B00',
    },
    {
      id: 'categories',
      label: 'Browse',
      iconActive: 'grid',
      iconInactive: 'grid-outline',
      badge: null,
      color: '#FF6B00',
    },
    {
      id: 'hot',
      label: 'Deals',
      iconActive: 'pricetags',
      iconInactive: 'pricetags-outline',
      badge: null,
      color: '#FF6B00',
    },
    // 'products'/Track tab hidden for now (see App.js) — ProductCard/fetchData still work,
    // just no bottom-bar entry point into them.
    {
      id: 'profile',
      label: 'Account',
      iconActive: 'person-circle',
      iconInactive: 'person-circle-outline',
      badge: null,
      color: '#FF6B00',
    },
  ];

  return (
    <View style={[styles.container, { paddingBottom: bottomPadding }]}>
      <View style={styles.tabBar}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const activeColor = tab.color;

          return (
            <TouchableOpacity
              key={tab.id}
              style={styles.tabItem}
              activeOpacity={0.7}
              onPress={() => {
                if (activeTab !== tab.id) {
                  Haptics.selectionAsync();
                }
                setActiveTab(tab.id);
              }}
            >
              <View style={styles.iconContainer}>
                <Ionicons
                  name={isActive ? tab.iconActive : tab.iconInactive}
                  size={22}
                  color={isActive ? activeColor : '#b0b0b0'}
                />
                {tab.badge !== null && (
                  <View style={[styles.badge, { backgroundColor: isActive ? activeColor : '#e0e0e0' }]}>
                    <Text style={styles.badgeText}>{tab.badge}</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.tabLabel, { color: isActive ? activeColor : '#b0b0b0', fontWeight: isActive ? '800' : '500' }]}>
                {tab.label}
              </Text>
              {isActive && <View style={[styles.activeBar, { backgroundColor: activeColor }]} />}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderColor: '#eeeeee',
    ...(Platform.OS === 'android' ? { elevation: 8 } : {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
    }),
  },
  tabBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-start',
    paddingTop: 10,
    paddingBottom: 4,
    paddingHorizontal: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingVertical: 4,
    position: 'relative',
  },
  iconContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 3,
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -10,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 8,
    minWidth: 16,
    alignItems: 'center',
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 8,
    fontWeight: '800',
  },
  tabLabel: {
    fontSize: 10,
    letterSpacing: 0.1,
  },
  activeBar: {
    position: 'absolute',
    top: -10,
    left: '25%',
    right: '25%',
    height: 2,
    borderRadius: 2,
  },
});
