import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, useWindowDimensions, Platform } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { FlashList } from '@shopify/flash-list';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import blogsData from '../data/blogs.json';
import WebFooter from './WebFooter';

export default function BlogListView({ onPressBlog, setActiveTab }) {
  const { width } = useWindowDimensions();
  const isDesktopWeb = width > 768;
  const numColumns = isDesktopWeb ? Math.max(2, Math.floor(width / 450)) : 1;

  const horizontalPadding = width > 1200 ? (width - 1200) / 2 : (isDesktopWeb ? 0 : 20);

  const renderItem = ({ item, index }) => {
    // Make the first item look slightly more emphasized on mobile
    const isFeatured = !isDesktopWeb && index === 0;

    return (
      <TouchableOpacity 
        style={[styles.card, isFeatured && styles.featuredCard]} 
        activeOpacity={0.8}
        onPress={() => onPressBlog(item.slug)}
      >
        <View style={styles.imageContainer}>
          <ExpoImage
            source={{ uri: item.imageUrl }}
            style={[styles.image, isFeatured && styles.featuredImage]}
            contentFit="cover"
            transition={200}
            cachePolicy="memory-disk"
            recyclingKey={item.slug}
            alt={item.title}
          />
          <View style={styles.badge}>
            <Text style={styles.badgeText}>GUIDE</Text>
          </View>
        </View>
        <View style={styles.content}>
          <Text style={styles.date}>{new Date(item.date).toLocaleDateString()}  •  {item.readTime}</Text>
          <Text style={[styles.title, isFeatured && styles.featuredTitle]} numberOfLines={2}>{item.title}</Text>
          <Text style={styles.excerpt} numberOfLines={3}>{item.excerpt}</Text>
          
          <View style={styles.readMoreContainer}>
            <Text style={styles.readMoreText}>Read Article</Text>
            <Ionicons name="arrow-forward" size={16} color="#ff6b00" />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderHeader = () => (
    <View style={{ marginHorizontal: -horizontalPadding, paddingBottom: 32, zIndex: 10 }}>
      <LinearGradient 
        colors={['#0f172a', '#1e293b']} 
        start={{ x: 0, y: 0 }} 
        end={{ x: 1, y: 1 }} 
        style={styles.heroHeader}
      >
        <View style={styles.heroContent}>
          <Text accessibilityRole="heading" aria-level={1} style={styles.headerTitle}>
            Expert <Text style={{ color: '#ff6b00' }}>Guides</Text>
          </Text>
          <Text style={styles.headerSubtitle}>
            Curated buying advice, deep-dive reviews, and strategies to help you secure the absolute best deals.
          </Text>
        </View>
      </LinearGradient>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.listWrapper}>
        <FlashList
          data={blogsData}
          key={isDesktopWeb ? `blog-grid-${numColumns}` : 'blog-list'}
          numColumns={numColumns}
          estimatedItemSize={350}
          renderItem={renderItem}
          contentContainerStyle={[
            styles.listPadding,
            { paddingHorizontal: horizontalPadding }
          ]}
          columnWrapperStyle={isDesktopWeb ? { gap: 24, paddingHorizontal: 24 } : undefined}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={renderHeader}
          ListFooterComponent={
            <View style={{ marginHorizontal: -horizontalPadding }}>
              <WebFooter setActiveTab={setActiveTab} />
            </View>
          }
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  heroHeader: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 40,
    paddingHorizontal: 24,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
    zIndex: 10,
  },
  heroContent: {
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
  },
  headerTitle: {
    fontSize: 36,
    fontWeight: '900',
    color: '#ffffff',
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#94a3b8',
    lineHeight: 24,
    maxWidth: 600,
  },
  listWrapper: {
    flex: 1,
    width: '100%',
    zIndex: 1,
  },
  listPadding: {
    paddingBottom: 100,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    marginBottom: 24,
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 4,
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.5)',
  },
  featuredCard: {
    marginBottom: 32,
  },
  imageContainer: {
    position: 'relative',
  },
  image: {
    width: '100%',
    height: 220,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: '#e2e8f0',
  },
  featuredImage: {
    height: 280,
  },
  badge: {
    position: 'absolute',
    top: 16,
    left: 16,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backdropFilter: 'blur(10px)',
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  content: {
    padding: 24,
  },
  date: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94a3b8',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 12,
    lineHeight: 30,
    letterSpacing: -0.3,
  },
  featuredTitle: {
    fontSize: 26,
    lineHeight: 34,
  },
  excerpt: {
    fontSize: 15,
    color: '#475569',
    lineHeight: 24,
    marginBottom: 20,
  },
  readMoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 'auto',
  },
  readMoreText: {
    color: '#ff6b00',
    fontWeight: '700',
    fontSize: 14,
    marginRight: 6,
  },
});
