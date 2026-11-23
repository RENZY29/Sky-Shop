import mongoose from 'mongoose';

const savedAddressSchema = new mongoose.Schema({
  addressLine1: { type: String, trim: true, maxlength: 200, default: '' },
  addressLine2: { type: String, trim: true, maxlength: 200, default: '' },
  city: { type: String, trim: true, maxlength: 100, default: '' },
  province: { type: String, trim: true, maxlength: 100, default: '' },
  postalCode: { type: String, trim: true, maxlength: 20, default: '' },
  country: { type: String, trim: true, maxlength: 100, default: 'Philippines' },
}, { _id: false });

const userSchema = new mongoose.Schema({
  firstName: { type: String, required: true, trim: true, minlength: 1, maxlength: 80 },
  lastName: { type: String, required: true, trim: true, minlength: 1, maxlength: 80 },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    maxlength: 254,
    match: [/^\S+@\S+\.\S+$/, 'Enter a valid email address.'],
  },
  passwordHash: { type: String, required: true, select: false, minlength: 20 },
  phone: { type: String, trim: true, maxlength: 30, default: '' },
  shippingAddress: { type: savedAddressSchema, default: () => ({}) },
  role: { type: String, enum: ['customer', 'admin'], default: 'customer', required: true },
  isActive: { type: Boolean, default: true },
}, { timestamps: true, versionKey: false, collection: 'users' });

userSchema.index({ email: 1 }, { unique: true });
userSchema.set('toJSON', {
  transform(_doc, ret) {
    delete ret.passwordHash;
    return ret;
  },
});

export default mongoose.model('User', userSchema);
