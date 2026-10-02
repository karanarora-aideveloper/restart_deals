import React from 'react';
import { View, Text, StyleSheet, Platform, TouchableOpacity } from 'react-native';
import SeoFooterContent from './SeoFooterContent';

export default function WebFooter({ setActiveTab }) {
  if (Platform.OS !== 'web') {
    return null;
  }

  const navigateTo = (tab, path) => {
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', path);
    }
    setActiveTab(tab);
  };

  return (
    <View style={styles.footerContainer}>
      <View style={[styles.footerContent, { marginBottom: 0, paddingBottom: 0 }]}>
        <SeoFooterContent />
      </View>

      <View style={styles.footerContent}>
        
        {/* Column 1: Brand & SEO Text */}
        <View style={styles.column}>
          <Text accessibilityRole="heading" aria-level={2} style={styles.brandTitle}>
            Shoppers<Text style={{ color: '#ff6b00' }}>Deals</Text>
          </Text>
          <Text style={styles.seoText}>
            ShoppersDeals is India's premier live deal tracking platform. We scan Amazon, Flipkart, and Myntra 24/7 to bring you the biggest discounts, lightning deals, and price drops on smartphones, laptops, and fashion before they expire.
          </Text>
        </View>

        {/* Column 2: Explore */}
        <View style={styles.column}>
          <Text style={styles.columnTitle}>Explore</Text>
          <TouchableOpacity onPress={() => navigateTo('deals', '/')}>
            <Text style={styles.link}>Home</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigateTo('hot', '/?tab=hot')}>
            <Text style={styles.link}>Deals</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigateTo('blog', '/blog')}>
            <Text style={styles.link}>Shopping Guides</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigateTo('categories', '/?tab=categories')}>
            <Text style={styles.link}>Browse Categories</Text>
          </TouchableOpacity>
        </View>

        {/* Column 3: Legal & Help */}
        <View style={styles.column}>
          <Text style={styles.columnTitle}>Legal</Text>
          <TouchableOpacity onPress={() => navigateTo('privacy', '/privacy')}>
            <Text style={styles.link}>Privacy Policy</Text>
          </TouchableOpacity>
          <TouchableOpacity>
            <Text style={styles.link}>Terms of Service</Text>
          </TouchableOpacity>
          <TouchableOpacity>
            <Text style={styles.link}>Contact Us</Text>
          </TouchableOpacity>
        </View>

      </View>
      
      <View style={styles.bottomBar}>
        <Text style={styles.copyrightText}>
          © {new Date().getFullYear()} ShoppersDeals. All rights reserved. 
          As an Amazon Associate we earn from qualifying purchases.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  footerContainer: {
    backgroundColor: '#0f172a',
    paddingTop: 60,
    width: '100%',
    alignItems: 'center',
  },
  footerContent: {
    width: '100%',
    maxWidth: 1200,
    paddingHorizontal: 24,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 40,
    gap: 40,
  },
  column: {
    flex: 1,
    minWidth: 250,
  },
  brandTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#ffffff',
    marginBottom: 16,
  },
  seoText: {
    color: '#94a3b8',
    fontSize: 14,
    lineHeight: 24,
    maxWidth: 400,
  },
  columnTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 20,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  link: {
    color: '#cbd5e1',
    fontSize: 15,
    marginBottom: 16,
  },
  bottomBar: {
    width: '100%',
    borderTopWidth: 1,
    borderColor: '#1e293b',
    paddingVertical: 24,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  copyrightText: {
    color: '#64748b',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 20,
  },
});
