import { useState } from 'react'
import { ChevronDown, ArrowLeft } from 'lucide-react'
import { KDIGO } from './kdigo.js'
import { Card } from './ui.jsx'

function Accordion({ emoji, title, items, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-3 p-4 text-left">
        <span className="text-lg">{emoji}</span>
        <span className="flex-1 text-sm font-semibold text-slate-800">{title}</span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <ul className="px-4 pb-4 space-y-2">
          {items.map((t, i) => <li key={i} className="text-sm text-slate-600 flex gap-2"><span className="text-emerald-500">•</span><span>{t}</span></li>)}
        </ul>
      )}
    </div>
  )
}

function Table({ rows, head }) {
  return (
    <table className="w-full text-sm">
      <thead><tr className="text-left text-xs text-slate-500">{head.map(h => <th key={h} className="pb-2 font-medium">{h}</th>)}</tr></thead>
      <tbody>
        {rows.map(r => (
          <tr key={r[0]} className="border-t border-slate-100">
            <td className="py-1.5 font-semibold text-emerald-700">{r[0]}</td>
            {r.slice(1).map((c, i) => <td key={i} className="py-1.5 text-slate-600">{c}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function Learn({ onBack }) {
  const K = KDIGO
  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-slate-500"><ArrowLeft className="w-4 h-4" /> Voltar</button>
      <Card>
        <p className="text-xs font-medium text-sky-600">KDIGO 2024</p>
        <h1 className="font-semibold text-slate-900">Doença Renal Crônica</h1>
        <p className="text-sm text-slate-600 mt-1">{K.intro}</p>
      </Card>

      <Card>
        <h2 className="font-semibold text-slate-900 text-sm mb-3">Diagnóstico: sistema CGA</h2>
        <div className="space-y-2 mb-4">
          {K.cga.map(c => (
            <div key={c.k} className="flex gap-3">
              <span className="w-8 h-8 shrink-0 rounded-lg bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center">{c.k}</span>
              <p className="text-sm text-slate-600"><b className="text-slate-800">{c.t}.</b> {c.d}</p>
            </div>
          ))}
        </div>
        <Table head={['Estágio', 'TFGe', 'Significado']} rows={K.estagiosG} />
        <div className="h-3" />
        <Table head={['Estágio', 'RAC', 'Significado']} rows={K.estagiosA} />
        <p className="text-xs text-amber-700 bg-amber-50 rounded-lg p-2.5 mt-4">{K.risco}</p>
      </Card>

      {K.sections.map((s, i) => <Accordion key={s.id} {...s} defaultOpen={i === 0} />)}

      <h2 className="font-semibold text-slate-900 text-sm pt-2">3C. Os 4 pilares que protegem o rim</h2>
      {K.pilares.map(p => (
        <div key={p.n} className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3 mb-2">
            <span className="w-7 h-7 rounded-full bg-sky-500 text-white text-sm font-bold flex items-center justify-center">{p.n}</span>
            <div><p className="text-sm font-semibold text-slate-800">{p.t}</p><p className="text-xs text-slate-500">{p.sub}</p></div>
          </div>
          <ul className="space-y-1.5">
            {p.items.map((t, i) => <li key={i} className="text-sm text-slate-600 flex gap-2"><span className="text-sky-500">•</span><span>{t}</span></li>)}
          </ul>
        </div>
      ))}

      {K.outros.map(o => <Accordion key={o.title} emoji={o.emoji} title={o.title} items={o.items} />)}
      <Accordion emoji="💊" title="4. Medicamentos na DRC" items={K.medicamentos} />
      <Accordion emoji="🤝" title="5. Modelo ideal de cuidado" items={K.cuidado} />
      <Accordion emoji="🆕" title="O que mudou de 2012 para 2024" items={K.mudancas} />

      <div className="rounded-xl bg-emerald-600 text-white p-4">
        <p className="text-xs font-medium opacity-80 mb-1">Resumo em 1 frase</p>
        <p className="text-sm">{K.resumo}</p>
      </div>
    </div>
  )
}
