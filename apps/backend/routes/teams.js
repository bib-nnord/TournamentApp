const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const teamController = require('../controllers/teamController');

const router = Router();

// Search teams by name
router.get('/search', teamController.search);

// Current user's teams (authenticated)
router.get('/my', authenticate, teamController.myTeams);

// Teams for a specific user (public)
router.get('/user/:userId', teamController.userTeams);

module.exports = router;
