import { useState } from 'react'
import { ArrowRight, ArrowLeft, Users, Plus, Check, Sparkles } from 'lucide-react'
import { AVATARS, GROUP_ICONS, OBJECTIVES, ACTIVITY_LEVELS, SEX_OPTIONS, bmi } from './config.js'
import { Brand, Card, PrimaryBtn, Field, inputCls, Disclaimer, TONES } from './ui.jsx'

const Nav = ({ step, setStep, onNext, disabled, last }) => (
  <div className="flex gap-2 mt-5">
    {step > 0 && (
      <button onClick={() => setStep(step - 1)} className="h-12 w-14 rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center">
        <ArrowLeft className="w-4 h-4" />
      </button>
    )}
    <PrimaryBtn onClick={onNext} disabled={disabled}>
      {last ? 'Começar desafio' : 'Continuar'} <ArrowRight className="w-4 h-4" />
    </PrimaryBtn>
  </div>
)

export function Onboarding({ onFinish }) {
  const [step, setStep] = useState(0)
  const [p, setP] = useState({
    name: '', avatar: AVATARS[0], age: '', sex: SEX_OPTIONS[0], height: '', weight: '', goalWeight: '',
    activity: 'Moderado', waterGoal: 2250, sleepGoal: 7.5, objectives: ['water', 'sleep', 'wellbeing'],
  })
  const up = (patch) => setP(s => ({ ...s, ...patch }))
  const num = (v) => (v === '' ? '' : Number(v))
  const imc = bmi(Number(p.weight), Number(p.height))

  const valid = [
    p.name.trim().length > 0,
    Number(p.age) > 0 && Number(p.height) > 0 && Number(p.weight) > 0,
    true,
    p.objectives.length > 0,
  ][step]

  const next = () => {
    if (step < 3) return setStep(step + 1)
    onFinish({
      ...p, name: p.name.trim(), age: Number(p.age), height: Number(p.height), weight: Number(p.weight),
      goalWeight: p.goalWeight === '' ? null : Number(p.goalWeight),
    })
  }

  return (
    <div className="max-w-[592px] mx-auto px-4 py-10 min-h-screen flex flex-col justify-center">
      <Brand />
      <Card className="p-6">
        <div className="flex gap-2 mb-8">
          {[0, 1, 2, 3].map(i => <div key={i} className={`h-1 flex-1 rounded-full ${i <= step ? 'bg-emerald-500' : 'bg-slate-200'}`} />)}
        </div>

        {step === 0 && (
          <>
            <h1 className="text-2xl font-semibold text-slate-900">Vamos começar</h1>
            <p className="text-sm text-slate-500 mb-4">Como você quer ser chamado?</p>
            <input className={inputCls} placeholder="Nome ou apelido" maxLength={30} value={p.name} onChange={e => up({ name: e.target.value })} />
            <p className="text-sm font-medium text-slate-700 mt-5 mb-2">Avatar</p>
            <div className="grid grid-cols-6 gap-2">
              {AVATARS.map(a => (
                <button key={a} onClick={() => up({ avatar: a })}
                  className={`aspect-square rounded-lg text-2xl border-2 ${a === p.avatar ? 'bg-emerald-100 border-emerald-400' : 'bg-slate-100 border-transparent hover:bg-slate-200'}`}>{a}</button>
              ))}
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <h1 className="text-2xl font-semibold text-slate-900">Seus dados</h1>
            <p className="text-sm text-slate-500 mb-4">Usados só para o seu IMC. Ficam privados no seu celular.</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Idade"><input type="number" min="1" className={inputCls} value={p.age} onChange={e => up({ age: num(e.target.value) })} /></Field>
              <Field label="Sexo (opcional)">
                <select className={inputCls} value={p.sex} onChange={e => up({ sex: e.target.value })}>
                  {SEX_OPTIONS.map(o => <option key={o}>{o}</option>)}
                </select>
              </Field>
              <Field label="Altura (cm)"><input type="number" min="50" className={inputCls} value={p.height} onChange={e => up({ height: num(e.target.value) })} /></Field>
              <Field label="Peso atual (kg)"><input type="number" min="10" className={inputCls} value={p.weight} onChange={e => up({ weight: num(e.target.value) })} /></Field>
              <Field label="Meta de peso (opcional)"><input type="number" min="10" className={inputCls} value={p.goalWeight} onChange={e => up({ goalWeight: num(e.target.value) })} /></Field>
              <Field label="Nível de atividade">
                <select className={inputCls} value={p.activity} onChange={e => up({ activity: e.target.value })}>
                  {ACTIVITY_LEVELS.map(o => <option key={o}>{o}</option>)}
                </select>
              </Field>
            </div>
            {imc && (
              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 flex items-center justify-between">
                <div><p className="text-xs text-slate-500">Seu IMC</p><p className="text-2xl font-bold text-slate-900">{imc.value}</p></div>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${TONES[imc.tone]}`}>{imc.label}</span>
              </div>
            )}
          </>
        )}

        {step === 2 && (
          <>
            <h1 className="text-2xl font-semibold text-slate-900">Metas diárias</h1>
            <p className="text-sm text-slate-500 mb-5">Personalize seus alvos de água e sono.</p>
            <p className="text-sm font-medium text-slate-800 mb-2">💧 Meta de água: {p.waterGoal} ml</p>
            <input type="range" min="1000" max="4000" step="250" value={p.waterGoal} onChange={e => up({ waterGoal: Number(e.target.value) })} className="w-full accent-sky-500 mb-6" />
            <p className="text-sm font-medium text-slate-800 mb-2">😴 Meta de sono: {p.sleepGoal}h</p>
            <input type="range" min="5" max="10" step="0.5" value={p.sleepGoal} onChange={e => up({ sleepGoal: Number(e.target.value) })} className="w-full accent-indigo-500" />
          </>
        )}

        {step === 3 && (
          <>
            <h1 className="text-2xl font-semibold text-slate-900">Seus objetivos</h1>
            <p className="text-sm text-slate-500 mb-4">Escolha o que quer melhorar.</p>
            <div className="space-y-2.5">
              {OBJECTIVES.map(o => {
                const on = p.objectives.includes(o.id)
                return (
                  <button key={o.id} onClick={() => up({ objectives: on ? p.objectives.filter(x => x !== o.id) : [...p.objectives, o.id] })}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border text-left text-sm font-medium ${on ? 'bg-emerald-50 border-emerald-400' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
                    <span className="text-xl">{o.emoji}</span>
                    <span className="flex-1">{o.label}</span>
                    {on && <Sparkles className="w-4 h-4 text-emerald-500" />}
                  </button>
                )
              })}
            </div>
          </>
        )}

        <Nav step={step} setStep={setStep} onNext={next} disabled={!valid} last={step === 3} />
      </Card>
      <Disclaimer />
    </div>
  )
}

const Row = ({ icon, title, sub, onClick, tone }) => (
  <button onClick={onClick} className="w-full flex items-center gap-4 p-4 rounded-xl border border-slate-200 bg-white text-left hover:bg-slate-50 shadow-sm">
    <span className={`w-12 h-12 rounded-lg flex items-center justify-center ${tone}`}>{icon}</span>
    <span><span className="block font-semibold text-slate-900">{title}</span><span className="block text-sm text-slate-400">{sub}</span></span>
  </button>
)

export function GroupSetup({ onCreate, onJoin, initialCode = '' }) {
  const [mode, setMode] = useState(initialCode ? 'join' : 'menu')
  const [name, setName] = useState('')
  const [icon, setIcon] = useState(GROUP_ICONS[0])
  const [code, setCode] = useState(initialCode)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const run = async (fn) => {
    setBusy(true); setError('')
    try { await fn() } catch (e) { setError(e.message); setBusy(false) }
  }
  const back = () => { setMode('menu'); setError('') }

  return (
    <div className="max-w-[592px] mx-auto px-4 py-10 min-h-screen flex flex-col justify-center">
      <div className="text-center mb-6">
        <div className="w-16 h-16 rounded-xl bg-emerald-600 text-white mx-auto flex items-center justify-center mb-3"><Users className="w-7 h-7" /></div>
        <h1 className="text-2xl font-semibold text-slate-900">Monte seu grupo</h1>
        <p className="text-sm text-slate-400">Crie ou entre em um desafio de 30 dias</p>
      </div>

      {mode === 'menu' && (
        <div className="space-y-3">
          <Row icon={<Plus className="w-5 h-5 text-emerald-600" />} tone="bg-emerald-50" title="Criar grupo" sub="Comece um novo desafio" onClick={() => setMode('create')} />
          <Row icon={<ArrowRight className="w-5 h-5 text-sky-600" />} tone="bg-sky-50" title="Entrar com código" sub="Use um código de convite" onClick={() => setMode('join')} />
        </div>
      )}

      {mode === 'create' && (
        <Card className="p-6">
          <Field label="Nome do grupo"><input className={inputCls} maxLength={30} value={name} onChange={e => setName(e.target.value)} placeholder="Ex.: Enfermagem 2026" /></Field>
          <p className="text-sm font-medium text-slate-700 mt-5 mb-2">Ícone do grupo</p>
          <div className="grid grid-cols-5 gap-2 mb-5">
            {GROUP_ICONS.map(i => (
              <button key={i} onClick={() => setIcon(i)}
                className={`aspect-square rounded-lg text-2xl border-2 ${i === icon ? 'bg-emerald-100 border-emerald-400' : 'bg-slate-100 border-transparent hover:bg-slate-200'}`}>{i}</button>
            ))}
          </div>
          {error && <p role="alert" className="text-sm text-rose-600 mb-3">{error}</p>}
          <PrimaryBtn disabled={!name.trim() || busy} onClick={() => run(() => onCreate(name.trim(), icon))}>{busy ? 'Criando…' : 'Criar e gerar convite'}</PrimaryBtn>
          <button onClick={back} className="w-full text-sm text-slate-400 mt-4">Voltar</button>
        </Card>
      )}

      {mode === 'join' && (
        <Card className="p-6">
          <Field label="Código de convite"><input className={`${inputCls} font-mono uppercase`} value={code} onChange={e => setCode(e.target.value)} placeholder="EXEMP30-6F0" /></Field>
          <div className="h-5" />
          {error && <p role="alert" className="text-sm text-rose-600 mb-3">{error}</p>}
          <PrimaryBtn disabled={code.trim().length < 4 || busy} onClick={() => run(() => onJoin(code.trim()))}><Check className="w-4 h-4" /> {busy ? 'Entrando…' : 'Entrar no grupo'}</PrimaryBtn>
          <button onClick={back} className="w-full text-sm text-slate-400 mt-4">Voltar</button>
        </Card>
      )}
    </div>
  )
}
