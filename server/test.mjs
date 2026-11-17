// Teste de fumaça da API: node server/test.mjs
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createApp } from './app.js'

// --libsql (ou TEST_DB=libsql) roda a mesma suíte no motor libSQL/Turso, usando arquivos locais (sem conta no Turso).
const mode = process.argv.includes('--libsql') || process.env.TEST_DB === 'libsql' ? 'libsql' : 'sqlite'
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'd30db-'))
let nDb = 0
const dbOpts = () =>
  mode === 'libsql' ? { url: 'file:' + path.join(tmpRoot, `t${nDb++}.db`).replaceAll('\\', '/') } : { dbPath: ':memory:' }
console.log('motor de banco:', mode, '\n')

const { server } = await createApp(dbOpts())
await new Promise(r => server.listen(0, r))
const base = `http://localhost:${server.address().port}/api`

async function call(method, path, body, token) {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  return { status: res.status, body: await res.json() }
}

const today = '2026-11-17'
const day = (n) => `2026-11-${String(17 + n).padStart(2, '0')}`
let passed = 0
const ok = (name, fn) => fn().then(() => { passed++; console.log('ok  ', name) }, (e) => { console.error('FAIL', name, '\n', e.message); process.exitCode = 1 })

let A, B, group
await ok('cria grupo e devolve código + dono', async () => {
  const r = await call('POST', '/groups', { name: 'Enfermagem 26', icon: '🌱', today, member: { name: 'Ana', avatar: '🦋' } })
  assert.equal(r.status, 201)
  assert.match(r.body.group.code, /^ENFER30-[0-9A-F]{3}$/)
  assert.equal(r.body.member.owner, true)
  A = r.body.member; group = r.body.group
})

await ok('rejeita grupo sem nome', async () => {
  const r = await call('POST', '/groups', { name: ' ', icon: '🌱', member: { name: 'x', avatar: 'y' } })
  assert.equal(r.status, 400)
})

await ok('entra com código (minúsculo) e não é dono', async () => {
  const r = await call('POST', '/groups/join', { code: group.code.toLowerCase(), member: { name: 'Beto', avatar: '🦁' } })
  assert.equal(r.status, 200)
  assert.equal(r.body.member.owner, false)
  assert.equal(r.body.group.start, today)
  B = r.body.member
})

await ok('código inexistente dá 404', async () => {
  assert.equal((await call('POST', '/groups/join', { code: 'NADA30-000', member: { name: 'x', avatar: 'y' } })).status, 404)
})

await ok('sync exige token', async () => {
  assert.equal((await call('PUT', '/sync', { days: [] })).status, 401)
  assert.equal((await call('PUT', '/sync', { days: [] }, 'f'.repeat(48))).status, 401)
})

await ok('sync + ranking ordenam por pontos, com semanas e títulos', async () => {
  await call('PUT', '/sync', { streak: 3, best: 3, days: [
    { date: day(0), pts: 50, water: 2250, activity: 30, sleep: 7.5 },
    { date: day(1), pts: 40, water: 1000, activity: 10, sleep: 6 },
    { date: day(8), pts: 20, water: 500, activity: 0, sleep: 0 },
  ] }, A.token)
  await call('PUT', '/sync', { streak: 1, best: 1, days: [{ date: day(0), pts: 90, water: 250, activity: 60, sleep: 8 }] }, B.token)
  const r = await call('GET', `/groups/${group.code}/ranking`, null, A.token)
  assert.equal(r.status, 200)
  assert.deepEqual(r.body.members.map(m => [m.name, m.total]), [['Ana', 110], ['Beto', 90]])
  assert.deepEqual(r.body.members[0].weeks, [90, 20, 0, 0])
  assert.equal(r.body.me.rank, 1)
  assert.equal(r.body.titles.water.name, 'Ana')
  assert.equal(r.body.titles.activity.name, 'Beto')
  assert.equal(r.body.titles.consistent.name, 'Ana')
})

await ok('sync é idempotente (upsert, não soma)', async () => {
  await call('PUT', '/sync', { streak: 3, best: 3, days: [{ date: day(0), pts: 50, water: 2250, activity: 30, sleep: 7.5 }] }, A.token)
  const r = await call('GET', `/groups/${group.code}/ranking`, null, B.token)
  assert.equal(r.body.members.find(m => m.name === 'Ana').total, 110)
  assert.equal(r.body.me.rank, 2)
})

await ok('ignora datas fora da temporada e limita pontos absurdos', async () => {
  await call('PUT', '/sync', { days: [{ date: '2020-01-01', pts: 100, water: 0, activity: 0, sleep: 0 }, { date: day(2), pts: 99999, water: 0, activity: 0, sleep: 0 }] }, B.token)
  const r = await call('GET', `/groups/${group.code}/ranking`, null, B.token)
  assert.equal(r.body.members.find(m => m.me).total, 90 + 200)
})

await ok('quem desliga o compartilhamento some do ranking dos outros', async () => {
  await call('PUT', '/sync', { share: false, days: [] }, B.token)
  const forA = await call('GET', `/groups/${group.code}/ranking`, null, A.token)
  assert.deepEqual(forA.body.members.map(m => m.name), ['Ana'])
  const forB = await call('GET', `/groups/${group.code}/ranking`, null, B.token)
  assert.equal(forB.body.members.length, 2)
  await call('PUT', '/sync', { share: true, days: [] }, B.token)
})

await ok('ranking de outro grupo é proibido', async () => {
  const other = await call('POST', '/groups', { name: 'Outro', icon: '🔥', member: { name: 'Zé', avatar: '🐯' } })
  const r = await call('GET', `/groups/${other.body.group.code}/ranking`, null, A.token)
  assert.equal(r.status, 403)
})

await ok('só o dono gera novo código; o antigo deixa de valer', async () => {
  assert.equal((await call('POST', `/groups/${group.code}/code`, {}, B.token)).status, 403)
  const r = await call('POST', `/groups/${group.code}/code`, {}, A.token)
  assert.equal(r.status, 200)
  assert.notEqual(r.body.group.code, group.code)
  assert.equal((await call('POST', '/groups/join', { code: group.code, member: { name: 'x', avatar: 'y' } })).status, 404)
  group = r.body.group
})

await ok('só o dono inicia temporada; pontos zeram e start muda', async () => {
  assert.equal((await call('POST', `/groups/${group.code}/season`, { today: day(5) }, B.token)).status, 403)
  const s = await call('POST', `/groups/${group.code}/season`, { today: day(5) }, A.token)
  assert.equal(s.body.group.season, 2)
  assert.equal(s.body.group.start, day(5))
  const r = await call('GET', `/groups/${group.code}/ranking`, null, B.token)
  assert.ok(r.body.members.every(m => m.total === 0))
})

await ok('apagar dados remove o membro', async () => {
  assert.equal((await call('DELETE', '/me', null, B.token)).status, 200)
  assert.equal((await call('GET', `/groups/${group.code}/ranking`, null, B.token)).status, 401)
  const r = await call('GET', `/groups/${group.code}/ranking`, null, A.token)
  assert.deepEqual(r.body.members.map(m => m.name), ['Ana'])
})

await ok('rota inexistente e JSON inválido', async () => {
  assert.equal((await call('GET', '/nada')).status, 404)
  const res = await fetch(base + '/groups', { method: 'POST', body: '{oops' })
  assert.equal(res.status, 400)
})

/* ---------- produção: limites, cabeçalhos e arquivos estáticos ---------- */
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'd30-'))
fs.mkdirSync(path.join(dir, 'assets'))
fs.writeFileSync(path.join(dir, 'index.html'), '<!doctype html><title>app</title>')
fs.writeFileSync(path.join(dir, 'assets', 'app-abc123.js'), 'console.log(1)')
fs.writeFileSync(path.join(os.tmpdir(), 'd30-segredo.txt'), 'nao pode vazar')

const prod = await createApp({ ...dbOpts(), staticDir: dir, trustProxy: true, rateLimit: { strict: 3, general: 6, windowMs: 60_000 } })
await new Promise(r => prod.server.listen(0, r))
const root = `http://localhost:${prod.server.address().port}`
const get = (p, headers) => fetch(root + p, { headers })
const mk = (ip) => fetch(`${root}/api/groups`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Fly-Client-IP': ip }, body: JSON.stringify({ name: 'G', icon: '🌱', member: { name: 'a', avatar: 'b' } }) })

await ok('serve o app, com SPA fallback e cabeçalhos de segurança', async () => {
  const r = await get('/qualquer/rota')
  assert.equal(r.status, 200)
  assert.match(await r.text(), /<title>app<\/title>/)
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff')
  assert.equal(r.headers.get('x-frame-options'), 'DENY')
  assert.match(r.headers.get('content-security-policy'), /default-src 'self'/)
  assert.equal(r.headers.get('cache-control'), 'no-cache')
})

await ok('assets com hash têm cache longo e tipo correto', async () => {
  const r = await get('/assets/app-abc123.js')
  assert.equal(r.status, 200)
  assert.match(r.headers.get('cache-control'), /immutable/)
  assert.match(r.headers.get('content-type'), /javascript/)
})

await ok('path traversal não vaza arquivos fora de dist', async () => {
  for (const p of ['/..%2Fd30-segredo.txt', '/%2e%2e/d30-segredo.txt', '/..%5Cd30-segredo.txt', '/%00']) {
    const r = await get(p)
    assert.ok(!(await r.text()).includes('nao pode vazar'), p)
  }
})

await ok('respostas da API também levam cabeçalhos de segurança e não são cacheadas', async () => {
  const r = await get('/api/health')
  assert.equal(r.status, 200)
  assert.equal(r.headers.get('cache-control'), 'no-store')
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff')
})

await ok('limite estrito: 4ª criação do mesmo IP dá 429 com Retry-After', async () => {
  for (let i = 0; i < 3; i++) assert.equal((await mk('10.0.0.1')).status, 201)
  const r = await mk('10.0.0.1')
  assert.equal(r.status, 429)
  assert.ok(Number(r.headers.get('retry-after')) > 0)
})

await ok('atrás de proxy, cada IP real tem seu próprio limite', async () => {
  assert.equal((await mk('10.0.0.2')).status, 201)
})

await ok('limite geral vale para o resto da API, mas /health nunca é limitado', async () => {
  for (let i = 0; i < 6; i++) assert.equal((await get('/api/nada', { 'Fly-Client-IP': '10.0.0.3' })).status, 404)
  assert.equal((await get('/api/nada', { 'Fly-Client-IP': '10.0.0.3' })).status, 429)
  for (let i = 0; i < 20; i++) assert.equal((await get('/api/health', { 'Fly-Client-IP': '10.0.0.3' })).status, 200)
})

await ok('sem TRUST_PROXY, o cabeçalho de IP é ignorado (não dá para burlar o limite)', async () => {
  const s = await createApp({ ...dbOpts(), rateLimit: { strict: 2 } })
  await new Promise(r => s.server.listen(0, r))
  const url = `http://localhost:${s.server.address().port}/api/groups`
  const post = (ip) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Fly-Client-IP': ip, 'X-Forwarded-For': ip }, body: JSON.stringify({ name: 'G', icon: '🌱', member: { name: 'a', avatar: 'b' } }) })
  assert.equal((await post('1.1.1.1')).status, 201)
  assert.equal((await post('2.2.2.2')).status, 201)
  assert.equal((await post('3.3.3.3')).status, 429)
  s.server.close()
})

/* ---------- função serverless da Vercel (api/[...path].js) ---------- */
import http from 'node:http'
import { pathToFileURL } from 'node:url'

const vercelFn = (await import(pathToFileURL(path.resolve(import.meta.dirname, '..', 'api', '[...path].js')).href)).default
// Emula a Vercel: o corpo chega já lido em req.body (objeto se for JSON, string nos demais casos).
const vercelServer = http.createServer(async (req, res) => {
  const chunks = []
  for await (const c of req) chunks.push(c)
  const raw = Buffer.concat(chunks).toString()
  if (raw) req.body = (req.headers['content-type'] || '').includes('json') ? JSON.parse(raw) : raw
  await vercelFn(req, res)
})
await new Promise(r => vercelServer.listen(0, r))
const vbase = `http://localhost:${vercelServer.address().port}/api`
const vcall = (method, p, body, token, type = 'application/json') =>
  fetch(vbase + p, { method, headers: { 'Content-Type': type, ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined })

await ok('Vercel: sem TURSO_DATABASE_URL recusa com 503 (não cai num banco que se perde)', async () => {
  delete process.env.TURSO_DATABASE_URL
  const r = await vcall('GET', '/health')
  assert.equal(r.status, 503)
  assert.match((await r.json()).error, /banco de dados/i)
})

let V
await ok('Vercel: com banco configurado, cria grupo recebendo req.body já lido', async () => {
  process.env.TURSO_DATABASE_URL = 'file:' + path.join(tmpRoot, 'vercel.db').replaceAll('\\', '/')
  const r = await vcall('POST', '/groups', { name: 'Vercel', icon: '🌱', today, member: { name: 'Vi', avatar: '🦊' } })
  assert.equal(r.status, 201)
  V = await r.json()
  assert.match(V.group.code, /^VERCE30-/)
})

await ok('Vercel: rota aninhada (ranking), sync e corpo recebido como string', async () => {
  const s = await vcall('PUT', '/sync', { streak: 2, best: 2, days: [{ date: today, pts: 42, water: 0, activity: 0, sleep: 0 }] }, V.member.token, 'text/plain')
  assert.equal(s.status, 200)
  const r = await vcall('GET', `/groups/${V.group.code}/ranking`, null, V.member.token)
  assert.equal(r.status, 200)
  const body = await r.json()
  assert.deepEqual(body.members.map(m => [m.name, m.total, m.avatar]), [['Vi', 42, '🦊']])
})

await ok('Vercel: não-API devolve 404 JSON e erros do app continuam com status certo', async () => {
  assert.equal((await vcall('GET', '/nada')).status, 404)
  assert.equal((await vcall('GET', `/groups/${V.group.code}/ranking`)).status, 401)
})

vercelServer.close()
delete process.env.TURSO_DATABASE_URL
prod.server.close()
fs.rmSync(dir, { recursive: true, force: true })
fs.rmSync(path.join(os.tmpdir(), 'd30-segredo.txt'), { force: true })
setTimeout(() => { try { fs.rmSync(tmpRoot, { recursive: true, force: true }) } catch {} }, 300).unref()
console.log(`\n${passed} testes passaram`)
server.close()
