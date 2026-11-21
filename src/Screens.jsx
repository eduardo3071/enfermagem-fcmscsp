import { useCallback, useEffect, useState } from 'react'
import { Flame, Check, Crown, Lock, Copy, X, Plus, Minus, BookOpen, ChevronRight, Bell, Star, KeyRound, ShieldCheck, Trophy, Users } from 'lucide-react'
import { TASKS, MOODS, ACHIEVEMENTS, GROUP_TITLES, OBJECTIVE_OF_TASK, bmi } from './config.js'
import { Card, TONES } from './ui.jsx'
import { dayKey, addDays, dayIndex, dayState, taskStatus, taskPoints, emptyEntry, CHALLENGE_DAYS } from './store.js'
import { diffDays } from '../shared/scoring.js'

const medal = ['🥇', '🥈', '🥉']

/* ---------------- Fim do desafio ---------------- */
function Finale({ state, stats, rankData, owner, onNewSeason }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const top = rankData ? [...rankData.members].sort((a, b) => b.total - a.total || b.streak - a.streak).slice(0, 3) : []
  const start = async () => {
    if (!confirm('Iniciar nova temporada? Os pontos de todo o grupo serão zerados.')) return
    setBusy(true); setError('')
    try { await onNewSeason() } catch (e) { setError(e.message) }
    setBusy(false)
  }
  return (
    <Card className="text-center">
      <div className="text-5xl">🏆</div>
      <h2 className="text-2xl font-semibold text-slate-900 mt-2">Desafio concluído!</h2>
      <p className="text-sm text-slate-500">Você chegou ao fim dos {CHALLENGE_DAYS} dias. Parabéns pela constância.</p>

      <div className="grid grid-cols-3 gap-3 my-5">
        {[[stats.total, 'pontos'], [stats.activeDays, 'dias ativos'], [stats.best, 'melhor sequência']].map(([v, l]) => (
          <div key={l} className="rounded-lg bg-slate-50 p-3"><p className="text-xl font-bold text-slate-900">{v}</p><p className="text-[11px] text-slate-500">{l}</p></div>
        ))}
      </div>
      <p className="text-sm text-slate-600 mb-4">Conquistas: <b>{stats.unlocked.length}</b> de {ACHIEVEMENTS.length}</p>

      {top.length > 0 && (
        <div className="text-left">
          <h3 className="text-sm font-semibold text-slate-800 mb-2 flex items-center gap-1.5"><Trophy className="w-4 h-4 text-amber-500" /> Pódio do grupo</h3>
          <div className="space-y-2">
            {top.map((m, i) => (
              <div key={m.id} className={`flex items-center gap-3 rounded-lg p-3 ${m.me ? 'bg-emerald-50 border border-emerald-200' : 'bg-slate-50'}`}>
                <span className="text-xl w-7 text-center">{medal[i]}</span><span className="text-xl">{m.avatar}</span>
                <span className="flex-1 text-sm font-medium text-slate-800 truncate">{m.name}{m.me && ' (você)'}</span>
                <span className="text-sm font-bold text-slate-900">{m.total} pts</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {owner ? (
        <button onClick={start} disabled={busy} className="w-full h-12 mt-5 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-500 disabled:opacity-50">{busy ? 'Iniciando…' : 'Iniciar nova temporada'}</button>
      ) : (
        <p className="text-xs text-slate-400 mt-5">Quem administra o grupo pode iniciar a próxima temporada.</p>
      )}
      {error && <p role="alert" className="text-sm text-rose-600 mt-2">{error}</p>}
    </Card>
  )
}

/* ---------------- Início ---------------- */
export function Home({ state, stats, position, ended, reminderDue, rankData, owner, onNewSeason, openLog, goLearn }) {
  const { profile, start } = state
  const idx = Math.min(Math.max(dayIndex(start), 1), CHALLENGE_DAYS)
  const entry = { ...emptyEntry, ...state.log[dayKey()] }
  const st = taskStatus(entry, profile)
  const pts = taskPoints(entry, profile)
  const doneCount = Object.values(st).filter(Boolean).length
  const focus = (t) => profile.objectives?.includes(OBJECTIVE_OF_TASK[t.id])
  const detail = {
    food: `${entry.food} refeição(ões)`, water: `${entry.water}/${profile.waterGoal} ml`, activity: `${entry.activity} min`,
    sleep: `${entry.sleep}/${profile.sleepGoal} h`, weight: entry.weight ? `${entry.weight} kg` : '—', mood: entry.mood ? MOODS[entry.mood - 1] : '—',
  }

  return (
    <div className="space-y-5">
      {reminderDue && !ended && (
        <button onClick={openLog} className="w-full flex items-center gap-3 rounded-xl bg-amber-50 border border-amber-200 p-4 text-left">
          <Bell className="w-5 h-5 text-amber-600 shrink-0" />
          <span className="flex-1"><span className="block text-sm font-semibold text-amber-900">Você ainda não registrou hoje</span><span className="block text-xs text-amber-800">Toque para registrar e manter a sequência.</span></span>
          <ChevronRight className="w-4 h-4 text-amber-600" />
        </button>
      )}

      {ended && <Finale state={state} stats={stats} rankData={rankData} owner={owner} onNewSeason={onNewSeason} />}

      <Card>
        <div className="flex justify-between text-xs text-slate-500 uppercase tracking-wide">
          <span>{ended ? 'Desafio encerrado' : `Dia ${idx} de ${CHALLENGE_DAYS}`}</span><span className="normal-case">Posição</span>
        </div>
        <div className="flex justify-between items-end">
          <p><span className="text-4xl font-bold text-slate-900">{ended ? stats.total : stats.todayPts}</span> <span className="text-slate-400">{ended ? 'pts no total' : 'pts hoje'}</span></p>
          <p className="text-2xl font-bold text-slate-900">{position ? `${position}º` : '—'}</p>
        </div>
        <div className="flex justify-between text-xs text-slate-500 mt-4 mb-1.5"><span>Progresso do desafio</span><span>{ended ? 100 : Math.round((idx / CHALLENGE_DAYS) * 100)}%</span></div>
        <div className="h-2 rounded-full bg-slate-100 overflow-hidden"><div className="h-full bg-emerald-500 rounded-full" style={{ width: `${ended ? 100 : (idx / CHALLENGE_DAYS) * 100}%` }} /></div>
        <p className="mt-4 text-sm text-slate-600 flex items-center gap-1.5"><Flame className="w-4 h-4 text-orange-500" /> {ended ? 'Melhor sequência' : 'Sequência'}: <b className="text-slate-900">{ended ? stats.best : stats.streak} dias</b></p>
      </Card>

      {!ended && (
        <>
          <section>
            <div className="flex justify-between mb-2 px-1"><h2 className="font-semibold text-slate-800">Tarefas diárias</h2><span className="text-sm text-slate-400">{doneCount}/{TASKS.length}</span></div>
            <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
              {TASKS.map(t => (
                <button key={t.id} onClick={openLog} className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-slate-50">
                  <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${st[t.id] ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300'}`}>
                    {st[t.id] && <Check className="w-3.5 h-3.5" />}
                  </span>
                  <span className={`flex-1 text-sm ${st[t.id] ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{t.label}</span>
                  {focus(t) && <Star aria-label="Seu foco" className="w-4 h-4 text-amber-400 fill-amber-400" />}
                </button>
              ))}
            </div>
          </section>

          <section>
            <h2 className="font-semibold text-slate-800 mb-2 px-1">Hábitos</h2>
            <div className="grid grid-cols-2 gap-3">
              {TASKS.map(t => (
                <button key={t.id} onClick={openLog} className={`bg-white rounded-xl border p-4 text-left hover:bg-slate-50 ${focus(t) ? 'border-amber-300' : 'border-slate-200'}`}>
                  <div className="flex justify-between"><span className="text-2xl">{t.emoji}</span><span className="text-xs font-medium text-emerald-600">+{pts[t.id]}</span></div>
                  <p className="text-sm font-medium text-slate-800 mt-2 flex items-center gap-1.5">{t.habit}{focus(t) && <span className="text-[11px] font-semibold uppercase tracking-wide text-amber-800 bg-amber-100 rounded px-1.5 py-0.5">Foco</span>}</p>
                  <p className="text-xs text-slate-400">{detail[t.id]}</p>
                </button>
              ))}
            </div>
          </section>
        </>
      )}

      <button onClick={goLearn} className="w-full bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3 text-left hover:bg-slate-50">
        <span className="w-10 h-10 rounded-lg bg-sky-100 text-sky-600 flex items-center justify-center shrink-0"><BookOpen className="w-5 h-5" /></span>
        <span className="flex-1"><span className="block text-sm font-semibold text-slate-800">Aprender: KDIGO 2024</span><span className="block text-xs text-slate-400">Resumo da diretriz de Doença Renal Crônica</span></span>
        <ChevronRight className="w-4 h-4 text-slate-400" />
      </button>
    </div>
  )
}

/* ---------------- Hoje ---------------- */
export function Today({ state, ended, openLog, saveStreak }) {
  const today = dayKey()
  const yesterday = addDays(today, -1)
  const canSave = !ended && state.rescues > 0 && dayIndex(state.start) > 1 && dayState(state, yesterday) === 'none'
  const dot = { full: 'bg-emerald-600 text-white', partial: 'bg-amber-400 text-black', saved: 'bg-sky-200 text-sky-700', none: 'bg-slate-100 text-slate-400' }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Calendário dos {CHALLENGE_DAYS} dias</h1>
      <p className="text-xs text-slate-500 mt-2 mb-4 flex items-center gap-1.5 flex-wrap">
        <i className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> completo ·
        <i className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" /> parcial ·
        <i className="w-2.5 h-2.5 rounded-full bg-sky-300 inline-block" /> salvo ·
        <i className="w-2.5 h-2.5 rounded-full bg-slate-300 inline-block" /> sem registro
      </p>
      <div className="grid grid-cols-7 gap-2 mb-6">
        {Array.from({ length: CHALLENGE_DAYS }, (_, i) => {
          const k = addDays(state.start, i)
          const future = k > today
          return (
            <div key={i} className={`aspect-square rounded-lg text-sm flex items-center justify-center ${future ? 'bg-white border border-dashed border-slate-200 text-slate-400' : dot[dayState(state, k)]} ${k === today ? 'ring-2 ring-emerald-500 ring-offset-1' : ''}`}>{i + 1}</div>
          )
        })}
      </div>

      <Card>
        <h2 className="font-semibold text-slate-900">Não quebre a corrente</h2>
        <p className="text-sm text-slate-400 mt-1">Teve um dia difícil? Use um resgate para preservar parte da sequência. Você tem <b className="text-slate-700">{state.rescues}</b> resgate(s).</p>
        <button disabled={!canSave} onClick={saveStreak}
          className="w-full h-11 mt-4 rounded-lg bg-amber-400 text-black font-semibold hover:bg-amber-300 disabled:opacity-40 disabled:cursor-not-allowed">Salvar sequência</button>
        {!canSave && <p className="text-[11px] text-slate-400 mt-2 text-center">{ended ? 'O desafio já terminou.' : 'Disponível quando ontem ficou sem registro.'}</p>}
      </Card>
      <button onClick={openLog} disabled={ended} className="w-full h-12 mt-5 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed">{ended ? 'Desafio encerrado' : 'Registrar hábitos de hoje'}</button>
    </div>
  )
}

/* ---------------- Ranking ---------------- */
export function Ranking({ rank }) {
  const [tab, setTab] = useState(0)
  const tabs = ['Geral', 'Semana 1', 'Semana 2', 'Semana 3', 'Semana 4']
  const { data, error, reload } = rank
  const score = (m) => (tab === 0 ? m.total : m.weeks[tab - 1])
  const list = data ? [...data.members].sort((a, b) => score(b) - score(a) || b.streak - a.streak) : []
  const alone = data && list.length <= 1

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900 mb-4">Ranking</h1>
      <div className="flex gap-2 overflow-x-auto pb-1 mb-4">
        {tabs.map((t, i) => (
          <button key={t} onClick={() => setTab(i)} aria-pressed={tab === i}
            className={`px-4 h-11 rounded-lg text-sm font-medium whitespace-nowrap border ${tab === i ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-slate-200 text-slate-600'}`}>{t}</button>
        ))}
      </div>

      {error && (
        <div role="alert" className="mb-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-sm p-3 flex items-center justify-between gap-3">
          <span>{error}</span><button onClick={reload} className="font-medium underline shrink-0">Tentar de novo</button>
        </div>
      )}

      {!data && !error && <p className="text-center text-sm text-slate-400 py-10">Carregando ranking…</p>}

      {data && (
        <div className="space-y-2">
          {list.map((m, i) => (
            <div key={m.id} className={`rounded-xl border p-3 flex items-center gap-3 ${m.me ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
              <span className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${i === 0 ? 'bg-amber-100 text-amber-500' : 'bg-slate-100 text-slate-500 text-sm font-semibold'}`}>
                {i === 0 ? <Crown className="w-5 h-5" /> : medal[i] || i + 1}
              </span>
              <span className="text-2xl">{m.avatar}</span>
              <span className="flex-1 min-w-0">
                <span className="block font-semibold text-slate-900 truncate">{m.name}{m.me && <span className="text-xs font-normal text-emerald-600"> (você)</span>}</span>
                <span className="text-xs text-slate-500 flex items-center gap-1"><Flame className="w-3 h-3 text-orange-500" />{m.streak} dias</span>
              </span>
              <span className="text-right"><span className="block text-xl font-bold text-slate-900">{score(m)}</span><span className="text-[11px] text-slate-400">pts</span></span>
            </div>
          ))}
        </div>
      )}

      {alone && <p className="text-center text-sm text-slate-400 my-6 px-2">Você é o único participante até agora. Compartilhe o convite pelo Perfil para entrar na disputa!</p>}

      <Card className="p-4 mt-6">
        <h2 className="font-semibold text-slate-900">Títulos do grupo</h2>
        <p className="text-xs text-slate-400 mb-3">Conquistas que não dependem só de pontos.</p>
        <div className="flex flex-wrap gap-2">
          {GROUP_TITLES.map(t => {
            const holder = data?.titles?.[t.key]
            return (
              <span key={t.key} className={`px-3 py-1.5 rounded-lg text-sm ${holder ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'}`}>
                {t.emoji} {t.label}{holder && <b className="font-semibold"> · {holder.name}</b>}
              </span>
            )
          })}
        </div>
      </Card>
      <p className="text-[11px] text-slate-400 text-center mt-5 flex items-start gap-1 justify-center"><Lock className="w-3 h-3 mt-0.5 shrink-0" /> No ranking mostramos só nome, avatar, pontos e sequência. Peso e calorias nunca aparecem para outros.</p>
    </div>
  )
}

/* ---------------- Perfil ---------------- */
// Gráfico de linha simples. data: [{ k: rótulo, v: valor }]
function LineChart({ data, color = '#10b981', min }) {
  const W = 480, H = 80, pad = 8
  const pts = data.length ? data : [{ k: '', v: 0 }]
  const lo = min ?? 0
  const hi = Math.max(...pts.map(d => d.v), lo + 1)
  const x = (i) => (pts.length === 1 ? W / 2 : pad + (i * (W - 2 * pad)) / (pts.length - 1))
  const y = (v) => H - pad - ((v - lo) / (hi - lo)) * (H - 2 * pad)
  const path = pts.map((d, i) => `${i ? 'L' : 'M'}${x(i)},${y(d.v)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H + 14}`} className="w-full" role="img" aria-label="Gráfico de evolução">
      {[0.33, 0.66].map(f => <line key={f} x1={pad} x2={W - pad} y1={pad + f * (H - 2 * pad)} y2={pad + f * (H - 2 * pad)} stroke="#e2e8f0" strokeDasharray="3 3" />)}
      <line x1={pad} x2={W - pad} y1={H - pad} y2={H - pad} stroke="#94a3b8" />
      <path d={path} fill="none" stroke={color} strokeWidth="2" />
      {pts.map((d, i) => <g key={i}><circle cx={x(i)} cy={y(d.v)} r="3" fill={color} /><text x={x(i)} y={H + 8} fontSize="8" textAnchor="middle" fill="#94a3b8">{d.k}</text></g>)}
    </svg>
  )
}

function WeightCard({ profile, stats, start }) {
  const start0 = profile.weight
  const last = stats.weights[stats.weights.length - 1]?.v
  const current = last ?? start0
  const goal = profile.goalWeight
  const pct = goal && goal !== start0 ? Math.max(0, Math.min(100, Math.round(((start0 - current) / (start0 - goal)) * 100))) : null
  const series = [{ k: 'início', v: start0 }, ...stats.weights.map(w => ({ k: String(diffDays(w.k, start) + 1), v: w.v }))]
  const delta = Math.round((current - start0) * 10) / 10
  return (
    <Card className="p-4">
      <div className="flex justify-between text-sm"><h2 className="font-semibold text-slate-800">Evolução do peso</h2><span className="text-xs text-slate-400 flex items-center gap-1"><Lock className="w-3 h-3" />só você vê</span></div>
      <div className="flex items-end justify-between mt-2">
        <p><span className="text-3xl font-bold text-slate-900">{current}</span> <span className="text-slate-400 text-sm">kg</span></p>
        <p className="text-sm text-slate-500">{delta === 0 ? 'sem variação' : `${delta > 0 ? '+' : ''}${delta} kg desde o início`}</p>
      </div>
      {pct !== null && (
        <div className="mt-3">
          <div className="flex justify-between text-xs text-slate-500 mb-1"><span>Caminho até a meta ({goal} kg)</span><span>{pct}%</span></div>
          <div className="h-2 rounded-full bg-slate-100 overflow-hidden"><div className="h-full bg-sky-500 rounded-full" style={{ width: `${pct}%` }} /></div>
        </div>
      )}
      {stats.weights.length > 0
        ? <div className="mt-3"><LineChart data={series} color="#0ea5e9" min={Math.min(...series.map(s => s.v)) - 1} /></div>
        : <p className="text-xs text-slate-400 mt-3">Registre seu peso no botão + para acompanhar a evolução aqui.</p>}
      <p className="text-[11px] text-slate-400 mt-2">Variações de peso são normais; use como referência, não como cobrança.</p>
    </Card>
  )
}

const Toggle = ({ label, on, onClick }) => (
  <button onClick={onClick} role="switch" aria-checked={on} className="w-full flex items-center justify-between py-2 text-sm text-slate-700">
    {label}
    <span className={`w-11 h-6 rounded-full p-0.5 transition ${on ? 'bg-emerald-500' : 'bg-slate-300'}`}>
      <span className={`block w-5 h-5 rounded-full bg-white transition ${on ? 'translate-x-5' : ''}`} />
    </span>
  </button>
)
const Btn = ({ children, onClick, disabled, cls = 'bg-slate-100 text-slate-700 hover:bg-slate-200' }) => (
  <button onClick={onClick} disabled={disabled} className={`w-full h-11 rounded-lg text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50 ${cls}`}>{children}</button>
)

function PinCard({ onSave }) {
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState({ ok: false, text: '' })
  const save = async () => {
    setBusy(true); setMsg({ ok: false, text: '' })
    try { await onSave(pin); setMsg({ ok: true, text: 'PIN salvo. Guarde-o em um lugar seguro.' }); setPin('') } catch (e) { setMsg({ ok: false, text: e.message }) }
    setBusy(false)
  }
  return (
    <Card className="p-4 border-amber-200 bg-amber-50">
      <h2 className="text-sm font-semibold text-amber-900 flex items-center gap-1.5"><KeyRound className="w-4 h-4" /> Defina um PIN de recuperação</h2>
      <p className="text-xs text-amber-800 mt-1 mb-3">Sem PIN, se você trocar de celular ou limpar o navegador, perde o acesso à sua conta no grupo.</p>
      <div className="flex gap-2">
        <input type="password" inputMode="numeric" pattern="[0-9]*" maxLength={8} aria-label="PIN de recuperação" value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
          placeholder="4 a 8 números" className="flex-1 h-11 px-3 rounded-lg border border-amber-200 bg-white outline-none focus:border-amber-400" />
        <button onClick={save} disabled={busy || !/^\d{4,8}$/.test(pin)} className="h-11 px-4 rounded-lg bg-amber-400 text-black font-semibold disabled:opacity-50">Salvar</button>
      </div>
      {msg.text && <p role={msg.ok ? 'status' : 'alert'} className={`text-sm mt-2 ${msg.ok ? 'text-emerald-700' : 'text-rose-600'}`}>{msg.text}</p>}
    </Card>
  )
}

// Administração do grupo (só o dono): remover membros, passar a administração, excluir o grupo.
function MembersPanel({ actions, onChanged }) {
  const [members, setMembers] = useState(null)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState('')
  const load = useCallback(async () => {
    try { setMembers(await actions.listMembers()); setError('') } catch (e) { setError(e.message) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => { load() }, [load])

  const act = async (id, fn, message) => {
    if (!confirm(message)) return
    setBusyId(id); setError('')
    try { await fn(id); await load(); onChanged?.() } catch (e) { setError(e.message) }
    setBusyId('')
  }
  return (
    <div className="rounded-lg border border-slate-200 p-3 space-y-2">
      {!members && !error && <p className="text-xs text-slate-400">Carregando…</p>}
      {members?.map(m => (
        <div key={m.id} className="flex items-center gap-2">
          <span className="text-xl">{m.avatar}</span>
          <span className="flex-1 min-w-0 text-sm text-slate-800 truncate">{m.name}{m.owner && <span className="text-[11px] text-emerald-600"> · administra</span>}{m.me && <span className="text-[11px] text-slate-400"> · você</span>}</span>
          {!m.me && (
            <>
              <button disabled={busyId === m.id} onClick={() => act(m.id, actions.transferOwner, `Passar a administração do grupo para ${m.name}? Você deixa de administrar.`)} className="text-xs px-2 h-10 rounded-md bg-sky-50 text-sky-700 disabled:opacity-50">Tornar admin</button>
              <button disabled={busyId === m.id} onClick={() => act(m.id, actions.kick, `Remover ${m.name} do grupo? Os pontos dessa pessoa serão apagados.`)} className="text-xs px-2 h-10 rounded-md bg-rose-50 text-rose-600 disabled:opacity-50">Remover</button>
            </>
          )}
        </div>
      ))}
      {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
    </div>
  )
}

export function Profile({ state, stats, actions, rank, reloadRank, goPrivacy }) {
  const { profile, group } = state
  const imc = bmi(profile.weight, profile.height)
  const [copied, setCopied] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [showMembers, setShowMembers] = useState(false)
  const owner = !!(rank?.me.owner ?? state.member.owner)
  const needsPin = rank && !rank.me.hasPin

  const serverCall = async (fn) => {
    setBusy(true); setError('')
    try { await fn() } catch (e) { setError(e.message) }
    setBusy(false)
  }
  const copy = async (text, what) => {
    try { await navigator.clipboard.writeText(text) } catch {}
    setCopied(what); setTimeout(() => setCopied(''), 1500)
  }
  const toggleReminder = () => {
    if (!state.settings.reminder && typeof Notification !== 'undefined' && Notification.permission === 'default') Notification.requestPermission()
    actions.setting('reminder')
  }
  const notifBlocked = typeof Notification !== 'undefined' && Notification.permission === 'denied'

  return (
    <div className="space-y-4">
      <Card className="p-4 flex items-center gap-4">
        <span className="w-14 h-14 rounded-xl bg-slate-100 text-3xl flex items-center justify-center shrink-0">{profile.avatar}</span>
        <div className="min-w-0"><p className="font-semibold text-slate-900 truncate">{profile.name}</p><p className="text-sm text-slate-400">{stats.total} pts · {rank ? `${rank.me.rank}º` : '—'} no grupo · 🔥 {stats.streak} dias</p></div>
      </Card>

      {needsPin && <PinCard onSave={actions.setPin} />}

      {imc && (
        <Card className="p-4">
          <div className="flex justify-between text-sm"><span className="font-medium text-slate-800">Seu IMC <span className="text-xs text-slate-400 font-normal">(privado)</span></span><span className="text-xs text-slate-400 flex items-center gap-1"><Lock className="w-3 h-3" />só você vê</span></div>
          <div className="flex justify-between items-center mt-2">
            <div><p className="text-3xl font-bold text-slate-900">{imc.value}</p><p className="text-xs text-slate-400">Altura {profile.height}cm · Peso {profile.weight}kg</p>{profile.goalWeight && <p className="text-xs text-slate-400 mt-1">Meta: {profile.goalWeight} kg</p>}</div>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${TONES[imc.tone]}`}>{imc.label}</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">O IMC é uma referência, não um veredito. Foco em consistência.</p>
        </Card>
      )}

      <WeightCard profile={profile} stats={stats} start={state.start} />

      <Card className="p-4">
        <h2 className="text-sm font-semibold text-slate-800 mb-2">Pontos por dia</h2>
        <LineChart data={stats.perDay.map(d => ({ k: String(diffDays(d.k, state.start) + 1), v: d.pts }))} />
      </Card>

      <Card className="p-4">
        <h2 className="text-sm font-semibold text-slate-800 mb-3">Conquistas ({stats.unlocked.length}/{ACHIEVEMENTS.length})</h2>
        <div className="grid grid-cols-4 gap-3">
          {ACHIEVEMENTS.map(a => {
            const on = stats.unlocked.includes(a.id)
            return <div key={a.id} className="text-center"><span className={`text-2xl block ${on ? '' : 'grayscale opacity-30'}`}>{a.emoji}</span><span className={`text-[11px] leading-tight block mt-1 ${on ? 'text-slate-700' : 'text-slate-400'}`}>{a.label}</span></div>
          })}
        </div>
      </Card>

      <Card className="p-4">
        <h2 className="text-sm font-semibold text-slate-800 mb-3">Grupo & Convite</h2>
        <div className="rounded-lg bg-slate-50 p-3 flex items-center justify-between mb-3">
          <div><p className="text-[11px] text-slate-400">Código de acesso</p><p className="font-mono font-bold text-emerald-600 break-all">{group.code}</p></div>
          <button onClick={() => copy(group.code, 'code')} className="h-10 px-3 rounded-md border border-slate-200 bg-white text-xs flex items-center gap-1.5 shrink-0"><Copy className="w-3 h-3" />{copied === 'code' ? 'Copiado' : 'Copiar'}</button>
        </div>
        <div className="space-y-2">
          <Btn onClick={() => copy(`${location.origin}/?convite=${group.code}`, 'link')}><Copy className="w-4 h-4" />{copied === 'link' ? 'Link copiado' : 'Copiar link de convite'}</Btn>
          {owner ? (
            <>
              <Btn onClick={() => setShowMembers(v => !v)}><Users className="w-4 h-4" />{showMembers ? 'Ocultar membros' : 'Gerenciar membros'}</Btn>
              {showMembers && <MembersPanel actions={actions} onChanged={reloadRank} />}
              <Btn disabled={busy} onClick={() => confirm('Gerar novo código? O código atual deixa de funcionar para novos membros (quem já está no grupo continua).') && serverCall(actions.newCode)}>Gerar novo código/link</Btn>
              <Btn disabled={busy} cls="bg-sky-50 text-sky-700 hover:bg-sky-100" onClick={() => confirm('Iniciar nova temporada? Os pontos de todo o grupo serão zerados.') && serverCall(actions.newSeason)}>Iniciar nova temporada</Btn>
              <Btn disabled={busy} cls="bg-rose-50 text-rose-600 hover:bg-rose-100" onClick={() => confirm('Excluir o grupo para TODOS os participantes? Isso não pode ser desfeito.') && serverCall(actions.deleteGroup)}>Excluir grupo</Btn>
            </>
          ) : (
            <p className="text-[11px] text-slate-400 text-center">Só quem administra o grupo pode gerar novo código, iniciar temporada ou remover membros.</p>
          )}
          {busy && <p className="text-[11px] text-slate-400 text-center">Aguarde…</p>}
          {error && <p role="alert" className="text-sm text-rose-600 text-center">{error}</p>}
        </div>
      </Card>

      <Card className="p-4">
        <h2 className="text-sm font-semibold text-slate-800 mb-1">Configurações</h2>
        <Toggle label="Lembrete diário" on={state.settings.reminder} onClick={toggleReminder} />
        {state.settings.reminder && (
          <div className="pb-2">
            <label className="flex items-center justify-between text-sm text-slate-700 py-1">
              Lembrar a partir das
              <input type="time" value={state.settings.reminderTime} onChange={e => actions.setSetting('reminderTime', e.target.value || '20:00')} className="h-11 px-2 rounded-md border border-slate-200 bg-slate-50 text-sm" />
            </label>
            <p className="text-[11px] text-slate-400">{notifBlocked ? 'As notificações do navegador estão bloqueadas; o aviso aparece só dentro do app.' : 'Avisa se você ainda não registrou o dia, enquanto o app estiver aberto (aba ou tela do celular). Com o app fechado não há aviso.'}</p>
          </div>
        )}
        <Toggle label="Compartilhar progresso no grupo" on={state.settings.share} onClick={() => actions.setting('share')} />
        <Toggle label="Modo escuro" on={state.settings.dark} onClick={() => actions.setting('dark')} />
        <button onClick={goPrivacy} className="w-full flex items-center justify-between py-3 text-sm text-slate-700"><span className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-emerald-600" /> Política de Privacidade</span><ChevronRight className="w-4 h-4 text-slate-400" /></button>
      </Card>

      <button disabled={busy} onClick={() => confirm('Apagar todos os seus dados? Você também sai do grupo.') && serverCall(actions.reset)}
        className="w-full h-11 rounded-lg bg-rose-50 text-rose-600 text-sm font-medium hover:bg-rose-100 disabled:opacity-50">Apagar todos os dados</button>
    </div>
  )
}

/* ---------------- Registro (botão +) ---------------- */
const Row = ({ emoji, title, children }) => (
  <div className="py-3 border-b border-slate-100 last:border-0">
    <p className="text-sm font-medium text-slate-800 mb-2">{emoji} {title}</p>{children}
  </div>
)
const Step = ({ value, unit, label, onMinus, onPlus }) => (
  <div className="flex items-center gap-3">
    <button onClick={onMinus} aria-label={`Diminuir ${label}`} className="w-11 h-11 rounded-lg bg-slate-100 flex items-center justify-center"><Minus className="w-4 h-4" /></button>
    <span className="flex-1 text-center font-semibold text-slate-900" aria-live="polite">{value} <span className="text-sm font-normal text-slate-400">{unit}</span></span>
    <button onClick={onPlus} aria-label={`Aumentar ${label}`} className="w-11 h-11 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center"><Plus className="w-4 h-4" /></button>
  </div>
)

export function LogSheet({ state, onChange, onClose }) {
  const { profile } = state
  const e = { ...emptyEntry, ...state.log[dayKey()] }
  useEffect(() => {
    const onKey = (ev) => ev.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Registrar hoje" onClick={ev => ev.stopPropagation()} className="bg-white w-full max-w-[552px] rounded-t-2xl p-5 max-h-[88vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-1"><h2 className="font-semibold text-slate-900 text-lg">Registrar hoje</h2><button onClick={onClose} aria-label="Fechar" className="p-3 -m-1 text-slate-400"><X className="w-5 h-5" /></button></div>
        <Row emoji="🥗" title="Alimentação (refeições saudáveis)"><Step label="refeições" value={e.food} unit="" onMinus={() => onChange({ food: Math.max(0, e.food - 1) })} onPlus={() => onChange({ food: Math.min(6, e.food + 1) })} /></Row>
        <Row emoji="💧" title={`Água (meta ${profile.waterGoal} ml)`}><Step label="água" value={e.water} unit="ml" onMinus={() => onChange({ water: Math.max(0, e.water - 250) })} onPlus={() => onChange({ water: e.water + 250 })} /></Row>
        <Row emoji="🏃" title="Atividade física (meta 30 min)"><Step label="atividade" value={e.activity} unit="min" onMinus={() => onChange({ activity: Math.max(0, e.activity - 10) })} onPlus={() => onChange({ activity: e.activity + 10 })} /></Row>
        <Row emoji="😴" title={`Sono (meta ${profile.sleepGoal}h)`}><Step label="sono" value={e.sleep} unit="h" onMinus={() => onChange({ sleep: Math.max(0, e.sleep - 0.5) })} onPlus={() => onChange({ sleep: Math.min(14, e.sleep + 0.5) })} /></Row>
        <Row emoji="⚖️" title="Peso (kg)"><input type="number" inputMode="decimal" step="0.1" min="10" aria-label="Peso em quilos" value={e.weight ?? ''} onChange={ev => onChange({ weight: ev.target.value === '' ? null : Number(ev.target.value) })} className="w-full h-11 px-3 rounded-lg border border-slate-200 bg-slate-50 outline-none focus:border-emerald-400" placeholder={String(profile.weight)} /></Row>
        <Row emoji="🧘" title="Como você está hoje?">
          <div className="flex justify-between">
            {MOODS.map((m, i) => <button key={m} onClick={() => onChange({ mood: i + 1 })} aria-label={`Humor ${i + 1} de 5`} aria-pressed={e.mood === i + 1} className={`w-12 h-12 rounded-xl text-2xl border-2 ${e.mood === i + 1 ? 'bg-emerald-100 border-emerald-400 text-black' : 'bg-slate-100 border-transparent'}`}>{m}</button>)}
          </div>
        </Row>
        <button onClick={onClose} className="w-full h-12 mt-3 rounded-lg bg-emerald-600 text-white font-semibold">Concluir</button>
      </div>
    </div>
  )
}
