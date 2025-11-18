
// models/Subscription.js - Improved Subscription Model
import mongoose from 'mongoose'

const SubscriptionSchema = new mongoose.Schema({
  email: {  
    type: String, 
    required: [true, 'Email is required'],
    trim: true,
    lowercase: true,
    validate: {
      validator: function(v) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
      },
      message: 'Invalid email format'
    }
  },
  
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User",
    required: [true, 'User ID is required'],
    index: true
  },
  
  productId: {
    type: String, 
    required: [true, 'Product ID is required']
  },
  
  websiteId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Website",
    required: [true, 'Website ID is required'],
    index: true
  },
  
  subscriptionId: { 
    type: String, 
    required: [true, 'Stripe subscription ID is required'],
    unique: true,
    index: true
  },
  
  status: { 
    type: String, 
    enum: ['active', 'canceled', 'incomplete', 'past_due', 'unpaid', 'trialing'],
    default: 'incomplete',
    index: true
  },
  
  startDate: { 
    type: Date, 
    required: [true, 'Start date is required']
  },
  
  currentPeriodEnd: {
    type: Date,
    required: [true, 'Current period end is required'],
    index: true
  },
  
  canceledAt: {
    type: Date,
    default: null
  },
  
  cancelAtPeriodEnd: {
    type: Boolean,
    default: false
  },
  
  trialEnd: {
    type: Date,
    default: null
  },
  
  metadata: {
    type: Object,
    default: {}
  }
}, {
  timestamps: true
});

// Compound indexes for common queries
SubscriptionSchema.index({ userId: 1, websiteId: 1 });
SubscriptionSchema.index({ userId: 1, status: 1 });
SubscriptionSchema.index({ websiteId: 1, status: 1 });
SubscriptionSchema.index({ status: 1, currentPeriodEnd: 1 });

// Check if subscription is currently active
SubscriptionSchema.methods.isActive = function() {
  return (
    this.status === 'active' && 
    this.currentPeriodEnd > new Date()
  );
};

// Check if subscription will renew
SubscriptionSchema.methods.willRenew = function() {
  return (
    this.status === 'active' && 
    !this.cancelAtPeriodEnd
  );
};

const SubscriptionModel= mongoose.model('Subscription', SubscriptionSchema);
export default SubscriptionModel
