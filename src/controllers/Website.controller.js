// controllers/Website.controller.js - Complete Website Management
import Website from "../models/Website.model.js";
import Template from "../models/Template.model.js";
import Subscription from "../models/Subscription.model.js";
import { validateSlug, generateUniqueSlug } from "../utils/slugUtils.js";
import { sanitizeTailwindHtml } from "../utils/sanitizer.js";

/**
 * Create website from template
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
 * Publish website with subscription check
 * @route PUT /api/templates/websites/:websiteId/publish
 */
export async function publishWebsite(req, res) {
  try {
    const { websiteId } = req.params;
    const { isPublished, slug } = req.body;

    if (!websiteId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid website ID"
      });
    }

    const website = await Website.findById(websiteId);

    if (!website) {
      return res.status(404).json({
        success: false,
        message: "Website not found"
      });
    }

    // ✅ CHECK SUBSCRIPTION STATUS
    const subscription = await Subscription.findOne({
      userId: website.userId,
      websiteId: websiteId,
      status: 'active'
    });

    // If trying to publish, check subscription
    if (isPublished === true) {
      if (!subscription) {
        return res.status(403).json({
          success: false,
          message: "Active subscription required to publish website",
          requiresSubscription: true
        });
      }

      // Check if subscription is valid (not expired or canceled)
      const now = new Date();
      if (subscription.currentPeriodEnd && new Date(subscription.currentPeriodEnd) < now) {
        return res.status(403).json({
          success: false,
          message: "Subscription has expired. Please renew to publish.",
          requiresSubscription: true
        });
      }
    }

    // Update slug if provided and valid
    if (slug && slug !== website.slug) {
      const isValidSlug = validateSlug(slug);
      if (!isValidSlug) {
        return res.status(400).json({
          success: false,
          message: "Invalid slug format. Use only lowercase letters, numbers, and hyphens"
        });
      }

      // Check if slug is already taken
      const existingWebsite = await Website.findOne({ 
        slug, 
        _id: { $ne: websiteId } 
      });

      if (existingWebsite) {
        return res.status(409).json({
          success: false,
          message: "This slug is already taken"
        });
      }

      website.slug = slug;
    }

    // Update publish status
    website.isPublished = isPublished;
    
    if (isPublished) {
      website.publishedAt = new Date();
    } else {
      website.publishedAt = null;
    }

    await website.save();

    res.status(200).json({
      success: true,
      message: isPublished ? "Website published successfully" : "Website unpublished",
      data: {
        websiteId: website._id,
        slug: website.slug,
        isPublished: website.isPublished,
        publishedAt: website.publishedAt,
        publicUrl: website.publicUrl
      }
    });

  } catch (error) {
    console.error("Error publishing website:", error);
    res.status(500).json({
      success: false,
      message: "Error publishing website",
      error: error.message
    });
  }
}

/**
 * Set custom domain with subscription check
 * @route POST /api/templates/websites/:websiteId/custom-domain
 */
export async function setCustomDomain(req, res) {
  try {
    const { websiteId } = req.params;
    const { domain } = req.body;

    if (!websiteId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid website ID"
      });
    }

    if (!domain || typeof domain !== 'string') {
      return res.status(400).json({
        success: false,
        message: "Domain is required"
      });
    }

    // Validate domain format
    const domainRegex = /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/;
    const cleanDomain = domain.toLowerCase().trim();

    if (!domainRegex.test(cleanDomain)) {
      return res.status(400).json({
        success: false,
        message: "Invalid domain format. Use format: example.com"
      });
    }

    const website = await Website.findById(websiteId);

    if (!website) {
      return res.status(404).json({
        success: false,
        message: "Website not found"
      });
    }

    // ✅ CHECK SUBSCRIPTION STATUS
    const subscription = await Subscription.findOne({
      userId: website.userId,
      websiteId: websiteId,
      status: 'active'
    });

    if (!subscription) {
      return res.status(403).json({
        success: false,
        message: "Active subscription required to use custom domain",
        requiresSubscription: true
      });
    }

    // Check if subscription is valid
    const now = new Date();
    if (subscription.currentPeriodEnd && new Date(subscription.currentPeriodEnd) < now) {
      return res.status(403).json({
        success: false,
        message: "Subscription has expired. Please renew to use custom domain.",
        requiresSubscription: true
      });
    }

    // Check if domain is already taken
    const existingWebsite = await Website.findOne({
      customDomain: cleanDomain,
      _id: { $ne: websiteId }
    });

    if (existingWebsite) {
      return res.status(409).json({
        success: false,
        message: "This domain is already in use"
      });
    }

    // Update domain
    website.customDomain = cleanDomain;
    website.isCustomDomainVerified = false; // Reset verification status
    website.domainVerifiedAt = null;

    await website.save();

    res.status(200).json({
      success: true,
      message: "Custom domain set successfully. Please verify your domain.",
      data: {
        websiteId: website._id,
        customDomain: website.customDomain,
        isCustomDomainVerified: website.isCustomDomainVerified,
        dnsRecords: {
          type: 'CNAME',
          name: cleanDomain,
          value: `${website.slug}.yourdomain.com`, // Replace with your actual domain
          ttl: '3600'
        }
      }
    });

  } catch (error) {
    console.error("Error setting custom domain:", error);
    res.status(500).json({
      success: false,
      message: "Error setting custom domain",
      error: error.message
    });
  }
}

/**
 * Verify custom domain
 * @route GET /api/templates/verify-domain/:domain
 */
export async function verifyCustomDomain(req, res) {
  try {
    const { domain } = req.params;
    const { siteid } = req.query;

    if (!siteid || !siteid.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Valid website ID is required"
      });
    }

    const website = await Website.findById(siteid);

    if (!website) {
      return res.status(404).json({
        success: false,
        message: "Website not found"
      });
    }

    if (website.customDomain !== domain.toLowerCase()) {
      return res.status(400).json({
        success: false,
        message: "Domain does not match website's custom domain"
      });
    }

    // ✅ CHECK SUBSCRIPTION STATUS
    const subscription = await Subscription.findOne({
      userId: website.userId,
      websiteId: siteid,
      status: 'active'
    });

    if (!subscription) {
      return res.status(403).json({
        success: false,
        message: "Active subscription required to verify custom domain",
        requiresSubscription: true
      });
    }

    // TODO: Implement actual DNS verification
    // For now, we'll simulate verification
    const dnsVerified = await verifyDNSRecord(domain, website.slug);

    if (dnsVerified) {
      website.isCustomDomainVerified = true;
      website.domainVerifiedAt = new Date();
      await website.save();

      res.status(200).json({
        success: true,
        message: "Domain verified successfully",
        data: {
          domain,
          isVerified: true,
          verifiedAt: website.domainVerifiedAt
        }
      });
    } else {
      res.status(400).json({
        success: false,
        message: "Domain verification failed. Please check your DNS settings.",
        data: {
          domain,
          isVerified: false,
          instructions: "Add a CNAME record pointing to your website's subdomain"
        }
      });
    }

  } catch (error) {
    console.error("Error verifying domain:", error);
    res.status(500).json({
      success: false,
      message: "Error verifying domain",
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
      .select("-thumbnail.data")
      .lean();

    if (!website) {
      return res.status(404).json({
        success: false,
        message: "Website not found"
      });
    }

    // Check subscription status
    const subscription = await Subscription.findOne({
      userId: website.userId,
      websiteId: websiteId,
      status: 'active'
    });

    // Ensure Tailwind CDN in HTML
    website.html = ensureTailwindCDN(website.html);

    res.status(200).json({
      success: true,
      data: {
        ...website,
        hasActiveSubscription: !!subscription,
        subscription: subscription ? {
          status: subscription.status,
          currentPeriodEnd: subscription.currentPeriodEnd,
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd
        } : null
      }
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

    // Get subscription status for each website
    const websiteIds = websites.map(w => w._id);
    const subscriptions = await Subscription.find({
      userId,
      websiteId: { $in: websiteIds },
      status: 'active'
    }).lean();

    const subscriptionMap = {};
    subscriptions.forEach(sub => {
      subscriptionMap[sub.websiteId.toString()] = sub;
    });

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
      hasActiveSubscription: !!subscriptionMap[website._id.toString()],
      subscription: subscriptionMap[website._id.toString()] || null
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

    const updateData = {
      updatedAt: new Date(),
    };

    if (html !== undefined) {
      const sanitizedHtml = sanitizeTailwindHtml(html);
      updateData.html = ensureTailwindCDN(sanitizedHtml);
    }

    if (css !== undefined) {
      updateData.css = "";
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

    // Delete associated subscriptions
    await Subscription.deleteMany({ websiteId });

    res.status(200).json({
      success: true,
      message: "Website and associated subscriptions deleted successfully",
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

// ============================================
// HELPER FUNCTIONS
// ============================================

function ensureTailwindCDN(html) {
  if (!html) return html;

  const tailwindCDN = '<script src="https://cdn.tailwindcss.com"></script>';

  if (html.includes('cdn.tailwindcss.com') || html.includes('tailwind')) {
    return html;
  }

  if (html.includes('</head>')) {
    return html.replace('</head>', `  ${tailwindCDN}\n</head>`);
  } else if (html.includes('<head>')) {
    return html.replace('<head>', `<head>\n  ${tailwindCDN}`);
  } else {
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

/**
 * Verify DNS record (simplified version)
 * In production, use DNS lookup libraries
 */
async function verifyDNSRecord(domain, targetSlug) {
  try {
    // TODO: Implement actual DNS verification using dns.resolve or similar
    // For now, return true for testing
    // In production, check if CNAME points to your platform
    
    // Example implementation:
    // const dns = require('dns').promises;
    // const records = await dns.resolveCname(domain);
    // return records.some(record => record.includes(targetSlug));
    
    return true; // Temporary for testing
  } catch (error) {
    console.error('DNS verification error:', error);
    return false;
  }
}

/**
 * Get published website by slug (PUBLIC ROUTE)
 * @route GET /api/websites/site/:slug
 */
export async function getPublishedWebsiteBySlug(req, res) {
  try {
    const { slug } = req.params;

    if (!slug) {
      return res.status(400).json({
        success: false,
        message: "Slug is required"
      });
    }

    // Find published website by slug
    const website = await Website.findOne({
      slug: slug.toLowerCase().trim(),
      isPublished: true
    })
      .select("name html css js slug customDomain viewCount publishedAt userId")
      .lean();

    if (!website) {
      return res.status(404).json({
        success: false,
        message: "Website not found or not published"
      });
    }

    // Increment view count (non-blocking best practice)
    Website.findByIdAndUpdate(
      website._id,
      {
        $inc: { viewCount: 1 },
        lastViewedAt: new Date()
      }
    ).catch(err => console.error("ViewCount update error:", err));

    // CHECK subscription for THIS WEBSITE (public check)
    const now = new Date();
    const subscription = await Subscription.findOne({
      websiteId: website._id,
      status: 'active',
      currentPeriodEnd: { $gt: now } // still in period
    }).lean();

    const hasActiveSubscription = !!subscription;

    res.status(200).json({
      success: true,
      data: {
        name: website.name,
        html: website.html,
        css: website.css || "",
        js: website.js || "",
        slug: website.slug,
        customDomain: website.customDomain,
        viewCount: (website.viewCount || 0) + 1,
        publishedAt: website.publishedAt,
        hasActiveSubscription,
        subscription: subscription ? {
          subscriptionId: subscription.subscriptionId,
          status: subscription.status,
          currentPeriodEnd: subscription.currentPeriodEnd,
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd
        } : null
      }
    });

  } catch (error) {
    console.error("Error fetching published website:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching website",
      error: error.message
    });
  }
}

/**
 * Get published website by custom domain (PUBLIC ROUTE)
 * @route GET /api/websites/domain/:domain
 */
export async function getPublishedWebsiteByDomain(req, res) {
  try {
    const { domain } = req.params;

    if (!domain) {
      return res.status(400).json({
        success: false,
        message: "Domain is required"
      });
    }

    const cleanDomain = domain.toLowerCase().trim();

    // Find published website by custom domain
    const website = await Website.findOne({
      customDomain: cleanDomain,
      isCustomDomainVerified: true,
      isPublished: true
    })
      .select("name html css js slug customDomain viewCount publishedAt")
      .lean();

    if (!website) {
      return res.status(404).json({
        success: false,
        message: "Website not found or domain not verified"
      });
    }

    // Increment view count
    await Website.findByIdAndUpdate(
      website._id,
      {
        $inc: { viewCount: 1 },
        lastViewedAt: new Date()
      }
    );

    res.status(200).json({
      success: true,
      data: {
        name: website.name,
        html: website.html,
        css: website.css || "",
        js: website.js || "",
        slug: website.slug,
        customDomain: website.customDomain,
        viewCount: website.viewCount + 1,
        publishedAt: website.publishedAt
      }
    });

  } catch (error) {
    console.error("Error fetching published website:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching website",
      error: error.message
    });
  }
}