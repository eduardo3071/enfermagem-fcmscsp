// Backup consistente do SQLite (seguro com o app rodando, mesmo em modo WAL).
// Uso: node --no-warnings server/backup.js [destino]   (padrão: <DB_PATH>.backup)
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'

const here = path.dirname(fileURLToPath(import.meta.url))
const src = process.env.DB_PATH || path.join(here, 'data.db')
const dest = process.argv[2] || `${src}.backup`

if (!fs.existsSync(src)) { console.error(`Banco não encontrado: ${src}`); process.exit(1) }
if (fs.existsSync(dest)) fs.rmSync(dest) // VACUUM INTO exige que o destino não exista

const db = new DatabaseSync(src, { readOnly: true })
db.prepare('VACUUM INTO ?').run(dest)
db.close()
console.log(`Backup gravado em ${dest} (${fs.statSync(dest).size} bytes)`)
