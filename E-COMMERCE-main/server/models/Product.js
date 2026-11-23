import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Product name is required.'],
    trim: true,
    minlength: 2,
    maxlength: 120,
  },
  category: {
    type: String,
    required: [true, 'Product category is required.'],
    enum: ['Fashion', 'Accessories', 'Tech', 'Home'],
  },
  price: { type: Number, required: true, min: 0 },
  oldPrice: { type: Number, min: 0 },
  rating: { type: Number, min: 0, max: 5, default: 0 },
  reviews: { type: Number, min: 0, validate: Number.isInteger, default: 0 },
  tag: { type: String, trim: true, maxlength: 40, default: '' },
  bg: {
    type: String,
    trim: true,
    default: '#e2efff',
    validate: {
      validator: (value) => /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value),
      message: 'bg must be a valid hex color, such as #e2efff.',
    },
  },
  image: { type: String, trim: true, maxlength: 2048, default: '' },
  description: { type: String, required: true, trim: true, maxlength: 1000 },
  stock: { type: Number, required: true, min: 0, validate: Number.isInteger, default: 0 },
}, { timestamps: true, versionKey: false, collection: 'products' });

productSchema.index({ category: 1 });
productSchema.index({ name: 1 });
productSchema.index({ name: 'text', description: 'text' });

export default mongoose.model('Product', productSchema);
