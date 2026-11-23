import { Router } from 'express';
import { changeMyPassword, getMe, login, register, updateMyProfile } from '../controllers/authController.js';
import { protect } from '../middleware/auth.js';

const router = Router();
router.post('/register', register);
router.post('/login', login);
router.get('/me', protect, getMe);
router.patch('/me', protect, updateMyProfile);
router.patch('/me/password', protect, changeMyPassword);
export default router;
