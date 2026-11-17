// Função serverless da Vercel: recebe qualquer /api/* e delega ao mesmo handler do servidor Node.
// Na Vercel o disco não persiste, então o banco é obrigatoriamente o Turso (TURSO_DATABASE_URL).
import { createApp } from '../server/app.js'

let app // reaproveitado enquanto a instância da função estiver "quente"

function init() {
  app ??= createApp({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
    trustProxy: true, // a Vercel sobrescreve X-Forwarded-For, então o IP é confiável
  }).catch((e) => { app = undefined; throw e }) // falha de conexão não fica "grudada" na instância
  return app
}

const fail = (res, status, error) => {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify({ error }))
}

export default async function handler(req, res) {
  // Sem isso o app cairia num SQLite em memória e perderia tudo a cada execução, sem avisar.
  if (!process.env.TURSO_DATABASE_URL) {
    console.error('TURSO_DATABASE_URL não está configurada.')
    return fail(res, 503, 'Servidor sem banco de dados configurado.')
  }
  try {
    const { handler: handle } = await init()
    await handle(req, res)
  } catch (e) {
    console.error(e)
    if (!res.headersSent) fail(res, 500, 'Erro interno.')
  }
}
