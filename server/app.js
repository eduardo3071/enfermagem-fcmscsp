// API do Desafio 30 Dias: grupos, convites, sincronização de pontos e ranking.
// Só nome, avatar, pontos e sequência saem do aparelho: peso, altura e IMC nunca são enviados.
// O mesmo `handler` roda em servidor Node (server/index.js) e como função da Vercel (api/[...path].js).
import http from 'node:http'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { openDb } from './db.js'

const MAX_BODY = 200_000
const MAX_MEMBERS = 100
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json' }

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex')
const text = (v, max) => String(v ?? '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, max)
const int = (v, min, max) => Math.min(max, Math.max(min, Math.round(Number(v) || 0)))
const num = (v, min, max) => Math.min(max, Math.max(min, Number(v) || 0))
const dayNum = (k) => { const [y, m, d] = k.split('-').map(Number); return Date.UTC(y, m - 1, d) / 864e5 }

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status }
}

// Limites por IP e janela de 1 min. O geral é folgado de propósito: uma turma inteira costuma
// sair pelo mesmo IP (Wi-Fi da faculdade) e cada app consulta o ranking a cada 20 s.
// Em ambiente serverless cada instância conta por conta própria (limite aproximado).
const DEFAULT_LIMITS = { general: 1200, strict: 30, windowMs: 60_000 }

const SQL = {
  groupByCode: 'SELECT * FROM groups WHERE code = ?',
  groupById: 'SELECT * FROM groups WHERE id = ?',
  codeExists: 'SELECT 1 AS x FROM groups WHERE code = ?',
  insertGroup: 'INSERT INTO groups (id, code, name, icon, start) VALUES (?, ?, ?, ?, ?)',
  insertMember: 'INSERT INTO members (id, group_id, name, avatar, token_hash, owner) VALUES (?, ?, ?, ?, ?, ?)',
  memberByToken: 'SELECT * FROM members WHERE token_hash = ?',
  memberCount: 'SELECT COUNT(*) AS n FROM members WHERE group_id = ?',
  membersOf: 'SELECT * FROM members WHERE group_id = ? ORDER BY rowid',
  daysOf: 'SELECT d.* FROM days d JOIN members m ON m.id = d.member_id WHERE m.group_id = ? AND d.season = ?',
  upsertDay: `INSERT INTO days (member_id, season, date, pts, water, activity, sleep) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(member_id, season, date) DO UPDATE SET pts = excluded.pts, water = excluded.water, activity = excluded.activity, sleep = excluded.sleep`,
  updateMember: 'UPDATE members SET streak = ?, best = ?, share = ? WHERE id = ?',
  setCode: 'UPDATE groups SET code = ? WHERE id = ?',
  newSeason: 'UPDATE groups SET season = season + 1, start = ? WHERE id = ?',
  deleteDays: 'DELETE FROM days WHERE member_id = ?',
  deleteMember: 'DELETE FROM members WHERE id = ?',
}

// Opções do banco: { url, authToken } (libSQL/Turso) ou { dbPath } (SQLite local, ':memory:' por padrão).
export async function createApp({ dbPath, url, authToken, staticDir, rateLimit = {}, trustProxy = false } = {}) {
  const limits = { ...DEFAULT_LIMITS, ...rateLimit }
  const db = await openDb({ url, authToken, dbPath })

  async function makeCode(name) {
    const base = name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 5).padEnd(3, 'X')
    for (let i = 0; i < 30; i++) {
      const code = `${base}30-${crypto.randomBytes(3).toString('hex').slice(0, i < 20 ? 3 : 5).toUpperCase()}`
      if (!(await db.get(SQL.codeExists, [code]))) return code
    }
    throw new HttpError(500, 'Não foi possível gerar um código.')
  }

  function checkToday(v) {
    if (v === undefined) return new Date().toISOString().slice(0, 10)
    if (!DATE_RE.test(String(v))) throw new HttpError(400, 'Data inválida.')
    return String(v)
  }

  // Valida e prepara o membro; quem chama grava (sozinho ou junto com o grupo, numa transação).
  async function newMember(groupId, m, owner, checkFull) {
    const name = text(m?.name, 30)
    const avatar = text(m?.avatar, 8)
    if (!name || !avatar) throw new HttpError(400, 'Informe nome e avatar.')
    if (checkFull && (await db.get(SQL.memberCount, [groupId])).n >= MAX_MEMBERS) throw new HttpError(409, 'Grupo cheio.')
    const id = crypto.randomUUID()
    const token = crypto.randomBytes(24).toString('hex')
    return {
      stmt: [SQL.insertMember, [id, groupId, name, avatar, sha(token), owner ? 1 : 0]],
      credentials: { id, token, owner },
    }
  }

  const publicGroup = (g) => ({ id: g.id, code: g.code, name: g.name, icon: g.icon, start: g.start, season: g.season })

  async function auth(req) {
    const m = /^Bearer ([a-f0-9]{48})$/.exec(req.headers.authorization || '')
    const member = m && (await db.get(SQL.memberByToken, [sha(m[1])]))
    if (!member) throw new HttpError(401, 'Sessão inválida.')
    return member
  }

  async function authInGroup(req, code) {
    const member = await auth(req)
    const group = await db.get(SQL.groupById, [member.group_id])
    if (!group || group.code !== String(code).toUpperCase()) throw new HttpError(403, 'Você não pertence a este grupo.')
    return { member, group }
  }

  async function ranking(group, me) {
    const members = (await db.all(SQL.membersOf, [group.id])).filter(m => m.share || m.id === me.id)
    const byMember = new Map(members.map(m => [m.id, { ...m, total: 0, weeks: [0, 0, 0, 0], water: 0, activity: 0, sleep: 0 }]))
    const start = dayNum(group.start)
    for (const d of await db.all(SQL.daysOf, [group.id, group.season])) {
      const row = byMember.get(d.member_id)
      if (!row) continue
      const idx = dayNum(d.date) - start
      if (idx < 0) continue
      row.total += d.pts
      row.weeks[Math.min(3, Math.floor(idx / 7))] += d.pts
      row.water += d.water; row.activity += d.activity; row.sleep += d.sleep
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
      titles: { water: holder('water'), consistent: holder('best'), activity: holder('activity'), sleep: holder('sleep') },
      me: { rank: sorted.findIndex(r => r.id === me.id) + 1, owner: !!me.owner },
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

  async function route(req, url) {
    const p = url.pathname
    const method = req.method

    if (method === 'GET' && p === '/api/health') {
      await db.get('SELECT 1 AS ok') // falha (500) se o banco estiver inacessível
      return { ok: true }
    }

    if (method === 'POST' && p === '/api/groups') {
      const b = await readBody(req)
      const name = text(b.name, 30), icon = text(b.icon, 8)
      if (!name || !icon) throw new HttpError(400, 'Informe nome e ícone do grupo.')
      const start = checkToday(b.today)
      const id = crypto.randomUUID()
      const code = await makeCode(name)
      const member = await newMember(id, b.member, true, false)
      await db.batch([[SQL.insertGroup, [id, code, name, icon, start]], member.stmt]) // grupo + dono, tudo ou nada
      return { status: 201, body: { group: publicGroup({ id, code, name, icon, start, season: 1 }), member: member.credentials } }
    }

    if (method === 'POST' && p === '/api/groups/join') {
      const b = await readBody(req)
      const group = await db.get(SQL.groupByCode, [text(b.code, 40).toUpperCase()])
      if (!group) throw new HttpError(404, 'Código de convite não encontrado.')
      const member = await newMember(group.id, b.member, false, true)
      await db.batch([member.stmt])
      return { body: { group: publicGroup(group), member: member.credentials } }
    }

    let m
    if (method === 'GET' && (m = /^\/api\/groups\/([^/]+)\/ranking$/.exec(p))) {
      const { member, group } = await authInGroup(req, decodeURIComponent(m[1]))
      return { body: await ranking(group, member) }
    }

    if (method === 'POST' && (m = /^\/api\/groups\/([^/]+)\/code$/.exec(p))) {
      const { member, group } = await authInGroup(req, decodeURIComponent(m[1]))
      if (!member.owner) throw new HttpError(403, 'Só quem criou o grupo pode gerar um novo código.')
      await db.run(SQL.setCode, [await makeCode(group.name), group.id])
      return { body: { group: publicGroup(await db.get(SQL.groupById, [group.id])) } }
    }

    if (method === 'POST' && (m = /^\/api\/groups\/([^/]+)\/season$/.exec(p))) {
      const { member, group } = await authInGroup(req, decodeURIComponent(m[1]))
      if (!member.owner) throw new HttpError(403, 'Só quem criou o grupo pode iniciar uma nova temporada.')
      const b = await readBody(req)
      await db.run(SQL.newSeason, [checkToday(b.today), group.id])
      return { body: { group: publicGroup(await db.get(SQL.groupById, [group.id])) } }
    }

    if (method === 'PUT' && p === '/api/sync') {
      const member = await auth(req)
      const group = await db.get(SQL.groupById, [member.group_id])
      const b = await readBody(req)
      const days = Array.isArray(b.days) ? b.days.slice(0, 60) : []
      const start = dayNum(group.start)
      const stmts = []
      for (const d of days) {
        if (!DATE_RE.test(String(d?.date))) continue
        const idx = dayNum(d.date) - start
        if (idx < 0 || idx > 40) continue
        stmts.push([SQL.upsertDay, [member.id, group.season, d.date, int(d.pts, 0, 200), int(d.water, 0, 10000), int(d.activity, 0, 1440), num(d.sleep, 0, 24)]])
      }
      stmts.push([SQL.updateMember, [int(b.streak, 0, 400), int(b.best, 0, 400), b.share === false ? 0 : 1, member.id]])
      await db.batch(stmts) // uma ida ao banco só (importante com Turso, que é remoto)
      return { body: { ok: true, season: group.season } }
    }

    if (method === 'DELETE' && p === '/api/me') {
      const member = await auth(req)
      await db.batch([[SQL.deleteDays, [member.id]], [SQL.deleteMember, [member.id]]])
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

  // Limite por IP (janela fixa). Atrás de proxy (TRUST_PROXY=1) usa o IP real informado por ele.
  const hits = new Map()
  const sweep = setInterval(() => { const now = Date.now(); for (const [k, v] of hits) if (v.reset <= now) hits.delete(k) }, limits.windowMs)
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
  function limited(req, url) {
    const strict = req.method === 'POST' && (url.pathname === '/api/groups' || url.pathname === '/api/groups/join')
    const key = `${strict ? 's' : 'g'}:${clientIp(req)}`
    const max = strict ? limits.strict : limits.general
    const now = Date.now()
    let h = hits.get(key)
    if (!h || h.reset <= now) { h = { n: 0, reset: now + limits.windowMs }; hits.set(key, h) }
    h.n++
    return h.n > max ? Math.ceil((h.reset - now) / 1000) : 0
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
    const wait = url.pathname === '/api/health' ? 0 : limited(req, url)
    if (wait) return send(429, { error: 'Muitas requisições. Aguarde um instante e tente de novo.' }, { 'Retry-After': String(wait) })
    try {
      const r = await route(req, url)
      if (r && r.status) send(r.status, r.body)
      else send(200, r.body ?? r)
    } catch (e) {
      if (e instanceof HttpError) return send(e.status, { error: e.message })
      console.error(e)
      send(500, { error: 'Erro interno.' })
    }
  }

  const server = http.createServer(handler)
  return { server, handler, db, close: () => db.close() }
}
