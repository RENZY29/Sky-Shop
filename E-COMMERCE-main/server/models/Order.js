import mongoose from 'mongoose';

const customerSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 160 },
  email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254, match: [/^\S+@\S+\.\S+$/, 'Enter a valid customer email.'] },
  phone: { type: String, trim: true, maxlength: 30, default: '' },
}, { _id: false });

const shippingAddressSchema = new mongoose.Schema({
  addressLine1: { type: String, required: true, trim: true, maxlength: 200 },
  addressLine2: { type: String, trim: true, maxlength: 200, default: '' },
  city: { type: String, required: true, trim: true, maxlength: 100 },
  province: { type: String, required: true, trim: true, maxlength: 100 },
  postalCode: { type: String, required: true, trim: true, maxlength: 20 },
  country: { type: String, required: true, trim: true, maxlength: 100, default: 'Philippines' },
}, { _id: false });

const orderItemSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  price: { type: Number, required: true, min: 0 },
  quantity: { type: Number, required: true, min: 1, validate: Number.isInteger },
  image: { type: String, trim: true, maxlength: 2048, default: '' },
}, { _id: false });

const orderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  customer: { type: customerSchema, required: true },
  shippingAddress: { type: shippingAddressSchema, required: true },
  items: {
    type: [orderItemSchema],
    required: true,
    validate: { validator: (items) => Array.isArray(items) && items.length > 0, message: 'An order must contain at least one item.' },
  },
  subtotal: { type: Number, min: 0, required: true, default: 0 },
  couponCode: { type: String, trim: true, uppercase: true, maxlength: 32, default: '' },
  discount: { type: Number, min: 0, required: true, default: 0 },
  shippingFee: { type: Number, min: 0, required: true, default: 0 },
  total: { type: Number, min: 0, required: true, default: 0 },
  paymentMethod: { type: String, enum: ['cash_on_delivery', 'bank_transfer', 'e_wallet'], required: true, default: 'cash_on_delivery' },
  status: { type: String, enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'], required: true, default: 'pending' },
  notes: { type: String, trim: true, maxlength: 1000, default: '' },
}, { timestamps: true, versionKey: false, collection: 'orders' });

orderSchema.pre('validate', function calculateTotals() {
  const subtotal = this.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const threshold = Number(process.env.SHIPPING_FREE_THRESHOLD ?? 1500);
  const fee = Number(process.env.SHIPPING_FEE ?? 100);
  this.subtotal = subtotal;
  this.shippingFee = subtotal === 0 || subtotal >= threshold ? 0 : fee;
  this.discount = Math.min(this.subtotal, this.discount || 0);
  this.total = Math.max(0, this.subtotal - this.discount) + this.shippingFee;
});

orderSchema.index({ userId: 1, createdAt: -1 });
orderSchema.index({ status: 1 });
orderSchema.index({ createdAt: -1 });
export default mongoose.model('Order', orderSchema);
