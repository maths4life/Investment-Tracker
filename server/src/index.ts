import express from 'express';
import cors from 'cors';
import { initDb, isEmpty } from './db.js';
import investmentsRouter from './routes/investments.js';
import transactionsRouter from './routes/transactions.js';
import txCrudRouter from './routes/txCrud.js';
import dashboardRouter from './routes/dashboard.js';
import settingsRouter from './routes/settings.js';
import exportImportRouter from './routes/exportImport.js';
import { authMiddleware } from './middleware/auth.js';
import { runSeed } from './seed.js';

const PORT = process.env.PORT ?? 3001;

initDb();

// Seed only when explicitly requested via `npm run seed` or AUTO_SEED=true
if (process.env.AUTO_SEED === 'true' && isEmpty()) {
  console.log('[server] Database is empty and AUTO_SEED is set, running seed...');
  runSeed();
  console.log('[server] Seed complete.');
}

const app = express();
app.use(cors({ origin: ['http://localhost:5173', 'http://127.0.0.1:5173'] }));
app.use(express.json({ limit: '10mb' }));
app.use(authMiddleware); // Scopes all endpoints by userId

// API routes
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
