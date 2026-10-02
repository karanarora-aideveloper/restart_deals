import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
  Switch,
  Alert,
  useWindowDimensions,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import HelpSupportModal from './HelpSupportModal';
import AffiliateDisclosureModal from './AffiliateDisclosureModal';
import { logEvent } from '../utils/analytics';

export default function LoginProfileView({ savedCount = 0, setActiveTab }) {
  const {
    user,
    token,
    isLoggedIn,
    loginWithFirebaseGoogle,
    loginWithGooglePayload,
    logout,
    deleteAccount
  } = useAuth();

  const { width } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === 'web' && width >= 768;

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  const [helpModalVisible, setHelpModalVisible] = useState(false);
  const [affiliateModalVisible, setAffiliateModalVisible] = useState(false);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      if (loginWithFirebaseGoogle) {
        await loginWithFirebaseGoogle();
      } else {
        const mockGoogleId = '1092837492837498' + Math.floor(Math.random() * 1000);
        const googleUser = {
          googleId: mockGoogleId,
          email: 'user.deals@gmail.com',
          name: 'Karan Arora',
          picture: 'https://lh3.googleusercontent.com/a/ACg8ocL8k3n3y3_shoppersdeals=s96-c',
        };
        await loginWithGooglePayload(googleUser);
      }
      logEvent('login', { method: 'Google' });
    } catch (err) {
      setErrorMsg(err.message || 'Google Sign-In failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    setLoading(true);
    try {
      await logout();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = () => {
    if (Platform.OS === 'web') {
      const confirmDelete = window.confirm("Are you sure you want to permanently delete your account? This action cannot be undone.");
      if (confirmDelete) {
        performDelete();
      }
    } else {
      Alert.alert(
        "Delete Account",
        "Are you sure you want to permanently delete your account? This action cannot be undone.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Delete", style: "destructive", onPress: performDelete }
        ]
      );
    }
  };

  const performDelete = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      await deleteAccount();
      setSuccessMsg('Account deleted successfully');
    } catch (err) {
      setErrorMsg(err.message || 'Failed to delete account');
      setLoading(false);
    }
  };


  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentPadding}>
      <View style={[isDesktopWeb && styles.desktopWrapper]}>
        {!isLoggedIn || !user ? (
          /* Dedicated Logged-Out Login Screen */
          <View style={[styles.heroCard, isDesktopWeb && styles.desktopHeroCard]}>
            <View style={styles.logoBadge}>
            <Ionicons name="flash" size={32} color="#00f2fe" />
          </View>
          <Text style={styles.heroTitle}>ShoppersDeals</Text>
          <Text style={styles.heroSub}>
            Sign in to unlock live deal notifications, price tracking, and synced bookmarks across devices.
          </Text>

          {errorMsg ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={16} color="#ef4444" />
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          ) : null}

          {successMsg ? (
            <View style={styles.successBox}>
              <Ionicons name="checkmark-circle" size={16} color="#10b981" />
              <Text style={styles.successText}>{successMsg}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={styles.googleBtn}
            activeOpacity={0.85}
            onPress={handleGoogleSignIn}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#0d111a" />
            ) : (
              <View style={styles.googleBtnRow}>
                <View style={styles.googleIconBg}>
                  <Text style={styles.googleGLetter}>G</Text>
                </View>
                <Text style={styles.googleBtnText}>Continue with Google</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      ) : (
        /* Dedicated Logged-In User Profile Screen */
        <View style={[styles.profileHeaderCard, isDesktopWeb && styles.desktopHeroCard]}>
          <View style={styles.avatarBorder}>
            {user.picture ? (
              <Image source={{ uri: user.picture }} style={styles.avatarImg} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarInitial}>{user.name ? user.name.charAt(0).toUpperCase() : 'U'}</Text>
              </View>
            )}
          </View>

          <Text style={styles.profileName}>{user.name}</Text>
          <Text style={styles.profileEmail}>{user.phoneNumber ? user.phoneNumber : user.email}</Text>

          <View style={styles.verifiedBadge}>
            <Ionicons name="checkmark-circle" size={14} color="#10b981" />
            <Text style={styles.verifiedText}>Verified Account</Text>
          </View>
        </View>
      )}

      {/* Messages for Logged-In Actions */}
      {isLoggedIn && errorMsg ? (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle" size={16} color="#ef4444" />
          <Text style={styles.errorText}>{errorMsg}</Text>
        </View>
      ) : null}

      {isLoggedIn && successMsg ? (
        <View style={styles.successBox}>
          <Ionicons name="checkmark-circle" size={16} color="#10b981" />
          <Text style={styles.successText}>{successMsg}</Text>
        </View>
      ) : null}

      {/* Account Stats Row (Only if logged in) */}
      {isLoggedIn && (
        <View style={styles.statsRow}>
          <TouchableOpacity 
            style={styles.statCard} 
            activeOpacity={0.7} 
            onPress={() => setActiveTab && setActiveTab('saved')}
          >
            <Text style={styles.statValue}>{savedCount}</Text>
            <Text style={styles.statLabel}>Saved Deals</Text>
          </TouchableOpacity>

          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: '#10b981' }]}>Active</Text>
            <Text style={styles.statLabel}>Status</Text>
          </View>

          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: '#818cf8' }]}>Pro</Text>
            <Text style={styles.statLabel}>Member Tier</Text>
          </View>
        </View>
      )}

      {/* Preferences & Actions Section */}
      <Text style={styles.sectionHeader}>Preferences & Account Controls</Text>

      <View style={styles.settingsGroup}>
        {isLoggedIn && (
          <TouchableOpacity 
            style={styles.settingRow} 
            activeOpacity={0.7} 
            onPress={() => setActiveTab && setActiveTab('saved')}
          >
            <View style={styles.settingLeft}>
              <Ionicons name="bookmark-outline" size={20} color="#f59e0b" />
              <Text style={styles.settingText}>My Saved Deals</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#64748b" />
          </TouchableOpacity>
        )}
        {isLoggedIn && (
          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <Ionicons name="notifications-outline" size={20} color="#3b82f6" />
              <Text style={styles.settingText}>Push Notifications</Text>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
              trackColor={{ false: '#334155', true: '#3b82f6' }}
              thumbColor={notificationsEnabled ? '#ffffff' : '#94a3b8'}
            />
          </View>
        )}

        <TouchableOpacity
          style={styles.settingRow} 
          activeOpacity={0.7} 
          onPress={() => setHelpModalVisible(true)}
        >
          <View style={styles.settingLeft}>
            <Ionicons name="help-circle-outline" size={20} color="#f59e0b" />
            <Text style={styles.settingText}>Help & Support</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#64748b" />
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.settingRow} 
          activeOpacity={0.7} 
          onPress={() => setAffiliateModalVisible(true)}
        >
          <View style={styles.settingLeft}>
            <Ionicons name="shield-checkmark-outline" size={20} color="#10b981" />
            <Text style={styles.settingText}>Affiliate Disclosure & Transparency</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#64748b" />
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.settingRow} 
          activeOpacity={0.7} 
          onPress={() => setActiveTab('privacy')}
        >
          <View style={styles.settingLeft}>
            <Ionicons name="document-text-outline" size={20} color="#3b82f6" />
            <Text style={styles.settingText}>Privacy Policy</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#64748b" />
        </TouchableOpacity>
      </View>

      {/* Feature Highlights Grid (when logged out) */}
      {!isLoggedIn && (
        <>
          <Text style={styles.sectionHeader}>Why Sign In?</Text>
          <View style={styles.featureGrid}>
            <View style={styles.featureItem}>
              <View style={[styles.featureIconBg, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
                <Ionicons name="flame" size={22} color="#ef4444" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.featureTitle}>Exclusive Deal Alerts</Text>
                <Text style={styles.featureDesc}>Get notified instantly when 50%+ price drop deals drop on Amazon & Flipkart.</Text>
              </View>
            </View>

            <View style={styles.featureItem}>
              <View style={[styles.featureIconBg, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
                <Ionicons name="bookmark" size={22} color="#f59e0b" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.featureTitle}>Synced Saved Deals</Text>
                <Text style={styles.featureDesc}>Save deals on mobile and access them anytime on Web and desktop.</Text>
              </View>
            </View>

            <View style={styles.featureItem}>
              <View style={[styles.featureIconBg, { backgroundColor: 'rgba(129, 140, 248, 0.15)' }]}>
                <Ionicons name="trending-down" size={22} color="#818cf8" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.featureTitle}>Price History Tracker</Text>
                <Text style={styles.featureDesc}>View historical price charts to make sure you get the lowest price ever.</Text>
              </View>
            </View>
          </View>
        </>
      )}

      {/* Logout Action (Only if logged in) */}
      {isLoggedIn && (
        <View style={{ gap: 12 }}>
          <TouchableOpacity
            style={styles.signOutButton}
            activeOpacity={0.8}
            onPress={handleSignOut}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#ef4444" />
            ) : (
              <>
                <Ionicons name="log-out-outline" size={18} color="#ef4444" style={{ marginRight: 8 }} />
                <Text style={styles.signOutText}>Sign Out of Account</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.deleteAccountButton}
            activeOpacity={0.8}
            onPress={handleDeleteAccount}
            disabled={loading}
          >
            <Ionicons name="trash-outline" size={16} color="#64748b" style={{ marginRight: 6 }} />
            <Text style={styles.deleteAccountText}>Delete Account Permanently</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Help & Support Dialog */}
      <HelpSupportModal 
        visible={helpModalVisible} 
        onClose={() => setHelpModalVisible(false)} 
      />

      {/* Affiliate Disclosure Dialog */}
      <AffiliateDisclosureModal 
        visible={affiliateModalVisible} 
        onClose={() => setAffiliateModalVisible(false)} 
      />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  desktopWrapper: {
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    paddingVertical: 24,
  },
  contentPadding: {
    padding: 16,
    paddingBottom: 140,
  },
  heroCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
    marginBottom: 24,
  },
  desktopHeroCard: {
    padding: 40,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.06,
    shadowRadius: 36,
    borderWidth: 0,
  },
  logoBadge: {
    width: 54,
    height: 54,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 242, 254, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(0, 242, 254, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  heroTitle: {
    color: '#1a1a1a',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 4,
  },
  heroSub: {
    color: '#64748b',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginBottom: 12,
    width: '100%',
    gap: 6,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 12,
    flex: 1,
  },
  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginBottom: 12,
    width: '100%',
    gap: 6,
  },
  successText: {
    color: '#10b981',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },

  googleBtn: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  googleBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  googleIconBg: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleGLetter: {
    color: '#4285F4',
    fontSize: 15,
    fontWeight: '900',
  },
  googleBtnText: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '700',
  },

  sectionHeader: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
    letterSpacing: 0.3,
  },
  featureGrid: {
    gap: 12,
    marginBottom: 24,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
    gap: 14,
  },
  featureIconBg: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureTitle: {
    color: '#1a1a1a',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  featureDesc: {
    color: '#64748b',
    fontSize: 12,
    lineHeight: 16,
  },

  // Logged-in profile styles
  profileHeaderCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
    marginBottom: 16,
  },
  avatarBorder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: '#3b82f6',
    overflow: 'hidden',
    marginBottom: 12,
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  avatarFallback: {
    width: '100%',
    height: '100%',
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: '#ffffff',
    fontSize: 32,
    fontWeight: '700',
  },
  profileName: {
    color: '#1a1a1a',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 2,
  },
  profileEmail: {
    color: '#64748b',
    fontSize: 13,
    marginBottom: 12,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
  },
  verifiedText: {
    color: '#10b981',
    fontSize: 11,
    fontWeight: '700',
  },

  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  statValue: {
    color: '#3b82f6',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 2,
  },
  statLabel: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '600',
  },

  settingsGroup: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
    marginBottom: 24,
    overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingText: {
    color: '#1a1a1a',
    fontSize: 14,
    fontWeight: '500',
  },

  signOutButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '700',
  },
  deleteAccountButton: {
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteAccountText: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
