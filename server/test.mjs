// Testes da API e do código compartilhado: npm test
// Roda a mesma suíte nos dois motores: SQLite local e libSQL/Turso (este com arquivos locais, sem conta no Turso).
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { createApp } from './app.js'
import { addDays, dayPoints, streakStats, taskPoints, MAX_DAY_POINTS } from '../shared/scoring.js'

const mode = process.argv.includes('--libsql') || process.env.TEST_DB === 'libsql' ? 'libsql' : 'sqlite'
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'd30db-'))
let nDb = 0
const fileUrl = (f) => 'file:' + f.replaceAll('\\', '/')
const newDbFile = () => path.join(tmpRoot, `t${nDb++}.db`)
const FIXED = new Date('2026-11-17T15:00:00Z') // "hoje" do servidor no início dos testes
let serverNow = FIXED
let clockDay = 0
// Avança o relógio do servidor (como passaria um dia de verdade). O app só pode informar "hoje" com até 1 dia de diferença.
const setClock = (n) => { clockDay = n; serverNow = new Date(`${addDays('2026-11-17', n)}T15:00:00Z`) }
const dbOpts = () => ({ ...(mode === 'libsql' ? { url: fileUrl(newDbFile()) } : { dbPath: ':memory:' }), now: () => serverNow })
console.log('motor de banco:', mode, '\n')

let passed = 0
let failed = 0
const ok = (name, fn) => fn().then(
  () => { passed++; console.log('ok  ', name) },
  (e) => { failed++; process.exitCode = 1; console.error('FAIL', name, '\n    ', e.message) },
)

const today = '2026-11-17'
const day = (n) => addDays(today, n)

/* ======================= código compartilhado ======================= */
await ok('pontos: regras do dia (máximo 100) e metas personalizadas', async () => {
  const full = { food: 4, water: 2250, activity: 45, sleep: 8, weight: true, mood: true }
  assert.equal(dayPoints(full), MAX_DAY_POINTS)
  assert.deepEqual(taskPoints({ food: 3, water: 1000, activity: 10, sleep: 4, weight: 82.5, mood: 4 }, { water: 2000, sleep: 8 }),
    { food: 15, water: 10, activity: 10, sleep: 4, weight: 5, mood: 10 })
  assert.equal(dayPoints({}), 0)
  assert.equal(dayPoints({ weight: 0, mood: null }), 0)
})

await ok('sequência: hoje vazio não quebra; resgate cobre buraco; melhor sequência', async () => {
  const active = new Set([day(0), day(1), day(2), day(4)])
  const s = (set, t) => streakStats({ isActive: (k) => set.has(k), start: day(0), today: t })
  assert.deepEqual(s(active, day(2)), { streak: 3, best: 3 })
  assert.deepEqual(s(active, day(3)), { streak: 3, best: 3 }) // hoje ainda sem registro: conta até ontem
  assert.deepEqual(s(active, day(4)), { streak: 1, best: 3 }) // dia 3 vazio quebrou
  assert.deepEqual(s(new Set([...active, day(3)]), day(4)), { streak: 5, best: 5 }) // resgate no dia 3
  assert.deepEqual(s(new Set(), day(5)), { streak: 0, best: 0 })
})

/* ======================= API ======================= */
const app0 = await createApp({ ...dbOpts(), rateLimit: { failMax: 100000, strict: 100000 } })
const { server } = app0
await new Promise(r => server.listen(0, r))
const base =`http://localhost:${server.address().port}/api`

async function call(method, p, body, token, headers = {}) {
  const res = await fetch(base + p, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  })
  return { status: res.status, body: await res.json(), headers: res.headers }
}
const member = (name, extra = {}) => ({ name, avatar: '🦋', ...extra })
const sync = (token, days, extra = {}) => call('PUT', '/sync', { today: day(clockDay), days, ...extra }, token)
const rank = (code, token) => call('GET', `/groups/${code}/ranking`, null, token)

let A, B, C, D, group
await ok('cria grupo: código longo e sem caracteres ambíguos, criador é dono', async () => {
  const r = await call('POST', '/groups', { name: 'Enfermagem 26', icon: '🌱', today, member: member('Ana', { pin: '1234', goals: { water: 2000, sleep: 7 } }) })
  assert.equal(r.status, 201)
  assert.match(r.body.group.code, /^ENFER-[A-HJ-KM-NP-Z2-9]{6}$/)
  assert.equal(r.body.member.owner, true)
  assert.ok(!('pin' in r.body.member) && !('pin_hash' in r.body.member))
  A = r.body.member; group = r.body.group
})

await ok('rejeita grupo sem nome, nome ofensivo, PIN inválido e data absurda', async () => {
  const m = member('x')
  assert.equal((await call('POST', '/groups', { name: ' ', icon: '🌱', member: m })).status, 400)
  assert.equal((await call('POST', '/groups', { name: 'Caralho Club', icon: '🌱', member: m })).status, 400)
  assert.equal((await call('POST', '/groups', { name: 'Ok', icon: '🌱', member: member('x', { pin: '12' }) })).status, 400)
  assert.equal((await call('POST', '/groups', { name: 'Ok', icon: '🌱', member: member('x', { pin: 'abcd' }) })).status, 400)
  assert.equal((await call('POST', '/groups', { name: 'Ok', icon: '🌱', today: '2030-01-01', member: m })).status, 400)
})

await ok('entra com código em minúsculas; nome repetido (sem acento/caixa) e ofensivo são recusados', async () => {
  const r = await call('POST', '/groups/join', { code: group.code.toLowerCase(), member: member('Beto', { pin: '5678' }) })
  assert.equal(r.status, 200)
  assert.equal(r.body.member.owner, false)
  assert.equal(r.body.group.start, today)
  B = r.body.member
  assert.equal((await call('POST', '/groups/join', { code: group.code, member: member('  ANA ') })).status, 409)
  assert.equal((await call('POST', '/groups/join', { code: group.code, member: member('Fdp') })).status, 400)
  assert.equal((await call('POST', '/groups/join', { code: 'NADA-AAAAAA', member: member('Zé') })).status, 404)
})

await ok('sync exige token válido', async () => {
  assert.equal((await call('PUT', '/sync', { days: [] })).status, 401)
  assert.equal((await call('PUT', '/sync', { days: [] }, 'f'.repeat(48))).status, 401)
})

await ok('pontos são calculados no SERVIDOR: "pts" e "streak" enviados pelo aparelho são ignorados', async () => {
  setClock(1)
  const a = await sync(A.token, [
    { date: day(0), food: 3, water: 2000, activity: 30, sleep: 7, weight: true, mood: true, pts: 9999 }, // 15+20+30+15+5+10 = 95
    { date: day(1), food: 1, water: 1000, activity: 10, sleep: 0, weight: false, mood: false },          // 5+10+10 = 25
    { date: day(8), food: 0, water: 0, activity: 5, sleep: 0, weight: false, mood: false },               // 5
  ], { today: day(1), streak: 999, best: 999, goals: { water: 2000, sleep: 7 } })
  assert.equal(a.status, 200)
  assert.deepEqual([a.body.streak, a.body.best], [2, 2]) // calculado: dias 0 e 1
  await sync(B.token, [{ date: day(0), food: 6, water: 250, activity: 60, sleep: 8, weight: false, mood: false }], { today: day(1) }) // 20+2+30+15 = 67
  const r = await rank(group.code, A.token)
  assert.deepEqual(r.body.members.map(m => [m.name, m.total]), [['Ana', 125], ['Beto', 67]])
  assert.deepEqual(r.body.members[0].weeks, [120, 5, 0, 0])
  assert.equal(r.body.me.rank, 1)
  assert.deepEqual(r.body.members.map(m => m.streak), [2, 1])
})

await ok('títulos do grupo seguem os totais brutos', async () => {
  const r = await rank(group.code, A.token)
  assert.equal(r.body.titles.water.name, 'Ana')
  assert.equal(r.body.titles.activity.name, 'Beto')
  assert.equal(r.body.titles.sleep.name, 'Beto')
  assert.equal(r.body.titles.consistent.name, 'Ana')
})

await ok('sync é idempotente e ignora datas fora do desafio (antes do início ou depois do dia 30)', async () => {
  await sync(A.token, [
    { date: day(0), food: 3, water: 2000, activity: 30, sleep: 7, weight: true, mood: true },
    { date: day(-1), food: 6, water: 9999, activity: 99, sleep: 9, weight: true, mood: true },
    { date: day(30), food: 6, water: 9999, activity: 99, sleep: 9, weight: true, mood: true },
    { date: 'não é data', food: 6 },
  ], { today: day(1) })
  const r = await rank(group.code, B.token)
  assert.equal(r.body.members.find(m => m.name === 'Ana').total, 95 + 25 + 5) // dia 1 e 8 continuam gravados
})

await ok('sequência: resgate ("saved") cobre buraco e hoje vazio não quebra', async () => {
  setClock(3)
  let r = await sync(A.token, [], { today: day(3) }) // dias 2 e 3 vazios
  assert.deepEqual([r.body.streak, r.body.best], [0, 2])
  r = await sync(A.token, [], { today: day(3), saved: [day(2), day(2), day(40)] }) // só o dia 2 vale
  assert.deepEqual([r.body.streak, r.body.best], [3, 3])
})

await ok('"hoje" do aparelho com mais de 1 dia de diferença do servidor é recusado', async () => {
  assert.equal((await sync(A.token, [], { today: day(5) })).status, 400)
  assert.equal((await sync(A.token, [], { today: day(4) })).status, 200) // 1 dia de folga (fusos)
  assert.equal((await sync(A.token, [], { today: 'ontem' })).status, 400)
})

await ok('app antigo (só "pts") é aceito, mas com teto de 100 por dia', async () => {
  const j = await call('POST', '/groups/join', { code: group.code, member: member('Cleo') })
  C = j.body.member
  await call('PUT', '/sync', { today: day(3), days: [{ date: day(0), pts: 9999, water: 100, activity: 0, sleep: 0 }] }, C.token)
  const r = await rank(group.code, C.token)
  assert.equal(r.body.members.find(m => m.name === 'Cleo').total, 100)
})

await ok('quem desliga o compartilhamento some do ranking dos outros, mas se vê', async () => {
  await sync(C.token, [], { share: false })
  assert.ok(!(await rank(group.code, A.token)).body.members.some(m => m.name === 'Cleo'))
  assert.ok((await rank(group.code, C.token)).body.members.some(m => m.name === 'Cleo'))
  await sync(C.token, [], { share: true })
})

await ok('ranking de outro grupo é proibido', async () => {
  const other = await call('POST', '/groups', { name: 'Outro', icon: '🔥', member: member('Zé') })
  assert.equal((await rank(other.body.group.code, A.token)).status, 403)
})

await ok('ranking diz se a pessoa já tem PIN', async () => {
  assert.equal((await rank(group.code, A.token)).body.me.hasPin, true)
  assert.equal((await rank(group.code, C.token)).body.me.hasPin, false)
  assert.equal((await call('PUT', '/me/pin', { pin: '12' }, C.token)).status, 400)
  assert.equal((await call('PUT', '/me/pin', { pin: '4321' }, C.token)).status, 200)
  assert.equal((await rank(group.code, C.token)).body.me.hasPin, true)
})

/* ----- recuperação de acesso ----- */
const recover = (code, name, pin, headers) => call('POST', '/recover', { code, name, pin }, null, headers)

await ok('recuperar: PIN errado 5x bloqueia a conta, mesmo com o PIN certo depois', async () => {
  const j = await call('POST', '/groups/join', { code: group.code, member: member('Dani', { pin: '9999' }) })
  D = j.body.member
  for (let i = 0; i < 5; i++) assert.equal((await recover(group.code, 'Dani', '0000')).status, 401)
  const locked = await recover(group.code, 'Dani', '9999')
  assert.equal(locked.status, 429)
  assert.ok(Number(locked.headers.get('retry-after')) > 0)
})

await ok('recuperar: dados errados dão a MESMA resposta (não revela se grupo/nome existem)', async () => {
  const msgs = new Set()
  for (const [c, n, p] of [['NADA-AAAAAA', 'Ana', '1234'], [group.code, 'Ninguém', '1234'], [group.code, 'Ana', '0000'], [group.code, 'Cleo', 'abc']]) {
    const r = await recover(c, n, p)
    assert.equal(r.status, 401)
    msgs.add(r.body.error)
  }
  assert.equal(msgs.size, 1)
})

await ok('recuperar: sem PIN cadastrado não entra', async () => {
  const j = await call('POST', '/groups/join', { code: group.code, member: member('Edu') })
  assert.equal((await recover(group.code, 'Edu', '1234')).status, 401)
  await call('DELETE', '/me', null, j.body.member.token)
})

await ok('recuperar: PIN certo (nome sem acento/caixa) devolve registros, metas e resgates e troca o token', async () => {
  await sync(A.token, [
    { date: day(0), food: 3, water: 2000, activity: 30, sleep: 7, weight: true, mood: true },
    { date: day(1), food: 1, water: 1000, activity: 10, sleep: 0, weight: false, mood: false },
  ], { today: day(3), saved: [day(2)], goals: { water: 2000, sleep: 7 } })
  const r = await recover(group.code.toLowerCase(), '  ANA ', '1234')
  assert.equal(r.status, 200)
  assert.equal(r.body.member.name, 'Ana')
  assert.equal(r.body.member.owner, true)
  assert.deepEqual(r.body.goals, { water: 2000, sleep: 7 })
  assert.deepEqual(r.body.saved, [day(2)])
  assert.deepEqual(r.body.days.find(d => d.date === day(0)), { date: day(0), food: 3, water: 2000, activity: 30, sleep: 7, weight: true, mood: true })
  assert.notEqual(r.body.member.token, A.token)
  assert.equal((await rank(group.code, A.token)).status, 401) // token antigo morreu
  A = { ...A, token: r.body.member.token }
  assert.equal((await rank(group.code, A.token)).status, 200)
})

/* ----- moderação ----- */
await ok('só o dono administra: os outros recebem 403 em tudo', async () => {
  const nonOwner = B.token
  assert.equal((await call('GET', `/groups/${group.code}/members`, null, nonOwner)).status, 403)
  assert.equal((await call('POST', `/groups/${group.code}/code`, {}, nonOwner)).status, 403)
  assert.equal((await call('POST', `/groups/${group.code}/season`, { today }, nonOwner)).status, 403)
  assert.equal((await call('POST', `/groups/${group.code}/owner`, { memberId: B.id }, nonOwner)).status, 403)
  assert.equal((await call('DELETE', `/groups/${group.code}/members/${C.id}`, null, nonOwner)).status, 403)
  assert.equal((await call('DELETE', `/groups/${group.code}`, null, nonOwner)).status, 403)
})

await ok('dono lista, remove membro (que perde o acesso) e não remove a si mesmo', async () => {
  const list = await call('GET', `/groups/${group.code}/members`, null, A.token)
  assert.deepEqual(list.body.members.map(m => m.name), ['Ana', 'Beto', 'Cleo', 'Dani'])
  assert.equal((await call('DELETE', `/groups/${group.code}/members/${A.id}`, null, A.token)).status, 400)
  assert.equal((await call('DELETE', `/groups/${group.code}/members/${D.id}`, null, A.token)).status, 200)
  assert.equal((await rank(group.code, D.token)).status, 401)
  assert.equal((await call('DELETE', `/groups/${group.code}/members/nao-existe`, null, A.token)).status, 404)
})

await ok('novo código só pelo dono; o antigo deixa de valer', async () => {
  const r = await call('POST', `/groups/${group.code}/code`, {}, A.token)
  assert.equal(r.status, 200)
  assert.notEqual(r.body.group.code, group.code)
  assert.match(r.body.group.code, /^ENFER-[A-HJ-KM-NP-Z2-9]{6}$/)
  assert.equal((await call('POST', '/groups/join', { code: group.code, member: member('Fulano') })).status, 404)
  // quem ainda tem o código antigo no aparelho continua entrando pelo apelido "me" e recebe o código novo
  const old = await rank(group.code, B.token)
  assert.equal(old.status, 403)
  const viaMe = await rank('me', B.token)
  assert.equal(viaMe.status, 200)
  assert.equal(viaMe.body.group.code, r.body.group.code)
  group = r.body.group
})

await ok('dono não pode sair com o grupo cheio; transfere a posse e então sai', async () => {
  assert.equal((await call('DELETE', '/me', null, A.token)).status, 409)
  assert.equal((await call('POST', `/groups/${group.code}/owner`, { memberId: A.id }, A.token)).status, 400)
  assert.equal((await call('POST', `/groups/${group.code}/owner`, { memberId: 'nao-existe' }, A.token)).status, 404)
  assert.equal((await call('POST', `/groups/${group.code}/owner`, { memberId: B.id }, A.token)).status, 200)
  assert.equal((await rank(group.code, B.token)).body.me.owner, true)
  assert.equal((await rank(group.code, A.token)).body.me.owner, false)
  assert.equal((await call('DELETE', '/me', null, A.token)).status, 200)
  assert.equal((await rank(group.code, A.token)).status, 401)
})

await ok('nova temporada: zera pontos e sequências, apaga a temporada anterior e muda o início', async () => {
  const before = await rank(group.code, B.token)
  assert.ok(before.body.members.find(m => m.me).total > 0)
  const s = await call('POST', `/groups/${group.code}/season`, { today: day(3) }, B.token)
  assert.equal(s.body.group.season, 2)
  assert.equal(s.body.group.start, day(3))
  const r = await rank(group.code, B.token)
  assert.ok(r.body.members.every(m => m.total === 0 && m.streak === 0))
  const old = await app0.db.get('SELECT COUNT(*) AS n FROM days WHERE season < 2')
  assert.equal(old.n, 0) // dias da temporada 1 foram apagados
})

await ok('excluir grupo (dono) remove tudo; último a sair leva o grupo junto', async () => {
  assert.equal((await call('DELETE', '/me', null, C.token)).status, 200) // Cleo sai
  const last = await call('POST', '/groups', { name: 'Solo', icon: '🌱', member: member('Solo') })
  assert.equal((await call('DELETE', '/me', null, last.body.member.token)).status, 200)
  assert.equal((await call('POST', '/groups/join', { code: last.body.group.code, member: member('Tarde') })).status, 404)
  assert.equal((await call('DELETE', `/groups/${group.code}`, null, B.token)).status, 200)
  assert.equal((await call('POST', '/groups/join', { code: group.code, member: member('Tarde') })).status, 404)
  assert.equal((await rank(group.code, B.token)).status, 401)
})

await ok('rota inexistente e JSON inválido', async () => {
  assert.equal((await call('GET', '/nada')).status, 404)
  const res = await fetch(base + '/groups', { method: 'POST', body: '{oops' })
  assert.equal(res.status, 400)
})

/* ======================= limites (gravados no banco) ======================= */
async function limited({ rateLimit, trustProxy = true }) {
  const s = await createApp({ ...dbOpts(), rateLimit, trustProxy })
  await new Promise(r => s.server.listen(0, r))
  const b = `http://localhost:${s.server.address().port}/api`
  const post = (p, body, ip) => fetch(b + p, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Fly-Client-IP': ip, 'X-Forwarded-For': ip }, body: JSON.stringify(body) })
  return { s, post, close: () => s.server.close() }
}

await ok('limite estrito (criar/entrar) vem do banco: 4ª criação do mesmo IP dá 429; outro IP passa', async () => {
  const L = await limited({ rateLimit: { strict: 3 } })
  const mk = (ip) => L.post('/groups', { name: 'G', icon: '🌱', member: member('a') }, ip)
  for (let i = 0; i < 3; i++) assert.equal((await mk('10.0.0.1')).status, 201)
  const r = await mk('10.0.0.1')
  assert.equal(r.status, 429)
  assert.ok(Number(r.headers.get('retry-after')) > 0)
  assert.equal((await mk('10.0.0.2')).status, 201)
  const rows = await L.s.db.all('SELECT key FROM rate_limits')
  assert.ok(rows.length >= 2 && rows.every(x => !/10\.0\.0\./.test(x.key)), 'o IP não pode ser gravado em texto puro')
  L.close()
})

await ok('tentativas de código erradas bloqueiam o IP (impede varrer códigos), acerto não conta', async () => {
  const L = await limited({ rateLimit: { failMax: 3, strict: 100 } })
  const created = await L.post('/groups', { name: 'Real', icon: '🌱', member: member('Dono') }, '9.9.9.9')
  const code = (await created.json()).group.code
  for (let i = 0; i < 3; i++) assert.equal((await L.post('/groups/join', { code: 'ZZZZ-AAAAAA', member: member('x') }, '1.1.1.1')).status, 404)
  const blocked = await L.post('/groups/join', { code, member: member('Intruso') }, '1.1.1.1') // até o código certo é barrado
  assert.equal(blocked.status, 429)
  assert.ok(Number(blocked.headers.get('retry-after')) > 0)
  assert.equal((await L.post('/groups/join', { code, member: member('Legitimo') }, '2.2.2.2')).status, 200) // outro IP segue normal
  L.close()
})

await ok('sem TRUST_PROXY o cabeçalho de IP é ignorado (não dá para burlar o limite)', async () => {
  const L = await limited({ rateLimit: { strict: 2 }, trustProxy: false })
  const mk = (ip) => L.post('/groups', { name: 'G', icon: '🌱', member: member('a') }, ip)
  assert.equal((await mk('1.1.1.1')).status, 201)
  assert.equal((await mk('2.2.2.2')).status, 201)
  assert.equal((await mk('3.3.3.3')).status, 429)
  L.close()
})

/* ======================= migração de banco no formato antigo ======================= */
await ok('migração: banco criado antes das migrações (esquema v1 com dados) abre, migra e continua funcionando', async () => {
  const legacyToken = 'a'.repeat(48)
  const v1 = [
    `CREATE TABLE groups (id TEXT PRIMARY KEY, code TEXT UNIQUE NOT NULL, name TEXT NOT NULL, icon TEXT NOT NULL, start TEXT NOT NULL, season INTEGER NOT NULL DEFAULT 1)`,
    `CREATE TABLE members (id TEXT PRIMARY KEY, group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE, name TEXT NOT NULL, avatar TEXT NOT NULL, token_hash TEXT UNIQUE NOT NULL, owner INTEGER NOT NULL DEFAULT 0, share INTEGER NOT NULL DEFAULT 1, streak INTEGER NOT NULL DEFAULT 0, best INTEGER NOT NULL DEFAULT 0)`,
    `CREATE TABLE days (member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE, season INTEGER NOT NULL, date TEXT NOT NULL, pts INTEGER NOT NULL, water INTEGER NOT NULL, activity INTEGER NOT NULL, sleep REAL NOT NULL, PRIMARY KEY (member_id, season, date))`,
    `INSERT INTO groups (id, code, name, icon, start, season) VALUES ('g1', 'LEG30-ABC', 'Antigo', '🌱', '${today}', 1)`,
    `INSERT INTO members (id, group_id, name, avatar, token_hash, owner, streak, best) VALUES ('m1', 'g1', 'Veterana', '🦊', '${crypto.createHash('sha256').update(legacyToken).digest('hex')}', 1, 3, 3)`,
    `INSERT INTO days (member_id, season, date, pts, water, activity, sleep) VALUES ('m1', 1, '${today}', 42, 1500, 20, 6)`,
  ]
  const file = newDbFile()
  if (mode === 'libsql') {
    const { createClient } = await import('@libsql/client')
    const c = createClient({ url: fileUrl(file) })
    for (const s of v1) await c.execute(s)
    c.close()
  } else {
    const { DatabaseSync } = await import('node:sqlite')
    const d = new DatabaseSync(file)
    for (const s of v1) d.exec(s)
    d.close()
  }
  const L = await createApp({ ...(mode === 'libsql' ? { url: fileUrl(file) } : { dbPath: file }), now: () => FIXED })
  await new Promise(r => L.server.listen(0, r))
  const b = `http://localhost:${L.server.address().port}/api`
  const get = (p, t) => fetch(b + p, { headers: { Authorization: `Bearer ${t}` } }).then(async r => ({ status: r.status, body: await r.json() }))
  const r = await get('/groups/LEG30-ABC/ranking', legacyToken)
  assert.equal(r.status, 200)
  assert.deepEqual(r.body.members.map(m => [m.name, m.total, m.streak]), [['Veterana', 42, 3]]) // dados antigos intactos
  assert.equal(r.body.me.hasPin, false)
  assert.deepEqual((await L.db.all('SELECT version FROM schema_migrations ORDER BY version')).map(x => x.version), [1, 2])
  const put = await fetch(b + '/sync', { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${legacyToken}` }, body: JSON.stringify({ today, days: [{ date: today, food: 2, water: 2250, activity: 30, sleep: 8, weight: false, mood: false }] }) })
  assert.equal(put.status, 200) // colunas novas existem e funcionam
  assert.equal((await get('/groups/LEG30-ABC/ranking', legacyToken)).body.members[0].total, 10 + 20 + 30 + 15)
  L.server.close()
  // abrir de novo não reaplica nada nem falha
  const again = await createApp({ ...(mode === 'libsql' ? { url: fileUrl(file) } : { dbPath: file }), now: () => FIXED })
  assert.equal((await again.db.get('SELECT COUNT(*) AS n FROM schema_migrations')).n, 2)
  await again.close()
})

/* ======================= produção: arquivos estáticos, cabeçalhos e cache ======================= */
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'd30-'))
fs.mkdirSync(path.join(dir, 'assets'))
fs.writeFileSync(path.join(dir, 'index.html'), '<!doctype html><title>app</title>')
fs.writeFileSync(path.join(dir, 'assets', 'app-abc123.js'), 'console.log(1)')
fs.writeFileSync(path.join(os.tmpdir(), 'd30-segredo.txt'), 'nao pode vazar')

const prod = await createApp({ ...dbOpts(), staticDir: dir, trustProxy: true, rateLimit: { general: 6 } })
await new Promise(r => prod.server.listen(0, r))
const root = `http://localhost:${prod.server.address().port}`
const get = (p, headers) => fetch(root + p, { headers })

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

await ok('respostas da API levam cabeçalhos de segurança e não são cacheadas', async () => {
  const r = await get('/api/health')
  assert.equal(r.status, 200)
  assert.equal(r.headers.get('cache-control'), 'no-store')
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff')
})

await ok('limite geral (memória) vale para o resto da API, mas /health nunca é limitado', async () => {
  for (let i = 0; i < 6; i++) assert.equal((await get('/api/nada', { 'Fly-Client-IP': '10.0.0.3' })).status, 404)
  assert.equal((await get('/api/nada', { 'Fly-Client-IP': '10.0.0.3' })).status, 429)
  for (let i = 0; i < 20; i++) assert.equal((await get('/api/health', { 'Fly-Client-IP': '10.0.0.3' })).status, 200)
})

/* ======================= função serverless da Vercel ======================= */
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
const realToday = new Date().toISOString().slice(0, 10) // a função da Vercel usa o relógio real

await ok('Vercel: sem TURSO_DATABASE_URL recusa com 503 (não cai num banco que se perde)', async () => {
  delete process.env.TURSO_DATABASE_URL
  const r = await vcall('GET', '/health')
  assert.equal(r.status, 503)
  assert.match((await r.json()).error, /banco de dados/i)
})

let V
await ok('Vercel: com banco configurado, cria grupo recebendo req.body já lido', async () => {
  process.env.TURSO_DATABASE_URL = fileUrl(path.join(tmpRoot, 'vercel.db'))
  const r = await vcall('POST', '/groups', { name: 'Vercel', icon: '🌱', today: realToday, member: member('Vi', { pin: '1234' }) })
  assert.equal(r.status, 201)
  V = await r.json()
  assert.match(V.group.code, /^VERCE-/)
})

await ok('Vercel: ranking, sync (corpo como string) e recuperação com PIN', async () => {
  const s = await vcall('PUT', '/sync', { today: realToday, days: [{ date: realToday, food: 2, water: 0, activity: 0, sleep: 0, weight: false, mood: false }] }, V.member.token, 'text/plain')
  assert.equal(s.status, 200)
  const r = await vcall('GET', `/groups/${V.group.code}/ranking`, null, V.member.token)
  assert.deepEqual((await r.json()).members.map(m => [m.name, m.total, m.avatar]), [['Vi', 10, '🦋']])
  const rec = await vcall('POST', '/recover', { code: V.group.code, name: 'vi', pin: '1234' })
  assert.equal(rec.status, 200)
  assert.equal((await rec.json()).days.length, 1)
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

console.log(`\n${passed} testes passaram${failed ? `, ${failed} FALHARAM` : ''}`)
server.close()
