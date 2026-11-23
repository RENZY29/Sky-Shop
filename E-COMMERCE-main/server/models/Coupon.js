import mongoose from 'mongoose';

const couponSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    trim: true,
    uppercase: true,
    minlength: 3,
    maxlength: 32,
    match: [/^[A-Z0-9_-]+$/, 'Coupon codes may use letters, numbers, hyphens, and underscores.'],
  },
  type: { type: String, enum: ['percentage', 'fixed'], required: true },
  value: { type: Number, required: true, min: 0.01 },
  minimumSubtotal: { type: Number, min: 0, default: 0 },
  maxDiscount: { type: Number, min: 0, default: null },
  usageLimit: { type: Number, min: 1, validate: Number.isInteger, default: null },
  usageCount: { type: Number, min: 0, validate: Number.isInteger, default: 0 },
  startsAt: { type: Date, default: null },
  expiresAt: { type: Date, default: null },
  active: { type: Boolean, default: true },
}, { timestamps: true, versionKey: false, collection: 'coupons' });

couponSchema.index({ code: 1 }, { unique: true });
couponSchema.pre('validate', function validateDateRange() {
  if (this.startsAt && this.expiresAt && this.expiresAt <= this.startsAt) {
    this.invalidate('expiresAt', 'Expiry must be later than the start date.');
  }
  if (this.type === 'percentage' && this.value > 100) {
    this.invalidate('value', 'Percentage discounts cannot exceed 100%.');
  }
});

export default mongoose.model('Coupon', couponSchema);
