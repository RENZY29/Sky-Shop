import { Router } from 'express';
import { getMyReviews, getProductReviews, saveReview } from '../controllers/reviewController.js';
import { protect } from '../middleware/auth.js';

const router = Router();
router.get('/product/:productId', getProductReviews);
router.get('/mine', protect, getMyReviews);
router.post('/', protect, saveReview);
export default router;
