import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import Product from '../models/Product.js';

const demoProducts = [
  { name: 'Coastal Knit Vest', category: 'Fashion', price: 980, oldPrice: 1290, rating: 4.7, reviews: 32, tag: 'NEW', bg: '#e5f0f8', image: 'Cloud Knit Cardigan.jpg', description: 'A soft knit layer for breezy mornings and relaxed weekends.', stock: 17 },
  { name: 'Everyday Canvas Sneakers', category: 'Fashion', price: 1750, rating: 4.8, reviews: 74, tag: 'EVERYDAY PICK', bg: '#e9edf3', image: 'Daily Runner Sneakers.jpg', description: 'Lightweight everyday sneakers with a cushioned, easy fit.', stock: 22 },
  { name: 'Soft Lounge Cardigan', category: 'Fashion', price: 1190, oldPrice: 1490, rating: 4.6, reviews: 25, tag: '', bg: '#e2efff', image: 'Cloud Knit Cardigan.jpg', description: 'A relaxed cardigan made for cozy layers and slow days.', stock: 14 },
  { name: 'Weekend Court Sneakers', category: 'Fashion', price: 1990, rating: 4.9, reviews: 58, tag: 'TOP RATED', bg: '#e7ebf1', image: 'Daily Runner Sneakers.jpg', description: 'A clean, versatile sneaker that goes with your off-duty favorites.', stock: 11 },
  { name: 'Ribbed Knit Beanie', category: 'Fashion', price: 590, rating: 4.5, reviews: 18, tag: 'NEW', bg: '#e7f0f8', image: 'Cloud Knit Cardigan.jpg', description: 'A soft ribbed beanie that adds warmth without the fuss.', stock: 30 },
  { name: 'Market Day Canvas Tote', category: 'Accessories', price: 540, rating: 4.8, reviews: 43, tag: 'EVERYDAY PICK', bg: '#f1e9de', image: 'Everyday Tote.jpg', description: 'A roomy canvas carryall for errands, books, and little finds.', stock: 35 },
  { name: 'Mini Zip Wallet', category: 'Accessories', price: 390, rating: 4.7, reviews: 27, tag: '', bg: '#eee9e3', image: 'Mini Crossbody Bag.jpg', description: 'A compact zip wallet that keeps cards and coins close at hand.', stock: 40 },
  { name: 'Quilted Shoulder Bag', category: 'Accessories', price: 1290, oldPrice: 1590, rating: 4.8, reviews: 61, tag: 'BESTSELLER', bg: '#eee9e5', image: 'Mini Crossbody Bag.jpg', description: 'A polished everyday shoulder bag with space for the essentials.', stock: 13 },
  { name: 'Travel Organizer Pouch', category: 'Accessories', price: 450, rating: 4.6, reviews: 20, tag: '', bg: '#f1e9de', image: 'Everyday Tote.jpg', description: 'A handy pouch for chargers, cosmetics, and small travel essentials.', stock: 29 },
  { name: 'Everyday Bucket Bag', category: 'Accessories', price: 890, rating: 4.7, reviews: 31, tag: 'NEW', bg: '#eee9e5', image: 'Mini Crossbody Bag.jpg', description: 'A lightweight bucket bag with a simple shape for daily use.', stock: 16 },
  { name: 'Pocket Wireless Earbuds', category: 'Tech', price: 990, rating: 4.7, reviews: 42, tag: 'NEW', bg: '#e7eaf2', image: 'Studio Headphones.jpg', description: 'Compact wireless earbuds for commutes, calls, and playlists.', stock: 25 },
  { name: 'Compact Bluetooth Speaker', category: 'Tech', price: 1090, rating: 4.6, reviews: 39, tag: '', bg: '#e9edf0', image: 'Pocket Bluetooth Speaker.jpg', description: 'Portable sound for your desk, room, or next little getaway.', stock: 18 },
  { name: 'Foldable Headphone Stand', category: 'Tech', price: 650, rating: 4.5, reviews: 17, tag: '', bg: '#e8ebf1', image: 'Studio Headphones.jpg', description: 'A tidy, foldable stand that keeps your headphones within reach.', stock: 32 },
  { name: 'Rechargeable Night Light', category: 'Tech', price: 780, rating: 4.8, reviews: 29, tag: 'TOP RATED', bg: '#f2eadb', image: 'Desk Buddy Lamp.jpg', description: 'A gentle rechargeable glow for bedside tables and late-night reading.', stock: 21 },
  { name: 'Travel Power Bank', category: 'Tech', price: 1290, rating: 4.7, reviews: 34, tag: '', bg: '#e9edf0', image: 'Pocket Bluetooth Speaker.jpg', description: 'A slim backup charger to keep your everyday devices going.', stock: 19 },
  { name: 'Sunday Latte Cup', category: 'Home', price: 390, rating: 4.8, reviews: 36, tag: 'HOME PICK', bg: '#f4e9e3', image: 'Sunday Ceramic Mug.jpg', description: 'A comfortable ceramic cup for slow mornings and afternoon coffee.', stock: 30 },
  { name: 'Warm Glow Table Lamp', category: 'Home', price: 1490, oldPrice: 1790, rating: 4.9, reviews: 53, tag: 'TOP RATED', bg: '#f1e8d9', image: 'Desk Buddy Lamp.jpg', description: 'A warm ambient lamp that makes a reading corner feel more inviting.', stock: 12 },
  { name: 'Cloud Knit Throw', category: 'Home', price: 1290, rating: 4.8, reviews: 22, tag: '', bg: '#e6eff6', image: 'Cloud Knit Cardigan.jpg', description: 'A soft knit throw for movie nights, naps, and cozy corners.', stock: 15 },
  { name: 'Ceramic Plant Pot', category: 'Home', price: 520, rating: 4.6, reviews: 19, tag: 'NEW', bg: '#f3e9e2', image: 'Sunday Ceramic Mug.jpg', description: 'A simple ceramic planter for a little greenery on your shelf.', stock: 28 },
  { name: 'Cozy Reading Light', category: 'Home', price: 990, rating: 4.7, reviews: 24, tag: '', bg: '#f1e8d9', image: 'Desk Buddy Lamp.jpg', description: 'A compact reading light for a calm wind-down at the end of the day.', stock: 20 },
];

async function main() {
  await connectDB();
  let inserted = 0;
  for (const product of demoProducts) {
    if (await Product.exists({ name: product.name })) continue;
    await Product.create(product);
    inserted += 1;
    console.log(`Added ${product.name}`);
  }
  console.log(`Added ${inserted} new products; existing catalog items were left unchanged.`);
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; }).finally(async () => { await mongoose.disconnect().catch(() => {}); });
