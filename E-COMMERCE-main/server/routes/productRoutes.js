import express, { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProduct, deleteProduct, getProductById, getProducts, updateProduct } from '../controllers/productController.js';
import { authorizeRoles, protect } from '../middleware/auth.js';

const router = Router();
const uploadDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../uploads');
const imageExtensions = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif', 'image/avif': '.avif' };
router.get('/', getProducts);
router.get('/:id', getProductById);
router.post('/image', protect, authorizeRoles('admin'), express.raw({ type: Object.keys(imageExtensions), limit: '5mb' }), async (req, res, next) => {
  try {
    const extension = imageExtensions[req.headers['content-type']];
    if (!extension || !Buffer.isBuffer(req.body) || !req.body.length) return res.status(400).json({ success: false, message: 'Choose a JPG, PNG, WebP, GIF, or AVIF image first.' });
    await mkdir(uploadDirectory, { recursive: true });
    const filename = `${randomUUID()}${extension}`;
    await writeFile(path.join(uploadDirectory, filename), req.body, { flag: 'wx' });
    res.status(201).json({ success: true, data: { image: `/uploads/${filename}` } });
  } catch (error) {
    next(error);
  }
});
router.post('/', protect, authorizeRoles('admin'), createProduct);
router.patch('/:id', protect, authorizeRoles('admin'), updateProduct);
router.delete('/:id', protect, authorizeRoles('admin'), deleteProduct);
export default router;
