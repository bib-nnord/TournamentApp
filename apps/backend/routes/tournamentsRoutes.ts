import { Router } from 'express';
import { authenticate } from '../middleware/authMiddleware';
import { create, list, getById, update, remove, myMatches, confirmParticipation } from '../controllers/tournamentController';
import { reportResult, getMatch } from '../controllers/matchController';

const router = Router();

router.get('/', list);
router.get('/my-matches', authenticate, myMatches);
router.get('/:id', getById);
router.get('/:id/matches/:matchId', getMatch);

router.post('/', authenticate, create);
router.patch('/:id/confirm', authenticate, confirmParticipation);
router.patch('/:id', authenticate, update);
router.delete('/:id', authenticate, remove);
router.patch('/:id/matches/:matchId', authenticate, reportResult);

export default router;
