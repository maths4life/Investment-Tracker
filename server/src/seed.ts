import { db, initDb } from './db.js';

const paise = (inr: number) => Math.round(inr * 100);

export function runSeed() {
  // Clear existing data
  try { db.exec('DELETE FROM holdings_prices'); } catch {}
  try { db.exec('DELETE FROM transactions'); } catch {}
  try { db.exec('DELETE FROM investments'); } catch {}
  try { db.exec('DELETE FROM settings'); } catch {}
  try { db.exec("DELETE FROM sqlite_sequence WHERE name IN ('investments','transactions')"); } catch {}

  // ─── Create investments ───────────────────────────────────────────────────

  const createInv = db.prepare('INSERT INTO investments (name, category, created_at) VALUES (?, ?, ?)');

  const niftyResult = createInv.run('Nifty 50 Index Fund', 'Mutual Funds', '2023-05-01 09:00:00');
  const niftyId = Number(niftyResult.lastInsertRowid);

  const hdfcResult = createInv.run('HDFC Bank', 'Stocks', '2023-05-15 09:00:00');
  const hdfcId = Number(hdfcResult.lastInsertRowid);

  const infyResult = createInv.run('Infosys', 'Stocks', '2023-06-01 09:00:00');
  const infyId = Number(infyResult.lastInsertRowid);

  const sbiFdResult = createInv.run('SBI Fixed Deposit', 'Fixed Deposits', '2023-07-01 09:00:00');
  const sbiFdId = Number(sbiFdResult.lastInsertRowid);

  const sgbResult = createInv.run('Sovereign Gold Bond 2023-24', 'Gold', '2023-08-01 09:00:00');
  const sgbId = Number(sgbResult.lastInsertRowid);

  const ppfResult = createInv.run('Public Provident Fund', 'PPF/EPF', '2023-05-01 09:00:00');
  const ppfId = Number(ppfResult.lastInsertRowid);

  const epfResult = createInv.run('Employee Provident Fund', 'PPF/EPF', '2023-05-01 09:00:00');
  const epfId = Number(epfResult.lastInsertRowid);

  const cryptoResult = createInv.run('Bitcoin Holdings', 'Crypto', '2023-09-01 09:00:00');
  const cryptoId = Number(cryptoResult.lastInsertRowid);

  const addTx = db.prepare(`
    INSERT INTO transactions (investment_id, type, date, amount, note, stock_name, shares, price_per_share)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // ─── Nifty 50 Index Fund: Monthly SIP ─────────────────────────────────
  const niftySips: [string, number][] = [
    ['2023-05-10', 437250],  ['2023-06-10', 437250],  ['2023-07-10', 437250],
    ['2023-08-10', 437250],  ['2023-09-10', 437250],  ['2023-10-10', 437250],
    ['2023-11-10', 437250],  ['2023-12-10', 437250],  ['2024-01-10', 437250],
    ['2024-02-10', 437250],  ['2024-03-10', 437250],  ['2024-04-10', 437250],
    ['2024-05-10', 437250],  ['2024-06-10', 437250],  ['2024-07-10', 437250],
    ['2024-08-10', 437250],  ['2024-09-10', 437250],  ['2024-10-10', 437250],
  ];
  for (const [date, inr] of niftySips) {
    addTx.run(niftyId, 'add', date, paise(inr), 'Monthly SIP', null, null, null);
  }
  addTx.run(niftyId, 'value_update', '2023-09-30', paise(1842750), 'Q2 NAV update', null, null, null);
  addTx.run(niftyId, 'value_update', '2023-12-31', paise(2318500), 'Year-end NAV', null, null, null);
  addTx.run(niftyId, 'value_update', '2024-03-31', paise(2894000), 'Q4 FY24 NAV', null, null, null);
  addTx.run(niftyId, 'value_update', '2024-06-30', paise(3287500), 'Q1 FY25 NAV', null, null, null);
  // No update since Jun 2024 → stale as of Nov 2026

  // ─── HDFC Bank stocks ─────────────────────────────────────────────────
  addTx.run(hdfcId, 'add', '2023-05-20', paise(37000), 'Initial buy', 'HDFC Bank', 25, paise(1480));
  addTx.run(hdfcId, 'add', '2023-08-14', paise(22680), null, 'HDFC Bank', 15, paise(1512));
  addTx.run(hdfcId, 'value_update', '2023-09-29', paise(66500), 'Q2 update', null, null, null);
  addTx.run(hdfcId, 'add', '2024-01-08', paise(16230), null, 'HDFC Bank', 10, paise(1623));
  addTx.run(hdfcId, 'value_update', '2024-03-28', paise(89750), 'FY24 close', null, null, null);
  addTx.run(hdfcId, 'withdraw', '2024-05-15', paise(33600), 'Partial sell', 'HDFC Bank', 20, paise(1680));
  addTx.run(hdfcId, 'value_update', '2024-06-28', paise(55000), 'Post-sell update', null, null, null);
  // Stale — no update since Jun 2024

  db.prepare('INSERT OR REPLACE INTO holdings_prices (investment_id, stock_name, price_per_share, updated_at) VALUES (?, ?, ?, ?)')
    .run(hdfcId, 'HDFC Bank', paise(1750), '2024-06-28 10:00:00');

  // ─── Infosys ──────────────────────────────────────────────────────────
  addTx.run(infyId, 'add', '2023-06-05', paise(187420), 'Initial buy', 'Infosys', 120, paise(1562));
  addTx.run(infyId, 'add', '2023-10-02', paise(50000), 'Top up', 'Infosys', 30, paise(1667));
  addTx.run(infyId, 'value_update', '2023-12-29', paise(258000), 'Year-end update', null, null, null);
  addTx.run(infyId, 'add', '2024-02-14', paise(74500), 'Buy on dip', 'Infosys', 42, paise(1774));
  addTx.run(infyId, 'withdraw', '2024-04-20', paise(96000), 'Partial sell', 'Infosys', 50, paise(1920));
  addTx.run(infyId, 'value_update', '2024-07-02', paise(314000), 'Q1 FY25 update', null, null, null);
  addTx.run(infyId, 'value_update', '2026-10-15', paise(348000), 'Oct 2026 update', null, null, null);
  // Recent — not stale

  db.prepare('INSERT OR REPLACE INTO holdings_prices (investment_id, stock_name, price_per_share, updated_at) VALUES (?, ?, ?, ?)')
    .run(infyId, 'Infosys', paise(2050), '2026-10-15 09:30:00');

  // ─── SBI FD ───────────────────────────────────────────────────────────
  addTx.run(sbiFdId, 'add', '2023-07-15', paise(500000), '5-year FD @ 7.1%', null, null, null);
  addTx.run(sbiFdId, 'value_update', '2023-12-31', paise(518742), 'Half-yearly interest accrual', null, null, null);
  addTx.run(sbiFdId, 'value_update', '2024-06-30', paise(537900), 'Half-yearly interest', null, null, null);
  // Stale since Jun 2024

  // ─── Sovereign Gold Bond ──────────────────────────────────────────────
  addTx.run(sgbId, 'add', '2023-08-10', paise(314560), 'SGB issue price', null, null, null);
  addTx.run(sgbId, 'value_update', '2023-12-31', paise(338200), 'Dec 2023 gold price update', null, null, null);
  addTx.run(sgbId, 'value_update', '2024-06-30', paise(362750), 'Jun 2024 gold price update', null, null, null);
  // Stale since Jun 2024

  // ─── PPF ──────────────────────────────────────────────────────────────
  addTx.run(ppfId, 'add', '2023-05-01', paise(150000), 'Annual PPF deposit', null, null, null);
  addTx.run(ppfId, 'add', '2024-04-01', paise(150000), 'Annual PPF deposit', null, null, null);
  addTx.run(ppfId, 'value_update', '2024-03-31', paise(316800), 'FY24 interest credit', null, null, null);
  addTx.run(ppfId, 'value_update', '2026-10-30', paise(498250), 'Latest balance check', null, null, null);

  // ─── EPF ──────────────────────────────────────────────────────────────
  for (let m = 0; m < 18; m++) {
    const year = 2023 + Math.floor((m + 4) / 12);
    const month = ((m + 4) % 12) + 1;
    const date = `${year}-${String(month).padStart(2, '0')}-01`;
    addTx.run(epfId, 'add', date, paise(8742), 'Monthly EPF contribution', null, null, null);
  }
  addTx.run(epfId, 'value_update', '2024-03-31', paise(195600), 'FY24 EPF passbook', null, null, null);
  addTx.run(epfId, 'value_update', '2026-10-28', paise(312450), 'Latest EPF balance', null, null, null);

  // ─── Crypto (Bitcoin) ─────────────────────────────────────────────────
  addTx.run(cryptoId, 'add', '2023-09-10', paise(100000), 'BTC purchase', 'Bitcoin', 0.038, paise(2631579));
  addTx.run(cryptoId, 'add', '2024-01-15', paise(75000), 'BTC top-up', 'Bitcoin', 0.021, paise(3571429));
  addTx.run(cryptoId, 'value_update', '2024-01-31', paise(248000), 'Jan bull run', null, null, null);
  addTx.run(cryptoId, 'value_update', '2024-06-30', paise(312500), 'Mid-year update', null, null, null);
  // Stale since Jun 2024

  // ─── Settings ────────────────────────────────────────────────────────
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)")
    .run('target_allocation', JSON.stringify({
      'Mutual Funds': 30,
      'Stocks': 25,
      'Fixed Deposits': 15,
      'Gold': 10,
      'PPF/EPF': 15,
      'Crypto': 5,
      'Other': 0,
    }));

  console.log('[seed] Created investments:', [niftyId, hdfcId, infyId, sbiFdId, sgbId, ppfId, epfId, cryptoId].join(', '));
}

// When run directly
const isMain = process.argv[1] && (
  process.argv[1].replace(/\\/g, '/').endsWith('seed.ts') ||
  process.argv[1].replace(/\\/g, '/').endsWith('seed.js')
);
if (isMain) {
  initDb();
  console.log('[seed] Resetting and seeding database...');
  runSeed();
  console.log('[seed] Done.');
  process.exit(0);
}
