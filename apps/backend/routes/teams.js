const { Router } = require('express');
const teamController = require('../controllers/teamController');

const router = Router();

// Search teams by name
router.get('/search', teamController.search);

module.exports = router;
