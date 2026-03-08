const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const messageController = require('../controllers/messageController');

const router = Router();

router.use(authenticate);

// Static routes before :id to avoid conflicts
router.get('/unread-count', messageController.unreadCount);
router.patch('/read-all', messageController.markAllRead);

router.get('/', messageController.list);
router.get('/:id', messageController.getById);
router.patch('/:id/read', messageController.markRead);
router.delete('/:id', messageController.remove);

module.exports = router;
