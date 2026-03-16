import { Router } from 'express';
import { authenticate } from '../middleware/authMiddleware';
import * as teamController from '../controllers/teamController';

const router = Router();

router.get('/', teamController.list);
router.get('/search', teamController.search);
router.get('/my', authenticate, teamController.myTeams);
router.get('/user/:userId', teamController.userTeams);
router.get('/news', authenticate, teamController.allNews);
router.get('/:id/news', authenticate, teamController.news);
router.patch('/:id/news/read-all', authenticate, teamController.markAllNewsRead);

router.post('/', authenticate, teamController.create);

router.get('/:id', teamController.getById);
router.patch('/:id', authenticate, teamController.update);
router.delete('/:id', authenticate, teamController.disband);

router.post('/:id/join', authenticate, teamController.join);
router.post('/:id/invite', authenticate, teamController.inviteMember);
router.post('/:id/leave', authenticate, teamController.leave);

router.patch('/:id/members/:userId', authenticate, teamController.updateMember);
router.delete('/:id/members/:userId', authenticate, teamController.kickMember);

export default router;
