
import mongoose from "mongoose"

const WebsiteSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User", 
    required: [true, 'User ID is required'],
    index: true
  },
  
  templateId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Template", 
    required: [true, 'Template ID is required']
  },
  
  name: { 
    type: String, 
    required: [true, 'Website name is required'],
    trim: true,
    minlength: [3, 'Name must be at least 3 characters'],
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  
  thumbnail: { 
    data: Buffer, 
    contentType: String 
  },
  
  html: { 
    type: String, 
    required: [true, 'HTML content is required']
  },
  
  css: { 
    type: String, 
    default: "" 
  },
  
  js: { 
    type: String, 
    default: "" 
  },
  
  slug: { 
    type: String,
    required: [true, 'Slug is required'],
    trim: true,
    lowercase: true,
    minlength: [3, 'Slug must be at least 3 characters'],
    maxlength: [100, 'Slug cannot exceed 100 characters']
  },
  
  customDomain: { 
    type: String, 
    default: "",
    trim: true,
    lowercase: true,
    sparse: true, // Allows multiple null/empty values
    validate: {
      validator: function(v) {
        if (!v) return true; // Allow empty
        // Validate domain format
        return /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/.test(v);
      },
      message: 'Invalid domain format'
    }
  },
  
  components: { 
    type: Object, 
    default: {} 
  },
  
  isPublished: { 
    type: Boolean, 
    default: false,
    index: true
  },
  
  publishedAt: {
    type: Date,
    default: null
  },
  
  isCustomDomainVerified: {
    type: Boolean,
    default: false,
    index: true
  },
  
  domainVerifiedAt: {
    type: Date,
    default: null
  },
  
  viewCount: {
    type: Number,
    default: 0
  },
  
  lastViewedAt: {
    type: Date,
    default: null
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound indexes for common queries
WebsiteSchema.index({ userId: 1, slug: 1 });
WebsiteSchema.index({ userId: 1, isPublished: 1 });
WebsiteSchema.index({ customDomain: 1, isCustomDomainVerified: 1 });
WebsiteSchema.index({ slug: 1, isPublished: 1 });
WebsiteSchema.index({ createdAt: -1 });
WebsiteSchema.index({ updatedAt: -1 });

// Virtual for public URL
WebsiteSchema.virtual('publicUrl').get(function() {
  if (this.isCustomDomainVerified && this.customDomain) {
    return `https://${this.customDomain}`;
  }
  if (this.slug) {
    return `${process.env.FRONTEND_URL}/site/${this.slug}`;
  }
  return null;
});

// Pre-save middleware to increment template usage count
WebsiteSchema.pre('save', async function(next) {
  if (this.isNew && this.templateId) {
    try {
      await mongoose.model('Template').findByIdAndUpdate(
        this.templateId,
        { $inc: { usageCount: 1 } }
      );
    } catch (error) {
      console.error('Error updating template usage count:', error);
    }
  }
  next();
});

 const Websites = mongoose.model("Website", WebsiteSchema);
 export default Websites