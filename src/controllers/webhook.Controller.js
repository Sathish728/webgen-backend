// controllers/webhookController.js - Improved Version
import Subscription from'../models/Subscription.model.js'
import Website from'../models/Website.model.js'
import dotenv from'dotenv'
dotenv.config();

import Stripe from 'stripe'
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/**
 * Handle Stripe webhook events
 * @route POST /api/templates/webhook
 */
export async function handleWebhook  (req, res)  {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.NODE_ENV === 'production'
    ? process.env.STRIPE_WEBHOOK_SECRET_LIVE
    : process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error("❌ Webhook signature verification failed:", err.message);
    return res.status(400).json({
      success: false,
      message: `Webhook Error: ${err.message}`
    });
  }

  console.log(`✅ Webhook Event Received: ${event.type}`);

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object);
        break;

      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object);
        break;

      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;

      case 'customer.subscription.trial_will_end':
        await handleTrialWillEnd(event.data.object);
        break;

      default:
        console.log(`⚠️ Unhandled event type: ${event.type}`);
    }

    res.status(200).json({ 
      success: true,
      received: true,
      eventType: event.type
    });

  } catch (error) {
    console.error("❌ Error handling webhook:", error);
    res.status(500).json({
      success: false,
      message: "Webhook handler failed",
      error: error.message
    });
  }
};

/**
 * Handle checkout.session.completed event
 */
async function handleCheckoutCompleted(session) {
  console.log("📦 Processing checkout.session.completed");

  try {
    const subscriptionId = session.subscription;

    if (!subscriptionId) {
      console.log("⚠️ No subscription ID in session");
      return;
    }

    // Retrieve full subscription details
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const customer = await stripe.customers.retrieve(session.customer);

    const websiteId = subscription.metadata.websiteId;
    const userId = subscription.metadata.userId;
    const email = customer.email || session.customer_email;

    if (!websiteId || !userId) {
      console.error("❌ Missing metadata in subscription");
      return;
    }

    const productId = subscription.items.data[0]?.price?.product || "unknown";
    const currentPeriodEnd = new Date(subscription.current_period_end * 1000);
    const startDate = new Date(subscription.current_period_start * 1000);

    // Create or update subscription
    await Subscription.findOneAndUpdate(
      { subscriptionId },
      {
        email,
        userId,
        productId,
        websiteId,
        status: subscription.status,
        startDate,
        currentPeriodEnd,
        trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        metadata: subscription.metadata
      },
      { upsert: true, new: true }
    );

    console.log("✅ Subscription created/updated:", subscriptionId);

  } catch (error) {
    console.error("❌ Error in handleCheckoutCompleted:", error);
    throw error;
  }
}

/**
 * Handle invoice.payment_succeeded event
 */
async function handlePaymentSucceeded(invoice) {
  console.log("💰 Processing invoice.payment_succeeded");

  try {
    const subscriptionId = invoice.subscription;

    if (!subscriptionId) {
      console.log("⚠️ No subscription ID in invoice");
      return;
    }

    const customer = await stripe.customers.retrieve(invoice.customer);
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);

    const websiteId = subscription.metadata.websiteId;
    const userId = subscription.metadata.userId;
    const email = customer.email;
    const productId = subscription.items.data[0]?.price?.product || "unknown";

    const currentPeriodEnd = invoice.lines?.data[0]?.period?.end 
      ? new Date(invoice.lines.data[0].period.end * 1000)
      : new Date(subscription.current_period_end * 1000);

    const startDate = invoice.lines?.data[0]?.period?.start
      ? new Date(invoice.lines.data[0].period.start * 1000)
      : new Date(subscription.current_period_start * 1000);

    // Map subscription status
    let status = subscription.status;
    if (status === 'past_due' || status === 'unpaid') {
      status = 'incomplete';
    }

    // Update or create subscription
    const updatedSubscription = await Subscription.findOneAndUpdate(
      { subscriptionId },
      {
        email,
        userId,
        productId,
        websiteId,
        status,
        startDate,
        currentPeriodEnd,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
      },
      { upsert: true, new: true }
    );

    console.log("✅ Payment succeeded - Subscription updated:", {
      subscriptionId,
      status,
      currentPeriodEnd
    });

    // Optional: Send success email to customer
    // await sendPaymentSuccessEmail(email, updatedSubscription);

  } catch (error) {
    console.error("❌ Error in handlePaymentSucceeded:", error);
    throw error;
  }
}

/**
 * Handle invoice.payment_failed event
 */
async function handlePaymentFailed(invoice) {
  console.log("❌ Processing invoice.payment_failed");

  try {
    const subscriptionId = invoice.subscription;

    if (!subscriptionId) {
      console.log("⚠️ No subscription ID in failed invoice");
      return;
    }

    await Subscription.findOneAndUpdate(
      { subscriptionId },
      { 
        status: 'incomplete',
        updatedAt: new Date()
      }
    );

    console.log("✅ Subscription marked as incomplete:", subscriptionId);

    // Optional: Send payment failed email
    // const customer = await stripe.customers.retrieve(invoice.customer);
    // await sendPaymentFailedEmail(customer.email, invoice);

  } catch (error) {
    console.error("❌ Error in handlePaymentFailed:", error);
    throw error;
  }
}

/**
 * Handle customer.subscription.updated event
 */
async function handleSubscriptionUpdated(subscription) {
  console.log("🔄 Processing customer.subscription.updated");

  try {
    const subscriptionId = subscription.id;
    const currentPeriodEnd = new Date(subscription.current_period_end * 1000);
    
    // Map status
    let status = subscription.status;
    if (status === 'past_due' || status === 'unpaid') {
      status = 'incomplete';
    }

    await Subscription.findOneAndUpdate(
      { subscriptionId },
      {
        status,
        currentPeriodEnd,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null,
        trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
        updatedAt: new Date()
      }
    );

    console.log("✅ Subscription updated:", {
      subscriptionId,
      status,
      cancelAtPeriodEnd: subscription.cancel_at_period_end
    });

  } catch (error) {
    console.error("❌ Error in handleSubscriptionUpdated:", error);
    throw error;
  }
}

/**
 * Handle customer.subscription.deleted event
 */
async function handleSubscriptionDeleted(subscription) {
  console.log("🗑️ Processing customer.subscription.deleted");

  try {
    const subscriptionId = subscription.id;
    const canceledAt = subscription.canceled_at 
      ? new Date(subscription.canceled_at * 1000) 
      : new Date();

    const updatedSubscription = await Subscription.findOneAndUpdate(
      { subscriptionId },
      {
        status: 'canceled',
        canceledAt,
        cancelAtPeriodEnd: false,
        updatedAt: new Date()
      },
      { new: true }
    );

    if (updatedSubscription) {
      // Optional: Unpublish website or notify user
      // await Website.findByIdAndUpdate(
      //   updatedSubscription.websiteId,
      //   { isPublished: false }
      // );

      console.log("✅ Subscription canceled:", {
        subscriptionId,
        canceledAt,
        websiteId: updatedSubscription.websiteId
      });
    }

  } catch (error) {
    console.error("❌ Error in handleSubscriptionDeleted:", error);
    throw error;
  }
}

/**
 * Handle customer.subscription.trial_will_end event
 */
async function handleTrialWillEnd(subscription) {
  console.log("⏰ Processing customer.subscription.trial_will_end");

  try {
    const subscriptionId = subscription.id;
    const trialEnd = new Date(subscription.trial_end * 1000);

    // Optional: Send reminder email to customer
    const dbSubscription = await Subscription.findOne({ subscriptionId });
    if (dbSubscription) {
      console.log("📧 Trial ending soon for:", {
        subscriptionId,
        email: dbSubscription.email,
        trialEnd
      });

      // await sendTrialEndingEmail(dbSubscription.email, trialEnd);
    }

  } catch (error) {
    console.error("❌ Error in handleTrialWillEnd:", error);
    throw error;
  }
}

/**
 * Verify webhook endpoint (for testing)
 * @route GET /api/templates/webhook/verify
 */
export function verifyWebhook  (req, res)  {
  res.status(200).json({
    success: true,
    message: "Webhook endpoint is active",
    timestamp: new Date().toISOString()
  });
};