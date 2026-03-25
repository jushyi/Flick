import * as RNIap from 'react-native-iap';
import type { ProductPurchase, Product } from 'react-native-iap';
import { supabase } from '../lib/supabase';
import logger from '../utils/logger';

export const PRODUCT_IDS: string[] = [
  'flick_contribution_099',
  'flick_contribution_299',
  'flick_contribution_499',
  'flick_contribution_999',
];

let isIAPInitialized = false;

interface IAPResult {
  success: boolean;
  error?: string;
}

interface ProductsResult extends IAPResult {
  products?: Product[];
}

interface PurchaseResult extends IAPResult {
  purchase?: ProductPurchase;
  userCancelled?: boolean;
}

interface ContributorResult extends IAPResult {
  isContributor?: boolean;
}

interface ContributionRecord {
  id: string;
  [key: string]: unknown;
}

interface ContributionsResult extends IAPResult {
  contributions?: ContributionRecord[];
}

interface RestoreResult extends IAPResult {
  purchases?: ProductPurchase[];
}

export const initializeIAP = async (): Promise<IAPResult> => {
  if (isIAPInitialized) {
    logger.debug('IAPService.initializeIAP: Already initialized');
    return { success: true };
  }

  if (!RNIap || typeof RNIap.initConnection !== 'function') {
    logger.warn('IAPService.initializeIAP: Native module not available in this build');
    return { success: false, error: 'IAP not available in this build' };
  }

  try {
    logger.debug('IAPService.initializeIAP: Starting connection');
    await RNIap.initConnection();
    isIAPInitialized = true;
    logger.info('IAPService.initializeIAP: Connection established');
    return { success: true };
  } catch (err) {
    const error = err as Error;
    logger.error('IAPService.initializeIAP: Failed', { error: error.message });
    return { success: false, error: error.message };
  }
};

export const endIAPConnection = async (): Promise<IAPResult> => {
  try {
    await RNIap.endConnection();
    isIAPInitialized = false;
    logger.info('IAPService.endIAPConnection: Connection closed');
    return { success: true };
  } catch (err) {
    const error = err as Error;
    logger.error('IAPService.endIAPConnection: Failed', { error: error.message });
    return { success: false, error: error.message };
  }
};

export const getProducts = async (): Promise<ProductsResult> => {
  try {
    if (!isIAPInitialized) {
      const initResult = await initializeIAP();
      if (!initResult.success) return initResult;
    }

    logger.debug('IAPService.getProducts: Fetching products', { productIds: PRODUCT_IDS });
    const products = await RNIap.getProducts({ skus: PRODUCT_IDS });
    logger.info('IAPService.getProducts: Fetched successfully', { count: products.length });
    return { success: true, products };
  } catch (err) {
    const error = err as Error;
    logger.error('IAPService.getProducts: Failed', { error: error.message });
    return { success: false, error: error.message };
  }
};

export const purchaseProduct = async (productId: string): Promise<PurchaseResult> => {
  try {
    if (!isIAPInitialized) {
      const initResult = await initializeIAP();
      if (!initResult.success) return initResult;
    }

    logger.debug('IAPService.purchaseProduct: Starting purchase', { productId });
    const purchase = await RNIap.requestPurchase({ sku: productId });
    logger.info('IAPService.purchaseProduct: Purchase completed', {
      productId,
      transactionId: (purchase as ProductPurchase).transactionId,
    });
    return { success: true, purchase: purchase as ProductPurchase };
  } catch (err) {
    const error = err as Error & { code?: string };
    if (error.code === 'E_USER_CANCELLED') {
      logger.debug('IAPService.purchaseProduct: User cancelled', { productId });
      return { success: false, error: 'cancelled', userCancelled: true };
    }
    logger.error('IAPService.purchaseProduct: Failed', { productId, error: error.message });
    return { success: false, error: error.message };
  }
};

export const finishTransaction = async (purchase: ProductPurchase): Promise<IAPResult> => {
  try {
    logger.debug('IAPService.finishTransaction: Finishing transaction', {
      transactionId: purchase.transactionId,
    });
    await RNIap.finishTransaction({ purchase, isConsumable: true });
    logger.info('IAPService.finishTransaction: Transaction finished', {
      transactionId: purchase.transactionId,
    });
    return { success: true };
  } catch (err) {
    const error = err as Error;
    logger.error('IAPService.finishTransaction: Failed', { error: error.message });
    return { success: false, error: error.message };
  }
};

export const restorePurchases = async (): Promise<RestoreResult> => {
  try {
    if (!isIAPInitialized) {
      const initResult = await initializeIAP();
      if (!initResult.success) return initResult;
    }

    logger.debug('IAPService.restorePurchases: Starting restore');
    const purchases = await RNIap.getAvailablePurchases();
    logger.info('IAPService.restorePurchases: Restored', { count: purchases.length });
    return { success: true, purchases };
  } catch (err) {
    const error = err as Error;
    logger.error('IAPService.restorePurchases: Failed', { error: error.message });
    return { success: false, error: error.message };
  }
};

export const checkContributorStatus = async (userId: string): Promise<ContributorResult> => {
  try {
    logger.debug('IAPService.checkContributorStatus: Checking', { userId });
    const { data, error } = await supabase
      .from('users')
      .select('is_contributor')
      .eq('id', userId)
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    const isContributor = data?.is_contributor === true;
    logger.debug('IAPService.checkContributorStatus: Checked', { userId, isContributor });
    return { success: true, isContributor };
  } catch (err) {
    const error = err as Error;
    logger.error('IAPService.checkContributorStatus: Failed', { userId, error: error.message });
    return { success: false, error: error.message };
  }
};

export const saveContribution = async (
  userId: string,
  productId: string,
  transactionId: string,
  amount: string
): Promise<IAPResult> => {
  try {
    logger.debug('IAPService.saveContribution: Saving', { userId, productId, transactionId });

    const { error: insertError } = await supabase.from('contributions').insert({
      user_id: userId,
      product_id: productId,
      transaction_id: transactionId,
      amount,
    });

    if (insertError) throw insertError;

    // Mark user as contributor if not already
    const { data: userData } = await supabase
      .from('users')
      .select('is_contributor, name_color')
      .eq('id', userId)
      .single();

    if (userData && !userData.is_contributor) {
      await supabase
        .from('users')
        .update({ is_contributor: true })
        .eq('id', userId);
      logger.info('IAPService.saveContribution: User marked as contributor', { userId });
    }

    logger.info('IAPService.saveContribution: Contribution saved', { userId, productId, transactionId });
    return { success: true };
  } catch (err) {
    const error = err as Error;
    logger.error('IAPService.saveContribution: Failed', { userId, productId, error: error.message });
    return { success: false, error: error.message };
  }
};

export const getUserContributions = async (userId: string): Promise<ContributionsResult> => {
  try {
    logger.debug('IAPService.getUserContributions: Fetching', { userId });
    const { data, error } = await supabase
      .from('contributions')
      .select('*')
      .eq('user_id', userId);

    if (error) throw error;

    const contributions: ContributionRecord[] = (data || []).map(d => ({
      id: d.id,
      ...(d as Record<string, unknown>),
    }));

    logger.info('IAPService.getUserContributions: Fetched', { userId, count: contributions.length });
    return { success: true, contributions };
  } catch (err) {
    const error = err as Error;
    logger.error('IAPService.getUserContributions: Failed', { userId, error: error.message });
    return { success: false, error: error.message };
  }
};
