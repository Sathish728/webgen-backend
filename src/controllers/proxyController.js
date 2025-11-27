// controllers/proxyController.js
import Website from "../models/Website.model.js";
import Subscription from "../models/Subscription.model.js";

export async function proxyCustomDomain(req, res) {
  try {
    const customDomain = req.headers['x-original-host'] || req.headers.host;
    console.log('🌐 Custom domain request:', customDomain);

    const cleanDomain = customDomain.split(':')[0].toLowerCase().trim();

    // Don't proxy main application domain
    if (cleanDomain === 'webgen.club' || 
        cleanDomain === 'www.webgen.club' || 
        cleanDomain === '54.234.33.110' ||
        cleanDomain === 'localhost') {
      return res.status(404).send('This is the main application domain');
    }

    // Find website by custom domain
    const website = await Website.findOne({
      customDomain: cleanDomain,
      isCustomDomainVerified: true,
      isPublished: true
    }).lean();

    if (!website) {
      console.log('❌ Website not found for domain:', cleanDomain);
      return res.status(404).send(`
        <!DOCTYPE html>
        <html><head><title>Website Not Found</title></head>
        <body style="font-family: Arial; text-align: center; padding: 50px;">
          <h1>🌐 Website Not Found</h1>
          <p>The domain <b>${cleanDomain}</b> is not configured.</p>
        </body></html>
      `);
    }

    // Check subscription
    const now = new Date();
    const subscription = await Subscription.findOne({
      websiteId: website._id,
      status: 'active',
      currentPeriodEnd: { $gt: now }
    }).lean();

    if (!subscription) {
      console.log('❌ No active subscription for domain:', cleanDomain);
      return res.status(403).send(`
        <!DOCTYPE html>
        <html><head><title>Subscription Required</title></head>
        <body style="font-family: Arial; text-align: center; padding: 50px;">
          <h1>⚠️ Subscription Required</h1>
          <p>This website's subscription has expired.</p>
        </body></html>
      `);
    }

    console.log('✅ Serving website:', website.name, 'for domain:', cleanDomain);

    // Increment view count (non-blocking)
    Website.findByIdAndUpdate(
      website._id,
      { $inc: { viewCount: 1 }, lastViewedAt: new Date() }
    ).catch(err => console.error("ViewCount error:", err));

    // Serve HTML
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(website.html);

  } catch (error) {
    console.error("❌ Proxy error:", error);
    res.status(500).send('Server Error');
  }
}