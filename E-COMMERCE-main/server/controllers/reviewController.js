import mongoose from 'mongoose';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import Review from '../models/Review.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const httpError = (message, statusCode) => Object.assign(new Error(message), { statusCode });

export const getMyReviews = asyncHandler(async (req, res) => {
  const data = await Review.find({ userId: req.user._id }).select('orderId productId rating comment').lean();
  res.json({ success: true, data });
});

export const getProductReviews = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.productId)) throw httpError('Invalid product ID.', 400);
  const data = await Review.find({ productId: req.params.productId })
    .sort({ createdAt: -1 }).limit(12)
    .populate('userId', 'firstName lastName').lean();
  res.json({ success: true, data });
});

export const saveReview = asyncHandler(async (req, res) => {
  const { orderId, productId, rating, comment } = req.body || {};
  if (!mongoose.isValidObjectId(orderId) || !mongoose.isValidObjectId(productId)) throw httpError('A valid order and product are required.', 400);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw httpError('Choose a rating from 1 to 5 stars.', 400);
  if (typeof comment !== 'string' || comment.trim().length < 2 || comment.trim().length > 1000) throw httpError('Write a review between 2 and 1,000 characters.', 400);

  const [order, product] = await Promise.all([
    Order.findOne({ _id: orderId, userId: req.user._id, status: 'delivered', 'items.productId': productId }).select('_id'),
    Product.exists({ _id: productId }),
  ]);
  if (!order) throw httpError('You can review this product after its order is delivered.', 403);
  if (!product) throw httpError('This product is no longer available.', 404);

  const data = await Review.findOneAndUpdate(
    { orderId, productId, userId: req.user._id },
    { $set: { rating, comment: comment.trim() } },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
  ).populate('userId', 'firstName lastName');
  res.json({ success: true, message: 'Your review has been saved.', data });
});
