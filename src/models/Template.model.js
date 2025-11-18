import mongoose from "mongoose";

const TemplateSchema = new mongoose.Schema({

    name: { 
    type: String, 
    required: [true, 'Template name is required'],
    trim: true,
    minlength: [3, 'Name must be at least 3 characters'],
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  
  category: {
    type: String,
    enum: ['business', 'portfolio', 'blog', 'ecommerce', 'landing', 'other'],
    default: 'other'
  },
  
  thumbnail: { 
    data: Buffer, 
    contentType: String 
  },
  
  previewJson: {
    html: { type: String, required: true },
    css: { type: String, default: '' },
    js: { type: String, default: '' }
  },
  
  components: {
    type: Object,
    default: {}
  },
  
  isActive: {
    type: Boolean,
    default: true
  },
  
  usageCount: {
    type: Number,
    default: 0
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
TemplateSchema.index({ name: 1 });
TemplateSchema.index({ category: 1 });
TemplateSchema.index({ isActive: 1 });
TemplateSchema.index({ createdAt: -1 });

// Virtual for thumbnail URL (if needed)
TemplateSchema.virtual('thumbnailUrl').get(function() {
  if (this.thumbnail && this.thumbnail.data) {
    return `data:${this.thumbnail.contentType};base64,${this.thumbnail.data.toString('base64')}`;
  }
  return null;
});


const Templates = mongoose.model( "Templates" ,TemplateSchema )
export default Templates