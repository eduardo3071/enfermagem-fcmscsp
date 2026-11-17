import { useCallback, useEffect, useRef, useState } from 'react'
import { Home as HomeIcon, CalendarDays, Trophy, User, Plus, Moon, Sun } from 'lucide-react'
import { useStore, computeStats, dayIndex, buildSync } from './store.js'
import { api } from './api.js'
import { Onboarding, GroupSetup } from './Onboarding.jsx'
import { Home, Today, Ranking, Profile, LogSheet } from './Screens.jsx'
import { Learn } from './Learn.jsx'

const TABS = [
  { id: 'home', label: 'Início', Icon: HomeIcon },
  { id: 'today', label: 'Hoje', Icon: CalendarDays },
  { id: 'fab' },
  { id: 'ranking', label: 'Ranking', Icon: Trophy },
  { id: 'profile', label: 'Perfil', Icon: User },
]

// Ranking do servidor: carrega ao abrir, atualiza a cada 20s e depois de cada sincronização.
function useRanking(store) {
  const { state } = store
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const code = state.group.code
  const token = state.member.token

  const load = useCallback(async () => {
    try {
      const r = await api.ranking(code, token)
      setData(r); setError('')
      store.syncGroupMeta(r.group)
    } catch (e) {
      if (e.status === 401 || e.status === 403) return store.leaveGroup() // sessão perdida: volta para a tela de grupo
      setError(e.message)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, token])

  useEffect(() => {
    load()
    const t = setInterval(load, 20000)
    return () => clearInterval(t)
  }, [load])

  return { data, error, reload: load }
}

function Shell({ store }) {
  const { state } = store
  const [tab, setTab] = useState('home')
  const [logOpen, setLogOpen] = useState(false)
  const rank = useRanking(store)

  const stats = computeStats(state)
  const idx = Math.min(Math.max(dayIndex(state.start), 1), 30)
  const go = (t) => { setTab(t); window.scrollTo(0, 0) }
  const openLog = () => setLogOpen(true)

  // Sincroniza pontos com o servidor (debounce) sempre que o progresso muda.
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
          <span className="w-10 h-10 rounded-lg bg-sky-100 text-xl flex items-center justify-center">{state.group.icon}</span>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-slate-900 truncate leading-tight">{state.group.name}</p>
            <p className="text-[11px] text-slate-400">Temporada {state.season} · Dia {idx}/30</p>
          </div>
          <div className="text-right"><p className="text-[10px] text-slate-400 leading-none">Total</p><p className="font-semibold text-slate-900">{stats.total} pts</p></div>
          <button onClick={() => store.setting('dark')} aria-label="Alternar tema" className="w-10 h-10 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600">
            {state.settings.dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </header>

      <main className="max-w-[552px] mx-auto px-4 pt-5 pb-32">
        {tab === 'home' && <Home state={state} stats={stats} position={rank.data?.me.rank} openLog={openLog} goLearn={() => go('learn')} />}
        {tab === 'today' && <Today state={state} stats={stats} openLog={openLog} saveStreak={store.saveStreak} />}
        {tab === 'ranking' && <Ranking state={state} stats={stats} rank={rank} />}
        {tab === 'profile' && <Profile state={state} stats={stats} actions={store} rank={rank.data} />}
        {tab === 'learn' && <Learn onBack={() => go('home')} />}
      </main>

      <nav className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-slate-200">
        <div className="max-w-[552px] mx-auto grid grid-cols-5 items-end relative">
          {TABS.map(({ id, label, Icon }) =>
            id === 'fab' ? (
              <div key={id} className="flex justify-center">
                <button onClick={openLog} aria-label="Registrar hábitos" className="-mt-5 w-14 h-14 rounded-xl bg-emerald-600 text-white shadow-lg flex items-center justify-center hover:bg-emerald-500">
                  <Plus className="w-6 h-6" />
                </button>
              </div>
            ) : (
              <button key={id} onClick={() => go(id)} className={`py-2.5 flex flex-col items-center gap-0.5 text-[11px] ${tab === id ? 'text-emerald-600 font-medium' : 'text-slate-400'}`}>
                <Icon className="w-5 h-5" />{label}
              </button>
            )
          )}
        </div>
      </nav>

      {logOpen && <LogSheet state={state} onChange={store.logToday} onClose={() => setLogOpen(false)} />}
    </div>
  )
}

export default function App() {
  const store = useStore()
  const { state } = store
  if (!state.profile) return <Onboarding onFinish={store.saveProfile} />
  // Quem tinha grupo só local (versão sem servidor) precisa entrar de novo: state.member ausente.
  if (!state.group || !state.member) return <GroupSetup onCreate={store.createGroup} onJoin={store.joinGroup} initialCode={new URLSearchParams(location.search).get('convite') || ''} />
  return <Shell store={store} />
}
