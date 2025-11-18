// routes/website.Routes.js - Updated with public routes
import express from "express";
const router = express.Router();

import {  requireActiveSubscription } from '../utils/subscriptionUtils.js';
import { 
  publishWebsite, 
  setCustomDomain, 
  createWebsite, 
  getWebsiteList, 
  getWebsiteEdit, 
  updateTemplate, 
  deleteWebsite,
  getPublishedWebsiteBySlug,
  getPublishedWebsiteByDomain,
  verifyCustomDomain
} from '../controllers/Website.controller.js';
import { protectRoute } from "../middleware/auth.middleware.js";

// ==================== PUBLIC ROUTES (No Auth Required) ====================

/**
 * @route   GET /api/websites/site/:slug
 * @desc    Get published website by slug (PUBLIC)
 * @access  Public
 * @example GET /api/websites/site/my-sathish-portfolio
 */
router.get("/site/:slug", getPublishedWebsiteBySlug,);

/**
 * @route   GET /api/websites/domain/:domain
 * @desc    Get published website by custom domain (PUBLIC)
 * @access  Public
 * @example GET /api/websites/domain/example.com
 */
router.get("/domain/:domain", getPublishedWebsiteByDomain);

// ==================== PROTECTED ROUTES (Auth Required) ====================

/**
 * @route   POST /api/websites/create-website
 * @desc    Create website from template
 * @access  Protected
 * @body    { userId, templateId, customName? }
 */
router.post("/create-website", protectRoute, createWebsite);

/**
 * @route   GET /api/websites/website/:websiteId
 * @desc    Get website by ID for editing
 * @access  Protected
 */
router.get("/website/:websiteId", protectRoute, getWebsiteEdit);

/**
 * @route   GET /api/websites/website-list/:userId
 * @desc    Get all websites for a user with pagination
 * @access  Protected
 * @query   page, limit
 * @example GET /api/websites/website-list/507f1f77bcf86cd799439011?page=1&limit=20
 */
router.get("/website-list/:userId", protectRoute, getWebsiteList);

/**
 * @route   PUT /api/websites/update/:websiteId
 * @desc    Update website content (HTML/JS only - CSS forced to empty for Tailwind)
 * @access  Protected
 * @body    { html?, css?, js?, components?, name? }
 */
router.put("/update/:websiteId", protectRoute, updateTemplate);

/**
 * @route   DELETE /api/websites/delete-website/:websiteId
 * @desc    Delete website by ID
 * @access  Protected
 */
router.delete("/delete-website/:websiteId", protectRoute, deleteWebsite);

/**
 * @route   GET /api/websites/verify-domain/:domain
 * @desc    Verify custom domain DNS settings
 * @access  Protected (requires subscription)
 * @query   siteid
 */
router.get("/verify-domain/:domain", protectRoute, verifyCustomDomain);

// ==================== SUBSCRIPTION-PROTECTED ROUTES ====================

/**
 * @route   PUT /api/websites/:websiteId/publish
 * @desc    Publish/unpublish website (requires active subscription)
 * @access  Protected + Subscription
 */
router.put('/:websiteId/publish', protectRoute, requireActiveSubscription, publishWebsite);

/**
 * @route   POST /api/websites/:websiteId/custom-domain
 * @desc    Set custom domain (requires active subscription)
 * @access  Protected + Subscription
 */
router.post('/:websiteId/custom-domain', protectRoute, requireActiveSubscription, setCustomDomain);

export default router;