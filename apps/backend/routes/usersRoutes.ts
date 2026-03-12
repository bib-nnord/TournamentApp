import { Router } from 'express';
import { authenticate } from '../middleware/authMiddleware';
import * as userController from '../controllers/userController';

const router = Router();

router.get('/', userController.list);
router.get('/search', userController.search);

router.get('/me', authenticate, userController.getMe);
router.patch('/me', authenticate, userController.updateMe);

export default router;
