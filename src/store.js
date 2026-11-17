import { useEffect, useState } from 'react'
import { TASKS, ACHIEVEMENTS } from './config.js'
import { api } from './api.js'

const KEY = 'desafio30:v2'
const pad = (n) => String(n).padStart(2, '0')
// data local (não UTC): o dia vira à meia-noite do usuário
export const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const toDate = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d) }
const diffDays = (a, b) => Math.round((toDate(a) - toDate(b)) / 864e5)
export const addDays = (k, n) => { const d = toDate(k); d.setDate(d.getDate() + n); return dayKey(d) }
export const dayIndex = (start) => diffDays(dayKey(), start) + 1

export const emptyEntry = { food: 0, water: 0, activity: 0, sleep: 0, weight: null, mood: null }

const initial = {
  profile: null,   // { name, avatar, age, sex, height, weight, goalWeight, activity, waterGoal, sleepGoal, objectives }
  group: null,     // { name, icon, code }
  member: null,    // { token, owner } — credencial deste aparelho no servidor
  start: null,
  season: 1,
  log: {},         // { 'YYYY-MM-DD': entry }
  saved: [],       // dias salvos com "resgate"
  rescues: 2,
  settings: { notifications: true, share: true, dark: false },
}

function load() {
  try { return { ...initial, ...JSON.parse(localStorage.getItem(KEY)) } } catch { return initial }
}

export function useStore() {
  const [state, setState] = useState(load)
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(state)) } catch {} }, [state])
  useEffect(() => { document.documentElement.classList.toggle('dark', !!state.settings.dark) }, [state.settings.dark])

  const set = (patch) => setState(s => ({ ...s, ...patch }))
  const adopt = (g, m) => set({
    group: { code: g.code, name: g.name, icon: g.icon }, member: { token: m.token, owner: m.owner },
    start: g.start, season: g.season,
  })
  const actions = {
    saveProfile: (profile) => set({ profile }),
    // Entrar/criar falham com Error (mensagem em português) para a tela exibir.
    createGroup: async (name, icon) => {
      const r = await api.createGroup({ name, icon, today: dayKey(), member: { name: state.profile.name, avatar: state.profile.avatar } })
      adopt(r.group, r.member)
    },
    joinGroup: async (code) => {
      const r = await api.joinGroup({ code, member: { name: state.profile.name, avatar: state.profile.avatar } })
      adopt(r.group, r.member)
    },
    newCode: async () => {
      const r = await api.newCode(state.group.code, state.member.token)
      setState(s => ({ ...s, group: { ...s.group, code: r.group.code } }))
    },
    // Chamado quando o ranking traz dados novos do grupo (outro membro mudou código ou temporada).
    syncGroupMeta: (g) => setState(s => {
      if (!s.group || (s.group.code === g.code && s.group.name === g.name && s.season === g.season && s.start === g.start)) return s
      const newSeason = g.season > s.season
      return {
        ...s, group: { code: g.code, name: g.name, icon: g.icon }, season: g.season, start: g.start,
        ...(newSeason ? { log: {}, saved: [], rescues: 2 } : {}),
      }
    }),
    leaveGroup: () => setState(s => ({ ...s, group: null, member: null })),
    logToday: (patch) => setState(s => {
      const k = dayKey()
      return { ...s, log: { ...s.log, [k]: { ...emptyEntry, ...s.log[k], ...patch } } }
    }),
    saveStreak: () => setState(s => {
      const y = addDays(dayKey(), -1)
      if (s.rescues < 1 || s.saved.includes(y)) return s
      return { ...s, rescues: s.rescues - 1, saved: [...s.saved, y] }
    }),
    setting: (key) => setState(s => ({ ...s, settings: { ...s.settings, [key]: !s.settings[key] } })),
    newSeason: async () => {
      const r = await api.newSeason(state.group.code, state.member.token, dayKey())
      setState(s => ({ ...s, season: r.group.season, start: r.group.start, log: {}, saved: [], rescues: 2 }))
    },
    reset: async () => {
      if (state.member) { try { await api.deleteMe(state.member.token) } catch {} }
      setState({ ...initial, settings: state.settings })
    },
  }
  return { state, ...actions }
}

/* ---------- regras de pontos ---------- */
export function taskStatus(entry = emptyEntry, profile) {
  const e = { ...emptyEntry, ...entry }
  return {
    food: e.food >= 1,
    water: e.water >= profile.waterGoal,
    activity: e.activity >= 30,
    sleep: e.sleep >= profile.sleepGoal,
    weight: e.weight > 0,
    mood: e.mood > 0,
  }
}

export function taskPoints(entry = emptyEntry, profile) {
  const e = { ...emptyEntry, ...entry }
  return {
    food: Math.min(20, e.food * 5),
    water: Math.min(20, Math.round((20 * e.water) / profile.waterGoal)),
    activity: Math.min(30, Math.round(e.activity)),
    sleep: e.sleep >= profile.sleepGoal ? 15 : Math.round((7 * e.sleep) / profile.sleepGoal),
    weight: e.weight > 0 ? 5 : 0,
    mood: e.mood > 0 ? 10 : 0,
  }
}

const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0)
export const dayPoints = (entry, profile) => sum(taskPoints(entry, profile))

export function dayState(state, k) {
  const done = Object.values(taskStatus(state.log[k], state.profile)).filter(Boolean).length
  if (done === TASKS.length) return 'full'
  if (done > 0 || dayPoints(state.log[k], state.profile) > 0) return 'partial'
  return state.saved.includes(k) ? 'saved' : 'none'
}

export function computeStats(state) {
  const { profile, log } = state
  const keys = Object.keys(log).sort()
  const perDay = keys.map(k => ({ k, pts: dayPoints(log[k], profile) }))
  const total = perDay.reduce((a, d) => a + d.pts, 0)
  const todayK = dayKey()
  const todayPts = dayPoints(log[todayK], profile)

  const active = (k) => ['full', 'partial', 'saved'].includes(dayState(state, k))
  let streak = 0
  let k = todayK
  if (!active(k)) k = addDays(k, -1)
  while (active(k) && diffDays(k, state.start) >= 0) { streak++; k = addDays(k, -1) }

  let best = 0, run = 0
  for (let i = 0; i < 30; i++) {
    const d = addDays(state.start, i)
    run = active(d) ? run + 1 : 0
    best = Math.max(best, run)
  }

  const counts = { food: 0, water: 0, activity: 0, sleep: 0 }
  let activeDays = 0
  for (const key of keys) {
    const st = taskStatus(log[key], profile)
    if (['full', 'partial'].includes(dayState(state, key))) activeDays++
    for (const t of Object.keys(counts)) if (st[t]) counts[t]++
  }

  const weeks = [1, 2, 3, 4].map(w =>
    perDay.filter(d => { const i = diffDays(d.k, state.start); return i >= (w - 1) * 7 && i < w * 7 + (w === 4 ? 2 : 0) })
      .reduce((a, d) => a + d.pts, 0))

  const stats = { total, todayPts, streak, best, counts, activeDays, perDay, weeks }
  stats.unlocked = ACHIEVEMENTS.filter(a => a.test(stats)).map(a => a.id)
  return stats
}

/* ---------- payload enviado ao servidor (sem peso, altura ou IMC) ---------- */
export function buildSync(state) {
  const { streak, best } = computeStats(state)
  const days = Object.keys(state.log)
    .filter(k => k >= state.start)
    .map(k => {
      const e = { ...emptyEntry, ...state.log[k] }
      return { date: k, pts: dayPoints(e, state.profile), water: e.water, activity: e.activity, sleep: e.sleep }
    })
  return { days, streak, best, share: !!state.settings.share }
}
