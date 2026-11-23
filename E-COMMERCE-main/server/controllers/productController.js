import mongoose from 'mongoose';
import Product from '../models/Product.js';
import Cart from '../models/Cart.js';
import Order from '../models/Order.js';
import Review from '../models/Review.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const productFields = ['name', 'category', 'price', 'oldPrice', 'rating', 'reviews', 'tag', 'bg', 'image', 'description', 'stock'];
const pickProductFields = (body = {}) => Object.fromEntries(productFields.filter((field) => Object.hasOwn(body, field)).map((field) => [field, body[field]]));
const httpError = (message, statusCode) => Object.assign(new Error(message), { statusCode });
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function attachReviewStats(products) {
  if (!products.length) return products;
  const stats = await Review.aggregate([
    { $match: { productId: { $in: products.map((product) => product._id) } } },
    { $group: { _id: '$productId', rating: { $avg: '$rating' }, reviews: { $sum: 1 } } },
  ]);
  const byProduct = new Map(stats.map((entry) => [String(entry._id), entry]));
  return products.map((product) => {
    const result = byProduct.get(String(product._id));
    return { ...product, rating: result ? Math.round(result.rating * 10) / 10 : 0, reviews: result?.reviews || 0 };
  });
}

export const getProducts = asyncHandler(async (req, res) => {
  const { category, search = '', sort = 'newest' } = req.query;
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
  const filter = {};

  if (category && category !== 'All') {
    if (!['Fashion', 'Accessories', 'Tech', 'Home'].includes(category)) throw httpError('Invalid category filter.', 400);
    filter.category = category;
  }
  if (String(search).trim()) {
    const pattern = new RegExp(escapeRegex(String(search).trim()), 'i');
    filter.$or = [{ name: pattern }, { description: pattern }, { category: pattern }];
  }
  if (req.query.minPrice !== undefined || req.query.maxPrice !== undefined) {
    filter.price = {};
    if (req.query.minPrice !== undefined) {
      const value = Number(req.query.minPrice);
      if (!Number.isFinite(value) || value < 0) throw httpError('minPrice must be a non-negative number.', 400);
      filter.price.$gte = value;
    }
    if (req.query.maxPrice !== undefined) {
      const value = Number(req.query.maxPrice);
      if (!Number.isFinite(value) || value < 0) throw httpError('maxPrice must be a non-negative number.', 400);
      filter.price.$lte = value;
    }
    if (filter.price.$gte !== undefined && filter.price.$lte !== undefined && filter.price.$gte > filter.price.$lte) throw httpError('minPrice cannot exceed maxPrice.', 400);
  }

  const sortOptions = {
    newest: { createdAt: -1 },
    featured: { name: 1 },
    'price-asc': { price: 1 },
    'price-desc': { price: -1 },
    rating: { name: 1 },
    name: { name: 1 },
  };
  if (!sortOptions[sort]) throw httpError('Invalid sort option.', 400);

  let data;
  let total;
  if (sort === 'featured' || sort === 'rating') {
    const products = await Product.find(filter).lean();
    const ratedProducts = await attachReviewStats(products);
    ratedProducts.sort((a, b) => b.rating - a.rating || b.reviews - a.reviews || a.name.localeCompare(b.name));
    total = ratedProducts.length;
    data = ratedProducts.slice((page - 1) * limit, page * limit);
  } else {
    const [products, count] = await Promise.all([
      Product.find(filter).sort(sortOptions[sort]).skip((page - 1) * limit).limit(limit).lean(),
      Product.countDocuments(filter),
    ]);
    total = count;
    data = await attachReviewStats(products);
  }
  res.json({ success: true, data, pagination: { total, page, limit, pages: Math.ceil(total / limit) } });
});

export const getProductById = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw httpError('Invalid product ID.', 400);
  let product = await Product.findById(req.params.id).lean();
  if (!product) throw httpError('Product not found.', 404);
  [product] = await attachReviewStats([product]);
  res.json({ success: true, data: product });
});

export const createProduct = asyncHandler(async (req, res) => {
  const payload = pickProductFields(req.body);
  const product = await Product.create(payload);
  res.status(201).json({ success: true, message: 'Product created.', data: product });
});

export const updateProduct = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw httpError('Invalid product ID.', 400);
  const changes = pickProductFields(req.body);
  if (!Object.keys(changes).length) throw httpError('Provide at least one supported product field.', 400);
  const product = await Product.findByIdAndUpdate(req.params.id, changes, { new: true, runValidators: true, context: 'query' });
  if (!product) throw httpError('Product not found.', 404);
  res.json({ success: true, message: 'Product updated.', data: product });
});

export const deleteProduct = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw httpError('Invalid product ID.', 400);
  const productId = new mongoose.Types.ObjectId(req.params.id);
  if (await Order.exists({ 'items.productId': productId })) {
    throw httpError('This product appears in an order history and cannot be deleted. Set its stock to 0 instead.', 409);
  }
  const product = await Product.findByIdAndDelete(productId);
  if (!product) throw httpError('Product not found.', 404);
  await Cart.updateMany({}, { $pull: { items: { productId } } });
  res.json({ success: true, message: 'Product deleted and removed from carts.', data: { _id: product._id } });
});
