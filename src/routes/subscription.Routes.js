// routes/subscriptionRoutes.js - Improved Subscription Routes
import express from 'express'
const router = express.Router();
import { 
  createSubscription,
  checkSubscription,
  cancelSubscription,
  getSubscriptionDetails,
  reactivateSubscription,
  getUserSubscriptions
} from '../controllers/subscription.Controller.js'
import { protectRoute } from '../middleware/auth.middleware.js'

/**
 * @route   POST /api/templates/subscribe
 * @desc    Create subscription checkout session
 * @access  Protected
 */
router.post('/subscribe', protectRoute, createSubscription);

/**
 * @route   GET /api/templates/check/:userId/:websiteId
 * @desc    Check if user has active subscription for website
 * @access  Protected
 */
router.get('/check/:userId/:websiteId', protectRoute, checkSubscription);

/**
 * @route   POST /api/templates/cancel-subscription
 * @desc    Cancel subscription (at period end)
 * @access  Protected
 */
router.post("/cancel-subscription", protectRoute, cancelSubscription);

/**
 * @route   POST /api/templates/reactivate-subscription
 * @desc    Reactivate canceled subscription
 * @access  Protected
 */
router.post("/reactivate-subscription", protectRoute, reactivateSubscription);

/**
 * @route   GET /api/templates/subscription-details/:userId/:websiteId
 * @desc    Get subscription details for website
 * @access  Protected
 */
router.get("/subscription-details/:userId/:websiteId", protectRoute, getSubscriptionDetails);

/**
 * @route   GET /api/templates/user-subscriptions/:userId
 * @desc    Get all subscriptions for a user
 * @access  Protected
 */
router.get("/user-subscriptions/:userId", protectRoute, getUserSubscriptions);

export default router;