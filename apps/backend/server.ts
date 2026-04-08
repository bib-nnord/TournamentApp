import 'dotenv/config';
import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import yaml from 'js-yaml';
import fs from 'fs';
import path from 'path';
import authRoutes from './routes/authRoutes';
import friendRoutes from './routes/friendsRoutes';
import messageRoutes from './routes/messagesRoutes';
import teamRoutes from './routes/teamsRoutes';
import tournamentRoutes from './routes/tournamentsRoutes';
import userRoutes from './routes/usersRoutes';
import { optionalAuth } from './middleware/authMiddleware';
import { cleanupExpiredGhosts } from './lib/cleanup';


const app = express();

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 1000,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});
app.use(globalLimiter);

app.use(optionalAuth);

const swaggerDoc = yaml.load(fs.readFileSync(path.join(__dirname, 'swagger.yaml'), 'utf8')) as object;
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDoc));

app.get('/', (_req: Request, res: Response) => res.json({ status: 'ok' }));

app.use('/auth', authRoutes);
app.use('/tournaments', tournamentRoutes);
app.use('/teams', teamRoutes);
app.use('/users', userRoutes);
app.use('/messages', messageRoutes);
app.use('/friends', friendRoutes);

app.use((_req: Request, res: Response) => res.status(404).json({ error: 'Route not found' }));

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[unhandled]', err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = Number(process.env.PORT) || 2000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  cleanupExpiredGhosts();
});
