import mongoose from 'mongoose';
import User from '../models/User.js';
import Product from '../models/Product.js';
import Cart from '../models/Cart.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const httpError = (message, statusCode) => Object.assign(new Error(message), { statusCode });

async function normalizeItems(items) {
  if (!Array.isArray(items)) throw httpError('items must be an array.', 400);
  const quantities = new Map();
  for (const item of items) {
    if (!item || !mongoose.isValidObjectId(item.productId)) throw httpError('Every cart item requires a valid productId.', 400);
    if (!Number.isInteger(item.quantity) || item.quantity < 1) throw httpError('Item quantity must be a positive whole number.', 400);
    const key = String(item.productId);
    quantities.set(key, (quantities.get(key) || 0) + item.quantity);
  }

  const normalized = [];
  for (const [id, quantity] of quantities) {
    const product = await Product.findById(id).select('stock name');
    if (!product) throw httpError(`Product not found: ${id}`, 404);
    if (quantity > product.stock) throw httpError(`Only ${product.stock} unit(s) of ${product.name} are in stock.`, 409);
    normalized.push({ productId: product._id, quantity, addedAt: new Date() });
  }
  return normalized;
}

export const getMyCart = asyncHandler(async (req, res) => {
  const cart = await Cart.findOne({ userId: req.user._id }).populate('items.productId');
  res.json({ success: true, data: cart || { userId: req.user._id, items: [] } });
});

// PUT replaces the user's cart contents; it creates the cart if none exists.
export const replaceMyCart = asyncHandler(async (req, res) => {
  const items = await normalizeItems(req.body?.items ?? []);
  const cart = await Cart.findOneAndUpdate(
    { userId: req.user._id },
    { $set: { items } },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
  ).populate('items.productId');
  res.json({ success: true, message: 'Cart saved.', data: cart });
});

export const setCartItemQuantity = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const quantity = req.body?.quantity;
  if (!mongoose.isValidObjectId(productId)) throw httpError('Invalid product ID.', 400);
  if (!Number.isInteger(quantity) || quantity < 0) throw httpError('quantity must be a non-negative whole number.', 400);

  const product = await Product.findById(productId).select('stock name');
  if (!product) throw httpError('Product not found.', 404);
  if (quantity > product.stock) throw httpError(`Only ${product.stock} unit(s) of ${product.name} are in stock.`, 409);

  let cart = await Cart.findOne({ userId: req.user._id });
  if (!cart && quantity === 0) return res.json({ success: true, message: 'Nothing to remove; cart is empty.', data: { userId: req.user._id, items: [] } });
  if (!cart) cart = new Cart({ userId: req.user._id, items: [] });

  const existing = cart.items.find((item) => String(item.productId) === String(product._id));
  if (quantity === 0) {
    cart.items = cart.items.filter((item) => String(item.productId) !== String(product._id));
  } else if (existing) {
    existing.quantity = quantity;
  } else {
    cart.items.push({ productId: product._id, quantity, addedAt: new Date() });
  }
  await cart.save();
  await cart.populate('items.productId');
  res.json({ success: true, message: quantity === 0 ? 'Item removed from cart.' : 'Cart item updated.', data: cart });
});

export const removeCartItem = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.productId)) throw httpError('Invalid product ID.', 400);
  const cart = await Cart.findOne({ userId: req.user._id });
  if (!cart) throw httpError('Cart not found.', 404);
  cart.items = cart.items.filter((item) => String(item.productId) !== req.params.productId);
  await cart.save();
  await cart.populate('items.productId');
  res.json({ success: true, message: 'Item removed from cart.', data: cart });
});

export const clearMyCart = asyncHandler(async (req, res) => {
  const cart = await Cart.findOneAndUpdate({ userId: req.user._id }, { $set: { items: [] } }, { new: true });
  res.json({ success: true, message: 'Cart cleared.', data: cart || { userId: req.user._id, items: [] } });
});

export const getAllCarts = asyncHandler(async (_req, res) => {
  const carts = await Cart.find().sort({ updatedAt: -1 }).populate('userId', 'firstName lastName email').populate('items.productId', 'name price image stock');
  res.json({ success: true, count: carts.length, data: carts });
});

export const getCartById = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw httpError('Invalid cart ID.', 400);
  const cart = await Cart.findById(req.params.id).populate('userId', 'firstName lastName email').populate('items.productId');
  if (!cart) throw httpError('Cart not found.', 404);
  res.json({ success: true, data: cart });
});

export const deleteCartById = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw httpError('Invalid cart ID.', 400);
  const cart = await Cart.findByIdAndDelete(req.params.id);
  if (!cart) throw httpError('Cart not found.', 404);
  res.json({ success: true, message: 'Cart deleted.', data: { _id: cart._id } });
});
