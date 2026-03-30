import { Router } from 'express';
import { authenticate } from '../middleware/authMiddleware';
import * as friendController from '../controllers/friendController';

const router = Router();

// Public: view any user's friends list
router.get('/user/:username', friendController.listUserFriends);

router.use(authenticate);

router.get('/requests', friendController.listRequests);
router.get('/status/:username', friendController.getStatus);

router.get('/', friendController.listFriends);
router.post('/request', friendController.sendRequest);
router.patch('/:id/accept', friendController.acceptRequest);
router.patch('/:id/decline', friendController.declineRequest);
router.delete('/:id', friendController.removeFriend);

export default router;
