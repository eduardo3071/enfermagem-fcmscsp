import { useState } from 'react'
import { Flame, Check, Crown, Lock, Copy, X, Plus, Minus, BookOpen, ChevronRight } from 'lucide-react'
import { TASKS, MOODS, ACHIEVEMENTS, GROUP_TITLES, bmi } from './config.js'
import { Card, TONES } from './ui.jsx'
import { dayKey, addDays, dayIndex, dayState, taskStatus, taskPoints, emptyEntry } from './store.js'

/* ---------------- Início ---------------- */
export function Home({ state, stats, position, openLog, goLearn }) {
  const { profile, start } = state
  const idx = Math.min(Math.max(dayIndex(start), 1), 30)
  const entry = { ...emptyEntry, ...state.log[dayKey()] }
  const st = taskStatus(entry, profile)
  const pts = taskPoints(entry, profile)
  const doneCount = Object.values(st).filter(Boolean).length
  const detail = {
    food: `${entry.food} refeição(ões)`, water: `${entry.water}/${profile.waterGoal} ml`, activity: `${entry.activity} min`,
    sleep: `${entry.sleep}/${profile.sleepGoal} h`, weight: entry.weight ? `${entry.weight} kg` : '—', mood: entry.mood ? MOODS[entry.mood - 1] : '—',
  }

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex justify-between text-xs text-slate-500 uppercase tracking-wide">
          <span>Dia {idx} de 30</span><span className="normal-case">Posição</span>
        </div>
        <div className="flex justify-between items-end">
          <p><span className="text-4xl font-bold text-slate-900">{stats.todayPts}</span> <span className="text-slate-400">pts hoje</span></p>
          <p className="text-2xl font-bold text-slate-900">{position ? `${position}º` : '—'}</p>
        </div>
        <div className="flex justify-between text-xs text-slate-500 mt-4 mb-1.5"><span>Progresso do desafio</span><span>{Math.round((idx / 30) * 100)}%</span></div>
        <div className="h-2 rounded-full bg-slate-100 overflow-hidden"><div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(idx / 30) * 100}%` }} /></div>
        <p className="mt-4 text-sm text-slate-600 flex items-center gap-1.5"><Flame className="w-4 h-4 text-orange-500" /> Sequência: <b className="text-slate-900">{stats.streak} dias</b></p>
      </Card>

      <section>
        <div className="flex justify-between mb-2 px-1"><h2 className="font-semibold text-slate-800">Tarefas diárias</h2><span className="text-sm text-slate-400">{doneCount}/{TASKS.length}</span></div>
        <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
          {TASKS.map(t => (
            <button key={t.id} onClick={openLog} className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-slate-50">
              <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${st[t.id] ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300'}`}>
                {st[t.id] && <Check className="w-3.5 h-3.5" />}
              </span>
              <span className={`flex-1 text-sm ${st[t.id] ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{t.label}</span>
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-semibold text-slate-800 mb-2 px-1">Hábitos</h2>
        <div className="grid grid-cols-2 gap-3">
          {TASKS.map(t => (
            <button key={t.id} onClick={openLog} className="bg-white rounded-xl border border-slate-200 p-4 text-left hover:bg-slate-50">
              <div className="flex justify-between"><span className="text-2xl">{t.emoji}</span><span className="text-xs font-medium text-emerald-600">+{pts[t.id]}</span></div>
              <p className="text-sm font-medium text-slate-800 mt-2">{t.habit}</p>
              <p className="text-xs text-slate-400">{detail[t.id]}</p>
            </button>
          ))}
        </div>
      </section>

      <button onClick={goLearn} className="w-full bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3 text-left hover:bg-slate-50">
        <span className="w-10 h-10 rounded-lg bg-sky-100 text-sky-600 flex items-center justify-center"><BookOpen className="w-5 h-5" /></span>
        <span className="flex-1"><span className="block text-sm font-semibold text-slate-800">Aprender: KDIGO 2024</span><span className="block text-xs text-slate-400">Resumo da diretriz de Doença Renal Crônica</span></span>
        <ChevronRight className="w-4 h-4 text-slate-400" />
      </button>
    </div>
  )
}

/* ---------------- Hoje ---------------- */
export function Today({ state, stats, openLog, saveStreak }) {
  const today = dayKey()
  const yesterday = addDays(today, -1)
  const canSave = state.rescues > 0 && dayIndex(state.start) > 1 && dayState(state, yesterday) === 'none'
  const dot = { full: 'bg-emerald-500 text-white', partial: 'bg-amber-400 text-white', saved: 'bg-sky-200 text-sky-700', none: 'bg-slate-100 text-slate-400' }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Calendário dos 30 dias</h1>
      <p className="text-xs text-slate-500 mt-2 mb-4 flex items-center gap-1.5 flex-wrap">
        <i className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> completo ·
        <i className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" /> parcial ·
        <i className="w-2.5 h-2.5 rounded-full bg-slate-300 inline-block" /> sem registro
      </p>
      <div className="grid grid-cols-7 gap-2 mb-6">
        {Array.from({ length: 30 }, (_, i) => {
          const k = addDays(state.start, i)
          const future = k > today
          return (
            <div key={i} className={`aspect-square rounded-lg text-sm flex items-center justify-center ${future ? 'bg-slate-50 text-slate-300' : dot[dayState(state, k)]} ${k === today ? 'ring-2 ring-emerald-500 ring-offset-1' : ''}`}>{i + 1}</div>
          )
        })}
      </div>

      <Card>
        <h2 className="font-semibold text-slate-900">Não quebre a corrente</h2>
        <p className="text-sm text-slate-400 mt-1">Teve um dia difícil? Use um resgate para preservar parte da sequência. Você tem <b className="text-slate-700">{state.rescues}</b> resgate(s).</p>
        <button disabled={!canSave} onClick={saveStreak}
          className="w-full h-11 mt-4 rounded-lg bg-amber-500 text-white font-semibold hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed">Salvar sequência</button>
        {!canSave && <p className="text-[11px] text-slate-400 mt-2 text-center">Disponível quando ontem ficou sem registro.</p>}
      </Card>
      <button onClick={openLog} className="w-full h-12 mt-5 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-500">Registrar hábitos de hoje</button>
    </div>
  )
}

/* ---------------- Ranking ---------------- */
export function Ranking({ state, stats, rank }) {
  const [tab, setTab] = useState(0)
  const tabs = ['Geral', 'Semana 1', 'Semana 2', 'Semana 3', 'Semana 4']
  const { data, error, reload } = rank
  const score = (m) => (tab === 0 ? m.total : m.weeks[tab - 1])
  const list = data ? [...data.members].sort((a, b) => score(b) - score(a) || b.streak - a.streak) : []
  const alone = data && list.length <= 1
  const medal = ['🥇', '🥈', '🥉']

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900 mb-4">Ranking</h1>
      <div className="flex gap-2 overflow-x-auto pb-1 mb-4">
        {tabs.map((t, i) => (
          <button key={t} onClick={() => setTab(i)}
            className={`px-4 h-9 rounded-lg text-sm font-medium whitespace-nowrap border ${tab === i ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-slate-200 text-slate-600'}`}>{t}</button>
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
              <span className={`w-10 h-10 rounded-lg flex items-center justify-center ${i === 0 ? 'bg-amber-100 text-amber-500' : 'bg-slate-100 text-slate-500 text-sm font-semibold'}`}>
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
function PointsChart({ data }) {
  const W = 480, H = 80, pad = 8
  const pts = data.length ? data : [{ k: dayKey(), pts: 0 }]
  const max = Math.max(...pts.map(d => d.pts), 10)
  const x = (i) => (pts.length === 1 ? W / 2 : pad + (i * (W - 2 * pad)) / (pts.length - 1))
  const y = (v) => H - pad - (v / max) * (H - 2 * pad)
  const path = pts.map((d, i) => `${i ? 'L' : 'M'}${x(i)},${y(d.pts)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H + 14}`} className="w-full">
      {[0.33, 0.66].map(f => <line key={f} x1={pad} x2={W - pad} y1={pad + f * (H - 2 * pad)} y2={pad + f * (H - 2 * pad)} stroke="#e2e8f0" strokeDasharray="3 3" />)}
      <line x1={pad} x2={W - pad} y1={H - pad} y2={H - pad} stroke="#94a3b8" />
      <path d={path} fill="none" stroke="#10b981" strokeWidth="2" />
      {pts.map((d, i) => <g key={d.k}><circle cx={x(i)} cy={y(d.pts)} r="3" fill="#10b981" /><text x={x(i)} y={H + 8} fontSize="8" textAnchor="middle" fill="#94a3b8">{i + 1}</text></g>)}
    </svg>
  )
}

export function Profile({ state, stats, actions, rank }) {
  const { profile, group } = state
  const imc = bmi(profile.weight, profile.height)
  const [copied, setCopied] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const owner = !!(rank?.me.owner ?? state.member.owner)
  const serverCall = async (fn) => {
    setBusy(true); setError('')
    try { await fn() } catch (e) { setError(e.message) }
    setBusy(false)
  }
  const copy = async (text, what) => {
    try { await navigator.clipboard.writeText(text) } catch {}
    setCopied(what); setTimeout(() => setCopied(''), 1500)
  }
  const Toggle = ({ label, k }) => (
    <button onClick={() => actions.setting(k)} className="w-full flex items-center justify-between py-2 text-sm text-slate-700">
      {label}
      <span className={`w-11 h-6 rounded-full p-0.5 transition ${state.settings[k] ? 'bg-emerald-500' : 'bg-slate-300'}`}>
        <span className={`block w-5 h-5 rounded-full bg-white transition ${state.settings[k] ? 'translate-x-5' : ''}`} />
      </span>
    </button>
  )
  const Btn = ({ children, onClick, cls = 'bg-slate-100 text-slate-700 hover:bg-slate-200' }) => (
    <button onClick={onClick} className={`w-full h-11 rounded-lg text-sm font-medium flex items-center justify-center gap-2 ${cls}`}>{children}</button>
  )

  return (
    <div className="space-y-4">
      <Card className="p-4 flex items-center gap-4">
        <span className="w-14 h-14 rounded-xl bg-slate-100 text-3xl flex items-center justify-center">{profile.avatar}</span>
        <div><p className="font-semibold text-slate-900">{profile.name}</p><p className="text-sm text-slate-400">{stats.total} pts · {rank ? `${rank.me.rank}º` : '—'} no grupo · 🔥 {stats.streak} dias</p></div>
      </Card>

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

      <Card className="p-4"><h2 className="text-sm font-semibold text-slate-800 mb-2">Pontos por dia</h2><PointsChart data={stats.perDay} /></Card>

      <Card className="p-4">
        <h2 className="text-sm font-semibold text-slate-800 mb-3">Conquistas ({stats.unlocked.length}/{ACHIEVEMENTS.length})</h2>
        <div className="grid grid-cols-4 gap-3">
          {ACHIEVEMENTS.map(a => {
            const on = stats.unlocked.includes(a.id)
            return <div key={a.id} className="text-center"><span className={`text-2xl block ${on ? '' : 'grayscale opacity-30'}`}>{a.emoji}</span><span className={`text-[10px] leading-tight block mt-1 ${on ? 'text-slate-700' : 'text-slate-300'}`}>{a.label}</span></div>
          })}
        </div>
      </Card>

      <Card className="p-4">
        <h2 className="text-sm font-semibold text-slate-800 mb-3">Grupo & Convite</h2>
        <div className="rounded-lg bg-slate-50 p-3 flex items-center justify-between mb-3">
          <div><p className="text-[11px] text-slate-400">Código de acesso</p><p className="font-mono font-bold text-emerald-600">{group.code}</p></div>
          <button onClick={() => copy(group.code, 'code')} className="h-8 px-3 rounded-md border border-slate-200 bg-white text-xs flex items-center gap-1.5"><Copy className="w-3 h-3" />{copied === 'code' ? 'Copiado' : 'Copiar'}</button>
        </div>
        <div className="space-y-2">
          <Btn onClick={() => copy(`${location.origin}/?convite=${group.code}`, 'link')}><Copy className="w-4 h-4" />{copied === 'link' ? 'Link copiado' : 'Copiar link de convite'}</Btn>
          {owner ? (
            <>
              <Btn onClick={() => confirm('Gerar novo código? O código atual deixa de funcionar para novos membros.') && serverCall(actions.newCode)}>Gerar novo código/link</Btn>
              <Btn cls="bg-sky-50 text-sky-700 hover:bg-sky-100" onClick={() => confirm('Iniciar nova temporada? Os pontos de todo o grupo serão zerados.') && serverCall(actions.newSeason)}>Iniciar nova temporada</Btn>
            </>
          ) : (
            <p className="text-[11px] text-slate-400 text-center">Só quem criou o grupo pode gerar novo código ou iniciar uma temporada.</p>
          )}
          {busy && <p className="text-[11px] text-slate-400 text-center">Aguarde…</p>}
          {error && <p role="alert" className="text-sm text-rose-600 text-center">{error}</p>}
        </div>
      </Card>

      <Card className="p-4">
        <h2 className="text-sm font-semibold text-slate-800 mb-1">Configurações</h2>
        <Toggle label="Notificações" k="notifications" />
        <Toggle label="Compartilhar progresso no grupo" k="share" />
        <Toggle label="Modo escuro" k="dark" />
      </Card>

      <button onClick={() => confirm('Apagar todos os seus dados? Você também sai do grupo.') && actions.reset()} className="w-full h-11 rounded-lg bg-rose-50 text-rose-600 text-sm font-medium hover:bg-rose-100">Apagar todos os dados</button>
    </div>
  )
}

/* ---------------- Registro (botão +) ---------------- */
const Row = ({ emoji, title, children }) => (
  <div className="py-3 border-b border-slate-100 last:border-0">
    <p className="text-sm font-medium text-slate-800 mb-2">{emoji} {title}</p>{children}
  </div>
)
const Step = ({ value, unit, onMinus, onPlus }) => (
  <div className="flex items-center gap-3">
    <button onClick={onMinus} className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center"><Minus className="w-4 h-4" /></button>
    <span className="flex-1 text-center font-semibold text-slate-900">{value} <span className="text-sm font-normal text-slate-400">{unit}</span></span>
    <button onClick={onPlus} className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center"><Plus className="w-4 h-4" /></button>
  </div>
)

export function LogSheet({ state, onChange, onClose }) {
  const { profile } = state
  const e = { ...emptyEntry, ...state.log[dayKey()] }
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center" onClick={onClose}>
      <div onClick={ev => ev.stopPropagation()} className="bg-white w-full max-w-md rounded-t-2xl p-5 max-h-[88vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-1"><h2 className="font-semibold text-slate-900 text-lg">Registrar hoje</h2><button onClick={onClose} className="p-1 text-slate-400"><X className="w-5 h-5" /></button></div>
        <Row emoji="🥗" title="Alimentação (refeições saudáveis)"><Step value={e.food} unit="" onMinus={() => onChange({ food: Math.max(0, e.food - 1) })} onPlus={() => onChange({ food: Math.min(6, e.food + 1) })} /></Row>
        <Row emoji="💧" title={`Água (meta ${profile.waterGoal} ml)`}><Step value={e.water} unit="ml" onMinus={() => onChange({ water: Math.max(0, e.water - 250) })} onPlus={() => onChange({ water: e.water + 250 })} /></Row>
        <Row emoji="🏃" title="Atividade física (meta 30 min)"><Step value={e.activity} unit="min" onMinus={() => onChange({ activity: Math.max(0, e.activity - 10) })} onPlus={() => onChange({ activity: e.activity + 10 })} /></Row>
        <Row emoji="😴" title={`Sono (meta ${profile.sleepGoal}h)`}><Step value={e.sleep} unit="h" onMinus={() => onChange({ sleep: Math.max(0, e.sleep - 0.5) })} onPlus={() => onChange({ sleep: Math.min(14, e.sleep + 0.5) })} /></Row>
        <Row emoji="⚖️" title="Peso (kg)"><input type="number" step="0.1" min="10" value={e.weight ?? ''} onChange={ev => onChange({ weight: ev.target.value === '' ? null : Number(ev.target.value) })} className="w-full h-11 px-3 rounded-lg border border-slate-200 bg-slate-50 outline-none focus:border-emerald-400" placeholder={String(profile.weight)} /></Row>
        <Row emoji="🧘" title="Como você está hoje?">
          <div className="flex justify-between">
            {MOODS.map((m, i) => <button key={m} onClick={() => onChange({ mood: i + 1 })} className={`w-12 h-12 rounded-xl text-2xl border-2 ${e.mood === i + 1 ? 'bg-emerald-100 border-emerald-400' : 'bg-slate-100 border-transparent'}`}>{m}</button>)}
          </div>
        </Row>
        <button onClick={onClose} className="w-full h-12 mt-3 rounded-lg bg-emerald-600 text-white font-semibold">Concluir</button>
      </div>
    </div>
  )
}
