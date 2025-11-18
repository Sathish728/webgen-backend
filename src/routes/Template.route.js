
import express from "express";
const router = express.Router();

import {
  getAllTemplates,
  getTemplateById,
  addTemplate,
  updateTemplateAdmin,
  deleteTemplate,
} from "../controllers/Template.controller.js";

import { protectRoute, requireAdmin, optionalAuth } from "../middleware/auth.middleware.js";

// ==================== PUBLIC TEMPLATE ROUTES ====================

/**
 * @route   GET /api/templates/get-templates
 * @desc    Get all templates with pagination and filtering
 * @access  Public
 * @query   page, limit, category
 * @example GET /api/templates/get-templates?page=1&limit=10&category=portfolio
 */
router.get("/get-templates", getAllTemplates);

/**
 * @route   GET /api/templates/get-templates/:id
 * @desc    Get single template by ID
 * @access  Public
 * @example GET /api/templates/get-templates/507f1f77bcf86cd799439011
 */
router.get("/get-templates/:id", getTemplateById);

// ==================== ADMIN TEMPLATE ROUTES ====================

/**
 * @route   POST /api/templates/add-template
 * @desc    Add new template (Admin only)
 * @access  Protected (Admin)
 * @body    { name, html, js?, category?, thumbnail? }
 */
router.post("/add-template", addTemplate);

/**
 * @route   PUT /api/templates/update-template/:id
 * @desc    Update existing template (Admin only)
 * @access  Protected (Admin)
 * @body    { name?, html?, js?, category?, isActive?, thumbnail? }
 */
router.put("/update-template/:id", protectRoute, requireAdmin, updateTemplateAdmin);

/**
 * @route   DELETE /api/templates/delete-template/:id
 * @desc    Delete template (Admin only)
 * @access  Protected (Admin)
 */
router.delete("/delete-template/:id", protectRoute, requireAdmin, deleteTemplate);


// ==================== ADDITIONAL UTILITY ROUTES ====================

/**
 * @route   GET /api/templates/categories
 * @desc    Get all template categories
 * @access  Public
 */
router.get("/categories", (req, res) => {
  res.status(200).json({
    success: true,
    data: [
      { value: 'business', label: 'Business' },
      { value: 'portfolio', label: 'Portfolio' },
      { value: 'blog', label: 'Blog' },
      { value: 'ecommerce', label: 'E-commerce' },
      { value: 'landing', label: 'Landing Page' },
      { value: 'other', label: 'Other' }
    ]
  });
});

/**
 * @route   GET /api/templates/popular
 * @desc    Get most popular templates (by usage count)
 * @access  Public
 * @query   limit
 */
router.get("/popular", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 6;

    const popularTemplates = await Template.find({ isActive: true })
      .select("name thumbnail category usageCount createdAt")
      .sort({ usageCount: -1, createdAt: -1 })
      .limit(limit)
      .lean();

    const templatesWithImages = popularTemplates.map(template => ({
      _id: template._id,
      name: template.name,
      category: template.category,
      thumbnail: template.thumbnail?.data
        ? `data:${template.thumbnail.contentType};base64,${template.thumbnail.data.toString("base64")}`
        : null,
      usageCount: template.usageCount || 0,
    }));

    res.status(200).json({
      success: true,
      data: templatesWithImages
    });
  } catch (error) {
    console.error("Error fetching popular templates:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching popular templates",
      error: error.message
    });
  }
});

/**
 * @route   GET /api/templates/stats
 * @desc    Get template statistics (Admin only)
 * @access  Protected (Admin)
 */
router.get("/stats", protectRoute, requireAdmin, async (req, res) => {
  try {
    const Template = (await import("../models/Template.model.js")).default;
    const Website = (await import("../models/Website.model.js")).default;

    const [totalTemplates, activeTemplates, totalWebsites, categoryStats] = await Promise.all([
      Template.countDocuments(),
      Template.countDocuments({ isActive: true }),
      Website.countDocuments(),
      Template.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: "$category", count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ])
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalTemplates,
        activeTemplates,
        inactiveTemplates: totalTemplates - activeTemplates,
        totalWebsites,
        categoryStats
      }
    });
  } catch (error) {
    console.error("Error fetching template stats:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching statistics",
      error: error.message
    });
  }
});

export default router;