import Coupon from '../models/Coupon.js';

export function getCouponQuote(coupon, subtotal, now = new Date()) {
  if (!coupon || !coupon.active) return { error: 'This coupon is not active.' };
  if (coupon.startsAt && coupon.startsAt > now) return { error: 'This coupon is not available yet.' };
  if (coupon.expiresAt && coupon.expiresAt <= now) return { error: 'This coupon has expired.' };
  if (coupon.usageLimit != null && coupon.usageCount >= coupon.usageLimit) return { error: 'This coupon has reached its usage limit.' };
  if (subtotal < coupon.minimumSubtotal) return { error: `Spend at least ₱${coupon.minimumSubtotal.toLocaleString('en-PH')} to use this coupon.` };

  const rawDiscount = coupon.type === 'percentage' ? subtotal * coupon.value / 100 : coupon.value;
  const cappedDiscount = coupon.maxDiscount == null ? rawDiscount : Math.min(rawDiscount, coupon.maxDiscount);
  const discount = Math.round(Math.min(subtotal, cappedDiscount) * 100) / 100;
  return {
    data: {
      code: coupon.code,
      type: coupon.type,
      value: coupon.value,
      minimumSubtotal: coupon.minimumSubtotal,
      discount,
    },
  };
}

export async function quoteCouponCode(rawCode, subtotal) {
  const code = String(rawCode || '').trim().toUpperCase();
  if (!code || code.length > 32) return { error: 'Enter a valid coupon code.' };
  const coupon = await Coupon.findOne({ code });
  if (!coupon) return { error: 'That coupon code was not found.' };
  return getCouponQuote(coupon, subtotal);
}
