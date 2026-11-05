// @ts-ignore — node:sqlite is available in Node 24+ with --experimental-sqlite
import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'app.db');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// A thin compatibility wrapper around node:sqlite's DatabaseSync
// that mimics the better-sqlite3 API used throughout this project.
class DB {
  private raw: InstanceType<typeof DatabaseSync>;

  constructor(path: string) {
    this.raw = new DatabaseSync(path);
  }

  pragma(statement: string): void {
    this.raw.exec(`PRAGMA ${statement}`);
  }

  exec(sql: string): void {
    this.raw.exec(sql);
  }

  prepare(sql: string) {
    const stmt = this.raw.prepare(sql);
    return {
      run: (...args: unknown[]) => {
        const params = flattenArgs(args);
        return stmt.run(...params) as { lastInsertRowid: number | bigint; changes: number };
      },
      get: (...args: unknown[]) => {
        const params = flattenArgs(args);
        return stmt.get(...params) as Record<string, unknown> | undefined;
      },
      all: (...args: unknown[]) => {
        const params = flattenArgs(args);
        return stmt.all(...params) as Record<string, unknown>[];
      },
    };
  }

  transaction<T>(fn: (arg: T) => void): (arg: T) => void {
    return (arg: T) => {
      this.raw.exec('BEGIN');
      try {
        fn(arg);
        this.raw.exec('COMMIT');
      } catch (e) {
        this.raw.exec('ROLLBACK');
        throw e;
      }
    };
  }
}

function flattenArgs(args: unknown[]): unknown[] {
  // If a single object (not array) is passed, spread its values in insertion order
  if (args.length === 1 && args[0] !== null && typeof args[0] === 'object' && !Array.isArray(args[0])) {
    return Object.values(args[0] as Record<string, unknown>);
  }
  return args;
}

export const db = new DB(DB_PATH);

export function initDb(): void {
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS investments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT NOT NULL CHECK(category IN ('Stocks','Mutual Funds','Fixed Deposits','Gold','PPF/EPF','Crypto','Other')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      investment_id INTEGER NOT NULL REFERENCES investments(id) ON DELETE CASCADE,
      type TEXT NOT NULL CHECK(type IN ('add','withdraw','value_update')),
      date TEXT NOT NULL,
      amount INTEGER NOT NULL,
      note TEXT,
      stock_name TEXT,
      shares REAL,
      price_per_share INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS holdings_prices (
      investment_id INTEGER NOT NULL REFERENCES investments(id) ON DELETE CASCADE,
      stock_name TEXT NOT NULL,
      price_per_share INTEGER NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (investment_id, stock_name)
    );

    CREATE INDEX IF NOT EXISTS idx_transactions_investment_id ON transactions(investment_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
    CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
  `);
}

export function isEmpty(): boolean {
  const row = db.prepare('SELECT COUNT(*) as count FROM investments').get() as { count: number };
  return row.count === 0;
}
