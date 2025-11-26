// controllers/subscriptionController.js - Improved Version
import Subscription from'../models/Subscription.model.js'
import Website from'../models/Website.model.js'
import dotenv from'dotenv'
dotenv.config();

import Stripe from 'stripe'
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
/**
 * Create a new subscription checkout session
 * @route POST /api/templates/subscribe
 */
export async function createSubscription  (req, res) {
  try {
    const { priceId, email, websiteId, userId } = req.body;

    // Validation
    if (!priceId || !email || !websiteId || !userId) {
      return res.status(400).json({
        success: false,
        message: "All fields are required: priceId, email, websiteId, userId"
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email format"
      });
    }

    // Validate MongoDB ObjectIds
    if (!websiteId.match(/^[0-9a-fA-F]{24}$/) || !userId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid websiteId or userId"
      });
    }

    // Check if website exists and belongs to user
    const website = await Website.findOne({ _id: websiteId, userId });
    if (!website) {
      return res.status(404).json({
        success: false,
        message: "Website not found or you don't have permission"
      });
    }

    // Check if already has active subscription
    const existingSubscription = await Subscription.findOne({
      userId,
      websiteId,
      status: 'active',
      currentPeriodEnd: { $gte: new Date() }
    });

    if (existingSubscription) {
      return res.status(409).json({
        success: false,
        message: "This website already has an active subscription",
        data: {
          subscriptionId: existingSubscription.subscriptionId,
          currentPeriodEnd: existingSubscription.currentPeriodEnd
        }
      });
    }

    const FRONTEND_URL = process.env.NODE_ENV === "production" 
      ? process.env.FRONTEND_URL_LIVE 
      : process.env.FRONTEND_URL;

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ 
        price: priceId, 
        quantity: 1 
      }],
      customer_email: email,
      success_url: `${FRONTEND_URL_LIVE}/user-websites?session_id={CHECKOUT_SESSION_ID}&success=true`,
      cancel_url: `${FRONTEND_URL_LIVE}/pricing?canceled=true`,
      metadata: {
        websiteId: websiteId,
        userId: userId,
        websiteName: website.name,
      },
      subscription_data: {
        metadata: {
          websiteId: websiteId,
          userId: userId,
        }
      },
      allow_promotion_codes: true, // Allow discount codes
      billing_address_collection: 'auto',
    });

    console.log("Stripe session created:", session.id);

    res.status(200).json({
      success: true,
      data: {
        sessionId: session.id,
        url: session.url
      },
      message: "Checkout session created successfully"
    });

  } catch (error) {
    console.error("Stripe subscription error:", error);
    
    // Handle Stripe-specific errors
    if (error.type === 'StripeInvalidRequestError') {
      return res.status(400).json({
        success: false,
        message: "Invalid request to Stripe",
        error: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to create subscription",
      error: error.message
    });
  }
};

/**
 * Check if user has active subscription for a website
 * @route GET /api/templates/check/:userId/:websiteId
 */
export async function checkSubscription  (req, res) {
  try {
    const { userId, websiteId } = req.params;

    // Validate ObjectIds
    if (!userId.match(/^[0-9a-fA-F]{24}$/) || !websiteId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid userId or websiteId"
      });
    }

    const subscription = await Subscription.findOne({
      userId,
      websiteId,
      status: 'active',
      currentPeriodEnd: { $gte: new Date() }
    }).lean();

    if (subscription) {
      res.status(200).json({
        success: true,
        hasActiveSubscription: true,
        data: {
          subscriptionId: subscription.subscriptionId,
          status: subscription.status,
          currentPeriodEnd: subscription.currentPeriodEnd,
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
          productId: subscription.productId
        }
      });
    } else {
      res.status(200).json({
        success: true,
        hasActiveSubscription: false,
        data: null
      });
    }
  } catch (error) {
    console.error("Error checking subscription:", error);
    res.status(500).json({
      success: false,
      message: "Error checking subscription",
      error: error.message
    });
  }
};



/**
 * Cancel a subscription
 * @route POST /api/templates/cancel-subscription
 * @body { subscriptionId, userId, cancelImmediately?: boolean }
 */
export async function cancelSubscription(req, res) {
  try {
    const { subscriptionId, userId, cancelImmediately = false } = req.body;

    console.log('Cancel request:', { subscriptionId, userId, cancelImmediately });

    // Validation
    if (!subscriptionId) {
      return res.status(400).json({
        success: false,
        message: "subscriptionId is required"
      });
    }

    // Find subscription in database
    const subscription = await Subscription.findOne({ subscriptionId });

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: "Subscription not found in database"
      });
    }

    // Verify ownership if userId provided
    if (userId && subscription.userId.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: "You don't have permission to cancel this subscription"
      });
    }

    // Check if already canceled
    if (subscription.status === 'canceled') {
      return res.status(400).json({
        success: false,
        message: "Subscription is already canceled"
      });
    }

    let updatedStripeSubscription;
    let message;
    let cancelAt = null;

    if (cancelImmediately) {
      // ===== IMMEDIATE CANCELLATION =====
      console.log('Canceling immediately in Stripe...');
      
      updatedStripeSubscription = await stripe.subscriptions.cancel(subscriptionId);

      // Update database
      subscription.status = 'canceled';
      subscription.canceledAt = new Date();
      subscription.cancelAtPeriodEnd = false;
      subscription.endedAt = new Date();
      subscription.currentPeriodEnd = new Date(); // Ends now

      message = "Subscription canceled immediately";
      cancelAt = new Date();

    } else {
      // ===== CANCEL AT PERIOD END =====
      console.log('Setting cancel at period end in Stripe...');
      
      updatedStripeSubscription = await stripe.subscriptions.update(
        subscriptionId,
        { cancel_at_period_end: true }
      );

      // Update database
      subscription.cancelAtPeriodEnd = true;
      subscription.canceledAt = new Date();
      subscription.status = updatedStripeSubscription.status || 'active';

      message = "Subscription will be canceled at the end of billing period";
      
      // Get cancelation date
      cancelAt = updatedStripeSubscription.cancel_at 
        ? new Date(updatedStripeSubscription.cancel_at * 1000)
        : subscription.currentPeriodEnd;
    }

    // Save to database
    await subscription.save();

    console.log('Subscription updated successfully');

    // Return response
    res.status(200).json({
      success: true,
      message,
      data: {
        subscriptionId,
        canceledImmediately: cancelImmediately,
        status: subscription.status,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        cancelAt,
        canceledAt: subscription.canceledAt,
        currentPeriodEnd: subscription.currentPeriodEnd,
        refundable: cancelImmediately
      }
    });

  } catch (error) {
    console.error("Error canceling subscription:", error);

    // Handle specific Stripe errors
    if (error.type === 'StripeInvalidRequestError') {
      return res.status(400).json({
        success: false,
        message: "Invalid subscription ID or subscription already canceled",
        error: error.message
      });
    }

    if (error.code === 'resource_missing') {
      return res.status(404).json({
        success: false,
        message: "Subscription not found in Stripe",
        error: error.message
      });
    }

    // Generic error
    res.status(500).json({
      success: false,
      message: "Failed to cancel subscription",
      error: error.message
    });
  }
}


/**
 * Get subscription details
 * @route GET /api/templates/subscription-details/:userId/:websiteId
 */
export async function getSubscriptionDetails  (req, res)  {
  try {
    const { userId, websiteId } = req.params;

    // Validate ObjectIds
    if (!userId.match(/^[0-9a-fA-F]{24}$/) || !websiteId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid userId or websiteId"
      });
    }

    const subscription = await Subscription.findOne({
      userId,
      websiteId
    })
    .sort({ createdAt: -1 }) // Get most recent
    .lean();

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: "No subscription found for this website"
      });
    }

    // Get additional details from Stripe
    let stripeDetails = null;
    try {
      const stripeSubscription = await stripe.subscriptions.retrieve(subscription.subscriptionId);
      stripeDetails = {
        status: stripeSubscription.status,
        currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
        cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
        cancelAt: stripeSubscription.cancel_at ? new Date(stripeSubscription.cancel_at * 1000) : null,
        trialEnd: stripeSubscription.trial_end ? new Date(stripeSubscription.trial_end * 1000) : null,
      };
    } catch (stripeError) {
      console.error("Error fetching from Stripe:", stripeError);
    }

    res.status(200).json({
      success: true,
      data: {
        subscriptionId: subscription.subscriptionId,
        email: subscription.email,
        productId: subscription.productId,
        status: subscription.status,
        startDate: subscription.startDate,
        currentPeriodEnd: subscription.currentPeriodEnd,
        canceledAt: subscription.canceledAt,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        isActive: subscription.isActive(),
        willRenew: subscription.willRenew(),
        stripeDetails: stripeDetails,
        createdAt: subscription.createdAt,
        updatedAt: subscription.updatedAt
      }
    });

  } catch (error) {
    console.error("Error fetching subscription details:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch subscription details",
      error: error.message
    });
  }
};

/**
 * Reactivate a canceled subscription
 * @route POST /api/templates/reactivate-subscription
 */
export async function reactivateSubscription  (req, res) {
  try {
    const { subscriptionId, userId } = req.body;

    if (!subscriptionId) {
      return res.status(400).json({
        success: false,
        message: "subscriptionId is required"
      });
    }

    const subscription = await Subscription.findOne({ subscriptionId });

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: "Subscription not found"
      });
    }

    // Verify ownership
    if (userId && subscription.userId.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: "You don't have permission to reactivate this subscription"
      });
    }

    // Check if subscription is set to cancel
    if (!subscription.cancelAtPeriodEnd) {
      return res.status(400).json({
        success: false,
        message: "Subscription is not scheduled for cancellation"
      });
    }

    // Reactivate in Stripe
    const updatedStripeSubscription = await stripe.subscriptions.update(
      subscriptionId,
      { cancel_at_period_end: false }
    );

    // Update database
    subscription.cancelAtPeriodEnd = false;
    subscription.status = 'active';
    await subscription.save();

    res.status(200).json({
      success: true,
      message: "Subscription reactivated successfully",
      data: {
        subscriptionId,
        status: subscription.status,
        currentPeriodEnd: subscription.currentPeriodEnd
      }
    });

  } catch (error) {
    console.error("Error reactivating subscription:", error);
    res.status(500).json({
      success: false,
      message: "Failed to reactivate subscription",
      error: error.message
    });
  }
};

/**
 * Get all subscriptions for a user
 * @route GET /api/templates/user-subscriptions/:userId
 */
export async function getUserSubscriptions  (req, res)  {
  try {
    const { userId } = req.params;

    if (!userId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid userId"
      });
    }

    const subscriptions = await Subscription.find({ userId })
      .populate('websiteId', 'name slug customDomain')
      .sort({ createdAt: -1 })
      .lean();

    const subscriptionsWithStatus = subscriptions.map(sub => ({
      ...sub,
      isActive: sub.status === 'active' && sub.currentPeriodEnd > new Date(),
      daysUntilRenewal: sub.currentPeriodEnd 
        ? Math.ceil((sub.currentPeriodEnd - new Date()) / (1000 * 60 * 60 * 24))
        : null
    }));

    res.status(200).json({
      success: true,
      data: subscriptionsWithStatus,
      count: subscriptions.length
    });

  } catch (error) {
    console.error("Error fetching user subscriptions:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch subscriptions",
      error: error.message
    });
  }
};