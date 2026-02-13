import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

import * as RNIap from 'react-native-iap';

import {
  initializeIAP,
  getProducts,
  purchaseProduct,
  finishTransaction,
  saveContribution,
  PRODUCT_IDS,
} from '../services/iapService';

import ColorPickerGrid from '../components/ColorPickerGrid';
import PixelIcon from '../components/PixelIcon';
import PixelSpinner from '../components/PixelSpinner';

import { useAuth } from '../context/AuthContext';

import { colors } from '../constants/colors';
import { spacing } from '../constants/spacing';
import { typography } from '../constants/typography';

import logger from '../utils/logger';

/**
 * ContributionsScreen
 *
 * Allows users to support the app through in-app purchases.
 * Features:
 * - Personal pitch about supporting indie development
 * - 4 contribution tiers ($0.99, $2.99, $4.99, $9.99)
 * - After purchase: unlock custom name color perk
 * - Color picker appears after contribution
 */

const CONTRIBUTION_TIERS = [
  {
    productId: 'flick_contribution_099',
    label: 'Buy me a coffee',
    emoji: '☕',
  },
  {
    productId: 'flick_contribution_299',
    label: 'Keep the lights on',
    emoji: '💡',
  },
  {
    productId: 'flick_contribution_499',
    label: 'Fuel new features',
    emoji: '🚀',
  },
  {
    productId: 'flick_contribution_999',
    label: 'Champion supporter',
    emoji: '🏆',
  },
];

const ContributionsScreen = () => {
  const navigation = useNavigation();
  const { user, userProfile, updateUserDocumentNative, refreshUserProfile } = useAuth();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [purchasingProductId, setPurchasingProductId] = useState(null);
  const [isContributor, setIsContributor] = useState(false);
  const [selectedColor, setSelectedColor] = useState(null);
  const [savingColor, setSavingColor] = useState(false);

  // Load products and contributor status
  useEffect(() => {
    loadData();
  }, []);

  // Sync contributor status from userProfile
  useEffect(() => {
    if (userProfile) {
      setIsContributor(userProfile.isContributor === true);
      setSelectedColor(userProfile.nameColor || null);
    }
  }, [userProfile]);

  const loadData = async () => {
    try {
      logger.debug('ContributionsScreen: Loading IAP products');

      // Initialize IAP
      const initResult = await initializeIAP();
      if (!initResult.success) {
        logger.error('ContributionsScreen: IAP initialization failed', {
          error: initResult.error,
        });
        Alert.alert('Error', 'Unable to connect to the App Store. Please try again later.');
        setLoading(false);
        return;
      }

      // Fetch products
      const productsResult = await getProducts();
      if (productsResult.success) {
        logger.info('ContributionsScreen: Products loaded', {
          count: productsResult.products.length,
        });
        setProducts(productsResult.products);
      } else {
        logger.error('ContributionsScreen: Failed to fetch products', {
          error: productsResult.error,
        });
        Alert.alert('Error', 'Unable to load contribution options. Please try again later.');
      }

      setLoading(false);
    } catch (error) {
      logger.error('ContributionsScreen: Error loading data', { error: error.message });
      setLoading(false);
    }
  };

  const handlePurchase = async productId => {
    try {
      setPurchasing(true);
      setPurchasingProductId(productId);
      logger.debug('ContributionsScreen: Starting purchase', { productId });

      // Request purchase
      const purchaseResult = await purchaseProduct(productId);

      if (!purchaseResult.success) {
        // User cancelled is not an error - just return
        if (purchaseResult.userCancelled) {
          logger.debug('ContributionsScreen: User cancelled purchase');
          setPurchasing(false);
          setPurchasingProductId(null);
          return;
        }

        // Other errors
        logger.error('ContributionsScreen: Purchase failed', { error: purchaseResult.error });
        Alert.alert('Purchase Failed', 'Unable to complete the purchase. Please try again.');
        setPurchasing(false);
        setPurchasingProductId(null);
        return;
      }

      const purchase = purchaseResult.purchase;
      logger.info('ContributionsScreen: Purchase completed', {
        productId,
        transactionId: purchase.transactionId,
      });

      // Get product details for amount
      const product = products.find(p => p.productId === productId);
      const amount = product?.localizedPrice || '$0.99';

      // Save contribution to Firestore
      const saveResult = await saveContribution(
        user.uid,
        productId,
        purchase.transactionId,
        amount
      );

      if (!saveResult.success) {
        logger.error('ContributionsScreen: Failed to save contribution', {
          error: saveResult.error,
        });
      }

      // Finish transaction (MUST be called to prevent re-delivery)
      const finishResult = await finishTransaction(purchase);
      if (!finishResult.success) {
        logger.warn('ContributionsScreen: Failed to finish transaction', {
          error: finishResult.error,
        });
      }

      // Refresh user profile to get updated contributor status
      await refreshUserProfile();

      // Show success message
      Alert.alert(
        'Thank You!',
        'Your contribution means the world. You can now customize your name color below.',
        [{ text: 'OK', style: 'default' }]
      );

      setPurchasing(false);
      setPurchasingProductId(null);
    } catch (error) {
      logger.error('ContributionsScreen: Error during purchase', { error: error.message });
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
      setPurchasing(false);
      setPurchasingProductId(null);
    }
  };

  const handleColorSelect = async color => {
    try {
      setSavingColor(true);
      logger.debug('ContributionsScreen: Saving name color', { color });

      const result = await updateUserDocumentNative(user.uid, { nameColor: color });

      if (result.success) {
        setSelectedColor(color);
        await refreshUserProfile();
        logger.info('ContributionsScreen: Name color saved', { color });
      } else {
        logger.error('ContributionsScreen: Failed to save color', { error: result.error });
        Alert.alert('Error', 'Unable to save color. Please try again.');
      }

      setSavingColor(false);
    } catch (error) {
      logger.error('ContributionsScreen: Error saving color', { error: error.message });
      setSavingColor(false);
    }
  };

  const getProductPrice = productId => {
    const product = products.find(p => p.productId === productId);
    return product?.localizedPrice || '...';
  };

  const renderTierButton = tier => {
    const isPurchasing = purchasing && purchasingProductId === tier.productId;

    return (
      <TouchableOpacity
        key={tier.productId}
        style={styles.tierButton}
        onPress={() => handlePurchase(tier.productId)}
        disabled={purchasing}
        activeOpacity={0.7}
      >
        <View style={styles.tierButtonContent}>
          <View style={styles.tierButtonLeft}>
            <Text style={styles.tierEmoji}>{tier.emoji}</Text>
            <View style={styles.tierTextContainer}>
              <Text style={styles.tierLabel}>{tier.label}</Text>
              <Text style={styles.tierPrice}>{getProductPrice(tier.productId)}</Text>
            </View>
          </View>
          {isPurchasing && <ActivityIndicator size="small" color={colors.brand.purple} />}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            logger.debug('ContributionsScreen: Back button pressed');
            navigation.goBack();
          }}
          style={styles.backButton}
        >
          <PixelIcon name="chevron-back" size={28} color={colors.icon.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Support Flick</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scrollView} bounces={false}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <PixelSpinner size={48} color={colors.brand.purple} />
            <Text style={styles.loadingText}>Loading...</Text>
          </View>
        ) : (
          <>
            {/* Personal pitch */}
            <View style={styles.pitchContainer}>
              <Text style={styles.pitchText}>
                Flick is built by one person who loves what disposable cameras do for friendships.
                Every contribution helps keep the servers running and new features coming.{'\n\n'}
                If Flick has brought you closer to your friends, consider supporting it — it means
                the world.
              </Text>
            </View>

            {/* Thank you message for existing contributors */}
            {isContributor && (
              <View style={styles.thankYouContainer}>
                <PixelIcon name="heart" size={24} color={colors.brand.pink} />
                <Text style={styles.thankYouText}>
                  You&apos;re already a contributor — thank you! You can contribute again anytime or
                  change your name color below.
                </Text>
              </View>
            )}

            {/* Contribution tiers */}
            <View style={styles.tiersContainer}>
              <Text style={styles.sectionTitle}>Choose a contribution</Text>
              {CONTRIBUTION_TIERS.map(tier => renderTierButton(tier))}
            </View>

            {/* Color picker (only visible for contributors) */}
            {isContributor && (
              <View style={styles.colorPickerContainer}>
                <View style={styles.colorPickerHeader}>
                  <Text style={styles.sectionTitle}>Customize Your Name Color</Text>
                  {savingColor && <ActivityIndicator size="small" color={colors.brand.purple} />}
                </View>
                <Text style={styles.colorPickerDescription}>
                  Your chosen color will appear next to your name throughout the app.
                </Text>
                <ColorPickerGrid selectedColor={selectedColor} onColorSelect={handleColorSelect} />
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  backButton: {
    padding: spacing.xxs,
  },
  headerTitle: {
    fontSize: typography.size.xl,
    fontFamily: typography.fontFamily.display,
    color: colors.text.primary,
  },
  headerSpacer: {
    width: 36,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.size.lg,
    fontFamily: typography.fontFamily.body,
    color: colors.text.secondary,
  },
  pitchContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    backgroundColor: colors.background.secondary,
    marginTop: spacing.lg,
    marginHorizontal: spacing.md,
    borderRadius: 12,
  },
  pitchText: {
    fontSize: typography.size.lg,
    fontFamily: typography.fontFamily.body,
    color: colors.text.primary,
    lineHeight: 24,
  },
  thankYouContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.background.tertiary,
    marginTop: spacing.lg,
    marginHorizontal: spacing.md,
    borderRadius: 12,
    gap: spacing.md,
  },
  thankYouText: {
    flex: 1,
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.body,
    color: colors.text.secondary,
    lineHeight: 20,
  },
  tiersContainer: {
    marginTop: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.size.xl,
    fontFamily: typography.fontFamily.displayBold,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  tierButton: {
    backgroundColor: colors.background.secondary,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border.default,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  tierButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  tierButtonLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  tierEmoji: {
    fontSize: 32,
    marginRight: spacing.md,
  },
  tierTextContainer: {
    flex: 1,
  },
  tierLabel: {
    fontSize: typography.size.lg,
    fontFamily: typography.fontFamily.bodyBold,
    color: colors.text.primary,
    marginBottom: 4,
  },
  tierPrice: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.body,
    color: colors.text.secondary,
  },
  colorPickerContainer: {
    marginTop: spacing.xl,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
  colorPickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  colorPickerDescription: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.body,
    color: colors.text.secondary,
    marginBottom: spacing.lg,
  },
});

export default ContributionsScreen;
