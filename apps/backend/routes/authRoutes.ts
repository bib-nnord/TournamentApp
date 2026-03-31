import { Router } from 'express';
import { login, logout, refresh, register, forgotPassword, resetPassword, validateInvite, registerInvite } from '../controllers/authController';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.get('/validate-invite', validateInvite);
router.post('/register-invite', registerInvite);

export default router;
