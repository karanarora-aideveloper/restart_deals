import React from 'react';
import { View, Text, StyleSheet, Image, ScrollView, TouchableOpacity, useWindowDimensions, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import blogsData from '../data/blogs.json';
import WebFooter from './WebFooter';

export default function BlogPostView({ slug, onBack, setActiveTab }) {
  const { width } = useWindowDimensions();
  const isDesktopWeb = width > 768;

  const blog = blogsData.find((b) => b.slug === slug);

  if (!blog) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.notFoundText}>Article not found.</Text>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const renderContentBlock = (block, index) => {
    if (block.type === 'h2') {
      return <Text key={index} style={styles.contentH2} accessibilityRole="heading" aria-level={2}>{block.text}</Text>;
    }
    if (block.type === 'h3') {
      return <Text key={index} style={styles.contentH3} accessibilityRole="heading" aria-level={3}>{block.text}</Text>;
    }
    return <Text key={index} style={styles.contentP}>{block.text}</Text>;
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      
      {/* Desktop Specific Back Button */}
      {isDesktopWeb && (
        <TouchableOpacity style={styles.desktopBackWrapper} onPress={onBack}>
          <Ionicons name="arrow-back" size={24} color="#64748b" />
          <Text style={styles.desktopBackText}>Back to Guides</Text>
        </TouchableOpacity>
      )}

      {/* Main Content Card */}
      <View style={[styles.articleCard, isDesktopWeb && styles.articleCardDesktop]}>
        
        {/* Mobile Specific Back Button */}
        {!isDesktopWeb && (
          <TouchableOpacity style={styles.mobileBackBtn} onPress={onBack}>
            <Ionicons name="arrow-back" size={24} color="#0f172a" />
          </TouchableOpacity>
        )}

        <Image source={{ uri: blog.imageUrl }} style={styles.heroImage} resizeMode="cover" alt={blog.title} />
        
        <View style={styles.articleBody}>
          <Text style={styles.metaData}>{new Date(blog.date).toLocaleDateString()} · {blog.readTime}</Text>
          <Text style={styles.title} accessibilityRole="heading" aria-level={1}>{blog.title}</Text>
          
          <View style={styles.divider} />

          <View style={styles.contentWrapper}>
            {blog.content.map(renderContentBlock)}
          </View>
        </View>
      </View>
      
      <WebFooter setActiveTab={setActiveTab} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f4f4f4',
  },
  scrollContent: {
    paddingBottom: 100,
    alignItems: 'center',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f4f4f4',
  },
  notFoundText: {
    fontSize: 18,
    color: '#64748b',
    marginBottom: 20,
  },
  backBtn: {
    backgroundColor: '#ff6b00',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backBtnText: {
    color: '#fff',
    fontWeight: '600',
  },
  desktopBackWrapper: {
    width: '100%',
    maxWidth: 800,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  desktopBackText: {
    marginLeft: 8,
    fontSize: 16,
    color: '#64748b',
    fontWeight: '600',
  },
  articleCard: {
    backgroundColor: '#ffffff',
    width: '100%',
    overflow: 'hidden',
  },
  articleCardDesktop: {
    maxWidth: 800,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  mobileBackBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 20,
    left: 16,
    zIndex: 10,
    backgroundColor: 'rgba(255,255,255,0.8)',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroImage: {
    width: '100%',
    height: 300,
    backgroundColor: '#e2e8f0',
  },
  articleBody: {
    padding: 24,
    paddingBottom: 40,
  },
  metaData: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ff6b00',
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#0f172a',
    lineHeight: 40,
    marginBottom: 24,
  },
  divider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginBottom: 24,
  },
  contentWrapper: {
    gap: 16,
  },
  contentH2: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1e293b',
    marginTop: 16,
    marginBottom: 8,
  },
  contentH3: {
    fontSize: 20,
    fontWeight: '600',
    color: '#334155',
    marginTop: 12,
    marginBottom: 4,
  },
  contentP: {
    fontSize: 18,
    color: '#475569',
    lineHeight: 28,
  },
});
