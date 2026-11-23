import { Router } from 'express';
import { createUser, deleteUser, getUserById, getUsers, updateUser } from '../controllers/userController.js';
import { authorizeRoles, protect } from '../middleware/auth.js';

const router = Router();
router.use(protect, authorizeRoles('admin'));
router.route('/').get(getUsers).post(createUser);
router.route('/:id').get(getUserById).patch(updateUser).delete(deleteUser);
export default router;
