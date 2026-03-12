import { Router } from 'express';
import { authenticate } from '../middleware/authMiddleware';
import * as messageController from '../controllers/messageController';

const router = Router();

router.use(authenticate);

router.get('/unread-count', messageController.unreadCount);
router.patch('/read-all', messageController.markAllRead);

router.get('/', messageController.list);
router.post('/', messageController.send);
router.get('/:id', messageController.getById);
router.patch('/:id/read', messageController.markRead);
router.delete('/:id', messageController.remove);

export default router;
