import React from 'react';
import { StyleSheet, Text, View, ScrollView, Platform } from 'react-native';
import WebFooter from './WebFooter';

const PrivacyPolicyView = ({ setActiveTab }) => {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Privacy Policy</Text>
      
      <Text style={styles.lastUpdated}>Last Updated: August 2026</Text>

      <Text style={styles.heading}>1. Information We Collect</Text>
      <Text style={styles.paragraph}>
        When you use ShoppersDeals, we may collect the following types of information:
        {"\n"}• Account Information: If you create an account, we collect your name, email address, and profile picture (via Google Sign-in).
        {"\n"}• Contact Information: With your explicit permission, we may access your contacts to help you share deals with friends.
        {"\n"}• Usage Data: Information about how you interact with our app, the deals you save, and the links you click.
      </Text>

      <Text style={styles.heading}>2. How We Use Your Information</Text>
      <Text style={styles.paragraph}>
        We use the collected information to:
        {"\n"}• Provide and maintain our service
        {"\n"}• Personalize your experience and show you relevant deals
        {"\n"}• Sync your saved deals across devices
        {"\n"}• Allow you to easily share deals with your contacts
      </Text>

      <Text style={styles.heading}>3. Sharing Your Information</Text>
      <Text style={styles.paragraph}>
        We do not sell your personal information to third parties. We may share your information only in the following circumstances:
        {"\n"}• With your consent
        {"\n"}• To comply with legal obligations
        {"\n"}• With service providers who assist us in operating our app (e.g., Firebase for database and authentication)
      </Text>

      <Text style={styles.heading}>4. Data Security</Text>
      <Text style={styles.paragraph}>
        We implement appropriate technical and organizational measures to protect your personal data against unauthorized or unlawful processing, accidental loss, destruction, or damage.
      </Text>

      <Text style={styles.heading}>5. Your Rights</Text>
      <Text style={styles.paragraph}>
        You have the right to access, update, or delete your personal information. You can manage your account settings within the app or contact us directly for assistance.
      </Text>

      <Text style={styles.heading}>6. Contact Us</Text>
      <Text style={styles.paragraph}>
        If you have any questions about this Privacy Policy, please contact us at: support@shoppersdeals.in
      </Text>
      </View>
      <WebFooter setActiveTab={setActiveTab} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    flexGrow: 1,
  },
  content: {
    padding: 20,
    maxWidth: 800,
    alignSelf: 'center',
    width: '100%',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 10,
    marginTop: Platform.OS === 'web' ? 20 : 0,
  },
  lastUpdated: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 30,
  },
  heading: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginTop: 20,
    marginBottom: 10,
  },
  paragraph: {
    fontSize: 16,
    color: '#4b5563',
    lineHeight: 24,
    marginBottom: 10,
  },
});

export default PrivacyPolicyView;
