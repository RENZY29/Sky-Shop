import 'dotenv/config';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import User from '../models/User.js';

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password || password.length < 12) {
    throw new Error('Set ADMIN_EMAIL and an ADMIN_PASSWORD with at least 12 characters in server/.env.');
  }
  await connectDB();
  const passwordHash = await bcrypt.hash(password, 12);
  const existing = await User.findOne({ email }).select('+passwordHash');
  if (existing) {
    existing.role = 'admin';
    existing.isActive = true;
    existing.passwordHash = passwordHash;
    await existing.save();
    console.log(`Administrator account updated: ${email}`);
  } else {
    await User.create({
      firstName: process.env.ADMIN_FIRST_NAME || 'SkyShop',
      lastName: process.env.ADMIN_LAST_NAME || 'Administrator',
      email,
      passwordHash,
      role: 'admin',
      isActive: true,
    });
    console.log(`Administrator account created: ${email}`);
  }
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; }).finally(async () => { await mongoose.disconnect().catch(() => {}); });
