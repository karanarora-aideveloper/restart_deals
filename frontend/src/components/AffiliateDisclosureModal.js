import React from 'react';
import { 
  Modal, 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  TouchableWithoutFeedback 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function AffiliateDisclosureModal({ visible, onClose }) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.modalContent}>
              {/* Header */}
              <View style={styles.modalHeader}>
                <View style={styles.headerTitleRow}>
                  <Ionicons name="shield-checkmark-outline" size={22} color="#10b981" />
                  <Text style={styles.modalTitle}>Affiliate Disclosure & Transparency</Text>
                </View>
                <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                  <Ionicons name="close" size={20} color="#94a3b8" />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.scrollBody} showsVerticalScrollIndicator={false}>
                <View style={styles.badgeBox}>
                  <Ionicons name="checkmark-circle-outline" size={20} color="#10b981" />
                  <Text style={styles.badgeText}>100% Transparent • Zero Cost to You</Text>
                </View>

                <Text style={styles.paragraph}>
                  ShoppersDeals is a participant in the <Text style={styles.highlight}>Amazon Services LLC Associates Program</Text> and the <Text style={styles.highlight}>Flipkart Affiliate Program</Text>, affiliate advertising programs designed to provide a means for sites and apps to earn advertising fees by advertising and linking to Amazon.in, Flipkart.com, and affiliate partners.
                </Text>

                <Text style={styles.subHeader}>What does this mean for you?</Text>
                
                <View style={styles.bulletList}>
                  <View style={styles.bulletItem}>
                    <Ionicons name="pricetag-outline" size={16} color="#3b82f6" style={{ marginTop: 2 }} />
                    <Text style={styles.bulletText}>
                      <Text style={{ fontWeight: '700', color: '#ffffff' }}>Zero Additional Cost: </Text>
                      When you click on a deal link in ShoppersDeals and purchase an item, the price you pay on Amazon or Flipkart is exactly the same as going directly to their site.
                    </Text>
                  </View>

                  <View style={styles.bulletItem}>
                    <Ionicons name="heart-outline" size={16} color="#ec4899" style={{ marginTop: 2 }} />
                    <Text style={styles.bulletText}>
                      <Text style={{ fontWeight: '700', color: '#ffffff' }}>Unbiased Deal Selection: </Text>
                      Deals featured on our app are selected purely based on genuine price drops, high discount percentages, and seller verification, regardless of affiliate rates.
                    </Text>
                  </View>

                  <View style={styles.bulletItem}>
                    <Ionicons name="lock-closed-outline" size={16} color="#f59e0b" style={{ marginTop: 2 }} />
                    <Text style={styles.bulletText}>
                      <Text style={{ fontWeight: '700', color: '#ffffff' }}>Secure Checkout: </Text>
                      You complete all transactions directly on official e-commerce platforms (Amazon, Flipkart, Myntra). ShoppersDeals never collects your payment details or passwords.
                    </Text>
                  </View>
                </View>

                <Text style={styles.paragraph}>
                  We appreciate your support when purchasing through our links, as it enables us to keep the app 100% free for everyone.
                </Text>
              </ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#131824',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollBody: {
    marginTop: 16,
  },
  badgeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginBottom: 16,
    gap: 8,
  },
  badgeText: {
    color: '#10b981',
    fontSize: 12,
    fontWeight: '700',
  },
  paragraph: {
    color: '#94a3b8',
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 16,
  },
  highlight: {
    color: '#ffffff',
    fontWeight: '700',
  },
  subHeader: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 12,
  },
  bulletList: {
    gap: 12,
    marginBottom: 16,
  },
  bulletItem: {
    flexDirection: 'row',
    backgroundColor: '#1a2030',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    gap: 10,
  },
  bulletText: {
    color: '#94a3b8',
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },
});
