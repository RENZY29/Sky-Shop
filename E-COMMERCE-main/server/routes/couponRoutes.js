import { Router } from 'express';
import { createCoupon, deleteCoupon, getAvailableCoupons, getCoupons, updateCoupon, validateCoupon } from '../controllers/couponController.js';
import { authorizeRoles, protect } from '../middleware/auth.js';

const router = Router();
router.get('/available', getAvailableCoupons);
router.use(protect);
router.post('/validate', validateCoupon);
router.get('/', authorizeRoles('admin'), getCoupons);
router.post('/', authorizeRoles('admin'), createCoupon);
router.patch('/:id', authorizeRoles('admin'), updateCoupon);
router.delete('/:id', authorizeRoles('admin'), deleteCoupon);
export default router;
