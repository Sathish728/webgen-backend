// routes/webhookRoutes.js - Improved Webhook Routes
import express from 'express'
const router = express.Router();
import { handleWebhook, verifyWebhook } from '../controllers/webhook.Controller.js'

/**
 * @route   POST /api/templates/webhook
 * @desc    Handle Stripe webhook events
 * @access  Public (Stripe only)
 * @note    Must use express.raw() middleware
 */
router.post('/webhook', express.raw({ type: "application/json" }), handleWebhook);

/**
 * @route   GET /api/templates/webhook/verify
 * @desc    Verify webhook endpoint is active
 * @access  Public
 */
router.get('/webhook/verify', verifyWebhook);

export default router;