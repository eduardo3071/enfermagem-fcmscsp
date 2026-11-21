import { useState } from 'react'
import { ArrowRight, ArrowLeft, Users, Plus, Check, Sparkles, KeyRound, Info } from 'lucide-react'
import { AVATARS, GROUP_ICONS, OBJECTIVES, ACTIVITY_LEVELS, SEX_OPTIONS, PRIVACY_VERSION, bmi, suggestWater, suggestSleep } from './config.js'
import { Brand, Card, PrimaryBtn, Field, inputCls, Disclaimer, TONES } from './ui.jsx'
import { Privacy } from './Privacy.jsx'

const Nav = ({ step, setStep, onNext, disabled, last }) => (
  <div className="flex gap-2 mt-5">
    {step > 0 && (
      <button onClick={() => setStep(step - 1)} aria-label="Voltar" className="h-12 w-14 rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center">
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
  const [showPrivacy, setShowPrivacy] = useState(false)
  const [consent, setConsent] = useState(false)
  const [goalsTouched, setGoalsTouched] = useState(false)
  const [p, setP] = useState({
    name: '', avatar: AVATARS[0], age: '', sex: SEX_OPTIONS[0], height: '', weight: '', goalWeight: '',
    activity: 'Moderado', waterGoal: 2250, sleepGoal: 7.5, objectives: ['water', 'sleep', 'wellbeing'],
  })
  const up = (patch) => setP(s => ({ ...s, ...patch }))
  const num = (v) => (v === '' ? '' : Number(v))
  const imc = bmi(Number(p.weight), Number(p.height))
  const sugWater = suggestWater(p.weight, p.activity)
  const sugSleep = suggestSleep(p.age)

  const valid = [
    p.name.trim().length > 0 && consent,
    Number(p.age) > 0 && Number(p.height) > 0 && Number(p.weight) > 0,
    true,
    p.objectives.length > 0,
  ][step]

  const next = () => {
    if (step === 1 && !goalsTouched) up({ waterGoal: sugWater, sleepGoal: sugSleep }) // metas começam na sugestão
    if (step < 3) return setStep(step + 1)
    onFinish({
      ...p, name: p.name.trim(), age: Number(p.age), height: Number(p.height), weight: Number(p.weight),
      goalWeight: p.goalWeight === '' ? null : Number(p.goalWeight),
      consent: { version: PRIVACY_VERSION, at: new Date().toISOString() },
    })
  }

  if (showPrivacy) return <div className="max-w-[552px] mx-auto px-4 py-6"><Privacy onBack={() => setShowPrivacy(false)} /></div>

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
                <button key={a} onClick={() => up({ avatar: a })} aria-label={`Avatar ${a}`} aria-pressed={a === p.avatar}
                  className={`aspect-square rounded-lg text-2xl border-2 ${a === p.avatar ? 'bg-emerald-100 border-emerald-400 text-black' : 'bg-slate-100 border-transparent hover:bg-slate-200'}`}>{a}</button>
              ))}
            </div>
            <label className="flex items-start gap-3 mt-6 text-sm text-slate-600 cursor-pointer">
              <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} className="mt-0.5 w-5 h-5 accent-emerald-600 shrink-0" />
              <span>Li e aceito a <button type="button" onClick={() => setShowPrivacy(true)} className="text-emerald-600 underline">Política de Privacidade</button>. Meu peso e IMC ficam só no meu aparelho.</span>
            </label>
          </>
        )}

        {step === 1 && (
          <>
            <h1 className="text-2xl font-semibold text-slate-900">Seus dados</h1>
            <p className="text-sm text-slate-500 mb-4">Usados só para o seu IMC e para sugerir metas. Ficam privados no seu celular.</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Idade"><input type="number" inputMode="numeric" min="1" className={inputCls} value={p.age} onChange={e => up({ age: num(e.target.value) })} /></Field>
              <Field label="Sexo (opcional)">
                <select className={inputCls} value={p.sex} onChange={e => up({ sex: e.target.value })}>
                  {SEX_OPTIONS.map(o => <option key={o}>{o}</option>)}
                </select>
              </Field>
              <Field label="Altura (cm)"><input type="number" inputMode="numeric" min="50" className={inputCls} value={p.height} onChange={e => up({ height: num(e.target.value) })} /></Field>
              <Field label="Peso atual (kg)"><input type="number" inputMode="decimal" min="10" className={inputCls} value={p.weight} onChange={e => up({ weight: num(e.target.value) })} /></Field>
              <Field label="Meta de peso (opcional)"><input type="number" inputMode="decimal" min="10" className={inputCls} value={p.goalWeight} onChange={e => up({ goalWeight: num(e.target.value) })} /></Field>
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
            <input type="range" aria-label="Meta de água" min="1000" max="4000" step="250" value={p.waterGoal} onChange={e => { setGoalsTouched(true); up({ waterGoal: Number(e.target.value) }) }} className="w-full accent-sky-500 mb-1" />
            <p className="text-xs text-slate-400 mb-6">Sugestão para você: {sugWater} ml (cerca de 35 ml por kg).</p>
            <p className="text-sm font-medium text-slate-800 mb-2">😴 Meta de sono: {p.sleepGoal}h</p>
            <input type="range" aria-label="Meta de sono" min="5" max="10" step="0.5" value={p.sleepGoal} onChange={e => { setGoalsTouched(true); up({ sleepGoal: Number(e.target.value) }) }} className="w-full accent-indigo-500 mb-1" />
            <p className="text-xs text-slate-400">Sugestão para a sua idade: {sugSleep}h. São referências gerais, não orientação médica.</p>
          </>
        )}

        {step === 3 && (
          <>
            <h1 className="text-2xl font-semibold text-slate-900">Seus objetivos</h1>
            <p className="text-sm text-slate-500 mb-4">Escolha o que quer melhorar. Esses hábitos aparecem com a marca “Foco”.</p>
            <div className="space-y-2.5">
              {OBJECTIVES.map(o => {
                const on = p.objectives.includes(o.id)
                return (
                  <button key={o.id} onClick={() => up({ objectives: on ? p.objectives.filter(x => x !== o.id) : [...p.objectives, o.id] })} aria-pressed={on}
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
    <span className={`w-12 h-12 rounded-lg flex items-center justify-center shrink-0 ${tone}`}>{icon}</span>
    <span><span className="block font-semibold text-slate-900">{title}</span><span className="block text-sm text-slate-400">{sub}</span></span>
  </button>
)

const PinField = ({ value, onChange, label = 'PIN de recuperação (4 a 8 números)', autoComplete = 'new-password' }) => (
  <Field label={label}>
    <input type="password" inputMode="numeric" pattern="[0-9]*" maxLength={8} autoComplete={autoComplete} className={inputCls}
      value={value} onChange={e => onChange(e.target.value.replace(/\D/g, ''))} placeholder="••••" />
  </Field>
)
const PinHint = () => (
  <p className="flex gap-2 text-xs text-slate-500 bg-slate-50 rounded-lg p-3 mt-3">
    <KeyRound className="w-4 h-4 shrink-0 mt-0.5" />
    <span>Anote o PIN: ele é a única forma de voltar à sua conta se você trocar de celular ou limpar o navegador.</span>
  </p>
)
const validPin = (p) => /^\d{4,8}$/.test(p)

export function GroupSetup({ onCreate, onJoin, onRecover, initialCode = '', notice = '', defaultName = '' }) {
  const [mode, setMode] = useState(initialCode ? 'join' : 'menu')
  const [name, setName] = useState('')
  const [icon, setIcon] = useState(GROUP_ICONS[0])
  const [code, setCode] = useState(initialCode)
  const [pin, setPin] = useState('')
  const [recName, setRecName] = useState(defaultName)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const run = async (fn) => {
    setBusy(true); setError('')
    try { await fn() } catch (e) { setError(e.message); setBusy(false) }
  }
  const go = (m) => { setMode(m); setError(''); setPin('') }

  return (
    <div className="max-w-[592px] mx-auto px-4 py-10 min-h-screen flex flex-col justify-center">
      <div className="text-center mb-6">
        <div className="w-16 h-16 rounded-xl bg-emerald-600 text-white mx-auto flex items-center justify-center mb-3"><Users className="w-7 h-7" /></div>
        <h1 className="text-2xl font-semibold text-slate-900">Monte seu grupo</h1>
        <p className="text-sm text-slate-400">Crie ou entre em um desafio de 30 dias</p>
      </div>

      {notice && (
        <p role="status" className="flex gap-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
          <Info className="w-4 h-4 shrink-0 mt-0.5" /> {notice}
        </p>
      )}

      {mode === 'menu' && (
        <div className="space-y-3">
          <Row icon={<Plus className="w-5 h-5 text-emerald-600" />} tone="bg-emerald-50" title="Criar grupo" sub="Comece um novo desafio" onClick={() => go('create')} />
          <Row icon={<ArrowRight className="w-5 h-5 text-sky-600" />} tone="bg-sky-50" title="Entrar com código" sub="Use um código de convite" onClick={() => go('join')} />
          <Row icon={<KeyRound className="w-5 h-5 text-amber-600" />} tone="bg-amber-50" title="Recuperar acesso" sub="Já participava? Volte com seu PIN" onClick={() => go('recover')} />
        </div>
      )}

      {mode === 'create' && (
        <Card className="p-6">
          <Field label="Nome do grupo"><input className={inputCls} maxLength={30} value={name} onChange={e => setName(e.target.value)} placeholder="Ex.: Enfermagem 2026" /></Field>
          <p className="text-sm font-medium text-slate-700 mt-5 mb-2">Ícone do grupo</p>
          <div className="grid grid-cols-5 gap-2 mb-5">
            {GROUP_ICONS.map(i => (
              <button key={i} onClick={() => setIcon(i)} aria-label={`Ícone ${i}`} aria-pressed={i === icon}
                className={`aspect-square rounded-lg text-2xl border-2 ${i === icon ? 'bg-emerald-100 border-emerald-400 text-black' : 'bg-slate-100 border-transparent hover:bg-slate-200'}`}>{i}</button>
            ))}
          </div>
          <PinField value={pin} onChange={setPin} />
          <PinHint />
          {error && <p role="alert" className="text-sm text-rose-600 mt-3">{error}</p>}
          <div className="h-4" />
          <PrimaryBtn disabled={!name.trim() || !validPin(pin) || busy} onClick={() => run(() => onCreate(name.trim(), icon, pin))}>{busy ? 'Criando…' : 'Criar e gerar convite'}</PrimaryBtn>
          <button onClick={() => go('menu')} className="w-full text-sm text-slate-400 mt-4">Voltar</button>
        </Card>
      )}

      {mode === 'join' && (
        <Card className="p-6">
          <Field label="Código de convite"><input className={`${inputCls} font-mono uppercase`} value={code} onChange={e => setCode(e.target.value)} placeholder="ENFER-K7M2QX" autoCapitalize="characters" /></Field>
          <div className="h-4" />
          <PinField value={pin} onChange={setPin} />
          <PinHint />
          {error && <p role="alert" className="text-sm text-rose-600 mt-3">{error}</p>}
          <div className="h-4" />
          <PrimaryBtn disabled={code.trim().length < 4 || !validPin(pin) || busy} onClick={() => run(() => onJoin(code.trim(), pin))}><Check className="w-4 h-4" /> {busy ? 'Entrando…' : 'Entrar no grupo'}</PrimaryBtn>
          <button onClick={() => go('menu')} className="w-full text-sm text-slate-400 mt-4">Voltar</button>
        </Card>
      )}

      {mode === 'recover' && (
        <Card className="p-6">
          <p className="text-sm text-slate-500 mb-4">Informe o código do grupo, o nome que você usava e o PIN que definiu. Seus pontos e registros voltam; peso e humor voltam apenas como “registrados”.</p>
          <Field label="Código do grupo"><input className={`${inputCls} font-mono uppercase`} value={code} onChange={e => setCode(e.target.value)} placeholder="ENFER-K7M2QX" autoCapitalize="characters" /></Field>
          <div className="h-3" />
          <Field label="Seu nome no grupo"><input className={inputCls} maxLength={30} value={recName} onChange={e => setRecName(e.target.value)} /></Field>
          <div className="h-3" />
          <PinField value={pin} onChange={setPin} label="PIN de recuperação" autoComplete="current-password" />
          {error && <p role="alert" className="text-sm text-rose-600 mt-3">{error}</p>}
          <div className="h-4" />
          <PrimaryBtn disabled={code.trim().length < 4 || !recName.trim() || !validPin(pin) || busy} onClick={() => run(() => onRecover(code.trim(), recName.trim(), pin))}><KeyRound className="w-4 h-4" /> {busy ? 'Verificando…' : 'Recuperar acesso'}</PrimaryBtn>
          <button onClick={() => go('menu')} className="w-full text-sm text-slate-400 mt-4">Voltar</button>
        </Card>
      )}
    </div>
  )
}
