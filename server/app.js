// API do Desafio 30 Dias: grupos, convites, sincronização, ranking, recuperação de acesso e moderação.
// Peso, altura e IMC nunca saem do aparelho. Os PONTOS e a SEQUÊNCIA são calculados aqui, a partir dos
// registros brutos, com o mesmo código do app (shared/scoring.js): o aparelho não consegue "dizer" quantos pontos tem.
// O mesmo `handler` roda em servidor Node (server/index.js) e como função da Vercel (api/[...path].js).
import http from 'node:http'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { promisify } from 'node:util'
import { openDb } from './db.js'
import { CHALLENGE_DAYS, DEFAULT_GOALS, MAX_DAY_POINTS, dayPoints, streakStats, dayNum, addDays } from '../shared/scoring.js'

const scrypt = promisify(crypto.scrypt)

const MAX_BODY = 200_000
const MAX_MEMBERS = 100
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const PIN_RE = /^\d{4,8}$/
const LOCK_AFTER = 5 // tentativas de PIN erradas
const LOCK_MS = 15 * 60_000
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json' }

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex')
const text = (v, max) => String(v ?? '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, max)
const int = (v, min, max) => Math.min(max, Math.max(min, Math.round(Number(v) || 0)))
const num = (v, min, max) => Math.min(max, Math.max(min, Number(v) || 0))
// sem acento, minúsculas: "João " e "joao" são o mesmo nome
const norm = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

// Filtro mínimo de nomes (palavras inteiras). Não é exaustivo: a moderação de verdade é o dono poder remover membros.
const BLOCKED = new Set(['porra', 'caralho', 'puta', 'putaria', 'merda', 'bosta', 'fdp', 'arrombado', 'buceta', 'cuzao', 'viado', 'vadia', 'nazista'])
const isBlocked = (s) => norm(s).split(/[^a-z0-9]+/).some(w => BLOCKED.has(w))

class HttpError extends Error {
  constructor(status, message, retryAfter) { super(message); this.status = status; this.retryAfter = retryAfter }
}

// Códigos sem 0/O/1/I/L para não confundir ao digitar. 6 caracteres de 31 = ~887 milhões de combinações.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const randomChars = (n) => Array.from({ length: n }, () => ALPHABET[crypto.randomInt(ALPHABET.length)]).join('')

async function hashPin(pin) {
  const salt = crypto.randomBytes(16)
  return `${salt.toString('hex')}:${(await scrypt(pin, salt, 32)).toString('hex')}`
}
async function checkPin(pin, stored) {
  const [salt, hash] = String(stored).split(':')
  const key = await scrypt(pin, Buffer.from(salt, 'hex'), 32)
  return crypto.timingSafeEqual(key, Buffer.from(hash, 'hex'))
}

// general: por IP e por instância (memória), folgado porque uma turma sai pelo mesmo Wi-Fi.
// strict e falhas: gravados no banco, então valem mesmo em serverless (cada instância da Vercel tem memória própria).
const DEFAULT_LIMITS = { general: 1200, strict: 30, windowMs: 60_000, failMax: 10, failWindowMs: 10 * 60_000 }

const SQL = {
  groupByCode: 'SELECT * FROM groups WHERE code = ?',
  groupById: 'SELECT * FROM groups WHERE id = ?',
  codeExists: 'SELECT 1 AS x FROM groups WHERE code = ?',
  insertGroup: 'INSERT INTO groups (id, code, name, icon, start) VALUES (?, ?, ?, ?, ?)',
  insertMember: 'INSERT INTO members (id, group_id, name, avatar, token_hash, owner, pin_hash, water_goal, sleep_goal) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
  memberByToken: 'SELECT * FROM members WHERE token_hash = ?',
  memberById: 'SELECT * FROM members WHERE id = ? AND group_id = ?',
  memberCount: 'SELECT COUNT(*) AS n FROM members WHERE group_id = ?',
  membersOf: 'SELECT * FROM members WHERE group_id = ? ORDER BY rowid',
  daysOf: 'SELECT d.* FROM days d JOIN members m ON m.id = d.member_id WHERE m.group_id = ? AND d.season = ?',
  daysOfMember: 'SELECT date, pts, food, water, activity, sleep, weight, mood FROM days WHERE member_id = ? AND season = ? ORDER BY date',
  upsertDay: `INSERT INTO days (member_id, season, date, pts, water, activity, sleep, food, weight, mood) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(member_id, season, date) DO UPDATE SET pts = excluded.pts, water = excluded.water, activity = excluded.activity,
      sleep = excluded.sleep, food = excluded.food, weight = excluded.weight, mood = excluded.mood`,
  updateSync: 'UPDATE members SET share = ?, water_goal = ?, sleep_goal = ?, saved = ? WHERE id = ?',
  updateStreak: 'UPDATE members SET streak = ?, best = ? WHERE id = ?',
  setPin: 'UPDATE members SET pin_hash = ?, failed_pin = 0, locked_until = 0 WHERE id = ?',
  pinFail: 'UPDATE members SET failed_pin = ?, locked_until = ? WHERE id = ?',
  rotateToken: 'UPDATE members SET token_hash = ?, failed_pin = 0, locked_until = 0 WHERE id = ?',
  setCode: 'UPDATE groups SET code = ? WHERE id = ?',
  bumpSeason: 'UPDATE groups SET season = season + 1, start = ? WHERE id = ?',
  purgeOldDays: 'DELETE FROM days WHERE season < ? AND member_id IN (SELECT id FROM members WHERE group_id = ?)',
  resetStreaks: "UPDATE members SET streak = 0, best = 0, saved = '[]' WHERE group_id = ?",
  clearOwner: 'UPDATE members SET owner = 0 WHERE id = ?',
  setOwner: 'UPDATE members SET owner = 1 WHERE id = ?',
  deleteDays: 'DELETE FROM days WHERE member_id = ?',
  deleteMember: 'DELETE FROM members WHERE id = ?',
  deleteGroupDays: 'DELETE FROM days WHERE member_id IN (SELECT id FROM members WHERE group_id = ?)',
  deleteGroupMembers: 'DELETE FROM members WHERE group_id = ?',
  deleteGroup: 'DELETE FROM groups WHERE id = ?',
  rateHit: `INSERT INTO rate_limits (key, n, reset) VALUES (?, 1, ?)
    ON CONFLICT(key) DO UPDATE SET n = CASE WHEN reset <= ? THEN 1 ELSE n + 1 END, reset = CASE WHEN reset <= ? THEN ? ELSE reset END
    RETURNING n, reset`,
  ratePeek: 'SELECT n, reset FROM rate_limits WHERE key = ?',
  rateSweep: 'DELETE FROM rate_limits WHERE reset < ?',
}

// Opções do banco: { url, authToken } (libSQL/Turso) ou { dbPath } (SQLite local, ':memory:' por padrão).
// `now` existe para os testes fixarem a data do "servidor".
export async function createApp({ dbPath, url, authToken, staticDir, rateLimit = {}, trustProxy = false, now = () => new Date() } = {}) {
  const limits = { ...DEFAULT_LIMITS, ...rateLimit }
  const db = await openDb({ url, authToken, dbPath })

  /* ---------- limites persistentes ---------- */
  async function hit(key, windowMs) {
    const t = Date.now()
    const reset = t + windowMs
    const r = await db.get(SQL.rateHit, [key, reset, t, t, reset])
    if (Math.random() < 0.02) await db.run(SQL.rateSweep, [t])
    return r
  }
  async function peek(key) {
    const r = await db.get(SQL.ratePeek, [key])
    return r && r.reset > Date.now() ? r : { n: 0, reset: Date.now() }
  }
  const wait = (reset) => Math.max(1, Math.ceil((reset - Date.now()) / 1000))
  const ipKey = (req) => sha(clientIp(req)).slice(0, 24)

  async function strictGate(req) {
    const r = await hit(`s:${ipKey(req)}`, limits.windowMs)
    if (r.n > limits.strict) throw new HttpError(429, 'Muitas requisições. Aguarde um instante e tente de novo.', wait(r.reset))
  }
  async function failGate(req) {
    const r = await peek(`f:${ipKey(req)}`)
    if (r.n >= limits.failMax) throw new HttpError(429, 'Muitas tentativas incorretas. Aguarde alguns minutos.', wait(r.reset))
  }
  const failHit = (req) => hit(`f:${ipKey(req)}`, limits.failWindowMs)

  /* ---------- utilidades ---------- */
  async function makeCode(name) {
    const base = name.normalize('NFD').replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 5).padEnd(3, 'X')
    for (let i = 0; i < 20; i++) {
      const code = `${base}-${randomChars(6)}`
      if (!(await db.get(SQL.codeExists, [code]))) return code
    }
    throw new HttpError(500, 'Não foi possível gerar um código.')
  }

  const serverToday = () => now().toISOString().slice(0, 10)
  // O app informa o "hoje" do aparelho (fuso do usuário); aceitamos no máximo 1 dia de diferença do servidor.
  function checkToday(v) {
    const server = serverToday()
    if (v === undefined || v === null) return server
    if (!DATE_RE.test(String(v))) throw new HttpError(400, 'Data inválida.')
    if (Math.abs(dayNum(String(v)) - dayNum(server)) > 1) throw new HttpError(400, 'A data do aparelho está fora do esperado. Ajuste o relógio.')
    return String(v)
  }

  const cleanName = (raw, what = 'nome') => {
    const name = text(raw, 30)
    if (!name) throw new HttpError(400, `Informe o ${what}.`)
    if (isBlocked(name)) throw new HttpError(400, `Esse ${what} não é permitido.`)
    return name
  }
  const cleanPin = (pin) => {
    if (pin === undefined || pin === null || pin === '') return null
    if (!PIN_RE.test(String(pin))) throw new HttpError(400, 'O PIN deve ter de 4 a 8 números.')
    return String(pin)
  }
  const goalsOf = (g) => ({
    water: int(g?.water ?? DEFAULT_GOALS.water, 1000, 4000),
    sleep: num(g?.sleep ?? DEFAULT_GOALS.sleep, 5, 10),
  })

  // Valida e prepara o membro; quem chama grava (sozinho ou junto com o grupo, numa transação).
  async function newMember(groupId, m, owner, existingNames = []) {
    const name = cleanName(m?.name)
    const avatar = text(m?.avatar, 8)
    if (!avatar) throw new HttpError(400, 'Informe o avatar.')
    if (existingNames.includes(norm(name))) throw new HttpError(409, 'Já existe alguém com esse nome no grupo. Use outro nome ou apelido.')
    const pin = cleanPin(m?.pin)
    const goals = goalsOf(m?.goals)
    const id = crypto.randomUUID()
    const token = crypto.randomBytes(24).toString('hex')
    return {
      stmt: [SQL.insertMember, [id, groupId, name, avatar, sha(token), owner ? 1 : 0, pin ? await hashPin(pin) : null, goals.water, goals.sleep]],
      credentials: { id, token, owner, name, avatar },
    }
  }

  const publicGroup = (g) => ({ id: g.id, code: g.code, name: g.name, icon: g.icon, start: g.start, season: g.season })

  async function auth(req) {
    const m = /^Bearer ([a-f0-9]{48})$/.exec(req.headers.authorization || '')
    const member = m && (await db.get(SQL.memberByToken, [sha(m[1])]))
    if (!member) throw new HttpError(401, 'Sessão inválida.')
    return member
  }

  async function authInGroup(req, code, { owner = false } = {}) {
    const member = await auth(req)
    const group = await db.get(SQL.groupById, [member.group_id])
    // "me" = o grupo de quem está autenticado. O app usa "me" para continuar funcionando quando o dono troca o código.
    if (!group || (code !== 'me' && group.code !== String(code).toUpperCase())) throw new HttpError(403, 'Você não pertence a este grupo.')
    if (owner && !member.owner) throw new HttpError(403, 'Só quem administra o grupo pode fazer isso.')
    return { member, group }
  }

  async function ranking(group, me) {
    const members = (await db.all(SQL.membersOf, [group.id])).filter(m => m.share || m.id === me.id)
    const byMember = new Map(members.map(m => [m.id, { ...m, total: 0, weeks: [0, 0, 0, 0], waterTotal: 0, activityTotal: 0, sleepTotal: 0 }]))
    const start = dayNum(group.start)
    for (const d of await db.all(SQL.daysOf, [group.id, group.season])) {
      const row = byMember.get(d.member_id)
      if (!row) continue
      const idx = dayNum(d.date) - start
      if (idx < 0) continue
      row.total += d.pts
      row.weeks[Math.min(3, Math.floor(idx / 7))] += d.pts
      row.waterTotal += d.water; row.activityTotal += d.activity; row.sleepTotal += d.sleep
    }
    const rows = [...byMember.values()]
    const holder = (key) => {
      const best = rows.reduce((a, r) => (r[key] > (a?.[key] ?? 0) ? r : a), null)
      return best ? { id: best.id, name: best.name } : null
    }
    const sorted = rows.sort((a, b) => b.total - a.total || b.streak - a.streak)
    return {
      group: publicGroup(group),
      members: sorted.map(r => ({ id: r.id, name: r.name, avatar: r.avatar, streak: r.streak, total: r.total, weeks: r.weeks, me: r.id === me.id })),
      titles: { water: holder('waterTotal'), consistent: holder('best'), activity: holder('activityTotal'), sleep: holder('sleepTotal') },
      me: { rank: sorted.findIndex(r => r.id === me.id) + 1, owner: !!me.owner, hasPin: !!me.pin_hash },
    }
  }

  async function readBody(req) {
    // Na Vercel o corpo já chega lido em req.body; em Node puro, lê-se do stream.
    if (req.body !== undefined && req.body !== null) {
      const b = req.body
      if (Buffer.isBuffer(b) || typeof b === 'string') {
        const s = String(b)
        if (s.length > MAX_BODY) throw new HttpError(413, 'Requisição grande demais.')
        try { return s ? JSON.parse(s) : {} } catch { throw new HttpError(400, 'JSON inválido.') }
      }
      return b
    }
    let size = 0
    const chunks = []
    for await (const c of req) {
      size += c.length
      if (size > MAX_BODY) throw new HttpError(413, 'Requisição grande demais.')
      chunks.push(c)
    }
    if (!chunks.length) return {}
    try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) } catch { throw new HttpError(400, 'JSON inválido.') }
  }

  const parseSaved = (s) => { try { const v = JSON.parse(s); return Array.isArray(v) ? v : [] } catch { return [] } }

  // Recalcula e grava sequência atual e melhor sequência a partir dos dias gravados + dias salvos (resgates).
  async function refreshStreak(member, group, saved, today) {
    const rows = await db.all(SQL.daysOfMember, [member.id, group.season])
    const active = new Set(rows.filter(r => r.pts > 0).map(r => r.date))
    for (const k of saved) active.add(k)
    const { streak, best } = streakStats({ isActive: (k) => active.has(k), start: group.start, today })
    await db.run(SQL.updateStreak, [streak, best, member.id])
    return { streak, best }
  }

  const inSeason = (date, group) => {
    if (!DATE_RE.test(String(date))) return false
    const idx = dayNum(date) - dayNum(group.start)
    return idx >= 0 && idx < CHALLENGE_DAYS
  }

  async function route(req, url) {
    const p = url.pathname
    const method = req.method

    if (method === 'GET' && p === '/api/health') {
      await db.get('SELECT 1 AS ok') // falha (500) se o banco estiver inacessível
      return { ok: true }
    }

    /* ----- criar / entrar / recuperar ----- */
    if (method === 'POST' && p === '/api/groups') {
      await strictGate(req)
      const b = await readBody(req)
      const name = cleanName(b.name, 'nome do grupo')
      const icon = text(b.icon, 8)
      if (!icon) throw new HttpError(400, 'Informe o ícone do grupo.')
      const start = checkToday(b.today)
      const id = crypto.randomUUID()
      const code = await makeCode(name)
      const member = await newMember(id, b.member, true)
      await db.batch([[SQL.insertGroup, [id, code, name, icon, start]], member.stmt]) // grupo + dono, tudo ou nada
      return { status: 201, body: { group: publicGroup({ id, code, name, icon, start, season: 1 }), member: member.credentials } }
    }

    if (method === 'POST' && p === '/api/groups/join') {
      await strictGate(req)
      await failGate(req)
      const b = await readBody(req)
      const group = await db.get(SQL.groupByCode, [text(b.code, 40).toUpperCase().replace(/\s+/g, '')])
      if (!group) { await failHit(req); throw new HttpError(404, 'Código de convite não encontrado.') }
      if ((await db.get(SQL.memberCount, [group.id])).n >= MAX_MEMBERS) throw new HttpError(409, 'Grupo cheio.')
      const names = (await db.all(SQL.membersOf, [group.id])).map(m => norm(m.name))
      const member = await newMember(group.id, b.member, false, names)
      await db.batch([member.stmt])
      return { body: { group: publicGroup(group), member: member.credentials } }
    }

    if (method === 'POST' && p === '/api/recover') {
      await strictGate(req)
      await failGate(req)
      const b = await readBody(req)
      const bad = async () => { await failHit(req); throw new HttpError(401, 'Dados de recuperação incorretos.') }
      const group = await db.get(SQL.groupByCode, [text(b.code, 40).toUpperCase().replace(/\s+/g, '')])
      const wanted = norm(text(b.name, 30))
      const member = group && (await db.all(SQL.membersOf, [group.id])).find(m => norm(m.name) === wanted)
      if (!member || !member.pin_hash || !PIN_RE.test(String(b.pin ?? ''))) return bad()
      if (member.locked_until > Date.now()) {
        throw new HttpError(429, 'Acesso bloqueado por tentativas incorretas. Tente de novo mais tarde.', wait(member.locked_until))
      }
      if (!(await checkPin(String(b.pin), member.pin_hash))) {
        const failed = member.failed_pin + 1
        await db.run(SQL.pinFail, failed >= LOCK_AFTER ? [0, Date.now() + LOCK_MS, member.id] : [failed, 0, member.id])
        return bad()
      }
      const token = crypto.randomBytes(24).toString('hex')
      await db.run(SQL.rotateToken, [sha(token), member.id]) // o token antigo deixa de valer
      const days = await db.all(SQL.daysOfMember, [member.id, group.season])
      return {
        body: {
          group: publicGroup(group),
          member: { id: member.id, token, owner: !!member.owner, name: member.name, avatar: member.avatar },
          days: days.map(d => ({ date: d.date, food: d.food, water: d.water, activity: d.activity, sleep: d.sleep, weight: !!d.weight, mood: !!d.mood })),
          saved: parseSaved(member.saved),
          goals: { water: member.water_goal, sleep: member.sleep_goal },
        },
      }
    }

    let m
    /* ----- ranking e membros ----- */
    if (method === 'GET' && (m = /^\/api\/groups\/([^/]+)\/ranking$/.exec(p))) {
      const { member, group } = await authInGroup(req, decodeURIComponent(m[1]))
      return { body: await ranking(group, member) }
    }

    if (method === 'GET' && (m = /^\/api\/groups\/([^/]+)\/members$/.exec(p))) {
      const { member, group } = await authInGroup(req, decodeURIComponent(m[1]), { owner: true })
      const members = await db.all(SQL.membersOf, [group.id])
      return { body: { members: members.map(x => ({ id: x.id, name: x.name, avatar: x.avatar, owner: !!x.owner, me: x.id === member.id })) } }
    }

    /* ----- administração do grupo (só o dono) ----- */
    if (method === 'POST' && (m = /^\/api\/groups\/([^/]+)\/code$/.exec(p))) {
      const { group } = await authInGroup(req, decodeURIComponent(m[1]), { owner: true })
      await db.run(SQL.setCode, [await makeCode(group.name), group.id])
      return { body: { group: publicGroup(await db.get(SQL.groupById, [group.id])) } }
    }

    if (method === 'POST' && (m = /^\/api\/groups\/([^/]+)\/season$/.exec(p))) {
      const { group } = await authInGroup(req, decodeURIComponent(m[1]), { owner: true })
      const b = await readBody(req)
      const next = group.season + 1
      await db.batch([
        [SQL.bumpSeason, [checkToday(b.today), group.id]],
        [SQL.purgeOldDays, [next, group.id]], // minimização de dados: a temporada anterior é apagada
        [SQL.resetStreaks, [group.id]],
      ])
      return { body: { group: publicGroup(await db.get(SQL.groupById, [group.id])) } }
    }

    if (method === 'POST' && (m = /^\/api\/groups\/([^/]+)\/owner$/.exec(p))) {
      const { member, group } = await authInGroup(req, decodeURIComponent(m[1]), { owner: true })
      const b = await readBody(req)
      const target = await db.get(SQL.memberById, [String(b.memberId ?? ''), group.id])
      if (!target) throw new HttpError(404, 'Membro não encontrado.')
      if (target.id === member.id) throw new HttpError(400, 'Você já é o administrador.')
      await db.batch([[SQL.clearOwner, [member.id]], [SQL.setOwner, [target.id]]])
      return { body: { ok: true } }
    }

    if (method === 'DELETE' && (m = /^\/api\/groups\/([^/]+)\/members\/([^/]+)$/.exec(p))) {
      const { member, group } = await authInGroup(req, decodeURIComponent(m[1]), { owner: true })
      const target = await db.get(SQL.memberById, [decodeURIComponent(m[2]), group.id])
      if (!target) throw new HttpError(404, 'Membro não encontrado.')
      if (target.id === member.id) throw new HttpError(400, 'Use "Apagar meus dados" para sair do grupo.')
      await db.batch([[SQL.deleteDays, [target.id]], [SQL.deleteMember, [target.id]]])
      return { body: { ok: true } }
    }

    if (method === 'DELETE' && (m = /^\/api\/groups\/([^/]+)$/.exec(p))) {
      const { group } = await authInGroup(req, decodeURIComponent(m[1]), { owner: true })
      await db.batch([[SQL.deleteGroupDays, [group.id]], [SQL.deleteGroupMembers, [group.id]], [SQL.deleteGroup, [group.id]]])
      return { body: { ok: true } }
    }

    /* ----- sincronização: o servidor recalcula pontos e sequência ----- */
    if (method === 'PUT' && p === '/api/sync') {
      const member = await auth(req)
      const group = await db.get(SQL.groupById, [member.group_id])
      const b = await readBody(req)
      const today = checkToday(b.today)
      const goals = b.goals ? goalsOf(b.goals) : { water: member.water_goal, sleep: member.sleep_goal }
      const saved = (Array.isArray(b.saved) ? b.saved : parseSaved(member.saved)).filter(k => inSeason(k, group)).slice(0, 2)
      const stmts = []
      for (const d of (Array.isArray(b.days) ? b.days : []).slice(0, CHALLENGE_DAYS)) {
        if (!inSeason(d?.date, group)) continue
        const entry = {
          food: int(d.food, 0, 6), water: int(d.water, 0, 10000), activity: int(d.activity, 0, 1440),
          sleep: num(d.sleep, 0, 24), weight: !!d.weight, mood: !!d.mood,
        }
        // app antigo (aba aberta antes da atualização) ainda manda "pts" e não os registros brutos: aceita limitado
        const legacy = d.food === undefined && d.weight === undefined && d.mood === undefined && d.pts !== undefined
        const pts = legacy ? int(d.pts, 0, MAX_DAY_POINTS) : dayPoints(entry, goals)
        stmts.push([SQL.upsertDay, [member.id, group.season, d.date, pts, entry.water, entry.activity, entry.sleep, entry.food, entry.weight ? 1 : 0, entry.mood ? 1 : 0]])
      }
      stmts.push([SQL.updateSync, [b.share === false ? 0 : 1, goals.water, goals.sleep, JSON.stringify(saved), member.id]])
      await db.batch(stmts) // uma ida ao banco só (importante com Turso, que é remoto)
      const { streak, best } = await refreshStreak(member, group, saved, today)
      return { body: { ok: true, season: group.season, streak, best } }
    }

    /* ----- minha conta ----- */
    if (method === 'PUT' && p === '/api/me/pin') {
      const member = await auth(req)
      const b = await readBody(req)
      const pin = cleanPin(b.pin)
      if (!pin) throw new HttpError(400, 'Informe o PIN.')
      await db.run(SQL.setPin, [await hashPin(pin), member.id])
      return { body: { ok: true } }
    }

    if (method === 'DELETE' && p === '/api/me') {
      const member = await auth(req)
      const others = (await db.get(SQL.memberCount, [member.group_id])).n - 1
      if (member.owner && others > 0) throw new HttpError(409, 'Você administra o grupo. Passe a administração para outra pessoa antes de sair.')
      const stmts = [[SQL.deleteDays, [member.id]], [SQL.deleteMember, [member.id]]]
      if (others === 0) stmts.push([SQL.deleteGroup, [member.group_id]]) // último a sair: o grupo some junto
      await db.batch(stmts)
      return { body: { ok: true } }
    }

    throw new HttpError(404, 'Rota não encontrada.')
  }

  const SECURITY = {
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'X-Frame-Options': 'DENY',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  }
  // style 'unsafe-inline' é necessário: o React usa o atributo style (largura das barras de progresso).
  const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"

  function serveStatic(req, res, url) {
    if (!staticDir || !['GET', 'HEAD'].includes(req.method)) return false
    const root = path.resolve(staticDir)
    let pathname
    try { pathname = decodeURIComponent(url.pathname) } catch { return false }
    let file = path.resolve(root, '.' + pathname)
    if (file !== root && !file.startsWith(root + path.sep)) return false
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(root, 'index.html')
    if (!fs.existsSync(file)) return false
    const ext = path.extname(file)
    const headers = { ...SECURITY, 'Content-Type': MIME[ext] || 'application/octet-stream' }
    // arquivos de /assets têm hash no nome: cache longo. O HTML nunca fica em cache.
    if (file.startsWith(path.join(root, 'assets') + path.sep)) headers['Cache-Control'] = 'public, max-age=31536000, immutable'
    else headers['Cache-Control'] = 'no-cache'
    if (ext === '.html') headers['Content-Security-Policy'] = CSP
    res.writeHead(200, headers)
    if (req.method === 'HEAD') return res.end(), true
    fs.createReadStream(file).pipe(res)
    return true
  }

  // Limite geral por IP em memória (janela fixa). Atrás de proxy (TRUST_PROXY=1) usa o IP real informado por ele.
  const hits = new Map()
  const sweep = setInterval(() => { const t = Date.now(); for (const [k, v] of hits) if (v.reset <= t) hits.delete(k) }, limits.windowMs)
  sweep.unref()
  function clientIp(req) {
    if (trustProxy) {
      const fly = req.headers['fly-client-ip']
      if (fly) return String(fly)
      const xff = req.headers['x-forwarded-for']
      if (xff) return String(xff).split(',')[0].trim()
    }
    return req.socket.remoteAddress || 'unknown'
  }
  function generalLimited(req) {
    const key = clientIp(req)
    const t = Date.now()
    let h = hits.get(key)
    if (!h || h.reset <= t) { h = { n: 0, reset: t + limits.windowMs }; hits.set(key, h) }
    h.n++
    return h.n > limits.general ? Math.ceil((h.reset - t) / 1000) : 0
  }

  // (req, res) padrão do Node: serve tanto http.createServer quanto uma função da Vercel.
  async function handler(req, res) {
    const url = new URL(req.url, 'http://x')
    const send = (status, body, extra = {}) => {
      res.writeHead(status, { ...SECURITY, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra })
      res.end(JSON.stringify(body))
    }
    if (!url.pathname.startsWith('/api/')) {
      if (serveStatic(req, res, url)) return
      return send(404, { error: 'Não encontrado.' })
    }
    const blocked = url.pathname === '/api/health' ? 0 : generalLimited(req)
    if (blocked) return send(429, { error: 'Muitas requisições. Aguarde um instante e tente de novo.' }, { 'Retry-After': String(blocked) })
    try {
      const r = await route(req, url)
      if (r && r.status) send(r.status, r.body)
      else send(200, r.body ?? r)
    } catch (e) {
      if (e instanceof HttpError) return send(e.status, { error: e.message }, e.retryAfter ? { 'Retry-After': String(e.retryAfter) } : {})
      console.error(e)
      send(500, { error: 'Erro interno.' })
    }
  }

  const server = http.createServer(handler)
  return { server, handler, db, close: () => db.close() }
}
