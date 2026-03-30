import { Router } from 'express';
import { authenticate, optionalAuth } from '../middleware/authMiddleware';
import * as userController from '../controllers/userController';

const router = Router();

router.get('/', userController.list);
router.get('/search', userController.search);
router.get('/profile/:username', optionalAuth, userController.getProfile);
router.get('/me', authenticate, userController.getMe);
router.patch('/me', authenticate, userController.updateMe);
router.patch('/me/password', authenticate, userController.changePassword);
router.patch('/me/email', authenticate, userController.changeEmail);

export default router;
