import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import Coupon from '../models/Coupon.js';

const demoCoupons = [
  { code: 'EXTRA5', type: 'percentage', value: 5, minimumSubtotal: 500, maxDiscount: 100, usageLimit: 100, active: true },
  { code: 'EXTRA10', type: 'percentage', value: 10, minimumSubtotal: 800, maxDiscount: 150, usageLimit: 100, active: true },
  { code: 'EXTRA15', type: 'percentage', value: 15, minimumSubtotal: 1500, maxDiscount: 250, usageLimit: 50, active: true },
  { code: 'EXTRA50', type: 'fixed', value: 50, minimumSubtotal: 500, usageLimit: 100, active: true },
  { code: 'EXTRA100', type: 'fixed', value: 100, minimumSubtotal: 1000, usageLimit: 75, active: true },
  { code: 'EXTRA200', type: 'fixed', value: 200, minimumSubtotal: 2000, usageLimit: 50, active: true },
  { code: 'EXTRAWEEKEND', type: 'percentage', value: 10, minimumSubtotal: 700, maxDiscount: 100, usageLimit: 100, active: true },
];

async function main() {
  await connectDB();
  let inserted = 0;
  for (const coupon of demoCoupons) {
    if (await Coupon.exists({ code: coupon.code })) continue;
    await Coupon.create(coupon);
    inserted += 1;
    console.log(`Added ${coupon.code}`);
  }
  console.log(`Added ${inserted} new coupons; existing coupons were left unchanged.`);
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; }).finally(async () => { await mongoose.disconnect().catch(() => {}); });
