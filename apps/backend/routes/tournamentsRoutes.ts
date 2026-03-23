import { Router } from 'express';
import { authenticate } from '../middleware/authMiddleware';
import { list, getById, update, remove, myMatches } from '../controllers/tournamentController';
import { create, confirmParticipation } from '../controllers/quickTournamentController';
import {
	createScheduled,
	inviteScheduled,
	registerScheduled,
	unregisterScheduled,
	respondInviteScheduled,
	approveScheduledParticipant,
	declineScheduledParticipant,
	rescindInvite,
	previewScheduledBracket,
	startScheduled,
	saveTeamAssignments,
} from '../controllers/scheduledTournamentController';
import { reportResult, getMatch } from '../controllers/matchController';

const router = Router();

router.get('/', list);
router.get('/my-matches', authenticate, myMatches);
router.get('/:id', getById);
router.get('/:id/matches/:matchId', getMatch);

router.post('/', authenticate, create);
router.post('/scheduled', authenticate, createScheduled);
router.post('/:id/invites', authenticate, inviteScheduled);
router.post('/:id/register', authenticate, registerScheduled);
router.delete('/:id/register', authenticate, unregisterScheduled);
router.patch('/:id/respond-invite', authenticate, respondInviteScheduled);
router.patch('/:id/participants/:seed/approve', authenticate, approveScheduledParticipant);
router.patch('/:id/participants/:seed/decline', authenticate, declineScheduledParticipant);
router.delete('/:id/participants/:seed/invite', authenticate, rescindInvite);
router.post('/:id/preview-bracket', authenticate, previewScheduledBracket);
router.put('/:id/team-assignments', authenticate, saveTeamAssignments);
router.post('/:id/start', authenticate, startScheduled);
router.patch('/:id/confirm', authenticate, confirmParticipation);
router.patch('/:id', authenticate, update);
router.delete('/:id', authenticate, remove);
router.patch('/:id/matches/:matchId', authenticate, reportResult);

export default router;
