const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const userController = require('../controllers/userController');

const router = Router();

// List all users (paginated, optional search)
router.get('/', userController.list);

// Search users by username or display_name
router.get('/search', userController.search);

// Current user profile & settings (authenticated)
router.get('/me', authenticate, userController.getMe);
router.patch('/me', authenticate, userController.updateMe);

module.exports = router;
