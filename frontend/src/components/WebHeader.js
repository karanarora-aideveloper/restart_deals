import React, { useState } from 'react';
import { Text as RNText, TextInput, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { Image } from '@/components/ui/image';
import { Pressable } from '@/components/ui/pressable';
import { useAuth } from '../context/AuthContext';

const NAV_LINKS = [
  { id: 'deals', label: 'Home' },
  { id: 'hot', label: 'Deals' },
  { id: 'products', label: 'Track Prices' },
  { id: 'compare', label: 'Compare' },
  { id: 'categories', label: 'Categories' },
];

/**
 * Single, shared web header for both desktop web and mobile web (native app
 * keeps its own Header.js). Nav links + inline search collapse away on
 * narrow widths — mobile relies on BottomTabBar for primary navigation and
 * gets a full-width search row instead, icon-only Wishlist/Account actions.
 */
export default function WebHeader({
  activeTab,
  setActiveTab,
  savedCount = 0,
  compareCount = 0,
  searchQuery = '',
  setSearchQuery = () => {},
}) {
  const { user, isLoggedIn } = useAuth();
  const [searchFocused, setSearchFocused] = useState(false);
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;

  const renderSearchField = () => (
    <>
      {/* Myntra-style: the app's own mark inside the search pill instead of a plain
          magnifying-glass icon. */}
      <Image
        source={require('../../assets/icon.png')}
        className="w-5 h-5 rounded-md"
        resizeMode="contain"
        alt=""
      />
      <TextInput
        value={searchQuery}
        onChangeText={setSearchQuery}
        onFocus={() => setSearchFocused(true)}
        onBlur={() => setSearchFocused(false)}
        placeholder="Search for deals, brands, products..."
        placeholderTextColor="#9a9a9a"
        style={{
          flex: 1,
          marginLeft: 8,
          fontSize: 13,
          color: '#1a1a1a',
          outlineStyle: 'none',
        }}
      />
      {!!searchQuery && (
        <Pressable onPress={() => setSearchQuery('')}>
          <Ionicons name="close-circle" size={15} color="#c4c4c4" />
        </Pressable>
      )}
    </>
  );

  return (
    <Box className="w-full sticky top-0 z-50">
      {/* Announcement strip */}
      <Box className="w-full bg-neutral-950">
        <HStack
          className={`w-full items-center justify-center py-1.5 ${
            isDesktop ? 'max-w-[1440px] mx-auto px-8' : 'px-4'
          }`}
        >
          <RNText
            numberOfLines={1}
            style={{
              fontSize: 11,
              fontWeight: '700',
              color: '#ffffff',
              letterSpacing: 0.4,
              textAlign: 'center',
            }}
          >
            {isDesktop
              ? '⚡ LIVE DEALS · Amazon · Flipkart · Myntra — refreshed every few seconds'
              : '⚡ LIVE DEALS · Refreshed every few seconds'}
          </RNText>
        </HStack>
      </Box>

      {/* Main bar */}
      <Box className="w-full bg-background border-b border-border">
        <Box className={isDesktop ? 'max-w-[1440px] mx-auto w-full px-8 py-3' : 'w-full px-4 py-2.5'}>
          <HStack className="items-center gap-4">
            {/* Logo */}
            <Pressable
              onPress={() => setActiveTab('deals')}
              className="flex-row items-center shrink-0"
            >
              <Image
                source={require('../../assets/icon.png')}
                className={isDesktop ? 'w-8 h-8 rounded-lg mr-2' : 'w-7 h-7 rounded-md mr-1.5'}
                resizeMode="contain"
                alt="ShoppersDeals Logo"
              />
              <Text className={`font-black text-foreground tracking-tight ${isDesktop ? 'text-[20px]' : 'text-[17px]'}`}>
                Shoppers<Text className="text-primary font-black">Deals</Text>
              </Text>
            </Pressable>

            {/* Nav links — desktop only; mobile relies on the bottom tab bar */}
            {isDesktop && (
              <HStack className="items-center gap-0.5 shrink-0">
                {NAV_LINKS.map((link) => {
                  const isActive =
                    activeTab === link.id ||
                    (link.id === 'deals' && (activeTab === 'dealDetail' || activeTab === 'blogPost'));
                  return (
                    <Pressable
                      key={link.id}
                      onPress={() => setActiveTab(link.id)}
                      className="px-3 py-2 rounded-lg hover:bg-secondary flex-row items-center gap-1.5"
                    >
                      <Text
                        className={`text-[12.5px] uppercase tracking-[0.4px] ${
                          isActive ? 'text-foreground font-black' : 'text-muted-foreground font-bold'
                        }`}
                      >
                        {link.label}
                      </Text>
                      {link.id === 'compare' && compareCount > 0 && (
                        <Box className="bg-primary rounded-full min-w-[16px] h-[16px] items-center justify-center px-1">
                          <Text className="text-white text-[9px] font-black">{compareCount}</Text>
                        </Box>
                      )}
                      <Box
                        className={`absolute left-3 right-3 -bottom-0 h-[2.5px] rounded-full ${
                          isActive ? 'bg-primary' : 'bg-transparent'
                        }`}
                      />
                    </Pressable>
                  );
                })}
              </HStack>
            )}

            {/* Inline search — desktop only; mobile gets a full-width row below */}
            {isDesktop ? (
              <HStack
                className={`flex-1 items-center bg-secondary rounded-full px-4 h-10 border max-w-[460px] ${
                  searchFocused ? 'border-primary' : 'border-border'
                }`}
              >
                {renderSearchField()}
              </HStack>
            ) : (
              <Box className="flex-1" />
            )}

            {/* Right actions */}
            <HStack className="items-center gap-1 shrink-0">
              <Pressable
                onPress={() => setActiveTab(user ? 'saved' : 'profile')}
                className={
                  isDesktop
                    ? 'flex-row items-center gap-1.5 px-3 py-2 rounded-full hover:bg-secondary'
                    : 'w-9 h-9 items-center justify-center rounded-full'
                }
              >
                <Box className="relative">
                  <Ionicons
                    name={activeTab === 'saved' ? 'heart' : 'heart-outline'}
                    size={isDesktop ? 19 : 21}
                    color={activeTab === 'saved' ? '#ff6b00' : '#4a4a4a'}
                  />
                  {savedCount > 0 && (
                    <Box className="absolute -top-1.5 -right-2 bg-primary rounded-full min-w-[15px] h-[15px] items-center justify-center px-0.5">
                      <Text className="text-white text-[9px] font-black">
                        {savedCount > 99 ? '99+' : savedCount}
                      </Text>
                    </Box>
                  )}
                </Box>
                {isDesktop && <Text className="text-[12px] font-bold text-foreground">Wishlist</Text>}
              </Pressable>

              <Pressable
                onPress={() => setActiveTab('profile')}
                className={
                  isDesktop
                    ? 'flex-row items-center gap-2 pl-2 pr-3.5 py-1.5 rounded-full border border-border hover:border-primary'
                    : 'w-9 h-9 items-center justify-center rounded-full'
                }
              >
                {isLoggedIn && user?.picture ? (
                  <Image
                    source={{ uri: user.picture }}
                    className={isDesktop ? 'w-6 h-6 rounded-full' : 'w-7 h-7 rounded-full'}
                    alt="Profile avatar"
                  />
                ) : (
                  <Box className={`items-center justify-center rounded-full bg-secondary ${isDesktop ? 'w-6 h-6' : 'w-7 h-7'}`}>
                    <Ionicons name="person" size={isDesktop ? 13 : 15} color="#7a7a7a" />
                  </Box>
                )}
                {isDesktop && (
                  <Text className="text-[12px] font-bold text-foreground">
                    {isLoggedIn ? user?.name?.split(' ')[0] || 'Account' : 'Sign In'}
                  </Text>
                )}
              </Pressable>
            </HStack>
          </HStack>

          {/* Full-width search row — mobile only */}
          {!isDesktop && (
            <HStack
              className={`items-center bg-secondary rounded-full px-4 h-10 border mt-2.5 ${
                searchFocused ? 'border-primary' : 'border-border'
              }`}
            >
              {renderSearchField()}
            </HStack>
          )}
        </Box>
      </Box>
    </Box>
  );
}
