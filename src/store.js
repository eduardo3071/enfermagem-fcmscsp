import { useCallback, useEffect, useState } from 'react'
import { TASKS, ACHIEVEMENTS, PRIVACY_VERSION } from './config.js'
import { api } from './api.js'
import {
  CHALLENGE_DAYS, addDays, diffDays,
  dayPoints as pointsOf, taskPoints as taskPointsOf, taskStatus as taskStatusOf, streakStats,
} from '../shared/scoring.js'

export { addDays, CHALLENGE_DAYS }

const KEY = 'desafio30:v2'
const pad = (n) => String(n).padStart(2, '0')
// data local (não UTC): o dia vira à meia-noite do usuário
export const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
// dia do desafio (1 = primeiro dia). Passa de 30 quando o desafio acabou.
export const dayIndex = (start) => diffDays(dayKey(), start) + 1
export const isEnded = (start) => dayIndex(start) > CHALLENGE_DAYS

export const emptyEntry = { food: 0, water: 0, activity: 0, sleep: 0, weight: null, mood: null }

const DEFAULT_SETTINGS = { reminder: true, reminderTime: '20:00', share: true, dark: false }

const initial = {
  profile: null,   // { name, avatar, age, sex, height, weight, goalWeight, activity, waterGoal, sleepGoal, objectives, consent }
  group: null,     // { name, icon, code }
  member: null,    // { token, owner } — credencial deste aparelho no servidor
  start: null,
  season: 1,
  log: {},         // { 'YYYY-MM-DD': entry }
  saved: [],       // dias salvos com "resgate"
  rescues: 2,
  settings: DEFAULT_SETTINGS,
}

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY)) || {}
    const old = saved.settings || {}
    // "notifications" era o nome antigo do lembrete; chaves novas entram com o valor padrão
    const settings = { ...DEFAULT_SETTINGS, ...old, ...(old.notifications !== undefined && old.reminder === undefined ? { reminder: old.notifications } : {}) }
    delete settings.notifications
    return { ...initial, ...saved, settings }
  } catch { return initial }
}

export function useStore() {
  const [state, setState] = useState(load)
  const [notice, setNotice] = useState('') // aviso passageiro (ex.: "você foi removido do grupo"); não é salvo
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(state)) } catch {} }, [state])
  useEffect(() => { document.documentElement.classList.toggle('dark', !!state.settings.dark) }, [state.settings.dark])

  const set = (patch) => setState(s => ({ ...s, ...patch }))
  const adopt = (g, m) => set({
    group: { code: g.code, name: g.name, icon: g.icon }, member: { token: m.token, owner: m.owner },
    start: g.start, season: g.season,
  })
  const token = state.member?.token
  const identity = () => ({ name: state.profile.name, avatar: state.profile.avatar, goals: { water: state.profile.waterGoal, sleep: state.profile.sleepGoal } })

  const actions = {
    saveProfile: (profile) => set({ profile }),
    acceptConsent: () => setState(s => ({ ...s, profile: { ...s.profile, consent: { version: PRIVACY_VERSION, at: new Date().toISOString() } } })),

    // Entrar, criar e recuperar falham com Error (mensagem em português) para a tela exibir.
    createGroup: async (name, icon, pin) => {
      const r = await api.createGroup({ name, icon, today: dayKey(), member: { ...identity(), pin } })
      setNotice(''); adopt(r.group, r.member)
    },
    joinGroup: async (code, pin) => {
      const r = await api.joinGroup({ code, member: { ...identity(), pin } })
      setNotice(''); adopt(r.group, r.member)
    },
    // Volta ao grupo com código + nome + PIN. Reconstrói os registros a partir do servidor.
    // Peso e humor só existem no servidor como "registrado": voltam como registrados (peso do cadastro, humor neutro).
    recover: async (code, name, pin) => {
      const r = await api.recover({ code, name, pin })
      setNotice('')
      setState(s => {
        const log = {}
        for (const d of r.days) {
          log[d.date] = { food: d.food, water: d.water, activity: d.activity, sleep: d.sleep, weight: d.weight ? s.profile.weight : null, mood: d.mood ? 3 : null }
        }
        return {
          ...s,
          profile: { ...s.profile, name: r.member.name, avatar: r.member.avatar, waterGoal: r.goals.water, sleepGoal: r.goals.sleep },
          group: { code: r.group.code, name: r.group.name, icon: r.group.icon },
          member: { token: r.member.token, owner: r.member.owner },
          start: r.group.start, season: r.group.season, log, saved: r.saved, rescues: Math.max(0, 2 - r.saved.length),
        }
      })
    },
    setPin: async (pin) => { await api.setPin(pin, token) },

    newCode: async () => {
      const r = await api.newCode(token)
      setState(s => ({ ...s, group: { ...s.group, code: r.group.code } }))
    },
    newSeason: async () => {
      const r = await api.newSeason(token, dayKey())
      setState(s => ({ ...s, season: r.group.season, start: r.group.start, log: {}, saved: [], rescues: 2 }))
    },
    listMembers: async () => (await api.members(token)).members,
    kick: async (id) => { await api.kick(token, id) },
    transferOwner: async (id) => { await api.transferOwner(token, id); setState(s => ({ ...s, member: { ...s.member, owner: false } })) },
    deleteGroup: async () => {
      await api.deleteGroup(token)
      setState(s => ({ ...s, group: null, member: null }))
    },

    // Chamado quando o ranking traz dados novos do grupo (outro membro mudou código ou temporada).
    syncGroupMeta: useCallback((g) => setState(s => {
      if (!s.group || (s.group.code === g.code && s.group.name === g.name && s.season === g.season && s.start === g.start)) return s
      const newSeason = g.season > s.season
      return {
        ...s, group: { code: g.code, name: g.name, icon: g.icon }, season: g.season, start: g.start,
        ...(newSeason ? { log: {}, saved: [], rescues: 2 } : {}),
      }
    }), []),
    leaveGroup: useCallback((message = '') => { setNotice(message); setState(s => ({ ...s, group: null, member: null })) }, []),
    clearNotice: () => setNotice(''),

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
    setSetting: (key, value) => setState(s => ({ ...s, settings: { ...s.settings, [key]: value } })),
    reset: async () => {
      if (state.member) { try { await api.deleteMe(token) } catch (e) { if (e.status === 409) throw e } }
      setState({ ...initial, settings: state.settings })
    },
  }
  return { state, notice, ...actions }
}

/* ---------- regras de pontos (código compartilhado com o servidor) ---------- */
export const goalsOf = (profile) => ({ water: profile.waterGoal, sleep: profile.sleepGoal })
export const taskStatus = (entry, profile) => taskStatusOf(entry, goalsOf(profile))
export const taskPoints = (entry, profile) => taskPointsOf(entry, goalsOf(profile))
export const dayPoints = (entry, profile) => pointsOf(entry, goalsOf(profile))

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
  const todayPts = dayPoints(log[dayKey()], profile)

  const { streak, best } = streakStats({
    isActive: (k) => ['full', 'partial', 'saved'].includes(dayState(state, k)),
    start: state.start,
    today: dayKey(),
  })

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

  // evolução do peso: só existe no aparelho
  const weights = keys.filter(k => Number(log[k].weight) > 0).map(k => ({ k, v: Number(log[k].weight) }))

  const stats = { total, todayPts, streak, best, counts, activeDays, perDay, weeks, weights }
  stats.unlocked = ACHIEVEMENTS.filter(a => a.test(stats)).map(a => a.id)
  return stats
}

/* ---------- payload enviado ao servidor ----------
   Registros brutos; o servidor calcula pontos e sequência. Peso e humor vão só como "registrado" (booleano):
   os valores, a altura e o IMC nunca saem do aparelho. */
export function buildSync(state) {
  const last = addDays(state.start, CHALLENGE_DAYS - 1)
  const days = Object.keys(state.log)
    .filter(k => k >= state.start && k <= last)
    .map(k => {
      const e = { ...emptyEntry, ...state.log[k] }
      return { date: k, food: e.food, water: e.water, activity: e.activity, sleep: e.sleep, weight: Number(e.weight) > 0, mood: Number(e.mood) > 0 }
    })
  return { days, goals: goalsOf(state.profile), saved: state.saved, today: dayKey(), share: !!state.settings.share }
}
