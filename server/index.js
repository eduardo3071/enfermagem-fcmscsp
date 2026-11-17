import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createApp } from './app.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const port = Number(process.env.PORT) || 3001
const dbPath = process.env.DB_PATH || path.join(here, 'data.db')
// Com TURSO_DATABASE_URL o servidor usa o Turso em vez do arquivo local (útil sem disco persistente).
const url = process.env.TURSO_DATABASE_URL || undefined
const authToken = process.env.TURSO_AUTH_TOKEN || undefined
// Atrás de proxy (Fly.io, Railway, Render, nginx): TRUST_PROXY=1 para o limite de requisições ver o IP real.
const trustProxy = ['1', 'true'].includes(String(process.env.TRUST_PROXY).toLowerCase())

const { server, close } = await createApp({ dbPath, url, authToken, staticDir: path.join(here, '..', 'dist'), trustProxy })
server.listen(port, '0.0.0.0', () =>
  console.log(`API em http://0.0.0.0:${port} (banco: ${url ? 'Turso' : dbPath}, proxy confiável: ${trustProxy})`))

// Desligamento limpo: para de aceitar conexões, fecha o banco (consolida o WAL) e sai.
let closing = false
function shutdown(signal) {
  if (closing) return
  closing = true
  console.log(`${signal} recebido, encerrando…`)
  server.close(async () => { try { await close() } catch {} process.exit(0) })
  setTimeout(() => process.exit(1), 8000).unref()
}
for (const s of ['SIGTERM', 'SIGINT']) process.on(s, () => shutdown(s))
