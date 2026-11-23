import { Router } from 'express';
import { cancelMyOrder, createOrder, deleteOrder, getOrderById, getOrders, updateOrder } from '../controllers/orderController.js';
import { authorizeRoles, protect } from '../middleware/auth.js';

const router = Router();
router.use(protect);
router.get('/', getOrders); // customers see only their own orders; admins see all orders
router.get('/:id', getOrderById);
router.post('/', createOrder);
router.patch('/:id/cancel', cancelMyOrder);
router.patch('/:id', authorizeRoles('admin'), updateOrder);
router.delete('/:id', authorizeRoles('admin'), deleteOrder);
export default router;
