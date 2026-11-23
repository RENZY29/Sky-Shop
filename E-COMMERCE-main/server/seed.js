import 'dotenv/config';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { connectDB } from './config/db.js';
import Product from './models/Product.js';
import User from './models/User.js';
import Cart from './models/Cart.js';
import Order from './models/Order.js';

// Optional, development-only starter data. It never clears collections or overwrites normal records.
// IDs match the separate JSON examples previously provided for the SkyShop schema.
const products = [
  { _id: '66a100000000000000000001', name: 'Cloud Knit Cardigan', category: 'Fashion', price: 1290, oldPrice: 1590, rating: 4.9, reviews: 128, tag: 'BESTSELLER', bg: '#e2efff', image: 'Cloud Knit Cardigan.jpg', description: 'A soft, everyday layer with a relaxed fit.', stock: 18 },
  { _id: '66a100000000000000000002', name: 'Everyday Tote', category: 'Accessories', price: 680, rating: 4.8, reviews: 86, tag: 'EVERYDAY PICK', bg: '#f7e8d7', image: 'Everyday Tote.jpg', description: 'Roomy, sturdy, and ready for wherever you go.', stock: 24 },
  { _id: '66a100000000000000000003', name: 'Studio Headphones', category: 'Tech', price: 2490, oldPrice: 2990, rating: 4.9, reviews: 204, tag: 'TOP RATED', bg: '#e6e9f4', image: 'Studio Headphones.jpg', description: 'Your own little world of clear, balanced sound.', stock: 12 },
  { _id: '66a100000000000000000004', name: 'Sunday Ceramic Mug', category: 'Home', price: 420, rating: 4.7, reviews: 64, tag: '', bg: '#f5e7e0', image: 'Sunday Ceramic Mug.jpg', description: 'A handmade-feel mug for slow mornings.', stock: 30 },
  { _id: '66a100000000000000000005', name: 'Mini Crossbody Bag', category: 'Accessories', price: 950, rating: 4.8, reviews: 91, tag: '', bg: '#f0e7d8', image: 'Mini Crossbody Bag.jpg', description: 'Keep your essentials close without the bulk.', stock: 16 },
  { _id: '66a100000000000000000006', name: 'Desk Buddy Lamp', category: 'Home', price: 1150, oldPrice: 1390, rating: 4.6, reviews: 43, tag: '', bg: '#e6edf0', image: 'Desk Buddy Lamp.jpg', description: 'A warm glow for late-night ideas and reading.', stock: 9 },
  { _id: '66a100000000000000000007', name: 'Daily Runner Sneakers', category: 'Fashion', price: 1890, rating: 4.8, reviews: 155, tag: '', bg: '#e6e9ee', image: 'Daily Runner Sneakers.jpg', description: 'Lightweight comfort for busy days on the move.', stock: 20 },
  { _id: '66a100000000000000000008', name: 'Pocket Bluetooth Speaker', category: 'Tech', price: 1390, rating: 4.7, reviews: 72, tag: '', bg: '#dcecf8', image: 'Pocket Bluetooth Speaker.jpg', description: 'Small speaker, surprisingly big sound.', stock: 14 },
];
const fixedUserIds = ['66a200000000000000000001', '66a200000000000000000002'];
const users = [
  { _id: fixedUserIds[0], firstName: 'Alex', lastName: 'Demo', email: 'alex.demo@example.com', phone: '+63 900 000 0001', role: 'customer', isActive: true },
  { _id: fixedUserIds[1], firstName: 'Jamie', lastName: 'Sample', email: 'jamie.sample@example.com', phone: '+63 900 000 0002', role: 'customer', isActive: true },
];
const now = new Date();
const carts = [
  { _id: '66a300000000000000000001', userId: fixedUserIds[0], items: [
    { productId: products[0]._id, quantity: 1 }, { productId: products[1]._id, quantity: 2 },
  ] },
  { _id: '66a300000000000000000002', userId: fixedUserIds[1], items: [
    { productId: products[2]._id, quantity: 1 }, { productId: products[6]._id, quantity: 1 },
  ] },
];
const orders = [
  { _id: '66a400000000000000000001', userId: fixedUserIds[0], customer: { name: 'Alex Demo', email: 'alex.demo@example.com', phone: '+63 900 000 0001' }, shippingAddress: { addressLine1: '123 Demo Street', addressLine2: 'Unit 2A', city: 'Paranaque', province: 'Metro Manila', postalCode: '1700', country: 'Philippines' }, items: [{ productId: products[0]._id, name: products[0].name, price: 1290, quantity: 1, image: products[0].image }, { productId: products[1]._id, name: products[1].name, price: 680, quantity: 1, image: products[1].image }], paymentMethod: 'cash_on_delivery', status: 'pending' },
  { _id: '66a400000000000000000002', userId: fixedUserIds[1], customer: { name: 'Jamie Sample', email: 'jamie.sample@example.com', phone: '+63 900 000 0002' }, shippingAddress: { addressLine1: '45 Sample Avenue', city: 'Quezon City', province: 'Metro Manila', postalCode: '1100', country: 'Philippines' }, items: [{ productId: products[2]._id, name: products[2].name, price: 2490, quantity: 1, image: products[2].image }, { productId: products[3]._id, name: products[3].name, price: 420, quantity: 1, image: products[3].image }], paymentMethod: 'e_wallet', status: 'delivered' },
  { _id: '66a400000000000000000003', userId: fixedUserIds[0], customer: { name: 'Alex Demo', email: 'alex.demo@example.com', phone: '+63 900 000 0001' }, shippingAddress: { addressLine1: '123 Demo Street', addressLine2: 'Unit 2A', city: 'Paranaque', province: 'Metro Manila', postalCode: '1700', country: 'Philippines' }, items: [{ productId: products[3]._id, name: products[3].name, price: 420, quantity: 2, image: products[3].image }], paymentMethod: 'bank_transfer', status: 'processing' },
];

async function addIfMissing(Model, record, label) {
  const id = new mongoose.Types.ObjectId(record._id);
  const existing = await Model.findById(id);
  if (existing) return { inserted: false, existing };
  const created = await Model.create({ ...record, _id: id });
  console.log(`Inserted ${label}: ${record._id}`);
  return { inserted: true, existing: created };
}

async function main() {
  await connectDB();
  const passwordHash = await bcrypt.hash('SkyShopDemo2026!', 12);
  for (const product of products) await addIfMissing(Product, product, `product "${product.name}"`);

  for (const userData of users) {
    const id = new mongoose.Types.ObjectId(userData._id);
    let user = await User.findById(id).select('+passwordHash');
    if (!user) {
      const duplicateEmail = await User.findOne({ email: userData.email });
      if (duplicateEmail) throw new Error(`Cannot seed ${userData.email}: that email already belongs to a different user ID.`);
      user = await User.create({ ...userData, _id: id, passwordHash });
      console.log(`Inserted demo user: ${userData.email}`);
    } else if (String(user.passwordHash || '').startsWith('DEMO_ONLY_NOT_A_REAL_PASSWORD_HASH')) {
      user.passwordHash = passwordHash;
      await user.save();
      console.log(`Replaced placeholder password for demo user: ${userData.email}`);
    }
  }

  for (const cart of carts) {
    const prepared = { ...cart, userId: new mongoose.Types.ObjectId(cart.userId), items: cart.items.map((item) => ({ ...item, productId: new mongoose.Types.ObjectId(item.productId), addedAt: now })) };
    await addIfMissing(Cart, prepared, `cart ${cart._id}`);
  }
  for (const order of orders) {
    const prepared = {
      ...order,
      userId: new mongoose.Types.ObjectId(order.userId),
      items: order.items.map((item) => ({ ...item, productId: new mongoose.Types.ObjectId(item.productId) })),
    };
    await addIfMissing(Order, prepared, `order ${order._id}`);
  }

  console.log('\nDemo setup completed without clearing any collection. Existing documents were preserved.');
  console.log('Demo logins created/upgraded by this script: alex.demo@example.com / SkyShopDemo2026! and jamie.sample@example.com / SkyShopDemo2026!');
  console.log('For a real deployment, change/remove demo users and rotate secrets.');
}

main().catch((error) => {
  console.error(`Demo seed failed: ${error.message}`);
  process.exitCode = 1;
}).finally(async () => {
  await mongoose.disconnect().catch(() => {});
});
