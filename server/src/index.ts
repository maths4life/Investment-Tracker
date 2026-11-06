import express from 'express';
import cors from 'cors';
import investmentsRouter from './routes/investments.js';
import transactionsRouter from './routes/transactions.js';
import txCrudRouter from './routes/txCrud.js';
import dashboardRouter from './routes/dashboard.js';
import settingsRouter from './routes/settings.js';
import exportImportRouter from './routes/exportImport.js';
import profilesRouter from './routes/profiles.js';
import { authMiddleware } from './middleware/auth.js';

try {
  process.loadEnvFile();
} catch {}

const PORT = process.env.PORT ?? 3001;

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Health check endpoint for root
app.get('/', (_req, res) => {
  res.json({ status: 'ok', message: 'Investment Tracker API is live and healthy (Supabase Backend)' });
});

app.use(authMiddleware); // Scopes all endpoints by userId

// API routes
app.use('/api/profiles', profilesRouter);
app.use('/api/investments', investmentsRouter);
app.use('/api/investments/:id/transactions', transactionsRouter);
app.use('/api/transactions', txCrudRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/portfolio', dashboardRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/export', exportImportRouter);
app.use('/api/import', exportImportRouter);

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

app.listen(PORT, () => {
  console.log(`[server] Running on http://localhost:${PORT}`);
});
