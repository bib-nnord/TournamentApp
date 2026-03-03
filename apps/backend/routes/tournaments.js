const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const { create, list, getById, update, remove } = require('../controllers/tournamentController');
const { reportResult } = require('../controllers/matchController');

const router = Router();

// Public (but respects private flag inside controller)
router.get('/', optionalAuth, list);
router.get('/:id', optionalAuth, getById);

// Protected
router.post('/', authenticate, create);
router.patch('/:id', authenticate, update);
router.delete('/:id', authenticate, remove);
router.patch('/:id/matches/:matchId', authenticate, reportResult);

/**
 * Optional auth — attaches req.user if a valid token is present,
 * but does not block the request if there is no token.
 */
function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return next();

  const jwt = require('jsonwebtoken');
  try {
    const payload = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET);
    req.user = {
      id: payload.sub,
      username: payload.username,
      email: payload.email,
      role: payload.role,
    };
  } catch (_) {
    // Ignore invalid tokens on public routes
  }
  next();
}

module.exports = router;
