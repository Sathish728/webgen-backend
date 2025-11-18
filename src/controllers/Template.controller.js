// controllers/Template.controller.js - Complete with Add Template Function
import Template from "../models/Template.model.js";
import Website from "../models/Website.model.js";
import { validateSlug, generateUniqueSlug } from "../utils/slugUtils.js";
import { sanitizeHtml, sanitizeTailwindHtml } from "../utils/sanitizer.js";

/**
 * Get all templates with pagination and filtering
 * @route GET /api/templates/get-templates
 */

export async function getAllTemplates(req, res) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const filter = { isActive: true };
    if (req.query.category) {
      filter.category = req.query.category;
    }

    const [templates, total] = await Promise.all([
      Template.find(filter)
        .select("name thumbnail category createdAt usageCount previewJson") // ✅ Include previewJson
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Template.countDocuments(filter)
    ]);

    // ✅ FIX: Return complete template data for preview
    const templatesWithImages = templates.map(template => ({
      _id: template._id,
      name: template.name,
      category: template.category,
      thumbnail: template.thumbnail?.data
        ? `data:${template.thumbnail.contentType};base64,${template.thumbnail.data.toString("base64")}`
        : null,
      usageCount: template.usageCount || 0,
      createdAt: template.createdAt,
      // ✅ ADD: Include template content for preview
      content: {
        html: template.previewJson?.html || '',
        css: template.previewJson?.css || '',
        js: template.previewJson?.js || ''
      }
    }));

    res.status(200).json({
      success: true,
      data: templatesWithImages,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: limit,
      }
    });
  } catch (error) {
    console.error("Error fetching templates:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching templates",
      error: error.message
    });
  }
}

/**
 * Get a single template by ID
 * @route GET /api/templates/get-templates/:id
 */
export async function getTemplateById(req, res) {
  try {
    const { id } = req.params;

    // Validate MongoDB ObjectId
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid template ID"
      });
    }

    const template = await Template.findById(id).lean();

    if (!template) {
      return res.status(404).json({
        success: false,
        message: "Template not found"
      });
    }

    // Ensure template uses Tailwind CSS
    const htmlWithTailwind = ensureTailwindCDN(template.previewJson.html);

    const templateWithImage = {
      _id: template._id,
      name: template.name,
      thumbnail: template.thumbnail?.data
        ? `data:${template.thumbnail.contentType};base64,${template.thumbnail.data.toString("base64")}`
        : null,
      previewJson: {
        html: htmlWithTailwind,
        css: "", // No external CSS, only Tailwind
        js: template.previewJson.js || ""
      },
      components: template.components || {},
      category: template.category,
      usageCount: template.usageCount || 0,
      createdAt: template.createdAt,
    };

    res.status(200).json({
      success: true,
      data: templateWithImage
    });
  } catch (error) {
    console.error("Error fetching template:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching template",
      error: error.message
    });
  }
}

/**
 * Add new template (Admin only)
 * @route POST /api/templates/add-template
 */
export async function addTemplate(req, res) {
  try {
    const { name, html, js, category, thumbnail } = req.body;

    // Validation
    if (!name || !html) {
      return res.status(400).json({
        success: false,
        message: "Name and HTML are required"
      });
    }

    // Validate category
    const validCategories = ['business', 'portfolio', 'blog', 'ecommerce', 'landing', 'other'];
    const templateCategory = category && validCategories.includes(category) ? category : 'other';

    // Sanitize and ensure Tailwind
    const sanitizedHtml = sanitizeTailwindHtml(html);
    const htmlWithTailwind = ensureTailwindCDN(sanitizedHtml);

    // Handle thumbnail (base64 or file buffer)
    let thumbnailData = null;
    if (thumbnail) {
      if (thumbnail.startsWith('data:image')) {
        // Base64 image
        const matches = thumbnail.match(/^data:(.+);base64,(.+)$/);
        if (matches) {
          thumbnailData = {
            data: Buffer.from(matches[2], 'base64'),
            contentType: matches[1]
          };
        }
      }
    }

    // Create new template
    const newTemplate = new Template({
      name: name.trim(),
      category: templateCategory,
      thumbnail: thumbnailData,
      previewJson: {
        html: htmlWithTailwind,
        css: "", // No external CSS
        js: js || ""
      },
      components: {},
      isActive: true,
      usageCount: 0
    });

    const savedTemplate = await newTemplate.save();

    res.status(201).json({
      success: true,
      message: "Template created successfully",
      data: {
        templateId: savedTemplate._id,
        name: savedTemplate.name,
        category: savedTemplate.category
      }
    });

  } catch (error) {
    console.error("Error adding template:", error);

    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: Object.values(error.errors).map(e => e.message)
      });
    }

    res.status(500).json({
      success: false,
      message: "Error adding template",
      error: error.message
    });
  }
}

/**
 * Update existing template (Admin only)
 * @route PUT /api/templates/update-template/:id
 */
export async function updateTemplateAdmin(req, res) {
  try {
    const { id } = req.params;
    const { name, html, js, category, isActive, thumbnail } = req.body;

    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid template ID"
      });
    }

    const template = await Template.findById(id);

    if (!template) {
      return res.status(404).json({
        success: false,
        message: "Template not found"
      });
    }

    // Update fields if provided
    if (name) template.name = name.trim();
    if (category) template.category = category;
    if (isActive !== undefined) template.isActive = isActive;

    if (html) {
      const sanitizedHtml = sanitizeTailwindHtml(html);
      template.previewJson.html = ensureTailwindCDN(sanitizedHtml);
      template.previewJson.css = ""; // Always empty for Tailwind
    }

    if (js !== undefined) {
      template.previewJson.js = js;
    }

    // Update thumbnail if provided
    if (thumbnail && thumbnail.startsWith('data:image')) {
      const matches = thumbnail.match(/^data:(.+);base64,(.+)$/);
      if (matches) {
        template.thumbnail = {
          data: Buffer.from(matches[2], 'base64'),
          contentType: matches[1]
        };
      }
    }

    await template.save();

    res.status(200).json({
      success: true,
      message: "Template updated successfully",
      data: {
        templateId: template._id,
        name: template.name
      }
    });

  } catch (error) {
    console.error("Error updating template:", error);
    res.status(500).json({
      success: false,
      message: "Error updating template",
      error: error.message
    });
  }
}

/**
 * Delete template (Admin only)
 * @route DELETE /api/templates/delete-template/:id
 */
export async function deleteTemplate(req, res) {
  try {
    const { id } = req.params;

    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid template ID"
      });
    }

    // Check if template is being used
    const websiteCount = await Website.countDocuments({ templateId: id });

    if (websiteCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete template. It is being used by ${websiteCount} website(s)`,
        websiteCount
      });
    }

    const deletedTemplate = await Template.findByIdAndDelete(id);

    if (!deletedTemplate) {
      return res.status(404).json({
        success: false,
        message: "Template not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Template deleted successfully",
      data: { templateId: id }
    });

  } catch (error) {
    console.error("Error deleting template:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting template",
      error: error.message
    });
  }
}

/**
 * Create website from existing template
 * @route POST /api/templates/create-website
 */
export async function createWebsite(req, res) {
  try {
    const { userId, templateId, customName } = req.body;

    // Validation
    if (!userId || !templateId) {
      return res.status(400).json({
        success: false,
        message: "userId and templateId are required"
      });
    }

    // Validate MongoDB ObjectIds
    if (!userId.match(/^[0-9a-fA-F]{24}$/) || !templateId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid userId or templateId"
      });
    }

    const template = await Template.findById(templateId).lean();

    if (!template) {
      return res.status(404).json({
        success: false,
        message: "Template not found"
      });
    }

    if (!template.isActive) {
      return res.status(400).json({
        success: false,
        message: "This template is not available"
      });
    }

    // Sanitize HTML with Tailwind classes only
    const sanitizedHtml = sanitizeTailwindHtml(template.previewJson.html);
    const htmlWithTailwind = ensureTailwindCDN(sanitizedHtml);

    // Generate unique slug
    const baseName = customName || template.name;
    const slug = await generateUniqueSlug(baseName, userId);

    const newWebsite = new Website({
      userId,
      templateId,
      name: baseName,
      thumbnail: template.thumbnail,
      html: htmlWithTailwind,
      css: "", // No external CSS for Tailwind templates
      js: template.previewJson.js || "",
      components: template.components || {},
      slug,
      isPublished: false,
    });

    const savedWebsite = await newWebsite.save();

    // Increment template usage count
    await Template.findByIdAndUpdate(templateId, {
      $inc: { usageCount: 1 }
    });

    res.status(201).json({
      success: true,
      message: "Website created successfully",
      data: {
        websiteId: savedWebsite._id,
        slug: savedWebsite.slug,
        name: savedWebsite.name,
      }
    });
  } catch (error) {
    console.error("Error creating website:", error);

    // Handle duplicate key error
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "A website with this slug already exists"
      });
    }

    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
}

/**
 * Get website by ID for editing
 * @route GET /api/templates/website/:websiteId
 */
export async function getWebsiteEdit(req, res) {
  try {
    const { websiteId } = req.params;

    if (!websiteId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid website ID"
      });
    }

    const website = await Website.findById(websiteId)
      .select("-thumbnail.data") // Exclude large binary data
      .lean();

    if (!website) {
      return res.status(404).json({
        success: false,
        message: "Website not found"
      });
    }

    // Ensure Tailwind CDN in HTML
    website.html = ensureTailwindCDN(website.html);

    res.status(200).json({
      success: true,
      data: website
    });
  } catch (error) {
    console.error("Error fetching website:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching website",
      error: error.message
    });
  }
}

/**
 * Get all websites for a user
 * @route GET /api/templates/website-list/:userId
 */
export async function getWebsiteList(req, res) {
  try {
    const { userId } = req.params;

    if (!userId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID"
      });
    }

    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const [websites, total] = await Promise.all([
      Website.find({ userId })
        .select("name thumbnail customDomain isPublished slug isCustomDomainVerified createdAt updatedAt viewCount")
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Website.countDocuments({ userId })
    ]);

    const websitesWithImages = websites.map(website => ({
      _id: website._id,
      name: website.name,
      thumbnail: website.thumbnail?.data
        ? `data:${website.thumbnail.contentType};base64,${website.thumbnail.data.toString("base64")}`
        : null,
      customDomain: website.customDomain,
      isPublished: website.isPublished,
      slug: website.slug,
      isCustomDomainVerified: website.isCustomDomainVerified,
      viewCount: website.viewCount || 0,
      createdAt: website.createdAt,
      updatedAt: website.updatedAt,
    }));

    res.status(200).json({
      success: true,
      data: websitesWithImages,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
      }
    });
  } catch (error) {
    console.error("Error fetching websites:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching websites",
      error: error.message
    });
  }
}

/**
 * Delete website by ID
 * @route DELETE /api/templates/delete-website/:websiteId
 */
export async function deleteWebsite(req, res) {
  try {
    const { websiteId } = req.params;

    if (!websiteId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid website ID"
      });
    }

    const deletedWebsite = await Website.findByIdAndDelete(websiteId);

    if (!deletedWebsite) {
      return res.status(404).json({
        success: false,
        message: "Website not found"
      });
    }

    // Decrement template usage count
    if (deletedWebsite.templateId) {
      await Template.findByIdAndUpdate(deletedWebsite.templateId, {
        $inc: { usageCount: -1 }
      });
    }

    // TODO: Also delete associated subscriptions
    // await Subscription.deleteMany({ websiteId });

    res.status(200).json({
      success: true,
      message: "Website deleted successfully",
      data: { websiteId }
    });
  } catch (error) {
    console.error("Error deleting website:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting website",
      error: error.message
    });
  }
}

/**
 * Update website template (HTML/CSS/JS)
 * @route PUT /api/templates/update/:websiteId
 */
export async function updateTemplate(req, res) {
  try {
    const { websiteId } = req.params;
    const { html, css, js, components, name } = req.body;

    if (!websiteId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid website ID"
      });
    }

    // Build update object with only provided fields
    const updateData = {
      updatedAt: new Date(),
    };

    if (html !== undefined) {
      const sanitizedHtml = sanitizeTailwindHtml(html);
      updateData.html = ensureTailwindCDN(sanitizedHtml);
    }

    // CSS should remain empty for Tailwind templates
    if (css !== undefined) {
      updateData.css = ""; // Force empty CSS
    }

    if (js !== undefined) updateData.js = js;
    if (components !== undefined) updateData.components = components;
    if (name !== undefined) updateData.name = name;

    const updatedWebsite = await Website.findByIdAndUpdate(
      websiteId,
      updateData,
      { new: true, runValidators: true }
    ).select("-thumbnail.data");

    if (!updatedWebsite) {
      return res.status(404).json({
        success: false,
        message: "Website not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Website updated successfully",
      data: updatedWebsite
    });
  } catch (error) {
    console.error("Error updating website:", error);
    res.status(500).json({
      success: false,
      message: "Error updating website",
      error: error.message
    });
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Ensure Tailwind CDN is included in HTML
 * @param {string} html - HTML content
 * @returns {string} - HTML with Tailwind CDN
 */
function ensureTailwindCDN(html) {
  if (!html) return html;

  const tailwindCDN = '<script src="https://cdn.tailwindcss.com"></script>';

  // Check if Tailwind is already included
  if (html.includes('cdn.tailwindcss.com') || html.includes('tailwind')) {
    return html;
  }

  // Add Tailwind CDN before </head> or at the start
  if (html.includes('</head>')) {
    return html.replace('</head>', `  ${tailwindCDN}\n</head>`);
  } else if (html.includes('<head>')) {
    return html.replace('<head>', `<head>\n  ${tailwindCDN}`);
  } else {
    // No head tag, wrap content
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${tailwindCDN}
</head>
<body>
  ${html}
</body>
</html>`;
  }
}