// Regras de pontos e sequência: UMA fonte da verdade, importada pelo app (src/) e pelo servidor (server/).
// O servidor recalcula tudo a partir dos registros brutos; o app usa as mesmas funções para exibir.
// Peso e humor são enviados ao servidor apenas como "registrado ou não" (booleano): os valores ficam no aparelho.

export const CHALLENGE_DAYS = 30
export const DEFAULT_GOALS = { water: 2250, sleep: 7.5 }
export const MAX_DAY_POINTS = 100 // 20 + 20 + 30 + 15 + 5 + 10

/* ---------- datas "YYYY-MM-DD" (sem fuso: o dia é o do calendário do usuário) ---------- */
const pad = (n) => String(n).padStart(2, '0')
export const dayNum = (k) => { const [y, m, d] = k.split('-').map(Number); return Date.UTC(y, m - 1, d) / 864e5 }
export const diffDays = (a, b) => dayNum(a) - dayNum(b)
export const addDays = (k, n) => {
  const t = new Date((dayNum(k) + n) * 864e5)
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`
}

/* ---------- pontos do dia ---------- */
export const normalizeEntry = (e = {}) => ({
  food: Number(e.food) || 0,
  water: Number(e.water) || 0,
  activity: Number(e.activity) || 0,
  sleep: Number(e.sleep) || 0,
  weight: Boolean(e.weight), // número (no app) ou booleano (no servidor)
  mood: Boolean(e.mood),
})

export function taskStatus(entry, goals = DEFAULT_GOALS) {
  const e = normalizeEntry(entry)
  return {
    food: e.food >= 1,
    water: e.water >= goals.water,
    activity: e.activity >= 30,
    sleep: e.sleep >= goals.sleep,
    weight: e.weight,
    mood: e.mood,
  }
}

export function taskPoints(entry, goals = DEFAULT_GOALS) {
  const e = normalizeEntry(entry)
  return {
    food: Math.min(20, e.food * 5),
    water: Math.min(20, Math.round((20 * e.water) / goals.water)),
    activity: Math.min(30, Math.round(e.activity)),
    sleep: e.sleep >= goals.sleep ? 15 : Math.round((7 * e.sleep) / goals.sleep),
    weight: e.weight ? 5 : 0,
    mood: e.mood ? 10 : 0,
  }
}

export const dayPoints = (entry, goals = DEFAULT_GOALS) =>
  Object.values(taskPoints(entry, goals)).reduce((a, b) => a + b, 0)

/* ---------- sequência ----------
   isActive(k): o dia tem algum progresso (ou foi salvo com "resgate").
   A sequência atual termina hoje, ou ontem se hoje ainda não tem registro. */
export function streakStats({ isActive, start, today }) {
  let streak = 0
  let k = today
  if (!isActive(k)) k = addDays(k, -1)
  while (diffDays(k, start) >= 0 && isActive(k)) { streak++; k = addDays(k, -1) }

  let best = 0
  let run = 0
  for (let i = 0; i < CHALLENGE_DAYS; i++) {
    run = isActive(addDays(start, i)) ? run + 1 : 0
    best = Math.max(best, run)
  }
  return { streak, best }
}
