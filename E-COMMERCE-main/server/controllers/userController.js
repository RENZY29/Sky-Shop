import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Cart from '../models/Cart.js';
import Order from '../models/Order.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const httpError = (message, statusCode) => Object.assign(new Error(message), { statusCode });
const fields = ['firstName', 'lastName', 'email', 'phone', 'role', 'isActive'];
const pickFields = (body = {}) => Object.fromEntries(fields.filter((field) => Object.hasOwn(body, field)).map((field) => [field, body[field]]));

export const getUsers = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
  const search = String(req.query.search || '').trim();
  const filter = search ? { $or: [
    { firstName: new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
    { lastName: new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
    { email: new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
  ] } : {};
  const [data, total] = await Promise.all([
    User.find(filter).select('-passwordHash').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    User.countDocuments(filter),
  ]);
  res.json({ success: true, data, pagination: { total, page, limit, pages: Math.ceil(total / limit) } });
});

export const getUserById = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw httpError('Invalid user ID.', 400);
  const user = await User.findById(req.params.id).select('-passwordHash').lean();
  if (!user) throw httpError('User not found.', 404);
  res.json({ success: true, data: user });
});

// Admin-created accounts accept a temporary password; only its bcrypt hash is stored.
export const createUser = asyncHandler(async (req, res) => {
  const { password, ...rest } = req.body || {};
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) throw httpError('Password must be between 8 and 128 characters.', 400);
  const user = await User.create({ ...pickFields(rest), email: String(rest.email || '').trim().toLowerCase(), passwordHash: await bcrypt.hash(password, 12) });
  res.status(201).json({ success: true, message: 'User created.', data: user });
});

export const updateUser = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw httpError('Invalid user ID.', 400);
  const changes = pickFields(req.body);
  if (Object.hasOwn(req.body || {}, 'password')) {
    if (typeof req.body.password !== 'string' || req.body.password.length < 8 || req.body.password.length > 128) throw httpError('Password must be between 8 and 128 characters.', 400);
    changes.passwordHash = await bcrypt.hash(req.body.password, 12);
  }
  if (changes.email) changes.email = String(changes.email).trim().toLowerCase();
  if (!Object.keys(changes).length) throw httpError('Provide at least one supported user field.', 400);
  const user = await User.findByIdAndUpdate(req.params.id, changes, { new: true, runValidators: true, context: 'query' }).select('-passwordHash');
  if (!user) throw httpError('User not found.', 404);
  res.json({ success: true, message: 'User updated.', data: user });
});

export const deleteUser = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw httpError('Invalid user ID.', 400);
  const id = new mongoose.Types.ObjectId(req.params.id);
  if (await Order.exists({ userId: id })) throw httpError('This user has order history and cannot be deleted. Deactivate the account instead.', 409);
  const user = await User.findByIdAndDelete(id);
  if (!user) throw httpError('User not found.', 404);
  await Cart.deleteOne({ userId: id });
  res.json({ success: true, message: 'User and active cart deleted.', data: { _id: user._id } });
});
