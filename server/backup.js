// Backup do banco. Dois modos, escolhidos pelo ambiente:
//  - SQLite local (padrão): cópia consistente com VACUUM INTO, segura com o app rodando (modo WAL).
//      node --no-warnings server/backup.js [destino]            (padrão: <DB_PATH>.backup)
//  - Turso / libSQL (quando TURSO_DATABASE_URL está definida): exporta esquema + dados em um arquivo .sql.
//      TURSO_DATABASE_URL=libsql://... TURSO_AUTH_TOKEN=... node server/backup.js [destino.sql]
//
// ATENÇÃO: o backup contém nomes, hashes de token e de PIN e o histórico de todos os participantes.
// Guarde fora do repositório e do alcance de terceiros (o .gitignore já ignora backup*.sql e *.backup).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const TABLES = ['groups', 'members', 'days'] // ordem importa: respeita as chaves estrangeiras ao restaurar
// rate_limits e schema_migrations não entram: o primeiro é descartável, o segundo é recriado ao subir o app

const literal = (v) => (v === null || v === undefined ? 'NULL' : typeof v === 'number' || typeof v === 'bigint' ? String(v) : `'${String(v).replace(/'/g, "''")}'`)

async function dumpTurso(dest) {
  const { createClient } = await import('@libsql/client')
  const c = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN })
  const lines = [`-- Backup Desafio 30 Dias, ${new Date().toISOString()}`, 'PRAGMA foreign_keys = OFF;', 'BEGIN;']
  const ddl = await c.execute(`SELECT sql FROM sqlite_master WHERE type IN ('table','index') AND name IN (${TABLES.map(() => '?').join(',')}) OR (type = 'index' AND tbl_name IN (${TABLES.map(() => '?').join(',')}) AND sql IS NOT NULL)`, [...TABLES, ...TABLES])
  for (const r of ddl.rows) lines.push(`${r[0]};`)
  const counts = {}
  for (const t of TABLES) {
    const res = await c.execute(`SELECT * FROM ${t}`)
    counts[t] = res.rows.length
    for (const row of res.rows) lines.push(`INSERT INTO ${t} (${res.columns.join(', ')}) VALUES (${res.columns.map((_, i) => literal(row[i])).join(', ')});`)
  }
  lines.push('COMMIT;', '')
  fs.writeFileSync(dest, lines.join('\n'))
  c.close()
  return counts
}

async function copyLocal(src, dest) {
  const { DatabaseSync } = await import('node:sqlite')
  if (!fs.existsSync(src)) throw new Error(`Banco não encontrado: ${src}`)
  const db = new DatabaseSync(src, { readOnly: true })
  db.prepare('VACUUM INTO ?').run(dest) // exige que o destino não exista
  db.close()
}

try {
  if (process.env.TURSO_DATABASE_URL) {
    const dest = process.argv[2] || `backup-${new Date().toISOString().slice(0, 10)}.sql`
    if (fs.existsSync(dest)) fs.rmSync(dest)
    const counts = await dumpTurso(dest)
    console.log(`Backup do Turso gravado em ${dest} (${fs.statSync(dest).size} bytes). Linhas: ${JSON.stringify(counts)}`)
  } else {
    const src = process.env.DB_PATH || path.join(here, 'data.db')
    const dest = process.argv[2] || `${src}.backup`
    if (fs.existsSync(dest)) fs.rmSync(dest)
    await copyLocal(src, dest)
    console.log(`Backup gravado em ${dest} (${fs.statSync(dest).size} bytes)`)
  }
} catch (e) {
  console.error(e.message)
  process.exit(1)
}
