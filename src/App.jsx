import { useCallback, useEffect, useRef, useState } from 'react'
import { Home as HomeIcon, CalendarDays, Trophy, User, Plus, Moon, Sun } from 'lucide-react'
import { useStore, computeStats, dayIndex, dayKey, dayPoints, buildSync, isEnded, CHALLENGE_DAYS } from './store.js'
import { PRIVACY_VERSION } from './config.js'
import { api } from './api.js'
import { Onboarding, GroupSetup } from './Onboarding.jsx'
import { Home, Today, Ranking, Profile, LogSheet } from './Screens.jsx'
import { Learn } from './Learn.jsx'
import { Privacy, ConsentGate } from './Privacy.jsx'

const TABS = [
  { id: 'home', label: 'Início', Icon: HomeIcon },
  { id: 'today', label: 'Hoje', Icon: CalendarDays },
  { id: 'fab' },
  { id: 'ranking', label: 'Ranking', Icon: Trophy },
  { id: 'profile', label: 'Perfil', Icon: User },
]

const LOST_ACCESS = 'Sua sessão neste aparelho terminou: você foi removido do grupo, o grupo foi excluído ou o acesso foi recuperado em outro aparelho. Entre de novo ou use "Recuperar acesso" com o seu PIN.'

// Ranking do servidor: carrega ao abrir, atualiza a cada 20s, ao trocar de aba e depois de cada sincronização.
function useRanking(store) {
  const { state } = store
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const token = state.member.token
  const { syncGroupMeta, leaveGroup } = store

  const load = useCallback(async () => {
    try {
      const r = await api.ranking(token)
      setData(r); setError('')
      syncGroupMeta(r.group)
    } catch (e) {
      if (e.status === 401 || e.status === 403) return leaveGroup(LOST_ACCESS) // sessão perdida: volta para a tela de grupo
      setError(e.message)
    }
  }, [token, syncGroupMeta, leaveGroup])

  useEffect(() => {
    load()
    const t = setInterval(load, 20000)
    return () => clearInterval(t)
  }, [load])

  return { data, error, reload: load }
}

const hhmm = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

function Shell({ store }) {
  const { state } = store
  const [tab, setTab] = useState('home')
  const [logOpen, setLogOpen] = useState(false)
  const [, setTick] = useState(0)
  const rank = useRanking(store)

  const stats = computeStats(state)
  const ended = isEnded(state.start)
  const idx = Math.min(Math.max(dayIndex(state.start), 1), CHALLENGE_DAYS)
  const go = (t) => { setTab(t); window.scrollTo(0, 0) }
  const openLog = () => (ended ? go('home') : setLogOpen(true))
  const owner = !!(rank.data?.me.owner ?? state.member.owner)

  // relógio: reavalia o lembrete (e a virada do dia) a cada 30 s
  useEffect(() => { const t = setInterval(() => setTick(n => n + 1), 30000); return () => clearInterval(t) }, [])

  // Lembrete diário: depois do horário escolhido, se nada foi registrado hoje.
  const loggedToday = dayPoints(state.log[dayKey()], state.profile) > 0
  const reminderDue = state.settings.reminder && !ended && !loggedToday && hhmm(new Date()) >= state.settings.reminderTime
  useEffect(() => {
    if (!reminderDue || typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    const key = `d30:notified:${dayKey()}`
    try {
      if (localStorage.getItem(key)) return
      localStorage.setItem(key, '1')
      new Notification('Desafio 30 Dias', { body: 'Você ainda não registrou seus hábitos de hoje.', icon: '/favicon.svg' })
    } catch {}
  }, [reminderDue])

  // Sincroniza com o servidor (debounce) sempre que o progresso muda. O servidor recalcula pontos e sequência.
  const payload = JSON.stringify(buildSync(state))
  const first = useRef(true)
  useEffect(() => {
    const t = setTimeout(async () => {
      try { await api.sync(JSON.parse(payload), state.member.token); rank.reload() } catch {}
      first.current = false
    }, first.current ? 0 : 800)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payload, state.member.token])

  // Ao trocar de aba, busca o ranking de novo para não mostrar dado velho.
  useEffect(() => { rank.reload() }, [tab]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-[552px] mx-auto px-4 h-[68px] flex items-center gap-3">
          <span className="w-10 h-10 rounded-lg bg-sky-100 text-xl flex items-center justify-center shrink-0">{state.group.icon}</span>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-slate-900 truncate leading-tight">{state.group.name}</p>
            <p className="text-[11px] text-slate-400">Temporada {state.season} · {ended ? 'encerrado' : `Dia ${idx}/${CHALLENGE_DAYS}`}</p>
          </div>
          <div className="text-right shrink-0"><p className="text-[11px] text-slate-400 leading-none">Total</p><p className="font-semibold text-slate-900">{stats.total} pts</p></div>
          <button onClick={() => store.setting('dark')} aria-label="Alternar tema" className="w-10 h-10 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 shrink-0">
            {state.settings.dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </header>

      <main className="max-w-[552px] mx-auto px-4 pt-5 pb-32">
        {tab === 'home' && (
          <Home state={state} stats={stats} position={rank.data?.me.rank} ended={ended} reminderDue={reminderDue} rankData={rank.data}
            owner={owner} onNewSeason={store.newSeason} openLog={openLog} goLearn={() => go('learn')} />
        )}
        {tab === 'today' && <Today state={state} ended={ended} openLog={openLog} saveStreak={store.saveStreak} />}
        {tab === 'ranking' && <Ranking rank={rank} />}
        {tab === 'profile' && <Profile state={state} stats={stats} actions={store} rank={rank.data} reloadRank={rank.reload} goPrivacy={() => go('privacy')} />}
        {tab === 'learn' && <Learn onBack={() => go('home')} />}
        {tab === 'privacy' && <Privacy onBack={() => go('profile')} />}
      </main>

      <nav aria-label="Navegação principal" className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-slate-200">
        <div className="max-w-[552px] mx-auto grid grid-cols-5 items-end relative">
          {TABS.map(({ id, label, Icon }) =>
            id === 'fab' ? (
              <div key={id} className="flex justify-center">
                <button onClick={openLog} aria-label={ended ? 'Desafio encerrado' : 'Registrar hábitos'} className={`-mt-5 w-14 h-14 rounded-xl text-white shadow-lg flex items-center justify-center ${ended ? 'bg-slate-400' : 'bg-emerald-600 hover:bg-emerald-500'}`}>
                  <Plus className="w-6 h-6" />
                </button>
              </div>
            ) : (
              <button key={id} onClick={() => go(id)} aria-current={tab === id ? 'page' : undefined} className={`py-2.5 flex flex-col items-center gap-0.5 text-[11px] ${tab === id ? 'text-emerald-600 font-medium' : 'text-slate-400'}`}>
                <Icon className="w-5 h-5" />{label}
              </button>
            )
          )}
        </div>
      </nav>

      {logOpen && !ended && <LogSheet state={state} onChange={store.logToday} onClose={() => setLogOpen(false)} />}
    </div>
  )
}

export default function App() {
  const store = useStore()
  const { state, notice } = store
  const [readPolicy, setReadPolicy] = useState(false)

  if (!state.profile) return <Onboarding onFinish={store.saveProfile} />
  // quem já usava o app antes da política (ou quando ela muda de versão) precisa aceitar de novo
  if (state.profile.consent?.version !== PRIVACY_VERSION) {
    return <ConsentGate onAccept={store.acceptConsent} onRead={() => setReadPolicy(true)} readOpen={readPolicy} onClose={() => setReadPolicy(false)} />
  }
  // Quem tinha grupo só local (versão sem servidor) ou perdeu o acesso precisa entrar de novo: state.member ausente.
  if (!state.group || !state.member) {
    return (
      <GroupSetup onCreate={store.createGroup} onJoin={store.joinGroup} onRecover={store.recover}
        initialCode={new URLSearchParams(location.search).get('convite') || ''} notice={notice} defaultName={state.profile.name} />
    )
  }
  return <Shell store={store} />
}
