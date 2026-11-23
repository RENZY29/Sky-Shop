import mongoose from 'mongoose';

const cartItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
    validate: { validator: Number.isInteger, message: 'Quantity must be a whole number.' },
  },
  addedAt: { type: Date, default: Date.now },
}, { _id: false });

const cartSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  items: { type: [cartItemSchema], default: [] },
}, { timestamps: true, versionKey: false, collection: 'carts' });

cartSchema.index({ userId: 1 }, { unique: true });
export default mongoose.model('Cart', cartSchema);
