// utils/subscriptionUtils.js - Subscription helper functions and middleware

import Subscription from "../models/Subscription.model.js";

/**
 * Check if a website has an active subscription
 * @param {string} websiteId - Website MongoDB ID
 * @returns {Promise<Object|null>} Active subscription or null
 */
export async function getActiveSubscription(websiteId) {
  try {
    const subscription = await Subscription.findOne({
      websiteId,
      status: 'active',
      currentPeriodEnd: { $gt: new Date() }
    });

    return subscription;
  } catch (error) {
    console.error('Error checking subscription:', error);
    return null;
  }
}

/**
 * Check if user has active subscription for a specific website
 * @param {string} userId - User MongoDB ID
 * @param {string} websiteId - Website MongoDB ID
 * @returns {Promise<boolean>}
 */
export async function hasActiveSubscription(userId, websiteId) {
  try {
    const subscription = await Subscription.findOne({
      userId,
      websiteId,
      status: 'active',
      currentPeriodEnd: { $gt: new Date() }
    });

    return !!subscription;
  } catch (error) {
    console.error('Error checking subscription:', error);
    return false;
  }
}

/**
 * Validate subscription and check if it's still active
 * @param {Object} subscription - Subscription document
 * @returns {boolean}
 */
export function isSubscriptionValid(subscription) {
  if (!subscription) return false;
  
  if (subscription.status !== 'active') return false;
  
  const now = new Date();
  if (subscription.currentPeriodEnd && new Date(subscription.currentPeriodEnd) <= now) {
    return false;
  }
  
  return true;
}

/**
 * Express middleware to check if website has active subscription
 * Usage: router.post('/publish', requireActiveSubscription, publishWebsite)
 */
export async function requireActiveSubscription(req, res, next) {
  try {
    const { websiteId } = req.params;
    const { userId } = req.body;

    if (!websiteId) {
      return res.status(400).json({
        success: false,
        message: "Website ID is required"
      });
    }

    const subscription = await getActiveSubscription(websiteId);

    if (!subscription) {
      return res.status(403).json({
        success: false,
        message: "Active subscription required for this action",
        requiresSubscription: true
      });
    }

    // Verify user owns the subscription
    if (userId && subscription.userId.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: "You don't have permission to access this subscription"
      });
    }

    // Attach subscription to request object
    req.subscription = subscription;
    next();

  } catch (error) {
    console.error('Subscription middleware error:', error);
    res.status(500).json({
      success: false,
      message: "Error checking subscription status",
      error: error.message
    });
  }
}

/**
 * Get subscription status for multiple websites
 * @param {string} userId - User MongoDB ID
 * @param {Array<string>} websiteIds - Array of website IDs
 * @returns {Promise<Object>} Map of websiteId to subscription status
 */
export async function getBulkSubscriptionStatus(userId, websiteIds) {
  try {
    const subscriptions = await Subscription.find({
      userId,
      websiteId: { $in: websiteIds },
      status: 'active'
    }).lean();

    const statusMap = {};
    const now = new Date();

    websiteIds.forEach(id => {
      statusMap[id] = {
        hasActive: false,
        subscription: null
      };
    });

    subscriptions.forEach(sub => {
      const isValid = sub.currentPeriodEnd > now;
      statusMap[sub.websiteId.toString()] = {
        hasActive: isValid,
        subscription: isValid ? sub : null
      };
    });

    return statusMap;
  } catch (error) {
    console.error('Error getting bulk subscription status:', error);
    return {};
  }
}

/**
 * Calculate days remaining in subscription
 * @param {Date} currentPeriodEnd - Subscription end date
 * @returns {number} Days remaining
 */
export function getDaysRemaining(currentPeriodEnd) {
  const now = new Date();
  const end = new Date(currentPeriodEnd);
  const diff = end - now;
  
  if (diff <= 0) return 0;
  
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

/**
 * Format subscription for API response
 * @param {Object} subscription - Subscription document
 * @returns {Object} Formatted subscription
 */
export function formatSubscriptionResponse(subscription) {
  if (!subscription) return null;

  return {
    subscriptionId: subscription.subscriptionId,
    status: subscription.status,
    planName: subscription.planName,
    planAmount: subscription.planAmount,
    currency: subscription.currency,
    interval: subscription.interval,
    currentPeriodStart: subscription.currentPeriodStart,
    currentPeriodEnd: subscription.currentPeriodEnd,
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    daysRemaining: getDaysRemaining(subscription.currentPeriodEnd),
    isActive: isSubscriptionValid(subscription),
    createdAt: subscription.createdAt,
    updatedAt: subscription.updatedAt
  };
}

/**
 * Check if subscription allows specific feature
 * @param {Object} subscription - Subscription document
 * @param {string} feature - Feature name ('publish', 'custom_domain', etc.)
 * @returns {boolean}
 */
export function canAccessFeature(subscription, feature) {
  if (!isSubscriptionValid(subscription)) return false;

  // Define feature access based on subscription plan
  const featureAccess = {
    'basic': ['publish', 'custom_domain', 'ssl', 'support'],
    'pro': ['publish', 'custom_domain', 'ssl', 'support', 'analytics', 'advanced_customization'],
    'enterprise': ['publish', 'custom_domain', 'ssl', 'support', 'analytics', 'advanced_customization', 'api_access']
  };

  // Extract plan tier from planName (e.g., "Basic Plan" -> "basic")
  const planTier = subscription.planName.toLowerCase().split(' ')[0];
  const allowedFeatures = featureAccess[planTier] || featureAccess['basic'];

  return allowedFeatures.includes(feature);
}