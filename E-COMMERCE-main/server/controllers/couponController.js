import mongoose from 'mongoose';
import Coupon from '../models/Coupon.js';
import { getCouponQuote } from '../utils/couponQuote.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const httpError = (message, statusCode) => Object.assign(new Error(message), { statusCode });

function pickCouponFields(body = {}) {
  const dateValue = (value) => value ? new Date(value) : null;
  return {
    code: String(body.code || '').trim().toUpperCase(),
    type: body.type,
    value: Number(body.value),
    minimumSubtotal: body.minimumSubtotal === '' || body.minimumSubtotal == null ? 0 : Number(body.minimumSubtotal),
    maxDiscount: body.maxDiscount === '' || body.maxDiscount == null ? null : Number(body.maxDiscount),
    usageLimit: body.usageLimit === '' || body.usageLimit == null ? null : Number(body.usageLimit),
    startsAt: dateValue(body.startsAt),
    expiresAt: dateValue(body.expiresAt),
    active: body.active !== false,
  };
}

export const validateCoupon = asyncHandler(async (req, res) => {
  const subtotal = Number(req.body?.subtotal);
  if (!Number.isFinite(subtotal) || subtotal < 0) throw httpError('Subtotal must be a valid non-negative amount.', 400);
  const code = String(req.body?.code || '').trim().toUpperCase();
  const coupon = await Coupon.findOne({ code });
  if (!coupon) throw httpError('That coupon code was not found.', 400);
  const quote = getCouponQuote(coupon, subtotal);
  if (quote.error) throw httpError(quote.error, 400);
  res.json({ success: true, data: quote.data });
});

export const getCoupons = asyncHandler(async (_req, res) => {
  const data = await Coupon.find().sort({ createdAt: -1 });
  res.json({ success: true, data });
});

export const getAvailableCoupons = asyncHandler(async (_req, res) => {
  const now = new Date();
  const data = await Coupon.find({
    active: true,
    $and: [
      { $or: [{ startsAt: null }, { startsAt: { $lte: now } }] },
      { $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] },
      { $or: [{ usageLimit: null }, { $expr: { $lt: ['$usageCount', '$usageLimit'] } }] },
    ],
  }).select('code type value minimumSubtotal maxDiscount expiresAt').sort({ expiresAt: 1, createdAt: -1 });
  res.json({ success: true, data });
});

export const createCoupon = asyncHandler(async (req, res) => {
  const coupon = await Coupon.create(pickCouponFields(req.body));
  res.status(201).json({ success: true, message: 'Coupon created.', data: coupon });
});

export const updateCoupon = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw httpError('Invalid coupon ID.', 400);
  const coupon = await Coupon.findByIdAndUpdate(req.params.id, pickCouponFields(req.body), { new: true, runValidators: true });
  if (!coupon) throw httpError('Coupon not found.', 404);
  res.json({ success: true, message: 'Coupon updated.', data: coupon });
});

export const deleteCoupon = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw httpError('Invalid coupon ID.', 400);
  const coupon = await Coupon.findByIdAndDelete(req.params.id);
  if (!coupon) throw httpError('Coupon not found.', 404);
  res.json({ success: true, message: 'Coupon deleted.', data: { _id: coupon._id } });
});
