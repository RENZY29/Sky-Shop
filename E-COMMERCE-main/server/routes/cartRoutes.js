import { Router } from 'express';
import { clearMyCart, deleteCartById, getAllCarts, getCartById, getMyCart, removeCartItem, replaceMyCart, setCartItemQuantity } from '../controllers/cartController.js';
import { authorizeRoles, protect } from '../middleware/auth.js';

const router = Router();
router.use(protect);
router.get('/me', getMyCart);
router.put('/me', replaceMyCart);
router.patch('/me/items/:productId', setCartItemQuantity);
router.delete('/me/items/:productId', removeCartItem);
router.delete('/me', clearMyCart);
router.get('/', authorizeRoles('admin'), getAllCarts);
router.get('/:id', authorizeRoles('admin'), getCartById);
router.delete('/:id', authorizeRoles('admin'), deleteCartById);
export default router;
