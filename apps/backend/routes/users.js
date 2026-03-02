const { Router } = require('express');
const userController = require('../controllers/userController');

const router = Router();

// Search users by username or display_name
router.get('/search', userController.search);

module.exports = router;
