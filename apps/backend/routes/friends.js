const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const friendController = require('../controllers/friendController');

const router = Router();

router.use(authenticate);

// Static routes before :id
router.get('/requests', friendController.listRequests);

router.get('/', friendController.listFriends);
router.post('/request', friendController.sendRequest);
router.patch('/:id/accept', friendController.acceptRequest);
router.patch('/:id/decline', friendController.declineRequest);
router.delete('/:id', friendController.removeFriend);

module.exports = router;
