import React, { useState } from 'react';
import { 
  Modal, 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  Linking,
  TouchableWithoutFeedback 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const FAQS = [
  {
    q: 'How does ShoppersDeals find and verify deals?',
    a: 'Our AI engine monitors official Telegram channels, Amazon price APIs, and Flipkart feeds in real-time. Every deal is automatically verified for active discount percentage and real price history before appearing in your feed.'
  },
  {
    q: 'Why did a deal price change when I opened Amazon or Flipkart?',
    a: 'Hot deals sell out quickly! Sellers or merchants can change prices or end flash sales within minutes. We recommend grabbing verified hot deals immediately.'
  },
  {
    q: 'Are there any extra costs for buying through ShoppersDeals?',
    a: 'No! Prices are identical or cheaper. You pay directly on Amazon, Flipkart, or Myntra using your existing account and prime benefits.'
  },
  {
    q: 'How do I save deals for later access?',
    a: 'Tap the bookmark icon on any deal card. You can view all your saved deals anytime in the "Saved" tab at the bottom navigation bar.'
  }
];

export default function HelpSupportModal({ visible, onClose }) {
  const [expandedFaq, setExpandedFaq] = useState(null);

  const toggleFaq = (index) => {
    setExpandedFaq(expandedFaq === index ? null : index);
  };

  const handleOpenEmail = () => {
    Linking.openURL('mailto:support@shoppersdeals.app?subject=Shoppers%20Deals%20App%20Support');
  };

  const handleOpenTelegram = () => {
    Linking.openURL('https://t.me/fitnessdealsindia');
  };

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
                  <Ionicons name="help-buoy-outline" size={22} color="#3b82f6" />
                  <Text style={styles.modalTitle}>Help & Support</Text>
                </View>
                <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                  <Ionicons name="close" size={20} color="#94a3b8" />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.scrollBody} showsVerticalScrollIndicator={false}>
                {/* Contact Quick Cards */}
                <View style={styles.contactRow}>
                  <TouchableOpacity style={styles.contactCard} activeOpacity={0.8} onPress={handleOpenEmail}>
                    <Ionicons name="mail-outline" size={24} color="#3b82f6" />
                    <Text style={styles.contactLabel}>Email Support</Text>
                    <Text style={styles.contactSub}>support@shoppersdeals.app</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.contactCard} activeOpacity={0.8} onPress={handleOpenTelegram}>
                    <Ionicons name="paper-plane-outline" size={24} color="#0088cc" />
                    <Text style={styles.contactLabel}>Telegram Chat</Text>
                    <Text style={styles.contactSub}>Live Community</Text>
                  </TouchableOpacity>
                </View>

                {/* FAQs */}
                <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>

                <View style={styles.faqList}>
                  {FAQS.map((faq, index) => {
                    const isExpanded = expandedFaq === index;
                    return (
                      <TouchableOpacity
                        key={index}
                        style={styles.faqItem}
                        activeOpacity={0.8}
                        onPress={() => toggleFaq(index)}
                      >
                        <View style={styles.faqHeader}>
                          <Text style={styles.faqQuestion}>{faq.q}</Text>
                          <Ionicons
                            name={isExpanded ? 'chevron-up' : 'chevron-down'}
                            size={18}
                            color="#94a3b8"
                          />
                        </View>

                        {isExpanded && (
                          <Text style={styles.faqAnswer}>{faq.a}</Text>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <View style={styles.appInfoBox}>
                  <Text style={styles.appInfoText}>ShoppersDeals App v1.0.0 (Build 2026)</Text>
                  <Text style={styles.appInfoSub}>Made with ❤️ for smart Indian online shoppers</Text>
                </View>
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
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 18,
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
  contactRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  contactCard: {
    flex: 1,
    backgroundColor: '#1a2030',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  contactLabel: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 8,
  },
  contactSub: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 2,
  },
  sectionTitle: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  faqList: {
    gap: 10,
    marginBottom: 24,
  },
  faqItem: {
    backgroundColor: '#1a2030',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  faqQuestion: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  faqAnswer: {
    color: '#94a3b8',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
    paddingTop: 10,
  },
  appInfoBox: {
    alignItems: 'center',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  appInfoText: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '600',
  },
  appInfoSub: {
    color: '#475569',
    fontSize: 11,
    marginTop: 2,
  },
});
