// Camada de banco assíncrona com dois motores e a mesma interface:
//  - SQLite local (node:sqlite): desenvolvimento, Docker, Fly.io (arquivo em disco persistente)
//  - libSQL / Turso (@libsql/client): Vercel e qualquer ambiente sem disco persistente
// Os dois são SQLite por baixo, então o SQL é o mesmo. Os módulos são importados sob demanda
// para que a Vercel não precise carregar node:sqlite e a imagem Docker não precise do @libsql/client.
import fs from 'node:fs'
import path from 'node:path'

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

/* ---------- migrações ----------
   Regras: nunca edite uma migração já publicada; para mudar o esquema, acrescente uma nova no fim.
   Cada instrução roda uma vez; "duplicate column"/"already exists" são tolerados para que duas
   instâncias subindo ao mesmo tempo (Vercel) não derrubem uma à outra. */
const MIGRATIONS = [
  {
    version: 1, // esquema original
    stmts: [
      `CREATE TABLE IF NOT EXISTS groups (
        id TEXT PRIMARY KEY, code TEXT UNIQUE NOT NULL, name TEXT NOT NULL, icon TEXT NOT NULL,
        start TEXT NOT NULL, season INTEGER NOT NULL DEFAULT 1
      )`,
      `CREATE TABLE IF NOT EXISTS members (
        id TEXT PRIMARY KEY, group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
        name TEXT NOT NULL, avatar TEXT NOT NULL, token_hash TEXT UNIQUE NOT NULL,
        owner INTEGER NOT NULL DEFAULT 0, share INTEGER NOT NULL DEFAULT 1,
        streak INTEGER NOT NULL DEFAULT 0, best INTEGER NOT NULL DEFAULT 0
      )`,
      `CREATE TABLE IF NOT EXISTS days (
        member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE, season INTEGER NOT NULL, date TEXT NOT NULL,
        pts INTEGER NOT NULL, water INTEGER NOT NULL, activity INTEGER NOT NULL, sleep REAL NOT NULL,
        PRIMARY KEY (member_id, season, date)
      )`,
      'CREATE INDEX IF NOT EXISTS idx_members_group ON members(group_id)',
      'CREATE INDEX IF NOT EXISTS idx_days_season ON days(season, member_id)',
    ],
  },
  {
    version: 2, // PIN de recuperação, metas e registros brutos (pontos passam a ser calculados no servidor), limite persistente
    stmts: [
      'ALTER TABLE members ADD COLUMN pin_hash TEXT',
      'ALTER TABLE members ADD COLUMN failed_pin INTEGER NOT NULL DEFAULT 0',
      'ALTER TABLE members ADD COLUMN locked_until INTEGER NOT NULL DEFAULT 0',
      'ALTER TABLE members ADD COLUMN water_goal INTEGER NOT NULL DEFAULT 2250',
      'ALTER TABLE members ADD COLUMN sleep_goal REAL NOT NULL DEFAULT 7.5',
      "ALTER TABLE members ADD COLUMN saved TEXT NOT NULL DEFAULT '[]'",
      'ALTER TABLE days ADD COLUMN food INTEGER NOT NULL DEFAULT 0',
      'ALTER TABLE days ADD COLUMN weight INTEGER NOT NULL DEFAULT 0',
      'ALTER TABLE days ADD COLUMN mood INTEGER NOT NULL DEFAULT 0',
      'CREATE TABLE IF NOT EXISTS rate_limits (key TEXT PRIMARY KEY, n INTEGER NOT NULL, reset INTEGER NOT NULL)',
    ],
  },
]

export const LATEST_SCHEMA_VERSION = MIGRATIONS[MIGRATIONS.length - 1].version
const TOLERATED = /duplicate column|already exists/i

async function migrate(db) {
  await db.run('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)')
  let current = (await db.get('SELECT MAX(version) AS v FROM schema_migrations'))?.v ?? 0
  if (current === 0 && (await db.get("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'groups'"))) {
    // banco criado antes do controle de versão: já tem o esquema da v1
    await db.run('INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES (1, ?)', [new Date().toISOString()])
    current = 1
  }
  for (const m of MIGRATIONS.filter(x => x.version > current)) {
    for (const sql of m.stmts) {
      try { await db.run(sql) } catch (e) { if (!TOLERATED.test(String(e?.message))) throw e }
    }
    await db.run('INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES (?, ?)', [m.version, new Date().toISOString()])
  }
}

export async function openDb({ url, authToken, dbPath = ':memory:' } = {}) {
  const db = url ? await openLibsql({ url, authToken }) : await openLocal(dbPath)
  await migrate(db)
  return db
}
