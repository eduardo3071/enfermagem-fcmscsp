// Camada de banco assíncrona com dois motores e a mesma interface:
//  - SQLite local (node:sqlite): desenvolvimento, Docker, Fly.io (arquivo em disco persistente)
//  - libSQL / Turso (@libsql/client): Vercel e qualquer ambiente sem disco persistente
// Os dois são SQLite por baixo, então o SQL é o mesmo. Os módulos são importados sob demanda
// para que a Vercel não precise carregar node:sqlite e a imagem Docker não precise do @libsql/client.
import fs from 'node:fs'
import path from 'node:path'

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS groups (
    id TEXT PRIMARY KEY, code TEXT UNIQUE NOT NULL, name TEXT NOT NULL, icon TEXT NOT NULL,
    start TEXT NOT NULL, season INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS members (
    id TEXT PRIMARY KEY, group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    name TEXT NOT NULL, avatar TEXT NOT NULL, token_hash TEXT UNIQUE NOT NULL,
    owner INTEGER NOT NULL DEFAULT 0, share INTEGER NOT NULL DEFAULT 1,
    streak INTEGER NOT NULL DEFAULT 0, best INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS days (
    member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE, season INTEGER NOT NULL, date TEXT NOT NULL,
    pts INTEGER NOT NULL, water INTEGER NOT NULL, activity INTEGER NOT NULL, sleep REAL NOT NULL,
    PRIMARY KEY (member_id, season, date)
  );
  CREATE INDEX IF NOT EXISTS idx_members_group ON members(group_id);
  CREATE INDEX IF NOT EXISTS idx_days_season ON days(season, member_id);
`

async function openLocal(dbPath) {
  const { DatabaseSync } = await import('node:sqlite')
  if (dbPath !== ':memory:') fs.mkdirSync(path.dirname(path.resolve(dbPath)), { recursive: true })
  const db = new DatabaseSync(dbPath)
  db.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON;')
  const cache = new Map()
  const st = (sql) => { let s = cache.get(sql); if (!s) cache.set(sql, (s = db.prepare(sql))); return s }
  return {
    kind: 'sqlite',
    get: async (sql, args = []) => st(sql).get(...args),
    all: async (sql, args = []) => st(sql).all(...args),
    run: async (sql, args = []) => { st(sql).run(...args) },
    // todas as instruções ou nenhuma (síncrono: nada se intercala no meio)
    batch: async (stmts) => {
      db.exec('BEGIN')
      try { for (const [sql, args = []] of stmts) st(sql).run(...args); db.exec('COMMIT') } catch (e) { db.exec('ROLLBACK'); throw e }
    },
    exec: async (sql) => { db.exec(sql) },
    close: async () => { db.close() },
  }
}

async function openLibsql({ url, authToken }) {
  const { createClient } = await import('@libsql/client')
  const c = createClient({ url, authToken })
  const rows = (r) => r.rows.map(row => Object.fromEntries(r.columns.map((col, i) => [col, row[i]])))
  return {
    kind: 'libsql',
    get: async (sql, args = []) => rows(await c.execute({ sql, args }))[0],
    all: async (sql, args = []) => rows(await c.execute({ sql, args })),
    run: async (sql, args = []) => { await c.execute({ sql, args }) },
    batch: async (stmts) => { await c.batch(stmts.map(([sql, args = []]) => ({ sql, args })), 'write') },
    exec: async (sql) => { await c.executeMultiple(sql) },
    close: async () => { c.close() },
  }
}

export async function openDb({ url, authToken, dbPath = ':memory:' } = {}) {
  const db = url ? await openLibsql({ url, authToken }) : await openLocal(dbPath)
  await db.exec(SCHEMA)
  return db
}
