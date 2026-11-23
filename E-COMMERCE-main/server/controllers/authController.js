import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const publicUser = (user) => ({
  _id: user._id,
  firstName: user.firstName,
  lastName: user.lastName,
  email: user.email,
  phone: user.phone,
  shippingAddress: user.shippingAddress || {},
  role: user.role,
  isActive: user.isActive,
  createdAt: user.createdAt,
});

function createToken(user) {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 24) {
    const error = new Error('JWT_SECRET must contain at least 24 characters. Configure server/.env.');
    error.statusCode = 500;
    throw error;
  }
  return jwt.sign({ sub: String(user._id) }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '1d' });
}

export const register = asyncHandler(async (req, res) => {
  const { firstName, lastName, email, password, phone = '' } = req.body || {};
  if (!firstName?.trim() || !lastName?.trim() || !email?.trim() || !password) {
    return res.status(400).json({ success: false, message: 'firstName, lastName, email, and password are required.' });
  }
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
    return res.status(400).json({ success: false, message: 'Password must be between 8 and 128 characters.' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (await User.exists({ email: normalizedEmail })) {
    return res.status(409).json({ success: false, message: 'An account with that email already exists.' });
  }

  const user = await User.create({
    firstName,
    lastName,
    email: normalizedEmail,
    phone,
    passwordHash: await bcrypt.hash(password, 12),
    role: 'customer',
  });

  return res.status(201).json({ success: true, message: 'Account created.', token: createToken(user), data: publicUser(user) });
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email and password are required.' });
  }

  const user = await User.findOne({ email: String(email).trim().toLowerCase() }).select('+passwordHash');
  const passwordMatches = user ? await bcrypt.compare(String(password), user.passwordHash).catch(() => false) : false;
  if (!user || !passwordMatches || !user.isActive) {
    return res.status(401).json({ success: false, message: 'Email or password is incorrect.' });
  }

  return res.json({ success: true, message: 'Signed in successfully.', token: createToken(user), data: publicUser(user) });
});

export const getMe = asyncHandler(async (req, res) => {
  res.json({ success: true, data: publicUser(req.user) });
});

export const updateMyProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user) return res.status(404).json({ success: false, message: 'Account not found.' });
  const { firstName, lastName, email, phone, shippingAddress } = req.body || {};
  if (firstName !== undefined) user.firstName = String(firstName).trim();
  if (lastName !== undefined) user.lastName = String(lastName).trim();
  if (email !== undefined) user.email = String(email).trim().toLowerCase();
  if (phone !== undefined) user.phone = String(phone).trim();
  if (shippingAddress !== undefined) {
    if (!shippingAddress || typeof shippingAddress !== 'object' || Array.isArray(shippingAddress)) {
      return res.status(400).json({ success: false, message: 'Shipping address must be an object.' });
    }
    for (const field of ['addressLine1', 'addressLine2', 'city', 'province', 'postalCode', 'country']) {
      if (shippingAddress[field] !== undefined) user.shippingAddress[field] = String(shippingAddress[field]).trim();
    }
  }
  await user.save();
  res.json({ success: true, message: 'Your personal information has been saved.', data: publicUser(user) });
});

export const changeMyPassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (typeof currentPassword !== 'string' || !currentPassword) throw Object.assign(new Error('Enter your current password.'), { statusCode: 400 });
  if (typeof newPassword !== 'string' || newPassword.length < 8 || newPassword.length > 128) {
    throw Object.assign(new Error('New password must be between 8 and 128 characters.'), { statusCode: 400 });
  }
  const user = await User.findById(req.user._id).select('+passwordHash');
  if (!user || !await bcrypt.compare(currentPassword, user.passwordHash)) {
    throw Object.assign(new Error('Your current password is incorrect.'), { statusCode: 401 });
  }
  user.passwordHash = await bcrypt.hash(newPassword, 12);
  await user.save();
  res.json({ success: true, message: 'Your password has been changed.' });
});
